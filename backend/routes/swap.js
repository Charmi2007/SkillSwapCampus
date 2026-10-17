const express = require("express");
const db = require("../config/db");
const { authenticateToken, authorizeUserOrAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Send a skill swap request
 * Protected: Requires authentication.
 * Derives senderId strictly from the authenticated JWT user (req.user.userId).
 * Rejects sender impersonation, validates IDs as positive integers,
 * validates skill existence and ownership, and enforces same-college verification.
 */
router.post("/request", authenticateToken, async (req, res) => {
    try {
        const authenticatedUserId = parseInt(req.user.userId, 10);
        if (isNaN(authenticatedUserId) || authenticatedUserId <= 0) {
            return res.status(401).json({ message: "Invalid authenticated user ID." });
        }

        const { receiverId, skillOffered, skillRequested } = req.body;

        // Strictly disallow sender impersonation if a client provides senderId in body
        if (req.body.senderId !== undefined && req.body.senderId !== null) {
            const bodySenderId = parseInt(req.body.senderId, 10);
            if (bodySenderId !== authenticatedUserId && (req.user.role || "").toLowerCase() !== "admin") {
                return res.status(403).json({
                    message: "Forbidden: Sender impersonation detected. You cannot send swap requests on behalf of another user."
                });
            }
        }

        const sId = authenticatedUserId;
        const rId = parseInt(receiverId, 10);
        const sOffered = parseInt(skillOffered, 10);
        const sRequested = parseInt(skillRequested, 10);

        // Validate all IDs as positive integers
        if (isNaN(rId) || rId <= 0 || isNaN(sOffered) || sOffered <= 0 || isNaN(sRequested) || sRequested <= 0) {
            return res.status(400).json({
                message: "All fields (receiverId, skillOffered, skillRequested) must be valid positive integers."
            });
        }

        // Prevent sending swap request to oneself
        if (sId === rId) {
            return res.status(400).json({
                message: "You cannot send a skill swap request to yourself"
            });
        }

        if (sOffered === sRequested) {
            return res.status(400).json({
                message: "Offered skill and requested skill cannot be the same skill."
            });
        }

        // Validate skills exist in database
        const [skillRows] = await db.promise().query(
            "SELECT skill_id, skill_name FROM skills WHERE skill_id IN (?, ?)",
            [sOffered, sRequested]
        );
        if (skillRows.length < 2) {
            return res.status(404).json({
                message: "One or more specified skills do not exist."
            });
        }

        // Validate skill ownership: sender must actually offer the offered skill
        const [senderSkillRows] = await db.promise().query(
            "SELECT user_skill_id FROM user_skills WHERE user_id = ? AND skill_id = ? AND skill_type = 'OFFER'",
            [sId, sOffered]
        );
        if (senderSkillRows.length === 0) {
            return res.status(400).json({
                message: "You can only offer skills that you have added to your profile as an offered skill."
            });
        }

        // Check same-college authorization & verification status
        const enforceSameCollege = process.env.ENFORCE_SAME_COLLEGE !== "false";
        const [userRows] = await db.promise().query(
            "SELECT user_id, name, college_id, verification_status FROM users WHERE user_id IN (?, ?)",
            [sId, rId]
        );

        const sender = userRows.find(u => u.user_id === sId);
        const receiver = userRows.find(u => u.user_id === rId);

        if (!sender || !receiver) {
            return res.status(404).json({ message: "Sender or receiver student not found" });
        }

        if (enforceSameCollege) {
            if (sender.verification_status !== "VERIFIED") {
                return res.status(403).json({
                    message: "Institutional email verification required: Please verify your official college email before requesting a skill swap."
                });
            }

            if (receiver.verification_status !== "VERIFIED") {
                return res.status(403).json({
                    message: "Institutional email verification required: The requested student has not yet verified their college email."
                });
            }

            if (!sender.college_id || !receiver.college_id || sender.college_id !== receiver.college_id) {
                return res.status(403).json({
                    message: "Same-college access restriction: Skill swaps are restricted to students from the same registered college."
                });
            }
        }

        // Check if there is already a PENDING swap request between these users for these skills
        const [dupResults] = await db.promise().query(
            "SELECT request_id FROM swap_requests WHERE sender_id = ? AND receiver_id = ? AND skill_offered = ? AND skill_requested = ? AND status = 'PENDING'",
            [sId, rId, sOffered, sRequested]
        );

        if (dupResults.length > 0) {
            return res.status(400).json({
                message: "A pending swap request has already been sent to this student for these skills"
            });
        }

        // Insert swap request
        const [insertResult] = await db.promise().query(
            "INSERT INTO swap_requests (sender_id, receiver_id, skill_offered, skill_requested, status) VALUES (?, ?, ?, ?, 'PENDING')",
            [sId, rId, sOffered, sRequested]
        );

        res.status(201).json({
            message: "Skill swap request sent successfully!",
            requestId: insertResult.insertId
        });
    } catch (error) {
        console.error("Swap request error:", error);
        res.status(500).json({ message: "Could not send swap request" });
    }
});

/**
 * Get requests received by a student (Incoming)
 * Protected: Requires authentication and ownership (or admin).
 */
router.get("/received/:userId", authenticateToken, authorizeUserOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);

        const query = `
            SELECT
                sr.request_id,
                sr.sender_id,
                u.name AS sender_name,
                u.email AS sender_email,
                u.department AS sender_department,
                u.year AS sender_year,
                u.college_id AS sender_college_id,
                c.college_name AS sender_college_name,
                u.verification_status AS sender_verification_status,
                sr.skill_offered AS skill_offered_id,
                offered.skill_name AS skill_offered,
                sr.skill_requested AS skill_requested_id,
                requested.skill_name AS skill_requested,
                sr.status,
                sr.created_at
            FROM swap_requests sr
            JOIN users u ON sr.sender_id = u.user_id
            LEFT JOIN colleges c ON u.college_id = c.college_id
            JOIN skills offered ON sr.skill_offered = offered.skill_id
            JOIN skills requested ON sr.skill_requested = requested.skill_id
            WHERE sr.receiver_id = ?
            ORDER BY sr.created_at DESC
        `;

        const [results] = await db.promise().query(query, [userId]);
        res.json(results);
    } catch (err) {
        console.error("Received request fetch error:", err);
        res.status(500).json({ message: "Database error fetching received requests" });
    }
});

