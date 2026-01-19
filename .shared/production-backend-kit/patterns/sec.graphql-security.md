---
id: api-graphql-security
title: GraphQL Security Best Practices
tags:
  - security
  - graphql
  - api
  - query-complexity
  - depth-limit
level: intermediate
stacks:
  - graphql
  - apollo
  - nodejs
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html
  - https://www.apollographql.com/docs/apollo-server/security/
  - https://graphql.org/learn/authorization/
  - https://escape.tech/blog/9-graphql-security-best-practices/
---

# GraphQL Security Best Practices

## Problem

GraphQL introduces unique security challenges:
- **Denial of Service**: Deeply nested or complex queries can overwhelm servers
- **Information Disclosure**: Introspection exposes entire API schema
- **Batching Attacks**: Multiple operations in single request
- **Injection**: Query parameters can be exploited
- **Authorization Complexity**: Field-level permissions are harder

REST comparison:
```
REST:  GET /users/123         → 1 endpoint, predictable load
GraphQL: query { users { posts { comments { ... } } } } → Unbounded complexity
```

## When to use

- Any production GraphQL API
- Public-facing GraphQL endpoints
- APIs with sensitive data
- Multi-tenant GraphQL services

## Solution

### 1. Query Depth Limiting

```typescript
import { ApolloServer } from '@apollo/server';
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(5), // Max depth of 5 levels
  ],
});

// What gets blocked:
// query {
//   user {           // 1
//     posts {        // 2
//       comments {   // 3
//         author {   // 4
//           posts {  // 5
//             comments { // 6 → BLOCKED
//             }
//           }
//         }
//       }
//     }
//   }
// }
```

### 2. Query Complexity Analysis

```typescript
import { createComplexityRule, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';

const complexityRule = createComplexityRule({
  maximumComplexity: 1000,
  
  estimators: [
    // Use @complexity directive from schema
    fieldExtensionsEstimator(),
    
    // Default: 1 point per field, multiplied by list size
    simpleEstimator({ defaultComplexity: 1 }),
  ],
  
  onComplete: (complexity: number) => {
    console.log('Query Complexity:', complexity);
  },
  
  createError: (max: number, actual: number) => {
    return new GraphQLError(
      `Query too complex: ${actual} > ${max} maximum allowed complexity`
    );
  },
});

// Schema with complexity hints
const typeDefs = gql`
  type Query {
    user(id: ID!): User @complexity(value: 1)
    
    users(
      first: Int = 10
      after: String
    ): UserConnection @complexity(
      value: 1
      multipliers: ["first"]  # 1 * first
    )
    
    searchUsers(query: String!): [User!]! @complexity(
      value: 10  # Expensive operation
      multipliers: ["first"]
    )
  }
  
  type User {
    id: ID!
    name: String!
    email: String! @complexity(value: 1)
    
    # N+1 potential - higher cost
    posts(first: Int = 10): [Post!]! @complexity(
      value: 5
      multipliers: ["first"]
    )
  }
`;
```

### 3. Disable Introspection in Production

```typescript
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginInlineTraceDisabled } from '@apollo/server/plugin/disabled';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  
  // Disable introspection in production
  introspection: process.env.NODE_ENV !== 'production',
  
  plugins: [
    // Also disable inline tracing
    ApolloServerPluginInlineTraceDisabled(),
    
    // Custom plugin to block introspection
    {
      async requestDidStart() {
        return {
          async didResolveOperation({ request, document }) {
            // Check if query contains __schema or __type
            const isIntrospection = request.operationName === 'IntrospectionQuery';
            
            if (isIntrospection && process.env.NODE_ENV === 'production') {
              throw new GraphQLError('Introspection disabled in production');
            }
          },
        };
      },
    },
  ],
});
```

### 4. Rate Limiting for GraphQL

