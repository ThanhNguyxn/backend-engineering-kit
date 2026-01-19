---
id: api-idempotency
title: Idempotent API Design
tags:
  - api
  - idempotency
  - reliability
  - retry
  - consistency
level: intermediate
stacks:
  - nodejs
  - python
  - go
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://stripe.com/docs/api/idempotent_requests
  - https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
  - https://developer.mozilla.org/en-US/docs/Glossary/Idempotent
  - https://datatracker.ietf.org/doc/html/rfc7231#section-4.2.2
---

# Idempotent API Design

## Problem

Without idempotency:
```
Client ──POST /orders──→ Server (creates order)
                        ↓
Client ←───timeout/error───┘
                        ↓
Client ──POST /orders──→ Server (creates DUPLICATE order!)
```

Network failures, timeouts, and retries can cause:
- Duplicate payments
- Double order submissions
- Multiple resource creations
- Data inconsistencies

## When to use

- **All mutating operations** (POST, PUT, PATCH, DELETE)
- Payment processing
- Order/booking systems
- Any operation that has side effects
- Webhook handlers
- Message queue consumers

## Solution

### 1. Idempotency Key Pattern

```typescript
import { createHash } from 'crypto';
import { Redis } from 'ioredis';

interface IdempotencyRecord {
  status: 'processing' | 'completed' | 'failed';
  response?: any;
  statusCode?: number;
  createdAt: number;
  completedAt?: number;
}

class IdempotencyService {
  constructor(
    private redis: Redis,
    private lockTTL = 60,      // Lock timeout in seconds
    private recordTTL = 86400   // Store completed responses for 24h
  ) {}

  /**
   * Execute an operation idempotently
   */
  async execute<T>(
    idempotencyKey: string,
    operation: () => Promise<{ statusCode: number; body: T }>
  ): Promise<{ statusCode: number; body: T; fromCache: boolean }> {
    const recordKey = `idempotency:${idempotencyKey}`;
    const lockKey = `idempotency:lock:${idempotencyKey}`;
    
    // Check if we already have a response for this key
    const existingRecord = await this.redis.get(recordKey);
    
    if (existingRecord) {
      const record: IdempotencyRecord = JSON.parse(existingRecord);
      
      if (record.status === 'completed') {
        // Return cached response
        return {
          statusCode: record.statusCode!,
          body: record.response,
          fromCache: true,
        };
      }
      
      if (record.status === 'processing') {
        // Another request is processing - conflict
        throw new IdempotencyConflictError(
          'Request with this idempotency key is already being processed'
        );
      }
      
      // Failed - allow retry
    }
    
    // Try to acquire lock
    const lockAcquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      this.lockTTL,
      'NX'
    );
    
    if (!lockAcquired) {
      throw new IdempotencyConflictError(
        'Request with this idempotency key is being processed'
      );
    }
    
    try {
      // Mark as processing
      await this.redis.set(
        recordKey,
        JSON.stringify({
          status: 'processing',
          createdAt: Date.now(),
        } as IdempotencyRecord),
        'EX',
        this.lockTTL
      );
      
      // Execute the operation
      const result = await operation();
      
      // Store successful response
      await this.redis.set(
        recordKey,
        JSON.stringify({
          status: 'completed',
          response: result.body,
          statusCode: result.statusCode,
          createdAt: Date.now(),
          completedAt: Date.now(),
        } as IdempotencyRecord),
        'EX',
        this.recordTTL
      );
      
      return { ...result, fromCache: false };
      
    } catch (error) {
      // Mark as failed
      await this.redis.set(
        recordKey,
        JSON.stringify({
          status: 'failed',
          createdAt: Date.now(),
        } as IdempotencyRecord),
        'EX',
        300  // Allow retry after 5 minutes
      );
      
      throw error;
    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * Generate idempotency key from request data
   */
  generateKey(components: {
    userId: string;
    action: string;
    data: object;
  }): string {
    const payload = JSON.stringify({
      userId: components.userId,
      action: components.action,
      data: this.sortObject(components.data),
    });
    
    return createHash('sha256').update(payload).digest('hex');
  }

  private sortObject(obj: object): object {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {} as any);
  }
}

class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}
```

