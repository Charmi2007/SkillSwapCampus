# 🎓 SkillSwap Campus

> A modern peer-to-peer college skill exchange platform where students teach skills they know and learn skills they want — without exchanging money. Features institutional email verification, same-college access restrictions, and secure Jitsi online video meetings.

---

## 📌 Project Overview

**SkillSwap Campus** connects college students within verified academic institutions to exchange practical skills. Students list skills they can teach (**OFFER**) and skills they want to learn (**WANT**), search for peers, propose reciprocal swaps, schedule learning sessions, and leave ratings and reviews.

The platform employs a hybrid architecture:
1. **Node.js / Express Backend:** User registration & login, profile management, skill catalog, search, swap request negotiation, session scheduling, and peer reviews.
2. **Java Servlet Module (Jakarta EE 6.0 / Apache Tomcat 10.1+):** College registry management, approved email domain validation, institutional OTP verification, same-college access restriction enforcement, and end-to-end Jitsi online meeting room generation and access management.

---

## 🛠️ Technology Stack

* **Frontend:**
  * HTML5, CSS3, JavaScript (Vanilla ES6+)
  * Responsive mobile-first design system
  * Dynamic environment API configuration (`frontend/js/config.js`)
* **Node.js Application:**
  * Node.js & Express.js
  * MySQL with `mysql2` connection pooling
  * Password hashing: `bcryptjs`
  * Security: JSON Web Tokens (`jsonwebtoken`), Cross-Origin Resource Sharing (`cors`), environment variable isolation (`dotenv`)
* **Java Servlet Application (`servlet-backend/`):**
  * Java 17+ (tested with JDK 21 / 27)
  * Jakarta Servlet API 6.0 (`jakarta.servlet-api`)
  * Apache Tomcat 10.1+ (Servlet 6.0 container)
  * Build Tool: Apache Maven 3.9+
  * Database Connectivity: MySQL Connector/J 8.3.0 & HikariCP 5.1.0 connection pool
  * Security: `java-jwt` 4.4.0 (JWT parsing & validation), `java.security.SecureRandom` (128-bit room entropy & OTP generation)
  * Email Dispatcher: Jakarta Mail (`angus-mail` 2.0.3) for institutional OTP delivery
  * JSON Parser: `org.json`
* **Database:**
  * MySQL 8.0+ (`skillswap_campus`)

---

## 🏗️ System Architecture

```
                       ┌───────────────────────────────┐
                       │       Web Browser (Client)    │
                       │    HTML5 / CSS3 / JavaScript  │
                       └───────────────┬───────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
         (HTTP / REST APIs)                    (HTTP / REST APIs)
                    │                                     │
                    ▼                                     ▼
     ┌─────────────────────────────┐       ┌─────────────────────────────┐
     │      Node.js / Express      │       │     Java Servlet Backend    │
     │        (Port 5000)          │       │  (Apache Tomcat, Port 8080) │
     ├─────────────────────────────┤       ├─────────────────────────────┤
     │ • Static Frontend Serving   │       │ • College Domain Registry   │
     │ • User Auth (Register/Login)│       │ • Institutional OTP Verify  │
     │ • Skills Catalog & Matching │       │ • Same-College Auth Checks  │
     │ • Swap Requests Negotiation │       │ • Jitsi Online Meetings API │
     │ • Session Scheduling        │       │ • Passcode Room Generation  │
     │ • Peer Reviews & Ratings    │       │ • Meeting Lifecycle State   │
     └──────────────┬──────────────┘       └──────────────┬──────────────┘
                    │                                     │
                    │               MySQL 8.0             │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │    Database: skillswap_campus │
                       │  (Users, Skills, Swaps,       │
                       │   Sessions, Colleges,         │
                       │   Verifications, Meetings)    │
                       └───────────────────────────────┘
```

---

## 🗄️ Database Setup & Migrations

### 1. Database Initialization
```sql
CREATE DATABASE IF NOT EXISTS skillswap_campus;
USE skillswap_campus;
```

### 2. Core Tables (v1 Schema)
The original 6 tables remain 100% intact:
* `users`: `user_id`, `name`, `email`, `password`, `department`, `year`, `profile_image`, `created_at`
* `skills`: `skill_id`, `skill_name`, `category`
* `user_skills`: `user_skill_id`, `user_id`, `skill_id`, `skill_type`, `skill_level`
* `swap_requests`: `request_id`, `sender_id`, `receiver_id`, `skill_offered`, `skill_requested`, `status`, `created_at`
* `sessions`: `session_id`, `request_id`, `session_date`, `session_time`, `duration`, `mode`, `status`
* `reviews`: `review_id`, `session_id`, `reviewer_id`, `rating`, `comment`

