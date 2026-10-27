# PyAssess — Secure Python Examination & Assessment Platform

> Enterprise-grade, production-oriented Python examination platform featuring transparent browser anti-cheating telemetry, server-authoritative trust scoring with automatic termination, Monaco code editor without runtime execution bias, and isolated behavioral unit-test auto-grading.

---

## 1. System Architecture

```text
                           ┌─────────────────────────────────────────┐
                           │      Next.js 14 Web Frontend           │
                           │   (App Router + Monaco Editor)          │
                           └────────────────────┬────────────────────┘
                                                │
                          Supabase Google OAuth │ Bearer JWT / Telemetry
                                                ▼
                           ┌─────────────────────────────────────────┐
                           │       Node.js + Express REST API        │
                           │       (TypeScript + Prisma ORM)         │
                           └──────┬──────────────────────┬───────────┘
                                  │                      │
           Server Token Validation│                      │ Internal HTTP + HMAC Secret
                                  ▼                      ▼
                     ┌───────────────────────┐ ┌───────────────────────────┐
                     │ Supabase / PostgreSQL │ │  Isolated Python Runner   │
                     │  (Relational Storage) │ │ (Sandbox Ephemeral Worker)│
                     └───────────────────────┘ └───────────────────────────┘
```

### Core Architectural Tenets
1. **Server-Authoritative Lifecycle**: Exam start times, countdown deadlines, attempt states, and trust scores are calculated and enforced exclusively by the Express backend. Client clocks are never trusted.
2. **Strict Telemetric Termination Floor**: Candidates initiate with a 100% baseline trust score. Telemetric incidents (blur, visibility loss, fullscreen exit) apply server-validated penalties. If the score falls **strictly below 70%** (`< 70`), the active attempt terminates immediately and halts input to prevent compounding penalties. A score of exactly 70% remains operational.
3. **Restricted Candidate Workspace**: During active examinations, candidates write solutions inside Monaco Editor without interactive stdout or "Run Code" triggers, preventing trial-and-error discovery of test cases.
4. **Isolated Behavioral Grading**: Untrusted Python code is never executed inside the Express process. Submissions are queued and dispatched to an unprivileged Python execution worker (`services/python-runner`) with CPU, memory, output, and wall-clock limits. Grading inspects behavioral stdin/stdout correspondence rather than fixed string matching.
5. **Private Hidden Test Cases**: Hidden test cases, inputs, expected outputs, and unreleased grades are never sent to the client browser until authorized release by an instructor.

---

## 2. Monorepo Structure

```text
pyassess/
├── apps/
│   ├── web/                     # Next.js 14 App Router, Monaco Editor, Tailwind CSS
│   │   ├── src/
│   │   │   ├── app/             # Application routes & layouts
│   │   │   ├── components/      # Accessible UI components (Navbar, Stepper, Bento cards)
│   │   │   └── lib/             # API client & Supabase browser integration
│   │   ├── tailwind.config.ts   # Academic Precision design tokens
│   │   └── package.json
│   │
│   └── api/                     # Node.js Express API, Prisma ORM, Vitest
│       ├── src/
│       │   ├── config/          # Zod-validated environment config
│       │   ├── middleware/      # Supabase Auth verification & RBAC authorization
│       │   ├── modules/
│       │   │   ├── auth/        # Profile bootstrapping & query-driven metrics
│       │   │   ├── exams/       # Exam CRUD, versioning & cryptographic keys
│       │   │   ├── attempts/    # Eligibility, atomic start, autosave & submit
│       │   │   ├── monitoring/  # Telemetry ingestion & < 70% termination guard
│       │   │   ├── grading/     # Stdin/stdout comparator & worker dispatcher
│       │   │   ├── instructor/  # Adjudication, attempt reopening & grade override
│       │   │   └── admin/       # User management, RBAC promotion & audit logs
│       │   ├── app.ts           # Express application factory
│       │   └── server.ts        # Server entrypoint
│       ├── prisma/
│       │   └── schema.prisma    # PostgreSQL relational schema
│       ├── tests/               # Backend Vitest suite (14 passing tests)
│       └── package.json
│
├── services/
│   └── python-runner/           # Isolated sandbox worker service
│       ├── src/
│       │   ├── sandbox.ts       # Ephemeral directory executor with timeout watchdog
│       │   └── index.ts         # HMAC-authenticated internal HTTP endpoint
│       ├── src/__tests__/       # Sandbox Vitest suite (4 passing tests)
│       ├── Dockerfile           # Unprivileged runner container configuration
│       └── package.json
│
├── packages/
│   └── shared/                  # Domain models, constants, and trust rules
│       ├── src/index.ts
│       └── package.json
│
├── docker-compose.yml           # Local multi-service orchestration
├── .env.example                 # Comprehensive environment variable template
└── README.md
```

---

