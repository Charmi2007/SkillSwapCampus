const express = require("express");
const db = require("../config/db");
const { authenticateToken, authorizeUserOrAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Schedule a new skill exchange session
 * Protected: Requires authentication.
 * Derives acting user strictly from req.user.userId. Only the sender or receiver
 * of the accepted swap request may schedule its session.
 * Rejects invalid IDs, dates, times, duration limits, and mode values.
 */
router.post("/schedule", authenticateToken, async (req, res) => {
    try {
        const actingUserId = parseInt(req.user.userId, 10);
        const userRole = (req.user.role || "").toLowerCase();

        if (isNaN(actingUserId) || actingUserId <= 0) {
            return res.status(401).json({ message: "Invalid authenticated user ID." });
        }

        // Prevent body userId spoofing
        if (req.body.userId !== undefined && req.body.userId !== null) {
            const bodyUserId = parseInt(req.body.userId, 10);
            if (bodyUserId !== actingUserId && userRole !== "admin") {
                return res.status(403).json({
                    message: "Forbidden: User impersonation detected in request body."
                });
            }
        }

        const {
            requestId,
            sessionDate,
            sessionTime,
            duration,
            mode
        } = req.body;

        // 1. Validate positive integer requestId
        const rId = parseInt(requestId, 10);
        if (isNaN(rId) || rId <= 0) {
            return res.status(400).json({
                message: "Valid positive integer requestId is required."
            });
        }

        // 2. Validate sessionDate (format YYYY-MM-DD and valid date)
        if (!sessionDate || typeof sessionDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate.trim())) {
            return res.status(400).json({
                message: "Valid session date is required in YYYY-MM-DD format."
            });
        }
        const trimmedDate = sessionDate.trim();
        const parsedDate = new Date(trimmedDate);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                message: "Invalid calendar date provided."
            });
        }

        // 3. Validate sessionTime (HH:MM or HH:MM:SS format)
        if (!sessionTime || typeof sessionTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(sessionTime.trim())) {
            return res.status(400).json({
                message: "Valid session time is required in 24-hour HH:MM or HH:MM:SS format."
            });
        }
        const trimmedTime = sessionTime.trim();

        // 4. Validate duration limits (must be positive integer between 15 and 480 minutes)
        let sessionDuration = 60;
        if (duration !== undefined && duration !== null && duration !== "") {
            const parsedDuration = parseInt(duration, 10);
            if (isNaN(parsedDuration) || parsedDuration < 15 || parsedDuration > 480) {
                return res.status(400).json({
                    message: "Session duration must be an integer between 15 and 480 minutes."
                });
            }
            sessionDuration = parsedDuration;
        }

        // 5. Validate mode (must be explicitly ONLINE or OFFLINE; reject invalid values)
        if (!mode || typeof mode !== "string") {
            return res.status(400).json({
                message: "Session mode is required. Must be ONLINE or OFFLINE."
            });
        }
        const upperMode = mode.trim().toUpperCase();
        if (!["ONLINE", "OFFLINE"].includes(upperMode)) {
            return res.status(400).json({
                message: "Invalid session mode. Must be ONLINE or OFFLINE."
            });
        }

        // 6. Verify swap request exists and is ACCEPTED
        const checkQuery = `
            SELECT request_id, sender_id, receiver_id, status
            FROM swap_requests
            WHERE request_id = ?
        `;
        const [checkResults] = await db.promise().query(checkQuery, [rId]);

        if (checkResults.length === 0) {
            return res.status(404).json({ message: "Swap request not found" });
        }

        const swapReq = checkResults[0];

        if (swapReq.status !== "ACCEPTED") {
            return res.status(400).json({
                message: "Cannot schedule session: the swap request has not been accepted yet"
            });
        }

        // 7. Authorization: acting user must be sender or receiver of the swap request
        if (actingUserId !== swapReq.sender_id && actingUserId !== swapReq.receiver_id && userRole !== "admin") {
            return res.status(403).json({
                message: "You are not a participant in this skill swap"
            });
        }

        // 8. Enforce same-college and verification status
        const enforceSameCollege = process.env.ENFORCE_SAME_COLLEGE !== "false";
        const userCheckQuery = `
            SELECT user_id, college_id, verification_status
            FROM users
            WHERE user_id IN (?, ?)
        `;
        const [userRows] = await db.promise().query(userCheckQuery, [swapReq.sender_id, swapReq.receiver_id]);

        if (enforceSameCollege) {
            const sender = userRows.find(u => u.user_id === swapReq.sender_id);
            const receiver = userRows.find(u => u.user_id === swapReq.receiver_id);

            if (!sender || !receiver) {
                return res.status(404).json({ message: "Participants not found" });
            }

            if (sender.verification_status !== "VERIFIED" || receiver.verification_status !== "VERIFIED") {
                return res.status(403).json({
                    message: "Institutional email verification required: Both participants must verify their college email before scheduling sessions."
                });
            }

            if (!sender.college_id || !receiver.college_id || sender.college_id !== receiver.college_id) {
                return res.status(403).json({
                    message: "Same-college access restriction: Sessions can only be scheduled between students of the same college."
                });
            }
        }

        // 9. Insert scheduled session
        const insertQuery = `
            INSERT INTO sessions
            (request_id, session_date, session_time, duration, mode, status)
            VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
        `;

        const [result] = await db.promise().query(
            insertQuery,
            [rId, trimmedDate, trimmedTime, sessionDuration, upperMode]
        );

        res.status(201).json({
            message: "Session scheduled successfully!",
            sessionId: result.insertId
        });
    } catch (error) {
        console.error("Schedule session error:", error);
        res.status(500).json({ message: "Could not schedule session" });
    }
});

