---
id: checklist-security-review
title: Security Review Checklist
description: Comprehensive security assessment checklist for backend applications
category: checklists
tags:
  - security
  - owasp
  - review
  - vulnerabilities
  - appsec
version: 2.0.0
scope: security
level: intermediate
maturity: stable
stacks:
  - all
sources:
  - https://owasp.org/www-project-top-ten/
  - https://cheatsheetseries.owasp.org/
  - https://cwe.mitre.org/top25/
  - https://www.nist.gov/cyberframework
---

# Security Review Checklist

Use this checklist for security review before deploying to production.

---

## 🔐 Authentication (OWASP A07)

### Password Security
- [ ] Passwords hashed with Argon2id (preferred) or bcrypt
- [ ] Cost factor appropriate (bcrypt ≥ 12, Argon2 tuned)
- [ ] No MD5/SHA1/SHA256 for password hashing
- [ ] Password requirements enforced (length ≥ 8, no common passwords)
- [ ] Password breach check (HaveIBeenPwned API or similar)

### Session Management
- [ ] Session tokens cryptographically random (256-bit entropy)
- [ ] Session ID rotated after login
- [ ] Session timeout configured (idle + absolute)
- [ ] Secure, HttpOnly, SameSite flags on cookies
- [ ] Session invalidation on logout (server-side)

### JWT Security
- [ ] Algorithm explicitly validated (no "none" accepted)
- [ ] Signature verified before trusting claims
- [ ] Expiration (exp) claim enforced
- [ ] Issuer (iss) and Audience (aud) validated
- [ ] Short-lived access tokens (< 15 mins)
- [ ] Refresh token rotation implemented
- [ ] JWTs not stored in localStorage (use httpOnly cookies)

### Multi-Factor Authentication
- [ ] MFA available for sensitive accounts
- [ ] TOTP implementation follows RFC 6238
- [ ] Backup codes provided (hashed storage)
- [ ] MFA bypass protection (social engineering)

### Account Protection
- [ ] Account lockout after failed attempts (5-10)
- [ ] Progressive delays on failed login
- [ ] Lockout notification to user
- [ ] CAPTCHA after suspicious activity
- [ ] Credential stuffing protection

---

## 🛡️ Authorization (OWASP A01, A04)

### Access Control
- [ ] All access controls enforced server-side
- [ ] Default deny (explicit allow required)
- [ ] Principle of least privilege applied
- [ ] Resource-level permissions checked

### IDOR Prevention (Insecure Direct Object Reference)
- [ ] Every object access validated against user context
- [ ] UUIDs preferred over sequential IDs (defense in depth)
- [ ] Horizontal privilege escalation tested
- [ ] Vertical privilege escalation tested

### Role-Based Access Control
- [ ] Roles defined with minimal permissions
- [ ] Admin functions require extra verification (step-up auth)
- [ ] Role changes require re-authentication
- [ ] Sensitive operations have audit trail

### Function Level Security
- [ ] Admin endpoints protected (not just hidden)
- [ ] API versioning doesn't expose old auth
- [ ] Mass assignment/over-posting prevented
- [ ] Indirect reference maps for sensitive resources

---

## 💉 Injection Prevention (OWASP A03)

### SQL Injection
- [ ] All SQL uses parameterized queries/prepared statements
- [ ] ORM configured safely (no raw queries without params)
- [ ] Dynamic table/column names validated against allowlist
- [ ] Stored procedures use parameterized inputs
- [ ] Database user has minimal permissions

### NoSQL Injection
- [ ] Query operators sanitized ($where, $regex blocked)
- [ ] Object IDs validated
- [ ] Aggregation pipeline inputs sanitized

### Command Injection
- [ ] No shell execution with user input
- [ ] If required: strict allowlist validation
- [ ] subprocess called without shell=True
- [ ] Arguments passed as array, not string

### XSS (Cross-Site Scripting)
- [ ] Output encoding for context (HTML, JS, URL, CSS)
- [ ] Content Security Policy (CSP) header configured
- [ ] Modern framework auto-escaping enabled
- [ ] User input in URLs validated
- [ ] DOM-based XSS reviewed

### Template Injection
- [ ] User input never in template expressions
- [ ] Template engine sandboxed
- [ ] SSTI (Server-Side Template Injection) tested

### Other Injection
- [ ] LDAP injection prevented (if applicable)
- [ ] XML injection/XXE prevented (if applicable)
- [ ] Path traversal prevented (canonicalize, validate)
- [ ] HTTP header injection prevented
- [ ] Email header injection prevented