### 3. Migration v2 (Non-Destructive)
Run `database/migration_v2.sql` to apply the upgrade without altering existing records:
* **`colleges` Table:** Approved institutions and required email domain suffixes.
* **`college_verifications` Table:** Single-use tokens, hashed OTP codes, expiry tracking, attempt rate limiting.
* **`online_meetings` Table:** Jitsi room identifiers, encrypted access passcodes, session linkage, meeting lifecycle.
* **`users` Table Alteration:** Non-destructive addition of `college_id`, `institutional_email`, `verification_status` (`UNVERIFIED`, `PENDING`, `VERIFIED`), and `verified_at`.

```bash
# Apply migration automatically
node database/run_migration.js
```

### 4. Rollback Script
In case of need, run `database/rollback_v2.sql` to cleanly remove v2 additions while leaving original v1 tables untouched.

---

## 🔒 Security & Privacy Model

### Same-College Access Restrictions
1. **Verification Requirement:** Students must verify their official institutional email against an approved college domain (e.g. `@student.vardhaman.org`).
2. **Double-Layer Enforcement:**
   * **Node.js Gateway:** `POST /api/swap/request` and `POST /api/sessions/schedule` verify that both sender and recipient are `VERIFIED` and share the same `college_id`. Blocked attempts return `403 Forbidden`.
   * **Java Servlet Service:** All meeting and verification endpoints validate caller identity against institutional ownership.
3. **Multi-Attempt Rate Limiting:** Verifications lock after 5 failed OTP attempts. OTP codes expire automatically after 15 minutes.

### Public Jitsi Privacy Considerations
* Public Jitsi Meet (`meet.jit.si`) rooms are accessible to anyone who guesses the exact room name.
* **SkillSwap Campus Protection Architecture:**
  1. Room names are constructed with a college prefix, session ID, and a 128-bit cryptographically secure random hexadecimal token (`SecureRandom`):
     `SkillSwap-Campus-Col1-Sess12-efb76d6ff0bd4f7e`
  2. A random 6-character alphanumeric passcode is generated and stored exclusively in the database.
  3. The room link and passcode are **never** published in plaintext and can **only** be retrieved through the authenticated Java Servlet endpoint (`GET /api/meetings/session`) by the two verified same-college session participants.
  4. For enterprise deployments, the `JITSI_DOMAIN` environment variable can be pointed to a private, self-hosted Jitsi instance with JWT token authentication.

---

## ⚙️ Environment Configuration

### Node.js (`backend/.env`)
```env
# Database Credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=skillswap_campus
DB_PORT=3306

# Server Port
PORT=5000

# Authentication Secret
JWT_SECRET=your_jwt_secret_key_change_in_production

# College Restriction Enforcement (default: true)
ENFORCE_SAME_COLLEGE=true

# Optional: CORS allowed origin(s)
CORS_ORIGIN=http://localhost:5000,http://localhost:8080
```

### Java Servlet Module (`servlet-backend` / System Env)
Inherits values from `backend/.env` automatically via `DotenvLoader`, with fallback to System environment variables:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `skillswap_campus` | Database name |
| `DB_USER` | `root` | Database user |
| `DB_PASSWORD` | — | Database password |
| `JWT_SECRET` | shared key | Secret for parsing and validating session JWTs |
| `JITSI_DOMAIN` | `meet.jit.si` | Trusted Jitsi Meet hostname |
| `SMTP_HOST` | (empty: dev log) | SMTP server for institutional emails |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASSWORD` | (empty) | SMTP password |
| `SMTP_FROM` | `no-reply@skillswap.campus` | Sender email address |

> [!NOTE]
> If `SMTP_HOST` is not configured, the Java Servlet operates in local development mode: it logs OTPs to the Tomcat console and returns `devOtp` in the API response for automated testing.

---

## 💻 Local Setup & Running Both Services

### Prerequisites
* Node.js 18+ & npm
* JDK 17+ with `JAVA_HOME` configured
* Apache Maven 3.9+ (or use included `mvnw.cmd`)
* Apache Tomcat 10.1+
* MySQL 8.0+

### Step 1: Install Node.js Dependencies & Run Migrations
```bash
cd backend
npm install
node ../database/run_migration.js
```

### Step 2: Start Node.js Express Backend
```bash
# In backend/ directory:
npm start
# Server listens on http://localhost:5000
```

### Step 3: Build & Deploy Java Servlet WAR
```bash
# In servlet-backend/ directory:
mvn package -DskipTests

# Copy WAR to Tomcat webapps directory:
cp target/skillswap-servlet.war /path/to/apache-tomcat-10.1.x/webapps/

