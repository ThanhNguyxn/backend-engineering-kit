---
id: sec-threat-checklist
title: Security Threat Checklist
tags: [security, owasp, threats, assessment]
level: advanced
stacks: [all]
---

# Security Threat Checklist

## Problem

Security is often an afterthought, leading to vulnerabilities that could have been prevented with systematic review. Teams lack structured approach to identify and address common threats.

## When to use

- New application security review
- Feature security assessment
- Pre-launch security audit
- Regular security check-ins
- After security incident

## Solution

1. **Use OWASP Top 10 as baseline**
   - Review against known vulnerability classes
   - Systematic threat identification
   - Prioritize by risk

2. **Apply threat modeling**
   - STRIDE: Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation
   - Data flow diagrams
   - Trust boundary analysis

3. **Automate where possible**
   - SAST (static analysis)
   - DAST (dynamic analysis)
   - Dependency scanning
   - Secret scanning

4. **Create security requirements**
   - Convert threats to testable requirements
   - Include in definition of done
   - Security regression tests

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| One-time security review | Make security continuous |
| Only external threats | Consider insider threats too |
| Ignoring dependencies | Scan all third-party packages |
| No remediation tracking | File tickets, track resolution |
| Security theater | Focus on real risks, not checkboxes |

## Checklist

### Injection
- [ ] SQL injection prevented (parameterized queries)
- [ ] NoSQL injection prevented
- [ ] Command injection prevented
- [ ] LDAP injection prevented
- [ ] XSS (Cross-Site Scripting) prevented

### Authentication
- [ ] Passwords hashed with bcrypt/Argon2
- [ ] Multi-factor authentication supported
- [ ] Session management secure
- [ ] Password reset flow secure
- [ ] Account lockout after failed attempts

### Authorization
- [ ] Access controls enforced server-side
- [ ] Principle of least privilege applied
- [ ] IDOR (Insecure Direct Object Reference) prevented
- [ ] Admin functions properly protected
- [ ] API endpoints have authorization checks

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] TLS enforced for data in transit
- [ ] Secrets not in source code
- [ ] PII properly handled
- [ ] Logging doesn't contain sensitive data

### Configuration
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Debug mode disabled in production
- [ ] Default credentials changed
- [ ] Unnecessary features disabled
- [ ] Error messages don't leak info

### Dependencies
- [ ] Dependencies regularly updated
- [ ] Vulnerability scanning in CI/CD
- [ ] No known vulnerabilities in deps
- [ ] Software bill of materials maintained

## Snippets (Generic)

```
STRIDE Threat Categories:
S - Spoofing: Can attacker pretend to be someone else?
T - Tampering: Can attacker modify data?
R - Repudiation: Can attacker deny actions?
I - Info Disclosure: Can attacker access private data?
D - Denial of Service: Can attacker crash/slow service?
E - Elevation of Privilege: Can attacker gain more access?

Security Review Process:
1. Draw data flow diagram
2. Identify trust boundaries
3. Apply STRIDE to each component
4. Rate risk (likelihood × impact)
5. Define mitigations
6. Track remediation

Minimum Security Headers:
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
X-XSS-Protection: 0 (rely on CSP instead)

Regular Security Activities:
- Weekly: Review dependency alerts
- Monthly: Security awareness reminder
- Quarterly: Penetration testing
- Per release: Security review
- Annually: Full security audit
```

## Sources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- STRIDE Threat Modeling: https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
