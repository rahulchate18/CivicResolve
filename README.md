# CivicResolve — Online Complaint Registration Portal

CivicResolve is a production-grade, full-stack municipal grievance management and resolution web platform. Built with a decoupled **React 19 + Vite 8** frontend and an **Express 5 + Mongoose 9** RESTful API connected to **MongoDB Atlas**, it streamlines citizen complaint filing, officer investigation workflows, and administrative analytics with strict role-based access control and lifecycle state machines.

---

## 1. Project Overview & Key Features

- **Public Tracking & Transparency:** Citizens can file grievances with category, priority, contact details, and attachment metadata, tracking live progress via unique human-readable tracking IDs (e.g. `CMP-20261023-XXXX`).
- **Role-Based Workspaces:**
  - **Citizen (`USER`):** Real-time personal dashboard, grievance filing form with client/server validation, status history audit trail, embedded inquiry messaging thread, resolution confirmation/reopening, and 1–5 star rating submission.
  - **Officer (`AGENT`):** Department-scoped workload console, assigned complaint queue, status transitions (`IN_PROGRESS`, `RESOLVED`, `REJECTED`) with mandatory resolution or rejection notes, and citizen communication threads.
  - **Administrator (`ADMIN`):** Live MongoDB aggregation analytics (status, category, priority breakdowns, average resolution hours, officer workload tables), unassigned complaint dispatch, officer application verification/rejection with required reason notes, and user account access control.