```typescript
import { GraphQLError } from 'graphql';

interface RateLimitContext {
  ip: string;
  userId?: string;
}

// Complexity-based rate limiting
class GraphQLRateLimiter {
  private limits = new Map<string, { points: number; resetAt: number }>();
  
  private config = {
    maxComplexityPerMinute: 10000,
    maxQueriesPerMinute: 100,
    windowMs: 60000,
  };

  async checkLimit(
    context: RateLimitContext,
    complexity: number
  ): Promise<void> {
    const key = context.userId || context.ip;
    const now = Date.now();
    
    let bucket = this.limits.get(key);
    
    if (!bucket || bucket.resetAt < now) {
      bucket = { points: 0, resetAt: now + this.config.windowMs };
      this.limits.set(key, bucket);
    }
    
    bucket.points += complexity;
    
    if (bucket.points > this.config.maxComplexityPerMinute) {
      throw new GraphQLError('Rate limit exceeded', {
        extensions: {
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
        },
      });
    }
  }
}

// Apollo Server plugin
const rateLimitPlugin = {
  async requestDidStart({ contextValue }) {
    return {
      async didResolveOperation({ request, document, contextValue }) {
        const complexity = calculateComplexity(document);
        await rateLimiter.checkLimit(
          { ip: contextValue.ip, userId: contextValue.userId },
          complexity
        );
      },
    };
  },
};
```

### 5. Field-Level Authorization

```typescript
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLSchema } from 'graphql';

// Schema with auth directives
const typeDefs = gql`
  directive @auth(requires: Role!) on FIELD_DEFINITION
  directive @owner on FIELD_DEFINITION
  
  enum Role {
    ADMIN
    USER
    GUEST
  }
  
  type User {
    id: ID!
    name: String!
    email: String! @auth(requires: USER) @owner
    role: Role! @auth(requires: ADMIN)
    
    privateData: PrivateData @auth(requires: ADMIN)
  }
  
  type Query {
    me: User @auth(requires: USER)
    users: [User!]! @auth(requires: ADMIN)
  }
`;

// Transform schema to add authorization
function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];
      const ownerDirective = getDirective(schema, fieldConfig, 'owner')?.[0];
      
      if (authDirective || ownerDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;
        
        fieldConfig.resolve = async (source, args, context, info) => {
          // Check role-based auth
          if (authDirective) {
            const requiredRole = authDirective.requires;
            if (!hasRole(context.user, requiredRole)) {
              throw new GraphQLError('Not authorized', {
                extensions: { code: 'FORBIDDEN' },
              });
            }
          }
          
          // Check ownership
          if (ownerDirective && source) {
            const resourceOwnerId = source.userId || source.id;
            if (resourceOwnerId !== context.user?.id) {
              // Return null instead of error for non-owners
              return null;
            }
          }
          
          return resolve(source, args, context, info);
        };
      }
      
      return fieldConfig;
    },
  });
}

function hasRole(user: User | null, requiredRole: string): boolean {
  if (!user) return false;
  
  const roleHierarchy = { ADMIN: 3, USER: 2, GUEST: 1 };
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}
```

### 6. Input Validation

```typescript
import { GraphQLError } from 'graphql';
import { z } from 'zod';

// Zod schemas for validation
const CreateUserInput = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
  password: z.string().min(8).max(72),
});

const SearchInput = z.object({
  query: z.string().min(1).max(100),
  first: z.number().int().min(1).max(100).default(10),
  after: z.string().optional(),
});

// Resolver with validation
const resolvers = {
  Mutation: {
    createUser: async (_, { input }, context) => {
      // Validate input
      const result = CreateUserInput.safeParse(input);
      
      if (!result.success) {
        throw new GraphQLError('Invalid input', {
          extensions: {
            code: 'BAD_USER_INPUT',
            validationErrors: result.error.flatten().fieldErrors,
          },
        });
      }
      
      // Sanitize - remove potential SQL/NoSQL injection
      const sanitizedInput = {
        ...result.data,
        email: result.data.email.toLowerCase().trim(),
        name: result.data.name.trim(),
      };
      
      return userService.create(sanitizedInput);
    },
  },
  
  Query: {
    searchUsers: async (_, args, context) => {
      const result = SearchInput.safeParse(args);
      
      if (!result.success) {
        throw new GraphQLError('Invalid search parameters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      
      // Escape special characters for search
      const safeQuery = escapeSearchQuery(result.data.query);
      
      return userService.search(safeQuery, result.data.first, result.data.after);
    },
  },
};

// Escape regex/search special chars
function escapeSearchQuery(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 7. Batching Attack Prevention

```typescript
import { ApolloServer } from '@apollo/server';