### 2. Express Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

const idempotencyService = new IdempotencyService(redis);

// Middleware for idempotent endpoints
function idempotent(options: { 
  headerName?: string;
  required?: boolean;
  generateKey?: (req: Request) => string;
} = {}) {
  const {
    headerName = 'Idempotency-Key',
    required = true,
    generateKey,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Get idempotency key from header or generate
    let idempotencyKey = req.get(headerName);
    
    if (!idempotencyKey && generateKey) {
      idempotencyKey = generateKey(req);
    }
    
    if (!idempotencyKey) {
      if (required) {
        return res.status(400).json({
          error: 'Idempotency-Key header is required',
          code: 'MISSING_IDEMPOTENCY_KEY',
        });
      }
      return next();
    }
    
    // Validate key format (UUID v4)
    if (!isValidUUID(idempotencyKey)) {
      return res.status(400).json({
        error: 'Invalid Idempotency-Key format. Use UUID v4.',
        code: 'INVALID_IDEMPOTENCY_KEY',
      });
    }
    
    // Include user/tenant in key to prevent cross-user conflicts
    const scopedKey = `${req.user?.id || 'anonymous'}:${idempotencyKey}`;
    
    try {
      const result = await idempotencyService.execute(scopedKey, async () => {
        // Capture the response
        const originalJson = res.json.bind(res);
        let capturedBody: any;
        let capturedStatus: number = 200;
        
        res.json = (body: any) => {
          capturedBody = body;
          return originalJson(body);
        };
        
        res.status = ((code: number) => {
          capturedStatus = code;
          return res;
        }) as any;
        
        // Call next middleware/handler
        await new Promise<void>((resolve, reject) => {
          res.on('finish', resolve);
          res.on('error', reject);
          next();
        });
        
        return { statusCode: capturedStatus, body: capturedBody };
      });
      
      // If from cache, set header and return cached response
      if (result.fromCache) {
        res.setHeader('Idempotent-Replayed', 'true');
        return res.status(result.statusCode).json(result.body);
      }
      
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        return res.status(409).json({
          error: error.message,
          code: 'IDEMPOTENCY_CONFLICT',
        });
      }
      throw error;
    }
  };
}

// Usage
app.post('/api/payments', 
  authenticate,
  idempotent({ required: true }),
  async (req, res) => {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).json(payment);
  }
);
```

### 3. Database-Level Idempotency

```typescript
import { Prisma, PrismaClient } from '@prisma/client';

// Using database unique constraints for idempotency

interface CreateOrderInput {
  idempotencyKey: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  totalAmount: number;
}

class OrderService {
  constructor(private prisma: PrismaClient) {}

  async createOrder(input: CreateOrderInput) {
    const { idempotencyKey, ...orderData } = input;
    
    // Use upsert with idempotency key
    // If key exists, return existing order
    // If key doesn't exist, create new order
    
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Check for existing order with this idempotency key
        const existing = await tx.order.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });
        
        if (existing) {
          // Verify the request data matches
          if (existing.customerId !== orderData.customerId) {
            throw new Error('Idempotency key reused with different request body');
          }
          return existing;
        }
        
        // Create new order
        const newOrder = await tx.order.create({
          data: {
            idempotencyKey,
            customerId: orderData.customerId,
            totalAmount: orderData.totalAmount,
            status: 'pending',
            items: {
              create: orderData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
          include: { items: true },
        });
        
        // Trigger downstream processes only for new orders
        await this.queueOrderProcessing(newOrder.id);
        
        return newOrder;
      });
      
      return order;
      
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - race condition
          // Fetch and return the existing order
          const existing = await this.prisma.order.findUnique({
            where: { idempotencyKey },
            include: { items: true },
          });
          return existing;
        }
      }
      throw error;
    }
  }
}

// Schema
// model Order {
//   id              String    @id @default(uuid())
//   idempotencyKey  String    @unique
//   customerId      String
//   totalAmount     Decimal
//   status          String
//   items           OrderItem[]
//   createdAt       DateTime  @default(now())
// }
```

### 4. Idempotent Message Processing

```typescript
// For message queues / event handlers