- **Auditable Lifecycle State Machine:** Strict transitions (`PENDING` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED` or `REJECTED`) backed by an immutable chronological `statusHistory` audit trail.
- **Reliable Notification Service:** Asynchronous, non-blocking email dispatch via Nodemailer that fails open in simulated mode if SMTP is unavailable, preventing email errors from crashing database operations.
- **Enterprise Security:** JWT authentication with bcrypt password hashing, Express `helmet()` security headers, CORS origin protection, parameter validation via `express-validator`, and account-deactivation token revocation.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, React Router 7, Bootstrap 5, Bootstrap Icons, Axios, React Toastify |
| **Backend** | Node.js (v20+ / v24+), Express 5, Mongoose 9, CommonJS |
| **Database** | MongoDB Atlas (Multi-Cloud Replica Set) |
| **Security & Auth** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, `express-validator` |
| **Notifications** | Nodemailer with automated mock/fallback transport |
| **Testing** | Node.js Native Test Runner (`node:test`, `node:assert/strict`) — 70 Automated Tests |

---

## 3. Repository Architecture & Directory Structure

```text
online-complaint-registration/
├── .gitignore                      # Root Git ignore rules (protects all .env, node_modules, dist)
├── README.md                       # Comprehensive system documentation & deployment guide
├── client/                         # Single Page Application (React 19 + Vite 8)
│   ├── .env.example                # Frontend environment template (safe placeholders)
│   ├── eslint.config.js            # Flat ESLint configuration
│   ├── index.html                  # HTML5 entry with Inter font & Bootstrap Icons CDN
│   ├── package.json                # Frontend dependencies and scripts
│   ├── vite.config.js              # Vite bundler configuration
│   └── src/
│       ├── main.jsx                # React root mount with Bootstrap & Toastify CSS
│       ├── App.jsx                 # Central router with role-based route guards
│       ├── index.css               # Civic Portal Design System (badges, cards, timeline, chat)
│       ├── components/
│       │   ├── common/             # ProtectedRoute and RoleRoute guards
│       │   └── layout/             # Responsive Navbar and Civic Footer
│       ├── context/
│       │   └── AuthContext.jsx     # Centralized auth state & session restoration
│       ├── pages/
│       │   ├── HomePage.jsx        # Landing page with hero & quick tracking search
│       │   ├── NotFoundPage.jsx    # 404 Not Found & 403 Unauthorized screens
│       │   ├── ProfilePage.jsx     # Citizen/Officer profile view & edit
│       │   ├── auth/               # LoginPage and RegisterPage
│       │   ├── citizen/            # Dashboard, NewComplaint, List, Detail, Track
│       │   ├── officer/            # OfficerDutyConsole with status update & chat
│       │   └── admin/              # AdminCenter with live analytics & management tabs
│       └── services/
│           └── api.js              # Centralized Axios client with Bearer token interceptor
└── server/                         # Backend REST API (Express 5 + Mongoose 9)
    ├── .env.example                # Backend environment template (safe placeholders)
    ├── package.json                # Backend dependencies and test scripts
    ├── server.js                   # Express app entry, security headers, routes mount, DNS config
    ├── config/
    │   └── db.js                   # Mongoose connection with retry logic & DNS options
    ├── controllers/                # authController, complaintController, messageController, feedbackController, adminController
    ├── middleware/                 # authMiddleware (protect, authorize), errorMiddleware, validate
    ├── models/                     # User, Complaint, Agent, Message, Feedback
    ├── routes/                     # authRoutes, complaintRoutes, messageRoutes, feedbackRoutes, adminRoutes
    ├── services/                   # emailService with non-blocking error handling
    ├── validators/                 # authValidators, complaintValidators, messageValidators, feedbackValidators, adminValidators
    └── tests/                      # 6 Automated Test Suites (70 test cases total)
        ├── auth.test.js
        ├── models.test.js
        ├── complaint.test.js
        ├── messaging_feedback.test.js
        ├── admin_analytics.test.js
        └── security_e2e_hardening.test.js
```

---

## 🌟 SkillWallet SmartBridge Internship Evaluator Quick Start

This section provides internship evaluators with an instant, safe way to test and evaluate the portal across all three workspaces (**Citizen**, **Officer**, **Administrator**) using an isolated demo dataset without affecting any production records.

### 1. Evaluator Demo Credentials

The demo seed populates the dedicated database `civicresolve_demo` with the following test accounts:

| Role / Workspace | Email Address | Password | Persona & Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `demo.admin@civicresolve.demo` | `DemoAdmin2026!` | City Governance, Dispatch & Live Aggregations |
| **Officer (Technical)** | `officer.tech@civicresolve.demo` | `DemoOfficer2026!` | Technical Support & Public Infrastructure |
| **Officer (Billing)** | `officer.billing@civicresolve.demo` | `DemoOfficer2026!` | Revenue, Property Tax & Meter Billing |
| **Citizen (Jane)** | `citizen.jane@civicresolve.demo` | `DemoCitizen2026!` | Active Grievance Submitter & Chat Participant |
| **Citizen (John)** | `citizen.john@civicresolve.demo` | `DemoCitizen2026!` | Resolved/Assigned Grievance Submitter |

> **Security Notice:** The above credentials are designated demo credentials used strictly in the isolated `civicresolve_demo` namespace. They must never be reused in production environments.

### 2. Evaluator 3-Step Setup

```powershell
# Step 1: In the server directory, set the dedicated demo environment variable (PowerShell):
cd server
$env:ALLOW_DEMO_SEED = "true"
$env:DEMO_MONGODB_URI = "mongodb+srv://<username>:<password>@<cluster-host>/civicresolve_demo?retryWrites=true&w=majority"

# Step 2: Seed the isolated demo database (idempotent, safe to rerun):
npm run seed:demo

# Step 3: Launch the backend pointing to the demo database:
$env:MONGODB_URI = $env:DEMO_MONGODB_URI
npm start
```

In a second terminal, launch the frontend:
```powershell
cd client
npm run dev
```
Open **`http://localhost:5173/login`** in your browser.

### 3. Guided 5-Minute Evaluation Walkthrough

1. **Citizen Workspace (`citizen.jane@civicresolve.demo`):**
   - **Dashboard:** Inspect active complaints and status badges (`PENDING`, `IN_PROGRESS`, `CLOSED`).
   - **Interactive Chat (`CMP-DEMO-TECH03`):** Open detail view to inspect the two-way message thread between Jane and Officer Rivera.
   - **Grievance Filing:** Click **"New Complaint"**, select Category/Priority, and submit to verify automatic `CMP-YYYYMMDD-XXXX` tracking ID generation.
   - **Public Tracking:** Log out and search the tracking ID on `/track` to view the public audit trail.

2. **Officer Workspace (`officer.tech@civicresolve.demo`):**
   - **Assigned Queue:** Review technical complaints assigned to Officer Rivera.
   - **Status Transitions:** Open `CMP-DEMO-TECH03`, transition status to `RESOLVED`, enter required resolution notes, and confirm the immutable `statusHistory` update.

3. **Administrator Workspace (`demo.admin@civicresolve.demo`):**
   - **Live MongoDB Analytics:** Inspect live aggregation charts (Status breakdown, Category volume, Priority distribution, Average resolution times, and Officer workload tables).
   - **Complaint Dispatch:** Open unassigned complaints (`CMP-DEMO-TECH01`), assign to an officer, and verify instant queue updates.
   - **User & Officer Access Management:** Review officer application profiles and manage user account activation.


## 4. Prerequisites

Before running the application, ensure the following are installed:
- **Node.js:** v20.x, v22.x, or v24.x (`node -v`)
- **npm:** v10.x or higher (`npm -v`)
- **MongoDB Atlas Account:** A free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) with a configured database user and IP access list.

