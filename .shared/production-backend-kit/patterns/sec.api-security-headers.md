---
id: sec-api-security-headers
title: HTTP Security Headers
tags:
  - security
  - http
  - headers
  - csp
  - cors
level: beginner
stacks:
  - all
scope: security
maturity: stable
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security
  - https://securityheaders.com/
  - https://web.dev/security-headers/
---

# HTTP Security Headers

## Problem

Missing or misconfigured HTTP headers expose applications to:
- Cross-Site Scripting (XSS) attacks
- Clickjacking via iframe embedding
- MIME-type sniffing exploits
- Downgrade attacks to HTTP
- Information leakage about server/framework
- Cross-site data theft

**Headers are your first line of defense - configure them properly!**

## When to use

- **Every web application** - no exceptions
- REST/GraphQL APIs
- Single Page Applications
- Server-rendered websites
- Any HTTP-based service

## Solution

### 1. Essential Security Headers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SECURITY HEADERS QUICK REFERENCE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Header                          │ Purpose                                   │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ Content-Security-Policy         │ Prevent XSS, injection attacks            │
│ Strict-Transport-Security       │ Force HTTPS                               │
│ X-Content-Type-Options          │ Prevent MIME sniffing                     │
│ X-Frame-Options                 │ Prevent clickjacking                      │
│ Referrer-Policy                 │ Control referrer information              │
│ Permissions-Policy              │ Control browser features                  │
│ Cross-Origin-Opener-Policy      │ Isolate browsing context                  │
│ Cross-Origin-Resource-Policy    │ Control resource sharing                  │
│ Cross-Origin-Embedder-Policy    │ Enable cross-origin isolation             │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ REMOVE THESE:                   │                                           │
│ X-Powered-By                    │ Reveals server technology                 │
│ Server                          │ Reveals server software                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Content-Security-Policy (CSP)

```typescript
// CSP is the most important security header
// It controls what resources the browser can load

// Strict CSP for SPAs
const strictCSP = [
  "default-src 'self'",                    // Default: only same origin
  "script-src 'self'",                     // Scripts: only same origin
  "style-src 'self' 'unsafe-inline'",      // Styles: same origin + inline (for CSS-in-JS)
  "img-src 'self' data: https:",           // Images: self, data URIs, any HTTPS
  "font-src 'self'",                       // Fonts: same origin
  "connect-src 'self' https://api.example.com", // XHR/Fetch: self + API
  "frame-ancestors 'none'",                // Prevent embedding (clickjacking)
  "base-uri 'self'",                       // Restrict <base> tag
  "form-action 'self'",                    // Restrict form submissions
  "upgrade-insecure-requests",             // Auto-upgrade HTTP to HTTPS
].join('; ');

// CSP for API (simpler)
const apiCSP = [
  "default-src 'none'",                    // APIs shouldn't load any resources
  "frame-ancestors 'none'",
].join('; ');

// CSP with nonce for inline scripts (more secure)
function generateCSPWithNonce(): { header: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('base64');
  
  const header = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,  // Only scripts with this nonce
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  
  return { header, nonce };
}

// Usage in HTML:
// <script nonce="<%= nonce %>">...</script>
```

### 3. Complete Header Configuration

```typescript
import helmet from 'helmet';
import express from 'express';

const app = express();

// Using Helmet (recommended)
app.use(helmet({
  // Content-Security-Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  
  // Strict-Transport-Security
  hsts: {
    maxAge: 31536000,        // 1 year
    includeSubDomains: true,
    preload: true,           // Submit to HSTS preload list
  },
  
  // X-Content-Type-Options: nosniff
  noSniff: true,
  
  // X-Frame-Options: DENY (or SAMEORIGIN)
  frameguard: { action: 'deny' },
  
  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // X-XSS-Protection: 0 (disabled - rely on CSP instead)
  xssFilter: false, // Modern browsers don't need this, CSP is better
  
  // X-Powered-By: removed
  hidePoweredBy: true,
  
  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: 'same-origin' },
  
  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
}));

// Additional headers not covered by Helmet
app.use((req, res, next) => {
  // Permissions-Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', '));
  
  // Cache-Control for sensitive endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  
  next();
});
```

### 4. CORS Configuration

```typescript
import cors from 'cors';

// CORS for APIs
const corsOptions: cors.CorsOptions = {
  // Allowed origins
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.example.com',
      'https://admin.example.com',
    ];
    
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Dev environment - allow localhost
    if (process.env.NODE_ENV === 'development' && 
        origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  
  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-ID',
  ],
  
  // Exposed headers (accessible to JavaScript)
  exposedHeaders: [
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
  ],
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Preflight cache duration
  maxAge: 86400, // 24 hours
  
  // Handle preflight success
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// For specific routes with different CORS
app.use('/api/public', cors({
  origin: '*', // Public API - allow all
  methods: ['GET'],
}));
```

### 5. Python/FastAPI Headers

```python
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # Content-Security-Policy
        response.headers["Content-Security-Policy"] = "; ".join([
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self' https://api.example.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ])
        
        # Strict-Transport-Security
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        
        # Other security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), microphone=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        
        # Remove server info
        if "server" in response.headers:
            del response.headers["server"]
        
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
    expose_headers=["X-Correlation-ID"],
    max_age=86400,
)
```

### 6. Nginx Configuration