interface Message<T> {
  id: string;           // Unique message ID
  type: string;
  payload: T;
  timestamp: number;
  retryCount?: number;
}

class IdempotentMessageHandler<T> {
  constructor(
    private redis: Redis,
    private ttl: number = 86400 * 7  // 7 days
  ) {}

  async process(
    message: Message<T>,
    handler: (payload: T) => Promise<void>
  ): Promise<{ processed: boolean; duplicate: boolean }> {
    const processedKey = `msg:processed:${message.id}`;
    const lockKey = `msg:lock:${message.id}`;
    
    // Check if already processed
    const alreadyProcessed = await this.redis.exists(processedKey);
    if (alreadyProcessed) {
      return { processed: true, duplicate: true };
    }
    
    // Acquire lock
    const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
    if (!lockAcquired) {
      // Another worker is processing this message
      throw new Error('Message is being processed by another worker');
    }
    
    try {
      // Double-check after acquiring lock
      const stillNotProcessed = !(await this.redis.exists(processedKey));
      if (!stillNotProcessed) {
        return { processed: true, duplicate: true };
      }
      
      // Process the message
      await handler(message.payload);
      
      // Mark as processed
      await this.redis.set(processedKey, JSON.stringify({
        processedAt: Date.now(),
        messageId: message.id,
      }), 'EX', this.ttl);
      
      return { processed: true, duplicate: false };
      
    } finally {
      await this.redis.del(lockKey);
    }
  }
}

// Usage with SQS/SNS
class OrderEventHandler {
  private idempotentHandler = new IdempotentMessageHandler(redis);

  async handleOrderCreated(message: Message<OrderCreatedEvent>) {
    const result = await this.idempotentHandler.process(message, async (event) => {
      // This will only run once per message ID
      await notificationService.sendOrderConfirmation(event.orderId);
      await inventoryService.reserveStock(event.items);
      await analyticsService.trackOrder(event);
    });
    
    if (result.duplicate) {
      logger.info({ messageId: message.id }, 'Skipped duplicate message');
    }
  }
}
```

### 5. Idempotent State Machines

```typescript
// Using state machines for complex operations

enum PaymentState {
  CREATED = 'created',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

interface PaymentTransition {
  from: PaymentState[];
  to: PaymentState;
  action: string;
}

const paymentTransitions: PaymentTransition[] = [
  { from: [PaymentState.CREATED], to: PaymentState.AUTHORIZED, action: 'authorize' },
  { from: [PaymentState.AUTHORIZED], to: PaymentState.CAPTURED, action: 'capture' },
  { from: [PaymentState.CAPTURED], to: PaymentState.REFUNDED, action: 'refund' },
  { from: [PaymentState.CREATED, PaymentState.AUTHORIZED], to: PaymentState.FAILED, action: 'fail' },
];

class IdempotentPaymentService {
  constructor(private prisma: PrismaClient) {}

  async authorize(paymentId: string, idempotencyKey: string): Promise<Payment> {
    return this.transition(paymentId, 'authorize', idempotencyKey, async (payment) => {
      // Call payment gateway
      const authResult = await paymentGateway.authorize({
        amount: payment.amount,
        paymentMethodId: payment.paymentMethodId,
      });
      
      return {
        gatewayAuthId: authResult.authorizationId,
        authorizedAt: new Date(),
      };
    });
  }

  async capture(paymentId: string, idempotencyKey: string): Promise<Payment> {
    return this.transition(paymentId, 'capture', idempotencyKey, async (payment) => {
      // Only capture if authorized
      const captureResult = await paymentGateway.capture({
        authorizationId: payment.gatewayAuthId,
      });
      
      return {
        gatewayCaptureId: captureResult.captureId,
        capturedAt: new Date(),
      };
    });
  }

