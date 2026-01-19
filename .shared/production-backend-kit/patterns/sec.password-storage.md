---
id: sec-password-storage
title: Password Storage
tags:
  - security
  - passwords
  - hashing
  - authentication
  - argon2
  - bcrypt
level: intermediate
stacks:
  - all
scope: security
maturity: stable
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
  - https://www.password-hashing.net/
  - https://github.com/P-H-C/phc-winner-argon2
---

# Password Storage

## Problem

Weak password storage leads to credential theft and account compromise. Plaintext or poorly hashed passwords, once leaked, expose users across multiple sites due to password reuse. This is consistently in OWASP Top 10.

## When to use

- User registration systems
- Any password-based authentication
- Migrating legacy password systems
- Internal admin accounts
- API key/secret storage (hash if one-way needed)

## Solution

### 1. Algorithm Selection (in order of preference)

| Algorithm | Recommendation | Notes |
|-----------|----------------|-------|
| **Argon2id** | ✅ Best | PHC winner, memory-hard, resists GPU/ASIC |
| **bcrypt** | ✅ Good | Proven, wide support, 72-byte limit |
| **scrypt** | ✅ Good | Memory-hard, more complex to tune |
| PBKDF2-SHA256 | ⚠️ Legacy | Only if required (FIPS), needs high iterations |
| SHA-256/512 | ❌ Never | Too fast, even with salt |
| MD5/SHA1 | ❌ Never | Cryptographically broken |

### 2. Argon2id Configuration (OWASP Recommended)

```typescript
// Recommended: tune to take ~250-500ms on your hardware
const argon2Config = {
  type: argon2.argon2id,      // Hybrid mode (recommended)
  memoryCost: 65536,          // 64 MB (minimum 47104 KB per OWASP)
  timeCost: 3,                // 3 iterations (minimum 1)
  parallelism: 4,             // 4 parallel threads
  hashLength: 32,             // 32 bytes output
  saltLength: 16,             // 16 bytes salt (auto-generated)
};

// Node.js with argon2
import * as argon2 from 'argon2';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argon2Config);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

### 3. bcrypt Configuration

```typescript
import * as bcrypt from 'bcrypt';

// Cost factor: 2^cost iterations. Target 250ms+
// 10 = ~100ms, 12 = ~300ms, 14 = ~1s (tune for your hardware)
const BCRYPT_COST = 12;

async function hashPassword(password: string): Promise<string> {
  // Salt is auto-generated and embedded in hash
  return bcrypt.hash(password, BCRYPT_COST);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Note: bcrypt truncates passwords > 72 bytes
// Pre-hash with SHA-256 if longer passwords needed:
async function hashLongPassword(password: string): Promise<string> {
  const preHash = crypto.createHash('sha256').update(password).digest('base64');
  return bcrypt.hash(preHash, BCRYPT_COST);
}
```

### 4. Password Strength & Breach Detection

```typescript
import { pwnedPassword } from 'hibp';

async function validatePassword(password: string): Promise<void> {
  // Length requirement (NIST recommends 8 min, we prefer 12)
  if (password.length < 12) {
    throw new ValidationError('Password must be at least 12 characters');
  }
  
  // Maximum length (prevent DoS via very long passwords)
  if (password.length > 128) {
    throw new ValidationError('Password must be at most 128 characters');
  }
  
  // Check against breached passwords (HaveIBeenPwned)
  const breachCount = await pwnedPassword(password);
  if (breachCount > 0) {
    throw new ValidationError(
      'This password has appeared in data breaches. Please choose a different password.'
    );
  }
}
```

### 5. Hash Upgrade on Login

```typescript
async function login(email: string, password: string): Promise<User> {
  const user = await db.users.findByEmail(email);
  if (!user) throw new AuthError('Invalid credentials');
  
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(user.id);
    throw new AuthError('Invalid credentials');
  }
  
  // Upgrade legacy hash if needed
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(password);
    await db.users.update(user.id, { passwordHash: newHash });
    logger.info({ event: 'PASSWORD_HASH_UPGRADED', userId: user.id });
  }
  
  return user;
}

function needsRehash(hash: string): boolean {
  // Check if using old algorithm or low cost factor
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    const cost = parseInt(hash.split('$')[2], 10);
    return cost < BCRYPT_COST; // Upgrade if cost too low
  }
  if (!hash.startsWith('$argon2id$')) {
    return true; // Not Argon2id, needs upgrade
  }
  return false;
}
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Using fast hashes (MD5/SHA) | Use bcrypt, Argon2, or scrypt |
| Global salt for all users | Unique salt per password |
| Low work factor | Target 250ms+ hash time |
| Not upgrading old hashes | Re-hash on successful login |
| Timing attacks | Use constant-time comparison |

## Checklist

- [ ] Argon2id or bcrypt used
- [ ] Unique salt per password
- [ ] Work factor targets 250ms+ hash time
- [ ] Password requirements enforced (length, complexity)
- [ ] Compromised password check integrated
- [ ] Rate limiting on login attempts
- [ ] Legacy hashes upgraded on login
- [ ] Password stored in separate secure store
- [ ] Constant-time comparison used
- [ ] MFA supported/encouraged

## Snippets (Generic)

```
Argon2id Configuration:
- Memory: 64 MB (65536 KB)
- Iterations: 3
- Parallelism: 4
- Hash length: 32 bytes
- Salt length: 16 bytes

bcrypt Configuration:
- Work factor (cost): 12-14 (adjust per hardware)
- Auto-generates salt

Hash Storage Format:
$argon2id$v=19$m=65536,t=3,p=4$salt_base64$hash_base64

Password Hashing Steps:
1. Receive plaintext password
2. Validate strength requirements
3. Generate cryptographically random salt
4. Hash with configured algorithm
5. Store full hash string (includes params)

Verification Steps:
1. Retrieve stored hash
2. Parse algorithm and parameters
3. Hash input with same params + salt
4. Constant-time compare result
5. If match and old algorithm → upgrade hash

Password Requirements:
- Minimum length: 12 characters
- No maximum (up to 128)
- Check against breached password list
- No composition rules (allow any chars)

Hash Upgrade on Login:
if verify_password(input, stored_hash):
  if is_legacy_algorithm(stored_hash):
    new_hash = hash_password(input)  # New algorithm
    update_user_password_hash(user, new_hash)
  return login_success()
```

## Sources

- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Password Hashing Competition (Argon2): https://www.password-hashing.net/
- Have I Been Pwned API: https://haveibeenpwned.com/API/v3
- NIST Digital Identity Guidelines: https://pages.nist.gov/800-63-3/sp800-63b.html
