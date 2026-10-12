# 🎓 SkillSwap Campus

> A modern peer-to-peer college skill exchange platform where students teach skills they know and learn skills they want — without exchanging money.

---

## 📌 Project Overview

**SkillSwap Campus** connects college students within and across academic departments to exchange practical skills. Students list skills they can teach (**OFFER**) and skills they want to learn (**WANT**), search for peers, propose mutual swaps, schedule learning sessions, and leave ratings and reviews.

### ✨ Key Features
* **User Authentication & Profiles:** Secure registration and login with `bcryptjs` password hashing and JSON Web Tokens (JWT). Edit profile details, view peer reputation, and track skills.
* **Skill Portfolio Management:** Add skills with proficiency levels (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`) and exchange types (`OFFER` / `WANT`). Easily manage and delete skills.
* **Smart Matching & Filtering:** Find peer tutors with multi-criteria search (skill name, proficiency level, department, and academic year), automatically excluding the searching student.
* **Skill Swap Requests:** Propose reciprocal swaps (choose a skill you can teach in exchange for a skill you want to learn). Recipient students can accept or reject requests with duplicate and self-request prevention.
* **Session Scheduling:** Coordinate learning sessions for accepted swaps with customized date, time, duration, and mode (`ONLINE` or `OFFLINE`).
* **Ratings & Reviews:** After marking a session as completed, participants can submit 1–5 star ratings and written reviews. Student average ratings are dynamically calculated.
* **Interactive Dashboard:** Live metric counters for skills offered, skills wanted, pending requests, upcoming sessions, and campus reputation score.

---

## 🛠️ Technology Stack

* **Frontend:**
  * HTML5, CSS3, JavaScript (Vanilla ES6+)
  * Responsive, mobile-friendly design system
  * Dynamic environment API configuration (`frontend/js/config.js`)
* **Backend:**
  * Node.js & Express.js
  * MySQL with `mysql2` connection pooling (handles idle timeouts and reconnects)
  * Authentication: `bcryptjs` (password hashing) & `jsonwebtoken` (JWT)
  * Security: Cross-Origin Resource Sharing (`cors`), environment variable isolation (`dotenv`)
* **Database:**
  * MySQL (`skillswap_campus`)

---

## 🗄️ Database Setup

### 1. Create MySQL Database
Log into your MySQL client (e.g. MySQL Workbench, phpMyAdmin, or command-line):
```sql
CREATE DATABASE IF NOT EXISTS skillswap_campus;
USE skillswap_campus;
```

### 2. Schema Definition
Run the following SQL statements to initialize the 6 database tables:

```sql
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    year INT,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS user_skills (
    user_skill_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    skill_id INT NOT NULL,
    skill_type ENUM('OFFER', 'WANT') NOT NULL,
    skill_level ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') DEFAULT 'BEGINNER',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS swap_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    skill_offered INT NOT NULL,
    skill_requested INT NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_offered) REFERENCES skills(skill_id),
    FOREIGN KEY (skill_requested) REFERENCES skills(skill_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    duration INT DEFAULT 60,
    mode ENUM('ONLINE', 'OFFLINE') DEFAULT 'ONLINE',
    status ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED') DEFAULT 'SCHEDULED',
    FOREIGN KEY (request_id) REFERENCES swap_requests(request_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (rating >= 1 AND rating <= 5)
);
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

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

# Optional: CORS allowed origin(s) for decoupled frontend deployment
# CORS_ORIGIN=https://my-frontend-domain.com,http://localhost:5000
```

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DB_HOST` | Yes | `localhost` | MySQL server host address |
| `DB_USER` | Yes | `root` | MySQL user |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_NAME` | Yes | `skillswap_campus` | MySQL database name |
| `DB_PORT` | No | `3306` | MySQL port |
| `PORT` | No | `5000` | Express server port |
| `JWT_SECRET` | Yes | fallback key | Secret for signing JWT authentication tokens |
| `CORS_ORIGIN` | No | `*` (dynamic) | Comma-separated list of allowed frontend origins |

---

## 💻 Local Setup & Execution

### 1. Install Dependencies
Open a terminal in the project directory:
```bash
cd backend
npm install
```

### 2. Configure Environment
Ensure `backend/.env` contains your MySQL database connection credentials.

### 3. Start the Application
You can start the server using `npm start` from either the root directory or the `backend/` folder:

* **From project root:**
  ```bash
  npm start
  ```
* **Or from `backend/`:**
  ```bash
  cd backend
  npm start
  ```

### 4. Access the Application
Open your web browser and navigate to:
```text
http://localhost:5000
```

---

## 🌐 Production Deployment

The project is structured for easy deployment in two scenarios:

### Option A: Unified Deployment (Recommended)
*Host backend and frontend together on a single service (e.g., Render, Railway, AWS EC2, Heroku, or DigitalOcean).*

1. **How it works:** Express statically serves the `frontend/` directory using `path.join(__dirname, "../frontend")`.
2. **Frontend Config:** In `frontend/js/config.js`, leave `API_BASE_URL: ""` (empty). The app automatically uses `window.location.origin`.
3. **Build & Start Commands:**
   - **Build Command:** `npm install --prefix backend`
   - **Start Command:** `npm start --prefix backend` (or `npm start` from root)
4. **Environment Variables:** Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, and `JWT_SECRET` in your cloud provider's dashboard. `PORT` is assigned automatically.

---

### Option B: Decoupled Deployment
*Host Backend on a service like Render/Railway and Frontend on Vercel/Netlify/GitHub Pages.*

1. **Deploy Backend:**
   - Deploy `backend/` to your API host (e.g. `https://skillswap-api.onrender.com`).
   - In cloud environment variables, set `CORS_ORIGIN=https://my-frontend.vercel.app`.
2. **Configure Frontend:**
   - In `frontend/js/config.js`, set your backend URL:
     ```javascript
     const API_CONFIG = {
         API_BASE_URL: "https://skillswap-api.onrender.com",
         DEV_BASE_URL: "http://localhost:5000"
     };
     ```
   - Deploy the `frontend/` directory to Vercel, Netlify, or GitHub Pages.

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Service health status check |
| **POST** | `/api/auth/register` | Register a new student |
| **POST** | `/api/auth/login` | Student login (returns JWT token and profile) |
| **GET** | `/api/auth/profile/:userId` | Get student profile and aggregate dashboard statistics |
| **PUT** | `/api/auth/profile/:userId` | Update student profile information |
| **POST** | `/api/skills/add` | Add an OFFER or WANT skill to student profile |
| **GET** | `/api/skills/:userId` | Retrieve all skills for a student |
| **DELETE** | `/api/skills/:userSkillId` | Remove a skill from student profile |
| **GET** | `/api/match/search` | Search and filter tutors (by skill, level, dept, year) |
| **GET** | `/api/match/find/:skillName` | Direct lookup of students offering a skill |
| **POST** | `/api/swap/request` | Send a skill swap request |
| **GET** | `/api/swap/received/:userId` | Get incoming swap requests |
| **GET** | `/api/swap/sent/:userId` | Get outgoing swap requests |
| **GET** | `/api/swap/accepted/:userId` | Get accepted swaps eligible for session scheduling |
| **PUT** | `/api/swap/respond/:requestId`| Accept or reject a swap request |
| **POST** | `/api/sessions/schedule` | Schedule a skill exchange session |
| **GET** | `/api/sessions/user/:userId` | Retrieve all sessions for a student |
| **PUT** | `/api/sessions/:sessionId/status`| Mark session as `COMPLETED` or `CANCELLED` |
| **POST** | `/api/reviews/add` | Submit a 1–5 star rating and comment for a session |
| **GET** | `/api/reviews/user/:userId` | Get reviews and average rating for a student |
| **GET** | `/api/reviews/session/:sessionId`| Get reviews for a specific session |

---

## 🔒 Security Practices

* **No Hardcoded Secrets:** Sensitive database credentials and JWT keys reside in `.env`, which is strictly ignored by `.gitignore`.
* **SQL Injection Protection:** All queries use parameterized queries (`?`).
* **Cross-Site Scripting (XSS) Mitigation:** Output strings are escaped in the frontend UI.
* **Authentication Safeguards:** Passwords are never sent back in API responses; password hashes use `bcryptjs` with salt rounds.
