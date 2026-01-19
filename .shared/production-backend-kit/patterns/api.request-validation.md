---
id: api-request-validation
title: Request Validation & Sanitization
tags:
  - api
  - validation
  - security
  - input
  - owasp
level: beginner
stacks:
  - all
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
  - https://zod.dev/
  - https://docs.pydantic.dev/
  - https://owasp.org/www-community/OWASP_Validation_Regex_Repository
---

# Request Validation & Sanitization

## Problem

Accepting unvalidated input is the **#1 cause of security vulnerabilities**:
- SQL Injection (OWASP #3)
- Cross-Site Scripting (OWASP #7)
- Data corruption and crashes
- Business logic bypass
- DoS via malformed input

**Trust nothing from the client. Validate everything.**

## When to use

- **Every single API endpoint** - no exceptions
- Request body (JSON, form data, XML)
- Path parameters (`/users/:id`)
- Query parameters (`?search=...`)
- Headers (Authorization, Content-Type)
- File uploads (name, type, size, content)
- Cookies and session data

## Solution

### 1. Validation Strategy: Defense in Depth

```
┌────────────────────────────────────────────────────────────┐
│ Layer 1: Schema Validation                                 │
│   • Type checking (string, number, boolean, array)         │
│   • Required vs optional fields                            │
│   • Format validation (email, UUID, URL, date)             │
│   • Range/length constraints                               │
└────────────────────────────────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Layer 2: Business Rule Validation                          │
│   • Cross-field validation                                 │
│   • Reference integrity (does user_id exist?)              │
│   • State validation (can this order be cancelled?)        │
│   • Permission checks                                      │
└────────────────────────────────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────┐
│ Layer 3: Sanitization & Encoding                           │
│   • HTML encoding for display                              │
│   • SQL parameterization (never string concat!)            │
│   • Path traversal prevention                              │
│   • Unicode normalization                                  │
└────────────────────────────────────────────────────────────┘
```

### 2. Validation Rules by Type

| Input Type | Validation Rules |
|------------|------------------|
| **Email** | RFC 5322 format, max 254 chars, lowercase normalize |
| **Password** | Min 8 chars, max 128, no leading/trailing whitespace |
| **Username** | Alphanumeric + underscore, 3-30 chars, no reserved words |
| **UUID** | RFC 4122 format (v4 preferred) |
| **URL** | Valid protocol (https only for external), max 2048 chars |
| **Phone** | E.164 format (+1234567890), 7-15 digits |
| **Date** | ISO 8601 (YYYY-MM-DD), valid calendar date |
| **Integer** | Within safe range, no leading zeros |
| **Currency** | Positive, max 2 decimal places, within limits |
| **File** | Allowlist extensions, MIME type check, max size, scan content |

### 3. The Allowlist Principle (CRITICAL)

**NEVER use blocklists. ALWAYS use allowlists.**

```typescript
// ❌ BAD: Blocklist approach
function validateUsername(input: string): boolean {
  const blocked = ['admin', 'root', 'system'];
  return !blocked.includes(input.toLowerCase()); // Attacker uses "ádmin"
}

// ✅ GOOD: Allowlist approach
function validateUsername(input: string): boolean {
  const pattern = /^[a-zA-Z0-9_]{3,30}$/;
  return pattern.test(input); // Only allows exactly what's expected
}
```

### 4. Common Validation Patterns (Regex)

```typescript
const PATTERNS = {
  // Email (simplified but effective)
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // UUID v4
  uuidV4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  
  // ISO 8601 Date
  isoDate: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
  
  // Alphanumeric with underscore
  alphanumericUnderscore: /^[a-zA-Z0-9_]+$/,
  
  // Slug (URL-safe)
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  
  // Phone (E.164)
  phoneE164: /^\+[1-9]\d{6,14}$/,
  
  // Strong password (min 8, upper, lower, digit, special)
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  
  // Credit card (Luhn validation needed separately)
  creditCard: /^\d{13,19}$/,
  
  // IPv4
  ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
};
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Client-side only validation | Bypassed trivially | ALWAYS validate server-side |
| Using blocklists | Attacker finds bypass | Use allowlists exclusively |
| Trusting Content-Type | File upload attacks | Validate actual content |
| SQL string concatenation | SQL Injection | Use parameterized queries |
| Reflecting input in HTML | XSS attacks | HTML encode output |
| No length limits | DoS via huge payloads | Set max lengths on all fields |
| Unicode bypass | Security filter bypass | Normalize before validation |
| Generic error messages | User frustration | Return field-specific errors |

## Checklist

- [ ] Schema validation on ALL endpoints (no exceptions)
- [ ] Validation library used (Zod, Joi, Pydantic, class-validator)
- [ ] All input sources validated (body, params, query, headers)
- [ ] Allowlist approach for all pattern matching
- [ ] Type coercion handled safely (string "true" → boolean)
- [ ] Length limits on all string fields
- [ ] Range limits on all numeric fields
- [ ] Enum values validated against allowlist
- [ ] File uploads validated (type, size, content)
- [ ] SQL uses parameterized queries (never concat)
- [ ] HTML output is encoded
- [ ] Unicode is normalized before validation
- [ ] Field-level errors returned to client
- [ ] Validation errors logged (for security monitoring)
- [ ] Validation happens BEFORE business logic

## Code Examples

### TypeScript/Node.js (Zod)

```typescript
import { z } from 'zod';

// Define schemas
const CreateUserSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .toLowerCase()
    .trim(),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
  
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .refine(
      (val) => !['admin', 'root', 'system', 'null'].includes(val.toLowerCase()),
      'This username is reserved'
    ),
  
  age: z.number()
    .int('Age must be a whole number')
    .min(13, 'Must be at least 13 years old')
    .max(120, 'Invalid age')
    .optional(),
  
  role: z.enum(['user', 'moderator']).default('user'),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Validation middleware
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        code: err.code,
        message: err.message,
      }));
      
      return res.status(400).json({
        type: 'https://api.example.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Request body failed validation',
        errors,
      });
    }
    
    req.validatedBody = result.data;
    next();
  };
}

