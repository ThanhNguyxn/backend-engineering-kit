---
id: sec-secrets-management
title: Secrets Management
tags:
  - security
  - secrets
  - configuration
  - devops
  - vault
level: intermediate
stacks:
  - all
scope: security
maturity: stable
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
  - https://developer.hashicorp.com/vault/docs
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/
---

# Secrets Management

## Problem

Hardcoded secrets in code or config files get committed to version control, exposed in logs, and leaked through breaches. Poor secret management is a top cause of security incidents and is easy to prevent with proper tooling.

## When to use

- API keys, tokens, credentials
- Database connection strings
- Encryption keys
- Third-party service credentials
- Any sensitive configuration
- Certificates and private keys

## Solution

### 1. Secret Storage Solutions

| Solution | Best For | Features |
|----------|----------|----------|
| **HashiCorp Vault** | On-prem, multi-cloud | Dynamic secrets, encryption as service |
| **AWS Secrets Manager** | AWS workloads | Auto-rotation, RDS integration |
| **AWS Parameter Store** | AWS, simpler needs | Cheaper, hierarchical, versioned |
| **Azure Key Vault** | Azure workloads | HSM-backed, managed identities |
| **Google Secret Manager** | GCP workloads | IAM integration, versioning |
| **1Password/Doppler** | Dev teams, CI/CD | Easy adoption, good DX |

### 2. Runtime Secret Injection

**AWS Secrets Manager (Node.js):**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

interface DatabaseSecret {
  username: string;
  password: string;
  host: string;
  port: number;
}

async function getSecret<T>(secretId: string): Promise<T> {
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);
  return JSON.parse(response.SecretString!);
}

// Cache secrets with TTL
const secretCache = new Map<string, { value: any; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSecret<T>(secretId: string): Promise<T> {
  const cached = secretCache.get(secretId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  
  const secret = await getSecret<T>(secretId);
  secretCache.set(secretId, { value: secret, expiresAt: Date.now() + CACHE_TTL });
  return secret;
}

// Usage
const dbSecret = await getCachedSecret<DatabaseSecret>('prod/database/credentials');
```

**HashiCorp Vault (Node.js):**
```typescript
import vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN, // Or use AppRole auth
});

async function getVaultSecret(path: string): Promise<Record<string, string>> {
  const result = await vaultClient.read(`secret/data/${path}`);
  return result.data.data;
}

// AppRole authentication (recommended for apps)
async function authenticateAppRole(): Promise<string> {
  const result = await vaultClient.approleLogin({
    role_id: process.env.VAULT_ROLE_ID,
    secret_id: process.env.VAULT_SECRET_ID,
  });
  return result.auth.client_token;
}
```

### 3. Kubernetes Secrets (with External Secrets Operator)

```yaml
# ExternalSecret syncs from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-secret
  data:
    - secretKey: username
      remoteRef:
        key: prod/database/credentials
        property: username
    - secretKey: password
      remoteRef:
        key: prod/database/credentials
        property: password
```

### 4. Secret Rotation

```typescript
// Automated rotation with AWS Secrets Manager
// This Lambda is triggered by Secrets Manager
export async function handler(event: RotationEvent): Promise<void> {
  const { SecretId, ClientRequestToken, Step } = event;
  
  switch (Step) {
    case 'createSecret':
      // Generate new credentials
      const newPassword = generateSecurePassword();
      await secretsManager.putSecretValue({
        SecretId,
        ClientRequestToken,
        SecretString: JSON.stringify({ ...currentSecret, password: newPassword }),
        VersionStage: 'AWSPENDING',
      });
      break;
      
    case 'setSecret':
      // Update the database with new credentials
      await updateDatabasePassword(newPassword);
      break;
      
    case 'testSecret':
      // Verify new credentials work
      await testDatabaseConnection(newPassword);
      break;
      
    case 'finishSecret':
      // Mark new version as current
      await secretsManager.updateSecretVersionStage({
        SecretId,
        VersionStage: 'AWSCURRENT',
        MoveToVersionId: ClientRequestToken,
      });
      break;
  }
}
```

### 5. Git Pre-Commit Hook (Secret Scanning)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
  
  - repo: https://github.com/awslabs/git-secrets
    rev: master
    hooks:
      - id: git-secrets
```

```bash
# Initialize git-secrets
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'private_key'
git secrets --add 'api[_-]?key'
git secrets --add 'password\s*=\s*["\'][^"\']+["\']'
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Secrets in git history | Use git-secrets, scan before commit |
| Logging credentials | Sanitize logs, mask patterns |
| Same secrets across envs | Unique per environment |
| Never rotating secrets | Schedule rotation quarterly |
| Over-sharing access | Least privilege, need-to-know |

## Checklist

- [ ] No secrets in source code
- [ ] No secrets in docker images
- [ ] Secrets stored in dedicated tool
- [ ] Environment-specific secrets
- [ ] Secret access is audited
- [ ] Rotation schedule defined
- [ ] CI/CD secrets masked in logs
- [ ] Git pre-commit hooks scan for secrets
- [ ] Emergency rotation procedure documented
- [ ] Access granted on need-to-know basis

## Snippets (Generic)

```
Environment Variables:
# .env (not committed)
DATABASE_URL=postgres://user:pass@host/db
API_KEY=secret_key_here

# Application reads from env
db_url = os.environ.get('DATABASE_URL')

Secret Manager Pattern:
1. Store secret in vault/manager
2. Application authenticates to secret service
3. Fetch secret at runtime
4. Cache with TTL (short-lived)
5. Re-fetch on expiry or rotation

AWS Secrets Manager:
aws secretsmanager get-secret-value --secret-id prod/db/password

Kubernetes Secret (encoded):
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  password: base64-encoded-value

Git Pre-commit Hook:
# .pre-commit-config.yaml
- repo: https://github.com/awslabs/git-secrets
  hooks:
    - id: git-secrets

Rotation Steps:
1. Generate new secret
2. Add new secret (keep old active)
3. Update applications to use new
4. Verify all using new secret
5. Revoke old secret
```

## Sources

- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- HashiCorp Vault: https://www.vaultproject.io/
- AWS Secrets Manager: https://aws.amazon.com/secrets-manager/
- 12 Factor App - Config: https://12factor.net/config