  private async transition(
    paymentId: string,
    action: string,
    idempotencyKey: string,
    execute: (payment: Payment) => Promise<Partial<Payment>>
  ): Promise<Payment> {
    const transition = paymentTransitions.find(t => t.action === action);
    if (!transition) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Lock the payment record
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Check for duplicate idempotency key
      const existingOperation = await tx.paymentOperation.findUnique({
        where: { idempotencyKey },
      });

      if (existingOperation) {
        if (existingOperation.paymentId !== paymentId) {
          throw new Error('Idempotency key used for different payment');
        }
        // Already processed - return current state
        return payment;
      }

      // Validate state transition
      if (!transition.from.includes(payment.status as PaymentState)) {
        // Invalid transition - but this might be a retry after success
        if (payment.status === transition.to) {
          // Already in target state - idempotent success
          return payment;
        }
        throw new Error(
          `Cannot ${action} payment in ${payment.status} state`
        );
      }

      // Execute the action
      const updates = await execute(payment);

      // Update payment and record operation atomically
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          ...updates,
          status: transition.to,
        },
      });

      await tx.paymentOperation.create({
        data: {
          idempotencyKey,
          paymentId,
          action,
          previousState: payment.status,
          newState: transition.to,
        },
      });

      return updatedPayment;
    });
  }
}
```

### 6. Client-Side Idempotency

```typescript
// Client implementation for idempotent requests

class IdempotentClient {
  private pendingKeys = new Map<string, Promise<Response>>();

  async request(
    url: string,
    options: RequestInit & { idempotencyKey?: string }
  ): Promise<Response> {
    const idempotencyKey = options.idempotencyKey || crypto.randomUUID();
    
    // Check if we already have a pending request with this key
    const pending = this.pendingKeys.get(idempotencyKey);
    if (pending) {
      return pending;
    }
    
    const requestPromise = this.executeWithRetry(url, {
      ...options,
      headers: {
        ...options.headers,
        'Idempotency-Key': idempotencyKey,
      },
    });
    
    // Store pending promise
    this.pendingKeys.set(idempotencyKey, requestPromise);
    
    try {
      const response = await requestPromise;
      return response;
    } finally {
      this.pendingKeys.delete(idempotencyKey);
    }
  }

  private async executeWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // 409 Conflict - another request with same key in progress
        if (response.status === 409) {
          await this.delay(Math.pow(2, attempt) * 100);
          continue;
        }
        
        // Check if response was replayed
        const replayed = response.headers.get('Idempotent-Replayed');
        if (replayed === 'true') {
          console.log('Received cached idempotent response');
        }
        
        return response;
        
      } catch (error) {
        lastError = error as Error;
        
        // Retry on network errors (with same idempotency key)
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 100);
          continue;
        }
      }
    }
    
    throw lastError || new Error('Request failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const client = new IdempotentClient();

// Same idempotency key ensures same result
const idempotencyKey = crypto.randomUUID();

const result1 = await client.request('/api/payments', {
  method: 'POST',
  body: JSON.stringify({ amount: 100 }),
  idempotencyKey,
});

// If first request timed out, retry with SAME key
const result2 = await client.request('/api/payments', {
  method: 'POST',
  body: JSON.stringify({ amount: 100 }),
  idempotencyKey,  // Same key!
});

// result1 and result2 will be the same payment
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No scope isolation | Cross-user conflicts | Include user/tenant in key |
| Key reuse with different body | Data inconsistency | Validate request body matches |
| Too short TTL | Lost idempotency | Keep records for 24h+ |
| No conflict handling | Race conditions | Use locks + 409 responses |
| Client key generation only | Missing coverage | Generate keys server-side for some cases |
| Not handling partial failures | Inconsistent state | Use transactions + state machines |

## Checklist

- [ ] Idempotency-Key header accepted on mutating endpoints
- [ ] Keys scoped to user/tenant
- [ ] Request body validated against stored key
- [ ] Lock mechanism prevents concurrent processing
- [ ] Completed responses cached for replay
- [ ] 409 Conflict returned for in-progress duplicates
- [ ] Idempotent-Replayed header on cached responses
- [ ] TTL appropriate for use case (24h+)
- [ ] Client retries use same idempotency key
- [ ] Database constraints as backup

## References

- [Stripe: Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)
- [AWS: Making Retries Safe](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [RFC 7231: HTTP Semantics](https://datatracker.ietf.org/doc/html/rfc7231#section-4.2.2)
- [Designing Robust APIs](https://brandur.org/idempotency-keys)