// Limit batched operations
const server = new ApolloServer({
  typeDefs,
  resolvers,
  
  // Disable batching entirely
  allowBatchedHttpRequests: false,
  
  // Or limit batch size via plugin
  plugins: [{
    async requestDidStart() {
      return {
        async parsingDidStart({ request }) {
          // Check for batched queries
          if (Array.isArray(request.http?.body)) {
            const batchSize = request.http.body.length;
            if (batchSize > 5) {
              throw new GraphQLError(
                `Batch size ${batchSize} exceeds maximum of 5`
              );
            }
          }
        },
      };
    },
  }],
});

// Prevent alias-based batching attacks
// Attacker could do: query { a1: user(id: 1) a2: user(id: 2) ... a1000: user(id: 1000) }
import { parse, visit } from 'graphql';

function limitAliases(query: string, maxAliases: number = 10): void {
  const document = parse(query);
  let aliasCount = 0;
  
  visit(document, {
    Field(node) {
      if (node.alias) {
        aliasCount++;
        if (aliasCount > maxAliases) {
          throw new GraphQLError(`Too many aliases: max ${maxAliases} allowed`);
        }
      }
    },
  });
}
```

### 8. Persisted Queries (APQ)

```typescript
import { ApolloServer } from '@apollo/server';
import { 
  ApolloServerPluginCacheControl,
  ApolloServerPluginLandingPageDisabled,
} from '@apollo/server/plugin/disabled';
import { createHash } from 'crypto';

// Persisted query store
const queryStore = new Map<string, string>();

// Pre-register allowed queries
const allowedQueries = [
  `query GetUser($id: ID!) { user(id: $id) { id name email } }`,
  `query ListUsers { users { id name } }`,
  `mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }`,
];

// Hash and store queries
allowedQueries.forEach(query => {
  const hash = createHash('sha256').update(query).digest('hex');
  queryStore.set(hash, query);
});

// Plugin to enforce persisted queries
const persistedQueriesPlugin = {
  async requestDidStart({ request }) {
    const extensions = request.extensions as { persistedQuery?: { sha256Hash: string } };
    
    // In production, ONLY allow persisted queries
    if (process.env.NODE_ENV === 'production') {
      if (!extensions?.persistedQuery) {
        throw new GraphQLError('Only persisted queries allowed in production');
      }
      
      const hash = extensions.persistedQuery.sha256Hash;
      const query = queryStore.get(hash);
      
      if (!query) {
        throw new GraphQLError('Unknown persisted query', {
          extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
        });
      }
      
      // Replace request query with stored query
      request.query = query;
    }
    
    return {};
  },
};

// Apollo Client with APQ
// import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';
// import { sha256 } from 'crypto-hash';
//
// const link = createPersistedQueryLink({ sha256 }).concat(httpLink);
```

### 9. Query Cost Analysis with DataLoader

```typescript
import DataLoader from 'dataloader';

// Prevent N+1 AND track costs
class CostAwareDataLoader<K, V> {
  private loader: DataLoader<K, V>;
  private loadCount = 0;
  private maxLoads: number;

  constructor(
    batchFn: (keys: readonly K[]) => Promise<(V | Error)[]>,
    maxLoads: number = 100
  ) {
    this.maxLoads = maxLoads;
    this.loader = new DataLoader(async (keys) => {
      this.loadCount += keys.length;
      
      if (this.loadCount > this.maxLoads) {
        throw new GraphQLError(
          `Too many database loads: ${this.loadCount} > ${this.maxLoads}`,
          { extensions: { code: 'QUERY_TOO_EXPENSIVE' } }
        );
      }
      
      return batchFn(keys);
    });
  }

  load(key: K): Promise<V> {
    return this.loader.load(key);
  }

  loadMany(keys: K[]): Promise<(V | Error)[]> {
    return this.loader.loadMany(keys);
  }
}

