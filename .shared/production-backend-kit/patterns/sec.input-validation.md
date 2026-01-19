---
id: sec-input-validation
title: Input Validation and Sanitization
tags:
  - security
  - validation
  - sanitization
  - xss
  - injection
level: intermediate
stacks:
  - nodejs
  - python
  - go
scope: security
maturity: stable
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
  - https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
  - https://owasp.org/www-community/attacks/SQL_Injection
  - https://docs.python.org/3/library/re.html
---

# Input Validation and Sanitization

## Problem

Unvalidated input causes:
- **SQL Injection**: `'; DROP TABLE users; --`
- **XSS**: `<script>document.cookie</script>`
- **Command Injection**: `; rm -rf /`
- **Path Traversal**: `../../etc/passwd`
- **NoSQL Injection**: `{"$gt": ""}`
- **Business Logic Bypass**: negative quantities, future dates

## When to use

- **Every** user input (request body, query params, headers)
- File uploads
- Webhook payloads
- Data from external APIs
- Configuration from environment

## Solution

### 1. Validation with Zod (TypeScript)

```typescript
import { z } from 'zod';

// User registration schema
const UserRegistrationSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .toLowerCase()
    .trim(),
  
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long')  // bcrypt limit
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain special character'),
  
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, hyphens'),
  
  age: z
    .number()
    .int('Age must be a whole number')
    .min(13, 'Must be at least 13 years old')
    .max(120, 'Invalid age'),
  
  website: z
    .string()
    .url('Invalid URL')
    .optional()
    .refine(
      (url) => !url || url.startsWith('https://'),
      'URL must use HTTPS'
    ),
});

// Order creation schema
const CreateOrderSchema = z.object({
  items: z
    .array(z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantity: z
        .number()
        .int()
        .positive('Quantity must be positive')
        .max(100, 'Maximum 100 items per product'),
    }))
    .min(1, 'Order must have at least one item')
    .max(50, 'Maximum 50 different products'),
  
  shippingAddress: z.object({
    street: z.string().min(5).max(200),
    city: z.string().min(2).max(100),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
    country: z.enum(['US', 'CA', 'MX']),
  }),
  
  paymentMethod: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('credit_card'),
      cardId: z.string().uuid(),
    }),
    z.object({
      type: z.literal('paypal'),
      paypalEmail: z.string().email(),
    }),
    z.object({
      type: z.literal('bank_transfer'),
      accountNumber: z.string().regex(/^\d{10,17}$/),
    }),
  ]),
  
  couponCode: z
    .string()
    .regex(/^[A-Z0-9]{4,20}$/, 'Invalid coupon format')
    .optional(),
});

// Validate and transform
function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    
    throw new ValidationError('Validation failed', errors);
  }
  
  return result.data;
}

// Express middleware
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = validateInput(schema, req.body);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

// Usage
app.post('/api/users', validate(UserRegistrationSchema), async (req, res) => {
  // req.body is validated and typed
  const user = await userService.create(req.body);
  res.status(201).json(user);
});
```

### 2. Sanitization Utilities

```typescript
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

const sanitizers = {
  // HTML content sanitization (for rich text)
  html(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'title'],
      ALLOW_DATA_ATTR: false,
    });
  },
  
  // Plain text (strip all HTML)
  plainText(input: string): string {
    return validator.escape(validator.stripLow(input.trim()));
  },
  
  // Filename sanitization
  filename(input: string): string {
    // Remove path components and dangerous characters
    return input
      .replace(/[/\\?%*:|"<>]/g, '')
      .replace(/^\.+/, '')  // No leading dots
      .replace(/\s+/g, '_')
      .substring(0, 255);
  },
  
  // SQL-safe string (use parameterized queries instead!)
  // This is a LAST RESORT - always use parameterized queries
  sqlString(input: string): string {
    return input.replace(/['";\\]/g, '');
  },
  
  // URL parameter
  urlParam(input: string): string {
    return encodeURIComponent(input);
  },
  
  // Shell argument (for subprocess)
  // WARNING: Avoid shell commands with user input!
  shellArg(input: string): string {
    return `'${input.replace(/'/g, "'\\''")}'`;
  },
  
  // JSON key (prevent prototype pollution)
  jsonKey(input: string): string {
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    if (dangerous.includes(input)) {
      throw new Error('Invalid JSON key');
    }
    return input;
  },
  
  // Phone number
  phone(input: string): string {
    return input.replace(/[^\d+\-\(\)\s]/g, '').trim();
  },
  
  // Credit card (mask for display)
  creditCardMask(input: string): string {
    const digits = input.replace(/\D/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  },
};

