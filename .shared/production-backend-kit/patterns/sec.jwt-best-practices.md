---
id: sec-jwt-best-practices
title: JWT Security Best Practices
tags:
  - security
  - jwt
  - authentication
  - tokens
  - oauth
level: intermediate
stacks:
  - all
scope: security
maturity: stable
version: 2.0.0
sources:
  - https://datatracker.ietf.org/doc/html/rfc7519
  - https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
  - https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/
  - https://curity.io/resources/learn/jwt-best-practices/
---

# JWT Security Best Practices

## Problem

JWTs are widely used but frequently misconfigured, leading to:
- Token forgery via algorithm confusion attacks
- Sensitive data exposure in payloads
- Stolen tokens used indefinitely
- No way to revoke compromised tokens
- XSS attacks stealing tokens from localStorage

**JWTs are not session tokens. Treat them as signed assertions.**

## When to use

- Stateless authentication for APIs
- Service-to-service authentication
- OAuth 2.0 / OpenID Connect implementations
- Short-lived authorization grants
- Passing claims between trusted systems

## When NOT to use

- When you need instant revocation (use sessions)
- Long-lived tokens (>1 hour) without refresh mechanism
- Storing sensitive data (use opaque tokens + backend lookup)
- Simple web apps where sessions work fine

## Solution

### 1. JWT Structure & Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JWT STRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleS0xIn0                   │
│  .eyJzdWIiOiJ1c2VyXzEyMyIsImlhdCI6MTcwNTY0MDAwMCwiZXhwIjoxNzA1NjQzNjAwfQ   │
│  .signature_here                                                            │
│                                                                             │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐            │
│  │   HEADER     │    │     PAYLOAD      │    │   SIGNATURE    │            │
│  │  (Base64)    │    │    (Base64)      │    │   (Base64)     │            │
│  ├──────────────┤    ├──────────────────┤    ├────────────────┤            │
│  │ {            │    │ {                │    │ HMAC/RSA/ECDSA │            │
│  │   "alg":     │    │   "sub": "123",  │    │ of header +    │            │
│  │     "RS256", │    │   "iat": ...,    │    │ payload using  │            │
│  │   "typ":     │    │   "exp": ...,    │    │ secret/key     │            │
│  │     "JWT",   │    │   "roles": [...] │    │                │            │
│  │   "kid":     │    │ }                │    │                │            │
│  │     "key-1"  │    │                  │    │                │            │
│  │ }            │    │                  │    │                │            │
│  └──────────────┘    └──────────────────┘    └────────────────┘            │
│                                                                             │
│  ⚠️  PAYLOAD IS NOT ENCRYPTED - Anyone can decode it!                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Algorithm Selection

```typescript
// ✅ RECOMMENDED: Asymmetric algorithms
const SECURE_ALGORITHMS = {
  RS256: 'RSA with SHA-256',      // Most common, widely supported
  RS384: 'RSA with SHA-384',      // Higher security
  RS512: 'RSA with SHA-512',      // Highest security, slower
  ES256: 'ECDSA with P-256',      // Smaller keys, fast
  ES384: 'ECDSA with P-384',      // Higher security
  ES512: 'ECDSA with P-512',      // Highest ECDSA security
  PS256: 'RSA-PSS with SHA-256',  // RSA with PSS padding
  EdDSA: 'Edwards-curve DSA',     // Modern, fast (Ed25519)
};

// ⚠️ USE WITH CAUTION: Symmetric algorithms
const SYMMETRIC_ALGORITHMS = {
  HS256: 'HMAC-SHA256', // Only if secret is truly secret
  HS384: 'HMAC-SHA384', // and >256 bits random
  HS512: 'HMAC-SHA512',
};

// ❌ NEVER USE
const DANGEROUS = {
  none: 'No signature',  // NEVER! Algorithm confusion attack
  RS256_with_HS256: 'Public key as HMAC secret', // Attack vector
};
```

### 3. Secure JWT Creation

```typescript
import * as jose from 'jose';

// Key management
const privateKey = await jose.importPKCS8(process.env.JWT_PRIVATE_KEY!, 'RS256');
const publicKey = await jose.importSPKI(process.env.JWT_PUBLIC_KEY!, 'RS256');

interface TokenPayload {
  sub: string;          // Subject (user ID)
  email: string;
  roles: string[];
  tenantId: string;
}

async function createAccessToken(payload: TokenPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const jwt = await new jose.SignJWT({
    // Custom claims
    email: payload.email,
    roles: payload.roles,
    tenant_id: payload.tenantId,
  })
    .setProtectedHeader({ 
      alg: 'RS256', 
      typ: 'JWT',
      kid: 'key-2024-01',  // Key ID for rotation
    })
    .setSubject(payload.sub)
    .setIssuer('https://auth.example.com')
    .setAudience('https://api.example.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 15 * 60)  // 15 minutes
    .setNotBefore(now)
    .setJti(crypto.randomUUID())  // Unique token ID
    .sign(privateKey);
  
  return jwt;
}

async function createRefreshToken(userId: string): Promise<string> {
  const jwt = await new jose.SignJWT({
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer('https://auth.example.com')
    .setIssuedAt()
    .setExpirationTime('7d')  // 7 days
    .setJti(crypto.randomUUID())
    .sign(privateKey);
  
  // Store refresh token ID in database for revocation
  await db.refreshTokens.create({
    jti: jose.decodeJwt(jwt).jti,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  
  return jwt;
}
```

