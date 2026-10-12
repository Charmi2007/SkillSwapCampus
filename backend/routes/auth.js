const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "skillswap_campus_jwt_secret_2026";

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
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // Check whether email already exists
        const checkQuery = "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)";

        db.query(checkQuery, [trimmedEmail], async (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                    message: "Database error"
                });
            }

            if (results.length > 0) {
                return res.status(409).json({
                    message: "Email already registered"
                });
            }

            // Encrypt password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert student
            const insertQuery = `
                INSERT INTO users
                (name, email, password, department, year)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(
                insertQuery,
                [name.trim(), trimmedEmail, hashedPassword, department ? department.trim() : null, year ? parseInt(year, 10) : null],
                (insertErr, result) => {
                    if (insertErr) {
                        console.error("Registration error:", insertErr);
                        return res.status(500).json({
                            message: "Registration failed"
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
        console.error("Server error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

// Student Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // Find student by email
        const query = "SELECT * FROM users WHERE LOWER(email) = LOWER(?)";

        db.query(query, [trimmedEmail], async (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                    message: "Database error"
                });
            }

            // Student not found
            if (results.length === 0) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            const user = results[0];

            // Compare password with hashed password
            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            // Generate JWT Token
            const token = jwt.sign(
                {
                    userId: user.user_id,
                    email: user.email,
                    name: user.name
                },
                JWT_SECRET,
                { expiresIn: "7d" }
            );

            // Login successful (preserve existing fields for backwards compatibility)
            res.status(200).json({
                message: "Login successful!",
                token,
                userId: user.user_id,
                name: user.name,
                email: user.email,
                department: user.department,
                year: user.year
            });
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});

// Get student profile with aggregated dashboard statistics
router.get("/profile/:userId", (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    const userQuery = `
        SELECT user_id, name, email, department, year, profile_image, created_at
        FROM users
        WHERE user_id = ?
    `;

    db.query(userQuery, [userId], (err, users) => {
        if (err) {
            console.error("Profile fetch error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (users.length === 0) {
            return res.status(404).json({ message: "Student not found" });
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
router.put("/profile/:userId", (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const { name, department, year } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ message: "Name cannot be empty" });
    }

    const updateQuery = `
        UPDATE users
        SET name = ?, department = ?, year = ?
        WHERE user_id = ?
    `;

    db.query(
        updateQuery,
        [name.trim(), department ? department.trim() : null, year ? parseInt(year, 10) : null, userId],
        (err, result) => {
            if (err) {
                console.error("Profile update error:", err);
                return res.status(500).json({ message: "Database error updating profile" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Student not found" });
            }

            res.json({
                message: "Profile updated successfully!",
                name: name.trim(),
                department: department ? department.trim() : null,
                year: year ? parseInt(year, 10) : null
            });
        }
    );
});

module.exports = router;