---

## 5. Local Setup Instructions (PowerShell / Windows)

### Step 1: Clone or Navigate to the Workspace
```powershell
cd c:\Users\rahul\online-complaint-registration
```

### Step 2: Configure Environment Variables
Copy the `.env.example` templates to `.env` in both `server/` and `client/`:

**Backend Configuration (`server/.env`):**
```powershell
Copy-Item server\.env.example server\.env
```
Edit `server\.env` with your preferred editor:
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/complaint_portal?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_minimum_32_characters_long
CLIENT_URL=http://localhost:5173

# Optional Email Configuration (Nodemailer operates in simulated mode if omitted)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
EMAIL_FROM="CivicResolve Portal" <no-reply@example.com>
```

**Frontend Configuration (`client/.env`):**
```powershell
Copy-Item client\.env.example client\.env
```
Ensure `client\.env` contains:
```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

### Step 3: Install Dependencies
Open two terminal tabs:

**Terminal 1 — Backend:**
```powershell
cd server
npm install
```

**Terminal 2 — Frontend:**
```powershell
cd client
npm install
```

---

## 6. Running the Application Locally

### Start Backend API Server:
```powershell
cd server
npm start
# Output: Server running on http://localhost:5000
# Output: Connected to MongoDB Atlas
```

### Start Frontend Development Server:
```powershell
cd client
npm run dev
# Output: Local: http://localhost:5173/
```
Open **`http://localhost:5173`** in your browser.

---

## 7. MongoDB Atlas & Network DNS Setup

### Atlas Network Access:
1. Log in to the MongoDB Atlas Console.
2. Under **Security → Network Access**, add your current IP address (or `0.0.0.0/0` for initial testing).
3. Under **Security → Database Access**, create a user with `readWriteAnyDatabase` privileges.

### Local ISP DNS Resolution Workaround:
On certain local Windows networks and ISP routers, Node.js cannot resolve `mongodb+srv://` DNS SRV records by default, resulting in `querySrv ENOTFOUND` or `ESERVFAIL`.
To solve this reliably without system reconfiguration, `server/server.js` explicitly defines trusted DNS resolvers:
```javascript
const dns = require("node:dns/promises");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
```
*Note for Cloud Deployment:* In standard Linux container environments (Render, Railway, AWS ECS), standard DNS works natively and does not conflict with this resolver setting.

---

## 8. Authentication & Role Model

| Role | Access Level | Description |
| :--- | :--- | :--- |
| **`USER`** | Citizen | Self-registers via `/register`. Can file grievances, track own complaints, chat with assigned officers, close/reopen resolved cases, and submit satisfaction feedback. |
| **`AGENT`** | Officer | Applies for officer credentials via `/register` (starts in `PENDING` approval status). Once approved by an Administrator, can access assigned grievances, update case lifecycle status, record resolution summaries, and converse with citizens. |
| **`ADMIN`** | Administrator | Has oversight over the portal. Can view live system aggregation metrics, dispatch complaints to verified officers, review/approve/reject officer applications, and activate/deactivate accounts. |