/**
 * Get requests sent by a student (Outgoing)
 * Protected: Requires authentication and ownership (or admin).
 */
router.get("/sent/:userId", authenticateToken, authorizeUserOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);

        const query = `
            SELECT
                sr.request_id,
                sr.receiver_id,
                u.name AS receiver_name,
                u.email AS receiver_email,
                u.department AS receiver_department,
                u.year AS receiver_year,
                u.college_id AS receiver_college_id,
                c.college_name AS receiver_college_name,
                u.verification_status AS receiver_verification_status,
                sr.skill_offered AS skill_offered_id,
                offered.skill_name AS skill_offered,
                sr.skill_requested AS skill_requested_id,
                requested.skill_name AS skill_requested,
                sr.status,
                sr.created_at
            FROM swap_requests sr
            JOIN users u ON sr.receiver_id = u.user_id
            LEFT JOIN colleges c ON u.college_id = c.college_id
            JOIN skills offered ON sr.skill_offered = offered.skill_id
            JOIN skills requested ON sr.skill_requested = requested.skill_id
            WHERE sr.sender_id = ?
            ORDER BY sr.created_at DESC
        `;

        const [results] = await db.promise().query(query, [userId]);
        res.json(results);
    } catch (err) {
        console.error("Sent request fetch error:", err);
        res.status(500).json({ message: "Database error fetching sent requests" });
    }
});

