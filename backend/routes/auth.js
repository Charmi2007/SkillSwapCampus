const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/db");
const { authenticateToken, authorizeUserOrAdmin, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// Email validation regex (RFC 5322 standard compliant format)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Test route
router.get("/test", (req, res) => {
    res.json({
        message: "Auth route is working!"
    });
});

// Student Registration
router.post("/register", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            department,
            year
        } = req.body;

        // Check required fields
        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Full name is required and must be between 2 and 100 characters."
            });
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 100) {
            return res.status(400).json({
                message: "Full name must be between 2 and 100 characters."
            });
        }

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "Email is required."
            });
        }

        const trimmedEmail = email.trim().toLowerCase();
        if (trimmedEmail.length > 150 || !EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({
                message: "Please provide a valid email address (maximum 150 characters)."
            });
        }

        if (!password || typeof password !== "string") {
            return res.status(400).json({
                message: "Password is required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long."
            });
        }

        if (password.length > 128) {
            return res.status(400).json({
                message: "Password cannot exceed 128 characters."
            });
        }

        // Validate department if provided
        let sanitizedDept = null;
        if (department !== undefined && department !== null) {
            if (typeof department !== "string") {
                return res.status(400).json({ message: "Department must be a text string." });
            }
            const trimmedDept = department.trim();
            if (trimmedDept.length > 100) {
                return res.status(400).json({ message: "Department cannot exceed 100 characters." });
            }
            sanitizedDept = trimmedDept.length > 0 ? trimmedDept : null;
        }

        // Validate year of study if provided
        let sanitizedYear = null;
        if (year !== undefined && year !== null && year !== "") {
            const parsedYear = parseInt(year, 10);
            if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 6) {
                return res.status(400).json({
                    message: "Year of study must be a number between 1 and 6."
                });
            }
            sanitizedYear = parsedYear;
        }

        // Check whether email already exists
        const checkQuery = "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)";

        db.query(checkQuery, [trimmedEmail], async (err, results) => {
            if (err) {
                console.error("Database error checking email:", err);
                return res.status(500).json({
                    message: "Database error during registration check."
                });
            }

            if (results.length > 0) {
                return res.status(409).json({
                    message: "Email already registered. Please sign in or use another email."
                });
            }

            // Encrypt password using bcrypt with salt factor 10
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert student with parameterized SQL
            const insertQuery = `
                INSERT INTO users
                (name, email, password, department, year)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [trimmedName, trimmedEmail, hashedPassword, sanitizedDept, sanitizedYear],
                (insertErr, result) => {
                    if (insertErr) {
                        console.error("Registration insert error:", insertErr);
                        return res.status(500).json({
                            message: "Registration failed. Please try again later."
                        });
                    }

                    res.status(201).json({
                        message: "Registration successful!",
                        userId: result.insertId
                    });
                }
            );
        });

    } catch (error) {
        console.error("Registration server error:", error);
        res.status(500).json({
            message: "Internal server error during registration."
        });
    }
});

// Student Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || typeof email !== "string" || !email.trim() ||
            !password || typeof password !== "string") {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // Find student by email
        const query = "SELECT * FROM users WHERE LOWER(email) = LOWER(?)";

        db.query(query, [trimmedEmail], async (err, results) => {
            if (err) {
                console.error("Database error during login:", err);
                return res.status(500).json({
                    message: "Database error during login."
                });
            }

            // Student not found - use generic error to prevent email enumeration
            if (results.length === 0) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            const user = results[0];

            // Compare password with hashed password safely
            let passwordMatch = false;
            try {
                passwordMatch = await bcrypt.compare(password, user.password);
            } catch (bcryptErr) {
                console.error("Bcrypt compare error:", bcryptErr);
                return res.status(500).json({ message: "Authentication service error." });
            }

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            // Generate JWT Token using securely configured JWT_SECRET
            const token = jwt.sign(
                {
                    userId: user.user_id,
                    email: user.email,
                    name: user.name,
                    role: user.role || "student"
                },
                JWT_SECRET,
                { expiresIn: "7d" }
            );

            // Login successful (preserve all existing fields for backwards compatibility)
            res.status(200).json({
                message: "Login successful!",
                token,
                userId: user.user_id,
                name: user.name,
                email: user.email,
                department: user.department,
                year: user.year,
                collegeId: user.college_id || null,
                verificationStatus: user.verification_status || "UNVERIFIED"
            });
        });

    } catch (error) {
        console.error("Login server error:", error);
        res.status(500).json({
            message: "Internal server error during login."
        });
    }
});

// Get student profile with aggregated dashboard statistics
// Protected with authentication and ownership authorization
router.get("/profile/:userId", authenticateToken, authorizeUserOrAdmin, (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    const userQuery = `
        SELECT u.user_id, u.name, u.email, u.department, u.year, u.profile_image, u.created_at,
               u.college_id, c.college_name, u.institutional_email, u.verification_status, u.verified_at
        FROM users u
        LEFT JOIN colleges c ON u.college_id = c.college_id
        WHERE u.user_id = ?
    `;

    db.query(userQuery, [userId], (err, users) => {
        if (err) {
            console.error("Profile fetch error:", err);
            return res.status(500).json({ message: "Database error retrieving profile" });
        }

        if (users.length === 0) {
            return res.status(404).json({ message: "Student profile not found" });
        }

        const user = users[0];

        // Gather statistics for dashboard & profile
        const statsQuery = `
            SELECT
                (SELECT COUNT(*) FROM user_skills WHERE user_id = ? AND skill_type = 'OFFER') AS skills_offered_count,
                (SELECT COUNT(*) FROM user_skills WHERE user_id = ? AND skill_type = 'WANT') AS skills_wanted_count,
                (SELECT COUNT(*) FROM swap_requests WHERE (receiver_id = ? OR sender_id = ?) AND status = 'PENDING') AS pending_requests_count,
                (SELECT COUNT(*) FROM sessions s JOIN swap_requests sr ON s.request_id = sr.request_id WHERE (sr.sender_id = ? OR sr.receiver_id = ?) AND s.status = 'SCHEDULED') AS upcoming_sessions_count
        `;

        db.query(statsQuery, [userId, userId, userId, userId, userId, userId], (statErr, statResults) => {
            if (statErr) {
                console.error("Stats query error:", statErr);
                return res.status(500).json({ message: "Database error calculating stats" });
            }

            const stats = statResults[0] || {};

            // Calculate average rating
            const ratingQuery = `
                SELECT AVG(r.rating) AS avg_rating, COUNT(r.review_id) AS review_count
                FROM reviews r
                JOIN sessions s ON r.session_id = s.session_id
                JOIN swap_requests sr ON s.request_id = sr.request_id
                WHERE (sr.sender_id = ? AND r.reviewer_id != ?)
                   OR (sr.receiver_id = ? AND r.reviewer_id != ?)
            `;

            db.query(ratingQuery, [userId, userId, userId, userId], (rateErr, rateResults) => {
                if (rateErr) {
                    console.error("Rating query error:", rateErr);
                    return res.status(500).json({ message: "Database error calculating rating" });
                }

                const ratingData = rateResults[0] || {};
                const avgRating = ratingData.avg_rating ? parseFloat(Number(ratingData.avg_rating).toFixed(1)) : 0;
                const reviewCount = ratingData.review_count || 0;

                res.json({
                    user,
                    stats: {
                        skillsOffered: stats.skills_offered_count || 0,
                        skillsWanted: stats.skills_wanted_count || 0,
                        pendingRequests: stats.pending_requests_count || 0,
                        upcomingSessions: stats.upcoming_sessions_count || 0,
                        averageRating: avgRating,
                        reviewCount: reviewCount
                    }
                });
            });
        });
    });
});

// Update student profile information
// Protected with authentication and ownership authorization
router.put("/profile/:userId", authenticateToken, authorizeUserOrAdmin, (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const { name, department, year } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Full name cannot be empty." });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json({ message: "Full name must be between 2 and 100 characters." });
    }

    let sanitizedDept = null;
    if (department !== undefined && department !== null) {
        if (typeof department !== "string") {
            return res.status(400).json({ message: "Department must be a text string." });
        }
        const trimmedDept = department.trim();
        if (trimmedDept.length > 100) {
            return res.status(400).json({ message: "Department cannot exceed 100 characters." });
        }
        sanitizedDept = trimmedDept.length > 0 ? trimmedDept : null;
    }

    let sanitizedYear = null;
    if (year !== undefined && year !== null && year !== "") {
        const parsedYear = parseInt(year, 10);
        if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 6) {
            return res.status(400).json({ message: "Year of study must be a number between 1 and 6." });
        }
        sanitizedYear = parsedYear;
    }

    const updateQuery = `
        UPDATE users
        SET name = ?, department = ?, year = ?
        WHERE user_id = ?
    `;

    db.query(
        updateQuery,
        [trimmedName, sanitizedDept, sanitizedYear, userId],
        (err, result) => {
            if (err) {
                console.error("Profile update error:", err);
                return res.status(500).json({ message: "Database error updating profile" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Student profile not found" });
            }

            res.json({
                message: "Profile updated successfully!",
                name: trimmedName,
                department: sanitizedDept,
                year: sanitizedYear
            });
        }
    );
});

module.exports = router;