---
id: sec-secrets-management
title: Secrets Management
tags: [security, secrets, configuration, devops]
level: intermediate
stacks: [all]
---

# Secrets Management

## Problem

Hardcoded secrets in code or config files get committed to version control, exposed in logs, and leaked through breaches. Poor secret management is a top cause of security incidents.

## When to use

- API keys, tokens, credentials
- Database connection strings
- Encryption keys
- Third-party service credentials
- Any sensitive configuration

## Solution

1. **Never hardcode secrets**
   - No secrets in source code
   - No secrets in docker images
   - No secrets in git history
   - Use environment variables or secret managers

2. **Use secret management tools**
   - HashiCorp Vault
   - AWS Secrets Manager / Parameter Store
   - Azure Key Vault
   - Google Secret Manager
   - Kubernetes Secrets (with encryption)

3. **Implement access control**
   - Principle of least privilege
   - Separate secrets per environment
   - Audit access logs
   - Rotate secrets regularly

4. **Handle secrets in CI/CD**
   - Use CI/CD secret variables
   - Never echo/print secrets
   - Mask in logs automatically

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