---

## 🔑 Sensitive Data (OWASP A02)

### Secrets Management
- [ ] No secrets in source code (git-secrets scan)
- [ ] No secrets in logs (grep test)
- [ ] Secrets in vault/secret manager
- [ ] Different secrets per environment
- [ ] Secrets rotation procedure exists

### Data at Rest
- [ ] Database encrypted (TDE or application-level)
- [ ] Backups encrypted
- [ ] Encryption keys properly managed (not with data)
- [ ] Sensitive columns encrypted (PII, financial)

### Data in Transit
- [ ] TLS 1.2+ enforced (no TLS 1.0/1.1)
- [ ] Strong cipher suites only
- [ ] Certificate validation enabled
- [ ] Internal service communication encrypted

### PII & Privacy
- [ ] PII identified and classified
- [ ] Data minimization applied (only collect needed)
- [ ] Retention policy implemented
- [ ] Right to deletion/export implemented (GDPR)
- [ ] Consent management in place

### Error Handling
- [ ] Error messages don't leak stack traces
- [ ] Error messages don't leak SQL/query info
- [ ] Different errors for "not found" vs "forbidden"
- [ ] Generic "invalid credentials" (no user enumeration)

---

## 🌐 HTTP Security Headers

### Essential Headers
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `Content-Security-Policy` configured (strict)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` or CSP frame-ancestors
- [ ] `X-XSS-Protection: 0` (CSP is better)
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` (formerly Feature-Policy)

### CORS Configuration
- [ ] `Access-Control-Allow-Origin` not wildcard (*) with credentials
- [ ] Allowed origins explicitly listed
- [ ] Methods and headers restricted to needed
- [ ] Preflight requests handled correctly

---

## ⚡ API Security

### Rate Limiting
- [ ] Rate limiting on all endpoints
- [ ] Stricter limits on auth endpoints
- [ ] Rate limit by user AND IP
- [ ] Informative rate limit headers (X-RateLimit-*)
- [ ] Graceful degradation under load

### Input Validation
- [ ] Schema validation (JSON Schema, Zod, etc.)
- [ ] Size limits on all inputs
- [ ] File upload restrictions (type, size)
- [ ] Encoding normalized (UTF-8)
- [ ] Recursive/nested depth limited

### API Design Security
- [ ] No sensitive data in URLs (logged!)
- [ ] Pagination limits enforced
- [ ] GraphQL complexity limits (if applicable)
- [ ] Batch/bulk limits enforced
- [ ] Debug endpoints disabled in production

---

## 🔄 Security Operations

### Logging & Monitoring
- [ ] Authentication events logged
- [ ] Authorization failures logged
- [ ] Sensitive operations logged (audit trail)
- [ ] Log integrity protected (append-only, centralized)
- [ ] Security alerts configured

### Dependency Management
- [ ] Dependencies scanned (Snyk, Dependabot, npm audit)
- [ ] No critical vulnerabilities in dependencies
- [ ] Automatic security updates enabled
- [ ] Transitive dependencies reviewed

### Security Testing
- [ ] SAST (Static Analysis) in CI
- [ ] DAST (Dynamic Analysis) scheduled
- [ ] SCA (Software Composition Analysis) enabled
- [ ] Secret scanning in repositories
- [ ] Penetration testing (annual minimum)

---

## ✅ OWASP Top 10 (2021) Quick Check

| # | Risk | Mitigated | Notes |
|---|------|-----------|-------|
| A01 | Broken Access Control | [ ] | |
| A02 | Cryptographic Failures | [ ] | |
| A03 | Injection | [ ] | |
| A04 | Insecure Design | [ ] | |
| A05 | Security Misconfiguration | [ ] | |
| A06 | Vulnerable Components | [ ] | |
| A07 | Auth Failures | [ ] | |
| A08 | Integrity Failures | [ ] | |
| A09 | Logging Failures | [ ] | |
| A10 | SSRF | [ ] | |

---

## Sign-Off

| Role | Name | Date | Findings |
|------|------|------|----------|
| Security Engineer | | | |
| Development Lead | | | |
| CISO (if required) | | | |

---

## Sources

- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP ASVS (Application Security Verification Standard)](https://owasp.org/www-project-application-security-verification-standard/)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SANS Top 25](https://www.sans.org/top25-software-errors/)
