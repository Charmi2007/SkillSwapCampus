const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Add a review for a completed session
router.post("/add", (req, res) => {
    const {
        sessionId,
        reviewerId,
        rating,
        comment
    } = req.body;

    if (!sessionId || !reviewerId || rating === undefined || rating === null) {
        return res.status(400).json({
            message: "Session ID, reviewer ID, and rating (1-5) are required"
        });
    }

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({
            message: "Rating must be an integer between 1 and 5"
        });
    }

    const sId = parseInt(sessionId, 10);
    const rId = parseInt(reviewerId, 10);

    // Verify session exists and is COMPLETED
    const sessionQuery = `
        SELECT s.session_id, s.status, sr.sender_id, sr.receiver_id
        FROM sessions s
        JOIN swap_requests sr ON s.request_id = sr.request_id
        WHERE s.session_id = ?
    `;

    db.query(sessionQuery, [sId], (sessErr, sessResults) => {
        if (sessErr) {
            console.error("Session lookup error:", sessErr);
            return res.status(500).json({ message: "Database error" });
        }

        if (sessResults.length === 0) {
            return res.status(404).json({ message: "Session not found" });
        }

        const session = sessResults[0];

        if (session.status !== "COMPLETED") {
            return res.status(400).json({
                message: "Reviews can only be submitted for COMPLETED sessions"
            });
        }

        if (rId !== session.sender_id && rId !== session.receiver_id) {
            return res.status(403).json({
                message: "You can only review sessions in which you participated"
            });
        }

        // Check if reviewer has already reviewed this session
        const checkExistingQuery = `
            SELECT review_id FROM reviews
            WHERE session_id = ? AND reviewer_id = ?
        `;

        db.query(checkExistingQuery, [sId, rId], (existErr, existResults) => {
            if (existErr) {
                console.error("Duplicate review check error:", existErr);
                return res.status(500).json({ message: "Database error" });
            }

            if (existResults.length > 0) {
                return res.status(400).json({
                    message: "You have already submitted a review for this session"
                });
            }

            const insertReviewQuery = `
                INSERT INTO reviews (session_id, reviewer_id, rating, comment)
                VALUES (?, ?, ?, ?)
            `;

            db.query(
                insertReviewQuery,
                [sId, rId, numRating, comment ? comment.trim() : ""],
                (insErr, insResult) => {
                    if (insErr) {
                        console.error("Review insertion error:", insErr);
                        return res.status(500).json({
                            message: "Could not submit review"
                        });
                    }

                    res.status(201).json({
                        message: "Review submitted successfully!",
                        reviewId: insResult.insertId
                    });
                }
            );
        });
    });
});

// Get reviews received by a student + average rating
router.get("/user/:userId", (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    const reviewsQuery = `
        SELECT
            r.review_id,
            r.session_id,
            r.rating,
            r.comment,
            reviewer.user_id AS reviewer_id,
            reviewer.name AS reviewer_name,
            reviewer.department AS reviewer_department,
            DATE_FORMAT(s.session_date, '%Y-%m-%d') AS session_date,
            offered.skill_name AS skill_offered,
            requested.skill_name AS skill_requested
        FROM reviews r
        JOIN sessions s ON r.session_id = s.session_id
        JOIN swap_requests sr ON s.request_id = sr.request_id
        JOIN users reviewer ON r.reviewer_id = reviewer.user_id
        JOIN skills offered ON sr.skill_offered = offered.skill_id
        JOIN skills requested ON sr.skill_requested = requested.skill_id
        WHERE (sr.sender_id = ? AND r.reviewer_id != ?)
           OR (sr.receiver_id = ? AND r.reviewer_id != ?)
        ORDER BY r.review_id DESC
    `;

    db.query(reviewsQuery, [userId, userId, userId, userId], (err, reviews) => {
        if (err) {
            console.error("Fetch reviews error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        let avgRating = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
            avgRating = parseFloat((sum / reviews.length).toFixed(1));
        }

        res.json({
            averageRating: avgRating,
            totalReviews: reviews.length,
            reviews
        });
    });
});

// Get reviews for a specific session
router.get("/session/:sessionId", (req, res) => {
    const sessionId = req.params.sessionId;

    const query = `
        SELECT
            r.review_id,
            r.rating,
            r.comment,
            u.user_id AS reviewer_id,
            u.name AS reviewer_name
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.user_id
        WHERE r.session_id = ?
    `;

    db.query(query, [sessionId], (err, results) => {
        if (err) {
            console.error("Fetch session reviews error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json(results);
    });
});

module.exports = router;
