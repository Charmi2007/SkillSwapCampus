const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Send a skill swap request
router.post("/request", (req, res) => {
    const {
        senderId,
        receiverId,
        skillOffered,
        skillRequested
    } = req.body;

    if (!senderId || !receiverId || !skillOffered || !skillRequested) {
        return res.status(400).json({
            message: "All fields (sender, receiver, offered skill, requested skill) are required"
        });
    }

    const sId = parseInt(senderId, 10);
    const rId = parseInt(receiverId, 10);
    const sOffered = parseInt(skillOffered, 10);
    const sRequested = parseInt(skillRequested, 10);

    // Prevent sending swap request to oneself
    if (sId === rId) {
        return res.status(400).json({
            message: "You cannot send a skill swap request to yourself"
        });
    }

    // Check same-college authorization & verification status
    const enforceSameCollege = process.env.ENFORCE_SAME_COLLEGE !== "false";
    const userCheckQuery = `
        SELECT user_id, name, college_id, verification_status
        FROM users
        WHERE user_id IN (?, ?)
    `;

    db.query(userCheckQuery, [sId, rId], (uErr, userRows) => {
        if (uErr) {
            console.error("User college verification check error:", uErr);
            return res.status(500).json({ message: "Database error verifying college eligibility" });
        }

        if (enforceSameCollege) {
            const sender = userRows.find(u => u.user_id === sId);
            const receiver = userRows.find(u => u.user_id === rId);

            if (!sender || !receiver) {
                return res.status(404).json({ message: "Sender or receiver student not found" });
            }

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
        const checkDuplicateQuery = `
            SELECT request_id FROM swap_requests
            WHERE sender_id = ? AND receiver_id = ? AND skill_offered = ? AND skill_requested = ? AND status = 'PENDING'
        `;

        db.query(checkDuplicateQuery, [sId, rId, sOffered, sRequested], (dupErr, dupResults) => {
            if (dupErr) {
                console.error("Duplicate check error:", dupErr);
                return res.status(500).json({ message: "Database error checking existing requests" });
            }

            if (dupResults.length > 0) {
                return res.status(400).json({
                    message: "A pending swap request has already been sent to this student for these skills"
                });
            }

            // Insert swap request
            const insertQuery = `
                INSERT INTO swap_requests
                (sender_id, receiver_id, skill_offered, skill_requested, status)
                VALUES (?, ?, ?, ?, 'PENDING')
            `;

            db.query(
                insertQuery,
                [sId, rId, sOffered, sRequested],
                (err, result) => {
                    if (err) {
                        console.error("Swap request error:", err);
                        return res.status(500).json({
                            message: "Could not send swap request"
                        });
                    }

                    res.status(201).json({
                        message: "Skill swap request sent successfully!",
                        requestId: result.insertId
                    });
                }
            );
        });
    });
});

// Get requests received by a student (Incoming)
router.get("/received/:userId", (req, res) => {
    const userId = req.params.userId;

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

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Received request fetch error:", err);
            return res.status(500).json({
                message: "Database error fetching received requests"
            });
        }

        res.json(results);
    });
});

// Get requests sent by a student (Outgoing)
router.get("/sent/:userId", (req, res) => {
    const userId = req.params.userId;

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

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Sent request fetch error:", err);
            return res.status(500).json({
                message: "Database error fetching sent requests"
            });
        }

        res.json(results);
    });
});

// Accept or reject a request
router.put("/respond/:requestId", (req, res) => {
    const requestId = req.params.requestId;
    const { status, userId } = req.body;

    if (!["ACCEPTED", "REJECTED"].includes(status)) {
        return res.status(400).json({
            message: "Invalid status. Must be ACCEPTED or REJECTED"
        });
    }

    // Verify request exists and user is receiver
    const findQuery = `SELECT * FROM swap_requests WHERE request_id = ?`;
    db.query(findQuery, [requestId], (findErr, findResults) => {
        if (findErr) {
            console.error("Fetch request error:", findErr);
            return res.status(500).json({ message: "Database error" });
        }

        if (findResults.length === 0) {
            return res.status(404).json({ message: "Swap request not found" });
        }

        const swapReq = findResults[0];

        if (userId && parseInt(userId, 10) !== swapReq.receiver_id) {
            return res.status(403).json({
                message: "Only the receiver of this request can accept or reject it"
            });
        }

        if (swapReq.status !== "PENDING") {
            return res.status(400).json({
                message: `This request has already been ${swapReq.status.toLowerCase()}`
            });
        }

        const updateQuery = `
            UPDATE swap_requests
            SET status = ?
            WHERE request_id = ?
        `;

        db.query(updateQuery, [status, requestId], (err) => {
            if (err) {
                console.error("Request update error:", err);
                return res.status(500).json({
                    message: "Could not update request status"
                });
            }

            res.json({
                message: `Request ${status.toLowerCase()} successfully!`,
                requestId,
                status
            });
        });
    });
});

// Get accepted swap requests that can be scheduled into a session
router.get("/accepted/:userId", (req, res) => {
    const userId = req.params.userId;

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

    db.query(query, [userId, userId], (err, results) => {
        if (err) {
            console.error("Accepted requests fetch error:", err);
            return res.status(500).json({
                message: "Database error fetching accepted requests"
            });
        }

        res.json(results);
    });
});

module.exports = router;