```nginx
# /etc/nginx/conf.d/security-headers.conf

# Content-Security-Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;

# Strict-Transport-Security
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# X-Content-Type-Options
add_header X-Content-Type-Options "nosniff" always;

# X-Frame-Options
add_header X-Frame-Options "DENY" always;

# Referrer-Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Permissions-Policy
add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), microphone=()" always;

# Cross-Origin policies
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;

# Remove server info
server_tokens off;
more_clear_headers Server;

# API-specific location
location /api/ {
    # Stricter CSP for API
    add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none';" always;
    
    # No caching for API responses
    add_header Cache-Control "no-store, no-cache, must-revalidate, private" always;
    add_header Pragma "no-cache" always;
    
    # ... proxy settings
}
```

### 7. Header Validation & Testing

```typescript
// Test your headers with this endpoint (dev only!)
app.get('/debug/headers', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).send('Not found');
  }
  
  // List all response headers that will be sent
  const headers = {
    sent: {}, // Will be populated after response
    expected: {
      'Content-Security-Policy': 'should contain default-src',
      'Strict-Transport-Security': 'should have max-age >= 31536000',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY or SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  };
  
  res.json(headers);
});

// Automated header check
async function checkSecurityHeaders(url: string): Promise<{
  passed: string[];
  failed: string[];
  warnings: string[];
}> {
  const response = await fetch(url, { method: 'HEAD' });
  const headers = response.headers;
  
  const checks = [
    {
      name: 'Content-Security-Policy',
      check: () => headers.has('content-security-policy'),
      severity: 'failed',
    },
    {
      name: 'Strict-Transport-Security',
      check: () => {
        const hsts = headers.get('strict-transport-security');
        if (!hsts) return false;
        const maxAge = parseInt(hsts.match(/max-age=(\d+)/)?.[1] || '0');
        return maxAge >= 31536000;
      },
      severity: 'failed',
    },
    {
      name: 'X-Content-Type-Options',
      check: () => headers.get('x-content-type-options') === 'nosniff',
      severity: 'failed',
    },
    {
      name: 'X-Frame-Options',
      check: () => ['DENY', 'SAMEORIGIN'].includes(
        headers.get('x-frame-options')?.toUpperCase() || ''
      ),
      severity: 'warning', // CSP frame-ancestors is preferred
    },
    {
      name: 'No X-Powered-By',
      check: () => !headers.has('x-powered-by'),
      severity: 'warning',
    },
    {
      name: 'No Server version',
      check: () => {
        const server = headers.get('server');
        return !server || !server.match(/\d+\.\d+/);
      },
      severity: 'warning',
    },
  ];
  
  const results = { passed: [], failed: [], warnings: [] };
  
  for (const check of checks) {
    if (check.check()) {
      results.passed.push(check.name);
    } else {
      results[check.severity === 'failed' ? 'failed' : 'warnings'].push(check.name);
    }
  }
  
  return results;
}
```

### 8. CSP Report-Only & Violation Reporting

```typescript
// Start with report-only to test CSP without breaking things
app.use((req, res, next) => {
  const csp = "default-src 'self'; script-src 'self'; report-uri /api/csp-report";
  
  // Report-only mode - violations reported but not enforced
  res.setHeader('Content-Security-Policy-Report-Only', csp);
  
  // Once tested, switch to enforcing:
  // res.setHeader('Content-Security-Policy', csp);
  
  next();
});

// CSP violation report endpoint
app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  const report = req.body['csp-report'];
  
  logger.warn({
    event: 'CSP_VIOLATION',
    documentUri: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
  });
  
  // Track violations in metrics
  metrics.increment('security.csp_violation', {
    directive: report['violated-directive'],
  });
  
  res.status(204).send();
});

// Modern Reporting API (successor to report-uri)
app.use((req, res, next) => {
  res.setHeader('Report-To', JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [
      { url: 'https://api.example.com/reports/csp' }
    ],
  }));
  
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; report-to csp-endpoint"
  );
  
  next();
});
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No CSP | XSS attacks possible | Always configure CSP |
| `unsafe-inline` in script-src | XSS via inline scripts | Use nonces or hashes |
| `*` in CORS origin | Any site can call API | Explicit allowlist |
| Missing HSTS | Downgrade attacks | Enable with preload |
| Exposing server version | Targeted attacks | Remove/hide version |
| Overly permissive CSP | Ineffective protection | Start strict, relax only if needed |
| CORS credentials + `*` origin | Security error | Can't combine these |
| Forgetting `always` in nginx | Headers missing on errors | Use `always` directive |

## Checklist

- [ ] Content-Security-Policy configured
- [ ] CSP tested in report-only mode first
- [ ] Strict-Transport-Security with long max-age
- [ ] HSTS preload submitted (if applicable)
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options or CSP frame-ancestors
- [ ] Referrer-Policy configured
- [ ] Permissions-Policy restricts unused features
- [ ] CORS origins explicitly whitelisted
- [ ] CORS credentials properly configured
- [ ] Server/X-Powered-By headers removed
- [ ] Cache-Control for sensitive responses
- [ ] Headers tested with securityheaders.com
- [ ] CSP violations monitored

## References

- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [SecurityHeaders.com](https://securityheaders.com/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Helmet.js](https://helmetjs.github.io/)
- [HSTS Preload](https://hstspreload.org/)
