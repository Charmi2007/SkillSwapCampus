const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Search and filter students who can teach skills with college verification support
router.get("/search", (req, res) => {
    const { skill, level, department, year, excludeUserId, collegeId, verifiedOnly } = req.query;

    let query = `
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.department,
            u.year,
            u.college_id,
            c.college_name,
            u.verification_status,
            s.skill_id,
            s.skill_name,
            us.skill_level
        FROM user_skills us
        JOIN users u ON us.user_id = u.user_id
        LEFT JOIN colleges c ON u.college_id = c.college_id
        JOIN skills s ON us.skill_id = s.skill_id
        WHERE us.skill_type = 'OFFER'
    `;
    const params = [];

    if (skill && skill.trim()) {
        query += ` AND LOWER(s.skill_name) LIKE LOWER(?)`;
        params.push(`%${skill.trim()}%`);
    }

    if (level && level.trim() && level !== "ALL") {
        query += ` AND us.skill_level = ?`;
        params.push(level.trim().toUpperCase());
    }

    if (department && department.trim() && department !== "ALL") {
        query += ` AND LOWER(u.department) = LOWER(?)`;
        params.push(department.trim());
    }

    if (year && year.trim() && year !== "ALL") {
        query += ` AND u.year = ?`;
        params.push(parseInt(year.trim(), 10));
    }

    if (excludeUserId) {
        query += ` AND u.user_id != ?`;
        params.push(parseInt(excludeUserId, 10));
    }

    if (collegeId && collegeId !== "ALL") {
        query += ` AND u.college_id = ?`;
        params.push(parseInt(collegeId, 10));
    }

    if (verifiedOnly === "true") {
        query += ` AND u.verification_status = 'VERIFIED'`;
    }

    query += ` ORDER BY s.skill_name ASC, u.name ASC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Search error:", err);
            return res.status(500).json({ message: "Database error searching students" });
        }

        res.json(results);
    });
});

// Find students who can teach a particular skill (legacy & direct lookup)
router.get("/find/:skillName", (req, res) => {
    const skillName = req.params.skillName;
    const excludeUserId = req.query.excludeUserId;
    const collegeId = req.query.collegeId;

    let query = `
        SELECT
            u.user_id,
            u.name,
            u.email,
            u.department,
            u.year,
            u.college_id,
            c.college_name,
            u.verification_status,
            s.skill_id,
            s.skill_name,
            us.skill_level
        FROM user_skills us
        JOIN users u ON us.user_id = u.user_id
        LEFT JOIN colleges c ON u.college_id = c.college_id
        JOIN skills s ON us.skill_id = s.skill_id
        WHERE LOWER(s.skill_name) = LOWER(?)
        AND us.skill_type = 'OFFER'
    `;
    const params = [skillName];

    if (excludeUserId) {
        query += ` AND u.user_id != ?`;
        params.push(parseInt(excludeUserId, 10));
    }

    if (collegeId) {
        query += ` AND u.college_id = ?`;
        params.push(parseInt(collegeId, 10));
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Matching error:", err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        res.json(results);
    });
});

module.exports = router;