## 3. Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, `@monaco-editor/react`.
- **Backend API**: Node.js 20 LTS, Express.js, TypeScript, Prisma ORM, Zod, Helmet, CORS.
- **Database**: PostgreSQL 15+ (Supabase compatible).
- **Authentication**: Supabase Auth with Google OAuth.
- **Execution Worker**: Python 3.12 / 3.13 isolated subprocess worker with wall-clock timer watchdogs and output stream buffers.
- **Testing**: Vitest with unit and integration test coverage.

---

## 4. Environment Configuration

Create `.env` at the root by copying `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Express REST API port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/pyassess?schema=public` |
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase server-side service role key | `your-service-role-key` |
| `INITIAL_ADMIN_EMAIL` | Trusted Google email promoted to admin on first sign-in | `admin@astu.edu.et` |
| `PYTHON_RUNNER_URL` | URL to isolated Python execution service | `http://localhost:5001` |
| `PYTHON_RUNNER_SECRET` | Shared HMAC secret for internal runner authentication | `dev-isolated-runner-secret-key-astu-2026` |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend API base endpoint | `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase anon key | `your-anon-key` |

---

## 5. Getting Started (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Shared Domain Package
```bash
npm run build --workspace=@pyassess/shared
```

### 3. Generate Database Client & Run Migrations
```bash
npm run prisma:generate --workspace=@pyassess/api
npm run prisma:push --workspace=@pyassess/api
```

### 4. Start Development Services

In separate terminal windows (or via workspace scripts):

- **Isolated Python Runner** (Port 5001):
  ```bash
  npm run dev --workspace=@pyassess/python-runner
  ```

- **Express API Backend** (Port 4000):
  ```bash
  npm run dev --workspace=@pyassess/api
  ```

- **Next.js Web Frontend** (Port 3000):
  ```bash
  npm run dev --workspace=@pyassess/web
  ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Testing

PyAssess features a test suite covering trust scoring, cryptographic keys, output comparison modes, and isolated Python execution:

```bash
# Run Python runner tests (4 tests)
npm test --workspace=@pyassess/python-runner

# Run Backend API tests (14 tests)
npm test --workspace=@pyassess/api
```

### Test Coverage Highlights
- **Trust Score Rule**: Strictly `< 70%` halts session; exactly `70%` remains operational.
- **Python Sandbox**: Syntax errors, runtime errors (ZeroDivisionError), and infinite loop timeouts (`TIME_LIMIT_EXCEEDED`).
- **Grading Output Comparators**: `TRIMMED_TEXT` (whitespace & CRLF normalization), `EXACT_TEXT`, and `NUMERIC_TOLERANCE` within 1e-4.
- **Exam Token Security**: Nonce generation via `crypto.randomBytes` and SHA-256 hash validation.

---

## 7. Role-Based Access Control (RBAC)

The platform supports three distinct application roles:

| Capability | Student | Instructor | Admin |
|---|:---:|:---:|:---:|
| Enter Exam with Access Token | ✅ | ✅ | ✅ |
| Acknowledge Rules & Start Attempt | ✅ | ❌ | ❌ |
| Monaco Editor & Debounced Autosave | ✅ | ❌ | ❌ |
| Run Code Interactively During Exam | ❌ | ❌ | ❌ |
| View Unreleased Grades / Hidden Tests | ❌ | ✅ | ✅ |
| Create, Edit & Publish Examinations | ❌ | ✅ | ✅ |
| Generate Cryptographic Access Tokens | ❌ | ✅ | ✅ |
| Reopen Flagged Attempt with Justification | ❌ | ✅ | ✅ |
| Override Grade with Mandatory Audit Reason | ❌ | ✅ | ✅ |
| Release Official Results to Candidates | ❌ | ✅ | ✅ |
| User Directory & Role Promotion/Demotion | ❌ | ❌ | ✅ |
| Suspend & Reactivate Accounts | ❌ | ❌ | ✅ |
| View Immutable Platform Audit Trail | ❌ | ❌ | ✅ |

---

## 8. Anti-Cheating & Browser Telemetry Protocol

### Monitored Events & Penalties

| Event Trigger | Penalty | Rationale |
|---|:---:|---|
| `WINDOW_BLUR` | -10% | OS window lost active focus |
| `VISIBILITY_HIDDEN` | -10% | Tab switched or browser minimized |
| `FULLSCREEN_EXIT` | -10% | Candidate escaped locked fullscreen bounds |
| `CLIPBOARD_COPY` | -5% | Unauthorized copy command attempt |
| `CLIPBOARD_PASTE` | -5% | External clipboard insertion attempt |
| `CONTEXT_MENU` | -3% | Suppressed context menu request |

### Technical Limitations Disclosure
PyAssess acknowledges that a web browser cannot guarantee 100% prevention of external physical devices, secondary monitors, or operating-system-level screen recorders. Therefore, telemetry events serve as objective evidence requiring human instructor context and non-punitive review, rather than automatic presumption of academic misconduct.

---

## 9. License

MIT License. Designed and engineered for academic integrity and modern university computer science curricula.
