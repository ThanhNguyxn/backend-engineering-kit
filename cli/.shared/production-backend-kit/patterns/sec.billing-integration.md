---
id: sec.billing-integration
title: Billing/Stripe Integration Lite
tags: [security, billing, stripe, webhooks]
scope: security
level: intermediate
maturity: stable
stacks: [nodejs, python, go, all]
description: Secure Stripe integration with webhook handling for SaaS
version: 2.0.0
sources:
  - https://stripe.com/docs/webhooks
  - https://stripe.com/docs/billing/subscriptions/overview
  - https://stripe.com/docs/api/idempotent_requests
---

# Billing/Stripe Integration Lite

## Problem

SaaS billing requires secure webhook handling, proper signature verification, and idempotent processing to avoid double-charges or missed events.

## When to use

- Integrating Stripe (or similar) for subscriptions
- Need webhook processing for payment events
- Want to sync billing state with app database
- Require idempotent payment processing

## Solution

### 1. Webhook Signature Verification

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }), // Raw body required!
  async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      logger.warn({ event: 'WEBHOOK_SIGNATURE_FAILED', error: err.message });
      return res.status(400).send('Webhook signature verification failed');
    }
    
    // Process event
    await handleStripeEvent(event);
    
    res.json({ received: true });
  }
);
```

### 2. Idempotent Event Processing

```typescript
async function handleStripeEvent(event: Stripe.Event) {
  // Check if already processed
  const existing = await db.webhookEvents.findOne({ stripeEventId: event.id });
  if (existing) {
    logger.info({ event: 'WEBHOOK_DUPLICATE', stripeEventId: event.id });
    return; // Already processed
  }
  
  // Store event first (with processing status)
  await db.webhookEvents.create({
    stripeEventId: event.id,
    type: event.type,
    data: event.data,
    status: 'processing',
    receivedAt: new Date(),
  });
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }
    
    await db.webhookEvents.update(
      { stripeEventId: event.id },
      { status: 'completed', processedAt: new Date() }
    );
  } catch (error) {
    await db.webhookEvents.update(
      { stripeEventId: event.id },
      { status: 'failed', error: error.message }
    );
    throw error; // Stripe will retry
  }
}
```

### 3. Subscription State Sync

```typescript
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Find tenant by Stripe customer ID
  const tenant = await db.tenants.findOne({ stripeCustomerId: customerId });
  if (!tenant) {
    logger.error({ event: 'TENANT_NOT_FOUND', customerId });
    return;
  }
  
  // Map Stripe status to app status
  const planStatus = mapSubscriptionStatus(subscription.status);
  const planName = getPlanFromPriceId(subscription.items.data[0]?.price.id);
  
  await db.tenants.update(
    { id: tenant.id },
    {
      plan: planName,
      planStatus,
      subscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    }
  );
  
  logger.info({
    event: 'SUBSCRIPTION_UPDATED',
    tenantId: tenant.id,
    plan: planName,
    status: planStatus,
  });
}

function mapSubscriptionStatus(stripeStatus: string): string {
  const mapping: Record<string, string> = {
    'active': 'active',
    'trialing': 'trial',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'suspended',
  };
  return mapping[stripeStatus] || 'unknown';
}
```

### 4. Creating Checkout Sessions

```typescript
async function createCheckoutSession(
  tenantId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const tenant = await db.tenants.findById(tenantId);
  
  // Create or reuse Stripe customer
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.billingEmail,
      metadata: { tenantId },
    });
    customerId = customer.id;
    await db.tenants.update({ id: tenantId }, { stripeCustomerId: customerId });
  }
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId }, // For webhook processing
  });
  
  return session.url!;
}
```

### 5. Handling Payment Failures

```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const tenant = await db.tenants.findOne({ stripeCustomerId: customerId });
  
  if (!tenant) return;
  
  // Update tenant status
  await db.tenants.update(
    { id: tenant.id },
    { planStatus: 'payment_failed' }
  );
  
  // Notify tenant admins
  const admins = await db.users.find({ 
    tenantId: tenant.id, 
    role: 'admin' 
  });
  
  for (const admin of admins) {
    await emailService.send({
      to: admin.email,
      template: 'payment-failed',
      data: {
        tenantName: tenant.name,
        amount: invoice.amount_due / 100,
        currency: invoice.currency.toUpperCase(),
        updatePaymentUrl: `/billing/update-payment`,
      }
    });
  }
}
```

## Pitfalls

1. **Not verifying signatures**: Critical security vulnerability
2. **Parsing body as JSON before Stripe**: Need raw body for verification
3. **Not handling retries**: Events may be sent multiple times
4. **Blocking webhook response**: Process async, respond quickly

## Checklist

- [ ] Webhook signature verification in place
- [ ] Idempotency using event ID tracking
- [ ] All relevant event types handled
- [ ] Subscription state synced to database
- [ ] Payment failure notifications sent
- [ ] Webhook endpoint returns quickly (< 5s)
- [ ] Failed events are retried or logged
