# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Best Practices

When using this kit:

1. **Never commit secrets** - Use environment variables or secret managers
2. **Validate all inputs** - Follow the patterns in `sec.*` files
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Review generated code** - AI adapters generate suggestions, not guaranteed secure code

## Dependency Auditing

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (where possible)
npm audit fix
```

## Response Time

We aim to respond to security reports within 48 hours and provide a fix within 7 days for critical issues.