// Context factory
function createContext({ req }): GraphQLContext {
  return {
    user: req.user,
    loaders: {
      user: new CostAwareDataLoader(
        async (ids) => userService.findByIds(ids),
        100
      ),
      post: new CostAwareDataLoader(
        async (ids) => postService.findByIds(ids),
        200
      ),
    },
  };
}
```

### 10. Logging and Monitoring

```typescript
const auditPlugin = {
  async requestDidStart({ request, contextValue }) {
    const startTime = Date.now();
    
    return {
      async didResolveOperation({ request, document, operationName }) {
        // Log operation details
        logger.info({
          type: 'graphql_operation',
          operationName,
          query: request.query,
          variables: sanitizeVariables(request.variables),
          userId: contextValue.user?.id,
          ip: contextValue.ip,
        });
      },
      
      async willSendResponse({ response }) {
        const duration = Date.now() - startTime;
        
        metrics.histogram('graphql.request.duration', duration, {
          operationName: request.operationName,
          hasErrors: response.body.singleResult?.errors ? 'true' : 'false',
        });
        
        // Alert on slow queries
        if (duration > 5000) {
          logger.warn({
            type: 'slow_graphql_query',
            duration,
            operationName: request.operationName,
            query: request.query,
          });
        }
      },
      
      async didEncounterErrors({ errors }) {
        for (const error of errors) {
          logger.error({
            type: 'graphql_error',
            message: error.message,
            path: error.path,
            code: error.extensions?.code,
            userId: contextValue.user?.id,
          });
          
          metrics.increment('graphql.errors', {
            code: error.extensions?.code || 'UNKNOWN',
          });
        }
      },
    };
  },
};

// Sanitize variables to remove sensitive data
function sanitizeVariables(variables: Record<string, any> | undefined) {
  if (!variables) return undefined;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
  const sanitized = { ...variables };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

## Complete Server Configuration

```typescript
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import depthLimit from 'graphql-depth-limit';
import { createComplexityRule } from 'graphql-query-complexity';

const server = new ApolloServer({
  schema: authDirectiveTransformer(schema),
  
  // Validation rules
  validationRules: [
    depthLimit(7),
    createComplexityRule({
      maximumComplexity: 1000,
      estimators: [fieldExtensionsEstimator(), simpleEstimator()],
    }),
  ],
  
  // Disable introspection in production
  introspection: process.env.NODE_ENV !== 'production',
  
  // Disable batching
  allowBatchedHttpRequests: false,
  
  // Plugins
  plugins: [
    rateLimitPlugin,
    persistedQueriesPlugin,
    auditPlugin,
  ],
  
  // Format errors
  formatError: (formattedError, error) => {
    // Don't leak internal errors
    if (process.env.NODE_ENV === 'production') {
      if (!formattedError.extensions?.code) {
        return {
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        };
      }
    }
    return formattedError;
  },
});

const app = express();

app.use(
  '/graphql',
  express.json({ limit: '100kb' }), // Limit body size
  expressMiddleware(server, {
    context: async ({ req }) => ({
      user: await authenticateRequest(req),
      ip: req.ip,
      loaders: createLoaders(),
    }),
  })
);
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No depth limit | DoS via nested queries | Use graphql-depth-limit |
| No complexity limit | Resource exhaustion | Implement query cost analysis |
| Introspection in prod | Schema disclosure | Disable for production |
| No rate limiting | Abuse, scraping | Complexity-aware rate limits |
| Missing field auth | Data leakage | Use auth directives |
| Unbounded lists | Memory exhaustion | Require pagination, max limits |
| Verbose errors | Information disclosure | Sanitize in production |
| No query logging | Audit failures | Log all operations |

## Checklist

- [ ] Query depth limit configured (max 5-7)
- [ ] Query complexity analysis enabled
- [ ] Complexity budget per client/IP
- [ ] Introspection disabled in production
- [ ] Batching disabled or limited
- [ ] Field-level authorization implemented
- [ ] Input validation on all mutations
- [ ] Rate limiting based on complexity
- [ ] DataLoader used to prevent N+1
- [ ] Persisted queries for production
- [ ] Request body size limited
- [ ] Audit logging for all operations
- [ ] Error messages sanitized
- [ ] Timeout configured for resolvers

## References

- [OWASP GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html)
- [Apollo Server Security](https://www.apollographql.com/docs/apollo-server/security/)
- [How to GraphQL Security](https://www.howtographql.com/advanced/4-security/)
- [graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity)