---

## 9. Main API Route Groups

| Prefix | Target Entity | Core Operations |
| :--- | :--- | :--- |
| `/api/auth` | Authentication & Profile | Registration, login, session inspection (`GET /me`), and profile updates (`PATCH /me`). |
| `/api/complaints` | Complaints Lifecycle | Register complaint, query paginated list, retrieve by ID, lookup by tracking ID, update status, and assign officer. |
| `/api/complaints/:id/messages` | Inquiry Messaging | Send message, retrieve thread history, and mark messages read. |
| `/api/feedback` | Citizen Feedback | Submit 1–5 star rating with comments, view complaint feedback, and list role-scoped feedback. |
| `/api/admin` | Administration & Analytics | Live aggregations (`/analytics/overview`), officer approval/rejection queue, and user activation management. |

---

## 10. Automated Testing, Linting & Build Verification

The application includes an extensive test suite and strict static analysis:

```powershell
# 1. Run All 70 Backend Tests
cd server
npm test

# 2. Run Individual Test Suites
npm run test:auth
npm run test:models
npm run test:complaint
npm run test:messaging_feedback
npm run test:admin
npm run test:hardening

# 3. Lint Frontend Codebase (0 errors, 0 warnings)
cd ..\client
npm run lint

# 4. Create Production Frontend Bundle (Vite)
npm run build
```

---

## 11. Troubleshooting Common Issues

1. **Port 5000 in use (`EADDRINUSE`):**
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
   ```
2. **MongoDB Connection Timeout:**
   - Verify `MONGODB_URI` password contains no unencoded special characters (`@`, `:`, `/`).
   - Confirm MongoDB Atlas Network Access whitelist includes your current IP.
3. **CORS Errors in Browser Console:**
   - Ensure `server/.env` has `CLIENT_URL=http://localhost:5173`.
4. **401 Unauthorized / Token Expired:**
   - Log out and log back in to refresh your JWT session in `localStorage`.

---

## 12. Current Architectural Boundaries & Limitations

- **Attachment Storage:** Attachments accept and validate structured metadata (`filename`, `originalName`, `url`, `mimeType`, `size` up to 10MB). Direct file binary streaming to S3/Cloudinary can be linked into `url`.
- **Real-Time Delivery:** Messaging uses polling upon route navigation and active conversation views. WebSocket (e.g. Socket.io) integration can be added if sub-second broadcast is required.
- **Email Delivery:** Emails are dispatched asynchronously via Nodemailer. If SMTP credentials are not configured, delivery operates in simulated mode without throwing errors.

---

## 13. Production Deployment Guide

### Option A — Full-Stack Monolith (Single Web Service on Render/Railway)
1. Build the frontend in `client/`:
   ```powershell
   cd client
   npm run build
   ```
2. Copy `client/dist/` into `server/public/`.
3. In `server/server.js`, serve static assets from `server/public` with an SPA fallback:
   ```javascript
   app.use(express.static(path.join(__dirname, "public")));
   app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
   ```
4. Deploy the `server/` directory with `npm start`.

### Option B — Decoupled Deployment (Recommended)
1. **Backend (Render / Railway / Fly.io):**
   - Root directory: `server/`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables: `PORT`, `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL=https://your-frontend-domain.vercel.app`
2. **Frontend (Vercel / Netlify / Cloudflare Pages):**
   - Root directory: `client/`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables: `VITE_API_BASE_URL=https://your-backend-api.onrender.com/api`
   - Configure SPA rewrite rule (e.g. `vercel.json` or `_redirects` with `/* -> /index.html 200`).

### Post-Deployment Verification Checklist:
- [ ] Visit `https://api.yourdomain.com/` and confirm `{ message: "Online Complaint Registration API is running" }`.
- [ ] Test citizen registration and verify login returns safe JWT payload without password hash.
- [ ] File a test grievance and verify automatic tracking ID format (`CMP-YYYYMMDD-XXXX`).
- [ ] Log in as Administrator, review analytics, and assign grievance to an approved officer.
- [ ] Verify CORS headers reject requests from unauthorized origins.