# Start Tomcat:
/path/to/apache-tomcat-10.1.x/bin/catalina run
# Servlet listens on http://localhost:8080/skillswap-servlet
```

### Step 4: Run Automated End-to-End Verification
```bash
node servlet-backend/test_full_e2e.js
```

### Step 5: Open Application in Browser
Navigate to `http://localhost:5000` to interact with the full web app.

---

## 🌐 Production Deployment Guide

### Node.js Backend Deployment (e.g. Render / Railway / Heroku / AWS)
1. **Repository:** Push repository to GitHub/GitLab.
2. **Build Command:** `npm install --prefix backend`
3. **Start Command:** `npm start --prefix backend`
4. **Environment Variables:**
   * `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   * `JWT_SECRET`
   * `PORT` (assigned automatically by host)
   * `ENFORCE_SAME_COLLEGE=true`
5. **Static Assets:** Express serves the `frontend/` directory directly using `path.join(__dirname, "../frontend")`.

### Java Servlet Module Deployment (Tomcat / Docker / Railway / AWS Elastic Beanstalk)
1. **Container Option (Recommended for Cloud):**
   Use standard Eclipse Temurin Tomcat 10 image with a Dockerfile:
   ```dockerfile
   FROM maven:3.9-eclipse-temurin-17 AS builder
   WORKDIR /app
   COPY servlet-backend/pom.xml .
   COPY servlet-backend/src ./src
   RUN mvn package -DskipTests

   FROM tomcat:10.1-jdk17-temurin
   RUN rm -rf /usr/local/tomcat/webapps/*
   COPY --from=builder /app/target/skillswap-servlet.war /usr/local/tomcat/webapps/ROOT.war
   EXPOSE 8080
   CMD ["catalina.sh", "run"]
   ```
2. **Environment Variables:** Provide `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JITSI_DOMAIN`, and optional SMTP variables.
3. **Frontend Wiring:** In `frontend/js/config.js`, set `SERVLET_CONFIG.SERVLET_BASE_URL` to your deployed servlet URL (or set `window.SERVLET_API_URL`).

---

## 📡 API Reference

### Java Servlet Endpoints (`/skillswap-servlet/api/...`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Health check & database connectivity test |
| **GET** | `/api/colleges` | List approved colleges and allowed email domains |
| **POST** | `/api/verification/request-otp` | Request 6-digit verification OTP for institutional email |
| **POST** | `/api/verification/verify-otp` | Verify 6-digit OTP and update user status to `VERIFIED` |
| **GET** | `/api/verification/status` | Retrieve college verification status for a user |
| **POST** | `/api/college/authorize` | Verify whether two users belong to the same college |
| **POST** | `/api/meetings/schedule` | Schedule Jitsi meeting for an accepted session |
| **GET** | `/api/meetings/session` | Get authorized meeting details, room URL, and passcode |
| **GET** | `/api/meetings/user` | List meetings for a student |
| **PUT/POST**| `/api/meetings/status` | Update meeting status (`ACTIVE`, `COMPLETED`, `CANCELLED`) |

### Node.js Express Endpoints (`/api/...`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Service health check |
| **POST** | `/api/auth/register` | Register new student |
| **POST** | `/api/auth/login` | Student login (returns JWT token and college status) |
| **GET** | `/api/auth/profile/:userId` | Get profile, college info, and dashboard stats |
| **PUT** | `/api/auth/profile/:userId` | Update profile information |
| **POST** | `/api/skills/add` | Add skill (`OFFER` or `WANT`) |
| **GET** | `/api/skills/:userId` | Get all skills for a user |
| **DELETE** | `/api/skills/:userSkillId` | Remove a skill |
| **GET** | `/api/match/search` | Search tutors with campus and verification filters |
| **POST** | `/api/swap/request` | Propose swap (enforces same-college verification) |
| **GET** | `/api/swap/received/:userId` | Incoming swap requests with sender college details |
| **GET** | `/api/swap/sent/:userId` | Outgoing swap requests with receiver college details |
| **PUT** | `/api/swap/respond/:requestId` | Accept or reject swap request |
| **POST** | `/api/sessions/schedule` | Schedule session (enforces same-college verification) |
| **GET** | `/api/sessions/user/:userId` | Get user sessions (includes linked meeting status) |
| **PUT** | `/api/sessions/:sessionId/status` | Mark session status (`COMPLETED` / `CANCELLED`) |
| **POST** | `/api/reviews/add` | Submit peer review for completed session |
| **GET** | `/api/reviews/user/:userId` | Get peer reviews and calculated average rating |