// Usage
const userComment = sanitizers.plainText(req.body.comment);
const richContent = sanitizers.html(req.body.content);
const uploadedFilename = sanitizers.filename(file.originalname);
```

### 3. SQL Injection Prevention

```typescript
// ❌ NEVER do this - SQL Injection vulnerable
const bad = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ ALWAYS use parameterized queries

// node-postgres
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1 AND status = $2',
  [email, 'active']
);

// Prisma (ORM)
const user = await prisma.user.findFirst({
  where: {
    email: email,  // Automatically parameterized
    status: 'active',
  },
});

// Raw queries with Prisma (still safe)
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;

// TypeORM
const user = await userRepository
  .createQueryBuilder('user')
  .where('user.email = :email', { email })
  .andWhere('user.status = :status', { status: 'active' })
  .getOne();

// Dynamic column names (still dangerous!)
// If you MUST use dynamic columns:
const allowedColumns = ['name', 'email', 'created_at'];
if (!allowedColumns.includes(sortColumn)) {
  throw new Error('Invalid sort column');
}
const query = `SELECT * FROM users ORDER BY ${sortColumn}`;
```

### 4. NoSQL Injection Prevention

```typescript
// MongoDB injection vulnerabilities

// ❌ Vulnerable to operator injection
// Input: { "$gt": "" } bypasses password check
const bad = await collection.findOne({
  username: req.body.username,
  password: req.body.password,  // Could be { "$gt": "" }
});

// ✅ Type check and sanitize
function sanitizeMongoQuery(input: unknown): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Expected string input');
  }
  
  // Remove MongoDB operators
  if (input.startsWith('$')) {
    throw new ValidationError('Invalid input');
  }
  
  return input;
}

const username = sanitizeMongoQuery(req.body.username);
const password = sanitizeMongoQuery(req.body.password);

const user = await collection.findOne({
  username,
  password: await hash(password),
});

// ✅ Better: Use schema validation
const LoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(72),
});

// Mongoose with schema validation
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^[a-zA-Z0-9_]+$/.test(v),
      message: 'Invalid username format',
    },
  },
});
```

### 5. Path Traversal Prevention

```typescript
import path from 'path';
import fs from 'fs/promises';

// ❌ Vulnerable to path traversal
// Input: "../../etc/passwd"
const bad = path.join('/uploads', req.params.filename);

// ✅ Safe file path handling
const UPLOAD_DIR = '/var/app/uploads';

async function getSecureFilePath(userInput: string): Promise<string> {
  // Normalize and resolve the path
  const safeName = path.basename(userInput);  // Remove directory components
  const fullPath = path.resolve(UPLOAD_DIR, safeName);
  
  // Verify it's within allowed directory
  if (!fullPath.startsWith(UPLOAD_DIR)) {
    throw new SecurityError('Invalid file path');
  }
  
  // Check file exists
  try {
    await fs.access(fullPath);
  } catch {
    throw new NotFoundError('File not found');
  }
  
  return fullPath;
}

// Usage
app.get('/files/:filename', async (req, res) => {
  const filePath = await getSecureFilePath(req.params.filename);
  res.sendFile(filePath);
});

// For file uploads
const uploadConfig = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      // Generate safe filename
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
      
      if (!allowedExts.includes(ext)) {
        return cb(new Error('Invalid file type'), '');
      }
      
      const safeName = `${crypto.randomUUID()}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB
  },
});
```

### 6. Command Injection Prevention