/**
 * Accept or reject a request
 * Protected: Requires authentication.
 * Derives acting user strictly from the token. Only the actual receiver of the request
 * can accept or reject it. Any body userId is strictly prevented from bypassing authorization.
 */
router.put("/respond/:requestId", authenticateToken, async (req, res) => {
    try {
        const rawRequestId = req.params.requestId;
        const requestId = parseInt(rawRequestId, 10);
        if (isNaN(requestId) || requestId <= 0) {
            return res.status(400).json({
                message: "Invalid request ID provided in parameters."
            });
        }

        const { status } = req.body;
        if (!status || !["ACCEPTED", "REJECTED"].includes(status.toUpperCase())) {
            return res.status(400).json({
                message: "Invalid status. Must be ACCEPTED or REJECTED"
            });
        }
        const normalizedStatus = status.toUpperCase();

        const actingUserId = parseInt(req.user.userId, 10);
        const userRole = (req.user.role || "").toLowerCase();

        // Check if client supplied a body userId that conflicts with authenticated user
        if (req.body.userId !== undefined && req.body.userId !== null) {
            const bodyUserId = parseInt(req.body.userId, 10);
            if (bodyUserId !== actingUserId && userRole !== "admin") {
                return res.status(403).json({
                    message: "Forbidden: User impersonation detected in request body."
                });
            }
        }

        // Verify request exists
        const [findResults] = await db.promise().query(
            "SELECT * FROM swap_requests WHERE request_id = ?",
            [requestId]
        );

        if (findResults.length === 0) {
            return res.status(404).json({ message: "Swap request not found" });
        }

        const swapReq = findResults[0];

        // Authorization: only the actual receiver of that request (or admin) can respond
        if (actingUserId !== swapReq.receiver_id && userRole !== "admin") {
            return res.status(403).json({
                message: "Only the receiver of this request can accept or reject it"
            });
        }

        if (swapReq.status !== "PENDING") {
            return res.status(400).json({
                message: `This request has already been ${swapReq.status.toLowerCase()}`
            });
        }

        await db.promise().query(
            "UPDATE swap_requests SET status = ? WHERE request_id = ?",
            [normalizedStatus, requestId]
        );

        res.json({
            message: `Request ${normalizedStatus.toLowerCase()} successfully!`,
            requestId,
            status: normalizedStatus
        });
    } catch (error) {
        console.error("Respond request error:", error);
        res.status(500).json({ message: "Could not update request status" });
    }
});

/**
 * Get accepted swap requests that can be scheduled into a session
 * Protected: Requires authentication and ownership (or admin).
 */
router.get("/accepted/:userId", authenticateToken, authorizeUserOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);

        const query = `
            SELECT
                sr.request_id,
                sr.sender_id,
                sr.receiver_id,
                u_sender.name AS sender_name,
                u_receiver.name AS receiver_name,
                offered.skill_name AS skill_offered,
                requested.skill_name AS skill_requested,
                sr.status,
                sr.created_at,
                (SELECT COUNT(*) FROM sessions WHERE request_id = sr.request_id) AS session_count
            FROM swap_requests sr
            JOIN users u_sender ON sr.sender_id = u_sender.user_id
            JOIN users u_receiver ON sr.receiver_id = u_receiver.user_id
            JOIN skills offered ON sr.skill_offered = offered.skill_id
            JOIN skills requested ON sr.skill_requested = requested.skill_id
            WHERE sr.status = 'ACCEPTED' AND (sr.sender_id = ? OR sr.receiver_id = ?)
            ORDER BY sr.created_at DESC
        `;

        const [results] = await db.promise().query(query, [userId, userId]);
        res.json(results);
    } catch (err) {
        console.error("Accepted requests fetch error:", err);
        res.status(500).json({ message: "Database error fetching accepted requests" });
    }
});

module.exports = router;
