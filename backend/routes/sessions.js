const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Schedule a new skill exchange session
router.post("/schedule", (req, res) => {
    const {
        requestId,
        userId,
        sessionDate,
        sessionTime,
        duration,
        mode
    } = req.body;

    if (!requestId || !sessionDate || !sessionTime) {
        return res.status(400).json({
            message: "Request ID, session date, and session time are required"
        });
    }

    const sessionDuration = parseInt(duration, 10) || 60;
    const sessionMode = (mode && ["ONLINE", "OFFLINE"].includes(mode.toUpperCase()))
        ? mode.toUpperCase()
        : "ONLINE";

    // Verify swap request exists and is ACCEPTED
    const checkQuery = `
        SELECT request_id, sender_id, receiver_id, status
        FROM swap_requests
        WHERE request_id = ?
    `;

    db.query(checkQuery, [requestId], (checkErr, checkResults) => {
        if (checkErr) {
            console.error("Check swap request error:", checkErr);
            return res.status(500).json({ message: "Database error" });
        }

        if (checkResults.length === 0) {
            return res.status(404).json({ message: "Swap request not found" });
        }

        const swapReq = checkResults[0];

        if (swapReq.status !== "ACCEPTED") {
            return res.status(400).json({
                message: "Cannot schedule session: the swap request has not been accepted yet"
            });
        }

        if (userId) {
            const uid = parseInt(userId, 10);
            if (uid !== swapReq.sender_id && uid !== swapReq.receiver_id) {
                return res.status(403).json({
                    message: "You are not a participant in this skill swap"
                });
            }
        }

        const insertQuery = `
            INSERT INTO sessions
            (request_id, session_date, session_time, duration, mode, status)
            VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
        `;

        db.query(
            insertQuery,
            [requestId, sessionDate, sessionTime, sessionDuration, sessionMode],
            (err, result) => {
                if (err) {
                    console.error("Schedule session error:", err);
                    return res.status(500).json({
                        message: "Could not schedule session"
                    });
                }

                res.status(201).json({
                    message: "Session scheduled successfully!",
                    sessionId: result.insertId
                });
            }
        );
    });
});

// Get all sessions for a student (where user is sender or receiver)
router.get("/user/:userId", (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT
            s.session_id,
            s.request_id,
            DATE_FORMAT(s.session_date, '%Y-%m-%d') AS session_date,
            s.session_time,
            s.duration,
            s.mode,
            s.status,
            sr.sender_id,
            sr.receiver_id,
            u_sender.name AS sender_name,
            u_sender.email AS sender_email,
            u_receiver.name AS receiver_name,
            u_receiver.email AS receiver_email,
            sk_offered.skill_name AS skill_offered,
            sk_requested.skill_name AS skill_requested,
            (SELECT COUNT(*) FROM reviews WHERE session_id = s.session_id AND reviewer_id = ?) AS has_reviewed
        FROM sessions s
        JOIN swap_requests sr ON s.request_id = sr.request_id
        JOIN users u_sender ON sr.sender_id = u_sender.user_id
        JOIN users u_receiver ON sr.receiver_id = u_receiver.user_id
        JOIN skills sk_offered ON sr.skill_offered = sk_offered.skill_id
        JOIN skills sk_requested ON sr.skill_requested = sk_requested.skill_id
        WHERE sr.sender_id = ? OR sr.receiver_id = ?
        ORDER BY s.session_date DESC, s.session_time DESC
    `;

    db.query(query, [userId, userId, userId], (err, results) => {
        if (err) {
            console.error("Fetch sessions error:", err);
            return res.status(500).json({
                message: "Database error fetching sessions"
            });
        }

        res.json(results);
    });
});

// Update session status (COMPLETED or CANCELLED)
router.put("/:sessionId/status", (req, res) => {
    const sessionId = req.params.sessionId;
    const { status, userId } = req.body;

    const upperStatus = status ? status.toUpperCase() : "";

    if (!["COMPLETED", "CANCELLED", "SCHEDULED"].includes(upperStatus)) {
        return res.status(400).json({
            message: "Invalid status. Must be SCHEDULED, COMPLETED, or CANCELLED"
        });
    }

    const checkQuery = `
        SELECT s.session_id, sr.sender_id, sr.receiver_id
        FROM sessions s
        JOIN swap_requests sr ON s.request_id = sr.request_id
        WHERE s.session_id = ?
    `;

    db.query(checkQuery, [sessionId], (checkErr, checkResults) => {
        if (checkErr) {
            console.error("Check session error:", checkErr);
            return res.status(500).json({ message: "Database error" });
        }

        if (checkResults.length === 0) {
            return res.status(404).json({ message: "Session not found" });
        }

        const session = checkResults[0];

        if (userId) {
            const uid = parseInt(userId, 10);
            if (uid !== session.sender_id && uid !== session.receiver_id) {
                return res.status(403).json({
                    message: "You are not authorized to update this session"
                });
            }
        }

        const updateQuery = `
            UPDATE sessions
            SET status = ?
            WHERE session_id = ?
        `;

        db.query(updateQuery, [upperStatus, sessionId], (err) => {
            if (err) {
                console.error("Update session error:", err);
                return res.status(500).json({
                    message: "Could not update session status"
                });
            }

            res.json({
                message: `Session status updated to ${upperStatus}!`,
                sessionId,
                status: upperStatus
            });
        });
    });
});

module.exports = router;