```typescript
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ❌ NEVER do this - Command injection
const bad = exec(`convert ${inputFile} ${outputFile}`);

// ✅ Use execFile with arguments array
async function convertImage(inputPath: string, outputPath: string) {
  // Validate paths first
  if (!inputPath.match(/^[a-zA-Z0-9_\-./]+$/)) {
    throw new Error('Invalid input path');
  }
  
  await execFileAsync('convert', [
    inputPath,
    '-resize', '800x600',
    '-quality', '85',
    outputPath,
  ]);
}

// ✅ For complex commands, use spawn with shell: false
async function runFFmpeg(input: string, output: string) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', input,
      '-vcodec', 'h264',
      '-acodec', 'aac',
      output,
    ], {
      shell: false,  // IMPORTANT: Don't use shell
    });
    
    proc.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    
    proc.on('error', reject);
  });
}

// ✅ If you absolutely need shell, use allowlist
const ALLOWED_COMMANDS = ['ls', 'cat', 'head', 'tail'];

function runShellCommand(command: string, args: string[]) {
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error('Command not allowed');
  }
  
  // Still use execFile, not exec
  return execFileAsync(command, args);
}
```

### 7. Request Size and Rate Limiting

```typescript
import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();

// Limit request body size
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  message: { error: 'Too many requests', retryAfter: 900 },
}));

// Stricter limits for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  message: { error: 'Too many login attempts' },
});

app.post('/api/auth/login', authLimiter, loginHandler);
app.post('/api/auth/forgot-password', authLimiter, forgotPasswordHandler);

// Array length limits
const ItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    value: z.number(),
  })).max(1000, 'Maximum 1000 items'),
});

// String length limits everywhere
const CommentSchema = z.object({
  content: z.string().max(10000, 'Comment too long'),
  tags: z.array(z.string().max(50)).max(10),
});

// Pagination limits
const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
```

### 8. Content-Type Validation

```typescript
// Validate content type matches actual content

import fileType from 'file-type';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
};

async function validateFileType(
  buffer: Buffer,
  declaredMimeType: string
): Promise<void> {
  // Detect actual file type from magic bytes
  const detected = await fileType.fromBuffer(buffer);
  
  if (!detected) {
    throw new ValidationError('Could not detect file type');
  }
  
  // Check against allowlist
  if (!ALLOWED_TYPES[detected.mime]) {
    throw new ValidationError(`File type ${detected.mime} not allowed`);
  }
  
  // Verify declared type matches detected
  if (detected.mime !== declaredMimeType) {
    throw new ValidationError(
      `Declared type ${declaredMimeType} does not match actual type ${detected.mime}`
    );
  }
}

// Usage with multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    await validateFileType(req.file.buffer, req.file.mimetype);
    
    // Safe to process file
    const filename = `${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);
    
    res.json({ filename });
  } catch (error) {
    next(error);
  }
});
```

### 9. Prototype Pollution Prevention

```typescript
// Prevent prototype pollution attacks

// ❌ Vulnerable to prototype pollution
function merge(target: any, source: any) {
  for (const key in source) {
    target[key] = source[key];  // Can pollute __proto__
  }
  return target;
}

// ✅ Safe merge
function safeMerge<T extends object>(target: T, source: Partial<T>): T {
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  
  for (const key of Object.keys(source)) {
    if (dangerous.includes(key)) {
      continue;  // Skip dangerous keys
    }
    
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      (target as any)[key] = (source as any)[key];
    }
  }
  
  return target;
}

// ✅ Use Object.create(null) for dictionaries
const safeDict = Object.create(null);
safeDict['user-input'] = 'value';  // No prototype chain

// ✅ Freeze prototypes (do early in app startup)
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);

// ✅ Use Map instead of objects for user-keyed data
const userPreferences = new Map<string, unknown>();
userPreferences.set(userInputKey, value);
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Validation only on client | Bypass trivial | Always validate on server |
| Blacklist approach | Easy to bypass | Use allowlists |
| Missing encoding | XSS | Context-aware encoding |
| String concat in SQL | SQL injection | Parameterized queries |
| Shell commands with input | Command injection | Use execFile, not exec |
| Trust content-type header | File upload attacks | Validate magic bytes |
| No size limits | DoS | Limit all inputs |

## Checklist

- [ ] All inputs validated with schema
- [ ] Validation happens server-side
- [ ] Parameterized queries for all database ops
- [ ] HTML sanitized before rendering
- [ ] File paths validated against traversal
- [ ] File types verified by magic bytes
- [ ] Request body size limited
- [ ] Rate limiting on sensitive endpoints
- [ ] No shell commands with user input
- [ ] Prototype pollution prevented
- [ ] Error messages don't leak info

## References

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Zod Documentation](https://zod.dev/)
- [validator.js](https://github.com/validatorjs/validator.js)