### 4. Secure JWT Verification

```typescript
// CRITICAL: Always validate these!
const verifyOptions = {
  algorithms: ['RS256'],         // Explicit allowlist - NEVER accept 'none'
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com',
  clockTolerance: 30,            // 30 seconds leeway for clock skew
  requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
};

async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const { payload, protectedHeader } = await jose.jwtVerify(
      token,
      publicKey,
      verifyOptions
    );
    
    // Additional business validations
    if (!payload.sub) {
      throw new Error('Missing subject');
    }
    
    if (!payload.tenant_id) {
      throw new Error('Missing tenant');
    }
    
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      roles: payload.roles as string[],
      tenantId: payload.tenant_id as string,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new AuthError('TOKEN_EXPIRED', 'Token has expired');
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new AuthError('INVALID_CLAIMS', 'Token claims validation failed');
    }
    throw new AuthError('INVALID_TOKEN', 'Token verification failed');
  }
}

// Middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const token = authHeader.slice(7);
  
  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(401).json({ 
        error: error.code,
        message: error.message,
      });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
```

### 5. Token Refresh Pattern

```typescript
// Token refresh endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    // 1. Verify refresh token
    const { payload } = await jose.jwtVerify(refreshToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://auth.example.com',
    });
    
    // 2. Check if refresh token is in database (not revoked)
    const storedToken = await db.refreshTokens.findOne({
      jti: payload.jti,
      revokedAt: null,
    });
    
    if (!storedToken) {
      // Token was revoked or doesn't exist
      throw new AuthError('REFRESH_TOKEN_REVOKED', 'Refresh token is invalid');
    }
    
    // 3. Check for token reuse (replay attack detection)
    if (storedToken.usedAt) {
      // Token was already used! Possible token theft
      // Revoke ALL refresh tokens for this user
      await db.refreshTokens.updateMany(
        { userId: storedToken.userId },
        { revokedAt: new Date() }
      );
      
      logger.security({
        event: 'REFRESH_TOKEN_REUSE',
        userId: storedToken.userId,
        jti: payload.jti,
      });
      
      throw new AuthError('REFRESH_TOKEN_REUSED', 'Security violation detected');
    }
    
    // 4. Mark old refresh token as used
    await db.refreshTokens.update(
      { jti: payload.jti },
      { usedAt: new Date() }
    );
    
    // 5. Issue new tokens (rotation)
    const user = await db.users.findById(storedToken.userId);
    
    const accessToken = await createAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId,
    });
    
    const newRefreshToken = await createRefreshToken(user.id);
    
    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900, // 15 minutes
    });
    
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    return res.status(401).json({ error: error.message });
  }
});
```

### 6. Token Revocation Strategies

```typescript
// Strategy 1: Short-lived access tokens + refresh token rotation
// - Access token: 15 minutes, not revocable
// - Refresh token: 7 days, stored in DB, revocable
// Pros: Fast verification, minimal DB lookups
// Cons: Up to 15 min window before revocation takes effect

// Strategy 2: Token blacklist
class TokenBlacklist {
  private redis: Redis;
  
  async revoke(jti: string, expiresAt: Date) {
    const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await this.redis.setex(`blacklist:${jti}`, ttl, '1');
    }
  }
  
  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(`blacklist:${jti}`)) === 1;
  }
}

// Check blacklist during verification
async function verifyWithBlacklist(token: string) {
  const { payload } = await jose.jwtVerify(token, publicKey, verifyOptions);
  
  if (payload.jti && await blacklist.isRevoked(payload.jti as string)) {
    throw new AuthError('TOKEN_REVOKED', 'Token has been revoked');
  }
  
  return payload;
}

// Strategy 3: Token versioning
// Store a version number per user, include in token
// Increment version to invalidate all tokens
async function verifyWithVersion(token: string) {
  const { payload } = await jose.jwtVerify(token, publicKey, verifyOptions);
  
  const user = await cache.get(`user:${payload.sub}:tokenVersion`);
  if (user && payload.v !== user.tokenVersion) {
    throw new AuthError('TOKEN_VERSION_MISMATCH', 'Token is outdated');
  }
  
  return payload;
}

// Logout - revoke all tokens
async function logout(userId: string) {
  // Increment token version
  await db.users.update({ id: userId }, { tokenVersion: { increment: 1 } });
  await cache.del(`user:${userId}:tokenVersion`);
  
  // Revoke all refresh tokens
  await db.refreshTokens.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
}
```

