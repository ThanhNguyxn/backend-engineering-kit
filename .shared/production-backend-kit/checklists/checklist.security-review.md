---
id: checklist-security-review
title: Security Review Checklist
description: Security assessment checklist for backend applications
category: checklists
tags:
  - security
  - owasp
  - review
  - vulnerabilities
version: 1.0.0
scope: security
level: intermediate
maturity: stable
stacks:
  - all
---

# Security Review Checklist

Use this checklist for security review before deploying to production.

---

## 🔐 Authentication

- [ ] Passwords hashed with bcrypt/Argon2 (not MD5/SHA1)
- [ ] Session tokens are cryptographically random
- [ ] JWT validated properly (signature, expiry, issuer)
- [ ] Multi-factor authentication supported
- [ ] Account lockout after failed attempts

## 🛡️ Authorization

- [ ] Access controls enforced server-side (not just UI)
- [ ] Principle of least privilege applied
- [ ] IDOR vulnerabilities checked (object-level auth)
- [ ] Admin functions protected with extra verification
- [ ] Role changes require re-authentication

## 💉 Injection Prevention

- [ ] SQL queries use parameterized statements
- [ ] NoSQL injection prevented
- [ ] Command injection prevented (no shell exec with user input)
- [ ] XSS prevented (output encoding, CSP headers)
- [ ] LDAP/XML injection considered if applicable

## 🔑 Secrets & Data

- [ ] No secrets in source code or logs
- [ ] Sensitive data encrypted at rest
- [ ] TLS enforced for data in transit
- [ ] PII handled per privacy regulations
- [ ] Error messages don't leak internal details

## 🌐 HTTP Security

- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] CORS policy restrictive and appropriate
- [ ] Rate limiting enabled on auth endpoints
- [ ] Debug mode disabled in production

---

## Sources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- CWE Top 25: https://cwe.mitre.org/top25/