/**
 * Get all sessions for a student (where user is sender or receiver)
 * Protected: Requires authentication and ownership (or admin role).
 */
router.get("/user/:userId", authenticateToken, authorizeUserOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);

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
                (SELECT COUNT(*) FROM reviews WHERE session_id = s.session_id AND reviewer_id = ?) AS has_reviewed,
                om.meeting_id,
                om.room_name,
                om.status AS meeting_status
            FROM sessions s
            JOIN swap_requests sr ON s.request_id = sr.request_id
            JOIN users u_sender ON sr.sender_id = u_sender.user_id
            JOIN users u_receiver ON sr.receiver_id = u_receiver.user_id
            JOIN skills sk_offered ON sr.skill_offered = sk_offered.skill_id
            JOIN skills sk_requested ON sr.skill_requested = sk_requested.skill_id
            LEFT JOIN online_meetings om ON s.session_id = om.session_id
            WHERE sr.sender_id = ? OR sr.receiver_id = ?
            ORDER BY s.session_date DESC, s.session_time DESC
        `;

        const [results] = await db.promise().query(query, [userId, userId, userId]);
        res.json(results);
    } catch (err) {
        console.error("Fetch sessions error:", err);
        res.status(500).json({ message: "Database error fetching sessions" });
    }
});

/**
 * Update session status (COMPLETED or CANCELLED)
 * Protected: Requires authentication.
 * Derives acting user from JWT token. Only authenticated participants may update status.
 */
router.put("/:sessionId/status", authenticateToken, async (req, res) => {
    try {
        const rawSessionId = req.params.sessionId;
        const sessionId = parseInt(rawSessionId, 10);
        if (isNaN(sessionId) || sessionId <= 0) {
            return res.status(400).json({
                message: "Invalid session ID. Must be a positive integer."
            });
        }

        const { status } = req.body;
        if (!status || typeof status !== "string") {
            return res.status(400).json({
                message: "Status is required."
            });
        }

        const upperStatus = status.trim().toUpperCase();
        if (!["COMPLETED", "CANCELLED", "SCHEDULED"].includes(upperStatus)) {
            return res.status(400).json({
                message: "Invalid status. Must be SCHEDULED, COMPLETED, or CANCELLED"
            });
        }

        const actingUserId = parseInt(req.user.userId, 10);
        const userRole = (req.user.role || "").toLowerCase();

        // Prevent body userId spoofing
        if (req.body.userId !== undefined && req.body.userId !== null) {
            const bodyUserId = parseInt(req.body.userId, 10);
            if (bodyUserId !== actingUserId && userRole !== "admin") {
                return res.status(403).json({
                    message: "Forbidden: User impersonation detected in request body."
                });
            }
        }

        const checkQuery = `
            SELECT s.session_id, s.status, sr.sender_id, sr.receiver_id
            FROM sessions s
            JOIN swap_requests sr ON s.request_id = sr.request_id
            WHERE s.session_id = ?
        `;

        const [checkResults] = await db.promise().query(checkQuery, [sessionId]);

        if (checkResults.length === 0) {
            return res.status(404).json({ message: "Session not found" });
        }

        const session = checkResults[0];

        // Authorization: acting user must be a session participant (sender or receiver) or admin
        if (actingUserId !== session.sender_id && actingUserId !== session.receiver_id && userRole !== "admin") {
            return res.status(403).json({
                message: "You are not authorized to update this session"
            });
        }

        const updateQuery = `
            UPDATE sessions
            SET status = ?
            WHERE session_id = ?
        `;

        await db.promise().query(updateQuery, [upperStatus, sessionId]);

        res.json({
            message: `Session status updated to ${upperStatus}!`,
            sessionId,
            status: upperStatus
        });
    } catch (error) {
        console.error("Update session error:", error);
        res.status(500).json({ message: "Could not update session status" });
    }
});

module.exports = router;
