---
id: api-request-validation
title: Request Validation
tags: [api, validation, security, input]
level: beginner
stacks: [all]
---

# Request Validation

## Problem

Accepting unvalidated input leads to crashes, security vulnerabilities, and data corruption. Invalid data propagating through the system causes debugging nightmares and inconsistent state.

## When to use

- Every API endpoint accepting input
- Form submissions
- File uploads
- Query parameters
- Request headers
- Any external data source

## Solution

1. **Validate at API boundary**
   - Define schema for every endpoint
   - Validate before business logic executes
   - Use schema validation library (Zod, Joi, Pydantic)

2. **Validate all input types**
   - Request body (JSON, form data)
   - Path parameters
   - Query parameters
   - Headers (Content-Type, Authorization format)

3. **Apply validation rules**
   - Type checking (string, number, boolean)
   - Format validation (email, UUID, date)
   - Range constraints (min, max, length)
   - Enum validation (allowed values)
   - Custom business rules

4. **Return actionable errors**
   - Field-level error messages
   - Clear indication of what's wrong
   - Suggestion for correction

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Validating only some fields | Use schema for entire request |
| Trusting client-side validation | Always validate server-side |
| Generic error messages | Return field-specific errors |
| Forgetting query params | Include in validation schema |
| Not sanitizing after validation | Sanitize HTML, SQL, etc. |

## Checklist

- [ ] Schema defined for every endpoint
- [ ] Validation runs before business logic
- [ ] All input sources validated (body, params, query, headers)
- [ ] Type validation applied
- [ ] Format validation for emails, URLs, dates
- [ ] Length/range constraints enforced
- [ ] Enum values validated against allowlist
- [ ] Field-level errors returned to client
- [ ] Validation library used (not manual checks)
- [ ] Sanitization applied after validation

## Snippets (Generic)

```
Schema Definition (pseudo-code):
UserCreateSchema:
  email: required, string, email format
  password: required, string, min 8, max 128
  age: optional, integer, min 13, max 120
  role: optional, enum ["user", "admin"], default "user"

Validation Flow:
1. Receive request
2. Select schema based on route
3. Parse and validate against schema
4. If invalid → return 400 with field errors
5. If valid → pass sanitized data to handler

Error Response:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      { "field": "email", "message": "Must be valid email" },
      { "field": "password", "message": "Minimum 8 characters" }
    ]
  }
}

Validation Middleware:
1. Extract schema for route
2. Validate request.body, request.params, request.query
3. Attach validated data to request object
4. Call next() or return 400
```

## Sources

- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- Zod Documentation: https://zod.dev/
- JSON Schema Specification: https://json-schema.org/
- Pydantic Documentation: https://docs.pydantic.dev/
