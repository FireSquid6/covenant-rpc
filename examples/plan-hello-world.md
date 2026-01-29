# Covenant Hello World Example - Implementation Plan

## Overview
A minimal Next.js application demonstrating basic Covenant RPC usage with a single "hello world" procedure.

## Project Structure
```
examples/covenant-hello-world/
├── src/
│   ├── covenant.ts                 # Shared covenant definition
│   ├── server/
│   │   ├── server.ts               # CovenantServer setup
│   │   ├── auth.ts                 # Simple username/password auth
│   │   └── db.ts                   # Drizzle setup with SQLite
│   ├── client/
│   │   └── client.ts               # CovenantReactClient setup
│   └── app/                        # Next.js app directory
│       ├── layout.tsx              # Root layout
│       ├── page.tsx                # Home page with hello world
│       ├── login/
│       │   └── page.tsx            # Login page
│       └── api/
│           └── covenant/
│               └── route.ts        # API route handler
├── tests/
│   ├── unit/
│   │   └── procedures.test.ts     # Unit tests for procedures
│   ├── integration/
│   │   └── server.test.ts         # Integration tests
│   └── e2e/
│       └── hello.spec.ts          # Playwright e2e tests
├── drizzle/
│   └── schema.ts                  # Database schema
├── playwright.config.ts           # Playwright configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack
- **Runtime**: Bun
- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+
- **Database**: SQLite with Drizzle ORM
- **Testing**: Bun test + Playwright
- **RPC**: Covenant (@covenant/core, @covenant/server, @covenant/client, @covenant/react)

## Feature Requirements

### 1. Authentication
- Simple username/password system (no encryption needed - this is for demo)
- Users table: id, username, password
- Login procedure that returns a token
- Context generator that validates token and provides user

### 2. Hello World Procedure
- `getHello` query that returns personalized greeting
- Input: none (uses authenticated user from context)
- Output: `{ message: string, username: string }`
- Resource: `user/{userId}`

### 3. UI Components
- Login page with username/password form
- Home page that displays hello world message
- Simple navigation/logout
- Loading and error states

### 4. Testing Coverage
- **Unit tests**: Test procedures in isolation using `directClientToServer`
- **Integration tests**: Test full server with database
- **E2E tests**: Test UI flows (login → see hello message → logout)

## Implementation Steps

### Step 1: Project Setup
1. Create directory structure
2. Initialize package.json with dependencies:
   - @covenant/core, @covenant/server, @covenant/client, @covenant/react, @covenant/ion
   - next, react, react-dom
   - drizzle-orm, drizzle-kit
   - @types/bun
   - playwright
3. Create tsconfig.json
4. Create playwright.config.ts

### Step 2: Database Schema
1. Create drizzle/schema.ts with users table
2. Create drizzle.config.ts
3. Set up database connection in src/server/db.ts
4. Create initialization script to create tables

### Step 3: Covenant Definition
1. Create src/covenant.ts with:
   - `login` mutation (input: username/password, output: token)
   - `getHello` query (input: null, output: message + username)
2. Export covenant type

### Step 4: Server Implementation
1. Create src/server/auth.ts:
   - Token generation/validation functions
   - User lookup functions
2. Create src/server/server.ts:
   - CovenantServer with contextGenerator (validate token → user)
   - Derivation with `requireAuth()` helper
   - Define `login` procedure (validate credentials, return token)
   - Define `getHello` procedure (get user, return greeting)
   - Call `assertAllDefined()`

### Step 5: Client Setup
1. Create src/client/client.ts:
   - CovenantReactClient instance
   - httpClientToServer pointing to /api/covenant
   - emptyClientToSidekick (no realtime needed)
   - Auth token management

### Step 6: Next.js API Route
1. Create src/app/api/covenant/route.ts:
   - Export POST handler that calls server.handle(request)

### Step 7: UI Components
1. Create src/app/layout.tsx (basic layout)
2. Create src/app/login/page.tsx:
   - Form for username/password
   - Call client.mutate("login")
   - Store token in localStorage
   - Redirect to home on success
3. Create src/app/page.tsx:
   - Check for auth token
   - Use client.useQuery("getHello")
   - Display greeting with loading/error states
   - Logout button

### Step 8: Unit Tests
1. Create tests/unit/procedures.test.ts:
   - Test login with valid credentials
   - Test login with invalid credentials
   - Test getHello with authenticated user
   - Test getHello without authentication
   - Use directClientToServer for fast in-memory tests

### Step 9: Integration Tests
1. Create tests/integration/server.test.ts:
   - Test full flow: create user → login → getHello
   - Test with real database (in-memory SQLite)
   - Test error handling

### Step 10: E2E Tests
1. Create tests/e2e/hello.spec.ts:
   - Test: Navigate to login → enter credentials → see hello message
   - Test: Access home without login → redirect to login
   - Test: Login → logout → verify logged out

### Step 11: Documentation
1. Create README.md with:
   - Setup instructions
   - How to run the app
   - How to run tests
   - Architecture explanation

## Testing Strategy

### Unit Tests (Bun Test)
- Fast, isolated procedure tests
- Mock database or use in-memory
- Focus on business logic

### Integration Tests (Bun Test)
- Test server + database together
- Use temporary SQLite files
- Test full request/response cycle

### E2E Tests (Playwright)
- Test real browser interactions
- Start dev server before tests
- Test complete user flows

## Key Patterns to Demonstrate

1. **Covenant Pattern**: Clean separation between covenant definition and implementation
2. **Context/Derivation**: Show how to handle authentication
3. **Error Handling**: Proper error responses from procedures
4. **React Hooks**: Use useQuery for data fetching
5. **Testing**: Complete test coverage at all levels

## Dependencies

```json
{
  "dependencies": {
    "@covenant/core": "workspace:*",
    "@covenant/server": "workspace:*",
    "@covenant/client": "workspace:*",
    "@covenant/react": "workspace:*",
    "@covenant/ion": "workspace:*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "drizzle-orm": "latest",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "drizzle-kit": "latest",
    "@playwright/test": "^1.40.0",
    "playwright": "^1.40.0"
  }
}
```

## Success Criteria

- ✅ User can log in with username/password
- ✅ Authenticated user sees personalized hello message
- ✅ Unauthenticated access is blocked
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All e2e tests pass
- ✅ Code follows Covenant patterns from guide.md
- ✅ README documents setup and usage

## Potential Covenant Issues to Watch For

- Token serialization through Ion format
- Context generator async behavior
- Error propagation from procedures to client
- Type inference from Zod schemas
- Workspace package resolution
