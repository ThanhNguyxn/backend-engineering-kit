---
id: sec-password-storage
title: Password Storage
tags: [security, passwords, hashing, authentication]
level: intermediate
stacks: [all]
---

# Password Storage

## Problem

Weak password storage leads to credential theft and account compromise. Plaintext or poorly hashed passwords, once leaked, expose users across multiple sites due to password reuse.

## When to use

- User registration systems
- Any password-based authentication
- Migrating legacy password systems
- Internal admin accounts
- Service account credentials

## Solution

1. **Use modern hashing algorithms**
   - **Argon2id**: Recommended (winner of PHC)
   - **bcrypt**: Widely supported, proven
   - **scrypt**: Memory-hard alternative
   - Never: MD5, SHA1, SHA256 alone

2. **Configure work factors**
   - Target ~250ms hash time
   - Increase as hardware improves
   - Balance security vs UX

3. **Implement properly**
   - Generate unique salt per password
   - Store algorithm parameters with hash
   - Upgrade hashes on login

4. **Add complementary controls**
   - Password strength requirements
   - Breach detection (HaveIBeenPwned)
   - Rate limiting on login attempts
   - Multi-factor authentication

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