// Path params validation
const UserIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

// Query params validation
const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  sort: z.enum(['created_at', 'name', 'email']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Usage
app.post('/users', validateBody(CreateUserSchema), async (req, res) => {
  const data: CreateUserInput = req.validatedBody;
  // data is fully typed and validated
  const user = await userService.create(data);
  res.status(201).json(user);
});

app.get('/users/:id', validateParams(UserIdParamSchema), async (req, res) => {
  const { id } = req.validatedParams;
  // id is guaranteed to be a valid UUID
});
```

### Python/FastAPI (Pydantic)

```python
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal
from datetime import date
import re

class CreateUserRequest(BaseModel):
    email: EmailStr = Field(..., max_length=254)
    
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Must contain uppercase, lowercase, and number"
    )
    
    username: str = Field(
        ...,
        min_length=3,
        max_length=30,
        pattern=r'^[a-zA-Z0-9_]+$'
    )
    
    age: Optional[int] = Field(None, ge=13, le=120)
    role: Literal['user', 'moderator'] = 'user'
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain a digit')
        return v
    
    @field_validator('username')
    @classmethod
    def validate_username_not_reserved(cls, v: str) -> str:
        reserved = {'admin', 'root', 'system', 'null', 'undefined'}
        if v.lower() in reserved:
            raise ValueError('This username is reserved')
        return v
    
    @field_validator('email')
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()

class ListUsersQuery(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    status: Optional[Literal['active', 'inactive', 'pending']] = None
    sort: Literal['created_at', 'name', 'email'] = 'created_at'
    order: Literal['asc', 'desc'] = 'desc'

@app.post("/users", status_code=201)
async def create_user(user: CreateUserRequest):
    # user is already validated by Pydantic
    return await user_service.create(user.model_dump())

@app.get("/users/{user_id}")
async def get_user(user_id: UUID):
    # FastAPI validates UUID format automatically
    return await user_service.get(user_id)

@app.get("/users")
async def list_users(query: Annotated[ListUsersQuery, Query()]):
    # All query params validated
    return await user_service.list(
        page=query.page,
        limit=query.limit,
        filters={'status': query.status},
        sort=query.sort,
        order=query.order
    )
```

### Go

```go
package validation

import (
    "github.com/go-playground/validator/v10"
    "regexp"
)

var validate = validator.New()

type CreateUserRequest struct {
    Email    string `json:"email" validate:"required,email,max=254"`
    Password string `json:"password" validate:"required,min=8,max=128,strongpassword"`
    Username string `json:"username" validate:"required,min=3,max=30,alphanumund,notreserved"`
    Age      *int   `json:"age,omitempty" validate:"omitempty,min=13,max=120"`
    Role     string `json:"role" validate:"omitempty,oneof=user moderator"`
}

func init() {
    // Register custom validators
    validate.RegisterValidation("strongpassword", validateStrongPassword)
    validate.RegisterValidation("alphanumund", validateAlphanumUnderscore)
    validate.RegisterValidation("notreserved", validateNotReserved)
}

func validateStrongPassword(fl validator.FieldLevel) bool {
    password := fl.Field().String()
    hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
    hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
    hasDigit := regexp.MustCompile(`\d`).MatchString(password)
    return hasLower && hasUpper && hasDigit
}

func validateAlphanumUnderscore(fl validator.FieldLevel) bool {
    return regexp.MustCompile(`^[a-zA-Z0-9_]+$`).MatchString(fl.Field().String())
}

func validateNotReserved(fl validator.FieldLevel) bool {
    reserved := map[string]bool{
        "admin": true, "root": true, "system": true, "null": true,
    }
    return !reserved[strings.ToLower(fl.Field().String())]
}

func ValidateStruct(s interface{}) []FieldError {
    err := validate.Struct(s)
    if err == nil {
        return nil
    }
    
    var errors []FieldError
    for _, e := range err.(validator.ValidationErrors) {
        errors = append(errors, FieldError{
            Field:   e.Field(),
            Code:    e.Tag(),
            Message: getErrorMessage(e),
        })
    }
    return errors
}
```

## References

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Validation Regex Repository](https://owasp.org/www-community/OWASP_Validation_Regex_Repository)
- [Zod Documentation](https://zod.dev/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Go Validator](https://github.com/go-playground/validator)