### 7. Secure Token Storage (Client-Side)

```typescript
// ❌ NEVER: localStorage (XSS vulnerable)
localStorage.setItem('token', jwt); // Attacker's JS can read this!

// ❌ AVOID: sessionStorage (still XSS vulnerable)
sessionStorage.setItem('token', jwt);

// ✅ RECOMMENDED: HttpOnly cookies
// Server sets this header:
res.cookie('accessToken', jwt, {
  httpOnly: true,      // JavaScript cannot access
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/api',        // Only sent to API routes
});

// For SPAs that need to read token expiry:
// Send a non-sensitive "tokenMeta" cookie alongside
res.cookie('tokenMeta', JSON.stringify({ exp: payload.exp }), {
  httpOnly: false,  // JS can read this
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000,
});

// ✅ ALTERNATIVE: In-memory + refresh
// Store token only in memory (JS variable)
// Use refresh token in HttpOnly cookie
class TokenManager {
  private accessToken: string | null = null;
  
  async getAccessToken(): Promise<string> {
    if (this.accessToken && !this.isExpired()) {
      return this.accessToken;
    }
    
    // Refresh token is in HttpOnly cookie, sent automatically
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    
    const { accessToken } = await response.json();
    this.accessToken = accessToken;
    return accessToken;
  }
}
```

### 8. Key Rotation

```typescript
// JWKS (JSON Web Key Set) for key rotation
// Publish at: https://auth.example.com/.well-known/jwks.json

const keys = [
  {
    kty: 'RSA',
    kid: 'key-2024-01',  // Current key
    use: 'sig',
    alg: 'RS256',
    n: '...',  // Public key modulus
    e: 'AQAB',
  },
  {
    kty: 'RSA',
    kid: 'key-2023-12',  // Previous key (for tokens still valid)
    use: 'sig',
    alg: 'RS256',
    n: '...',
    e: 'AQAB',
  },
];

// Verification uses JWKS
const JWKS = jose.createRemoteJWKSet(
  new URL('https://auth.example.com/.well-known/jwks.json'),
  {
    cacheMaxAge: 600000,  // Cache for 10 minutes
    cooldownDuration: 30000,  // Wait 30s between refreshes
  }
);

async function verifyWithJWKS(token: string) {
  // jose automatically selects key based on 'kid' header
  const { payload } = await jose.jwtVerify(token, JWKS, verifyOptions);
  return payload;
}

// Key rotation process:
// 1. Generate new key pair
// 2. Add new public key to JWKS (kid: key-2024-02)
// 3. Wait for JWKS cache to refresh everywhere
// 4. Start signing new tokens with new key
// 5. After old tokens expire, remove old key from JWKS
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Accepting 'none' algorithm | Token forgery | Explicit algorithm allowlist |
| Secret in code | Key compromise | Use environment variables, vault |
| Long-lived access tokens | Extended compromise window | Short TTL (15 min) + refresh |
| Sensitive data in payload | Data exposure | Payload is not encrypted! |
| No audience validation | Token misuse across services | Always validate 'aud' claim |
| localStorage storage | XSS token theft | Use HttpOnly cookies |
| No refresh token rotation | Replay attacks | Rotate on each refresh |
| Missing 'kid' header | Key rotation issues | Always include key ID |

## Checklist

- [ ] Algorithm explicitly whitelisted (no 'none')
- [ ] Asymmetric algorithm used (RS256/ES256)
- [ ] Short expiration on access tokens (≤15 min)
- [ ] Refresh tokens stored server-side
- [ ] Refresh token rotation implemented
- [ ] All claims validated (iss, aud, exp, iat)
- [ ] Key ID (kid) included in header
- [ ] JWKS endpoint for key distribution
- [ ] Key rotation process documented
- [ ] Tokens stored in HttpOnly cookies (not localStorage)
- [ ] Token revocation mechanism implemented
- [ ] No sensitive data in payload
- [ ] Clock skew tolerance configured

## References

- [RFC 7519 - JWT](https://datatracker.ietf.org/doc/html/rfc7519)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [JWT.io Debugger](https://jwt.io/)
- [Auth0 JWT Vulnerabilities](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/)
- [jose Library](https://github.com/panva/jose)
