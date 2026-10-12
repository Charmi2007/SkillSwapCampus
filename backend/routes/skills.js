const express = require("express");

const db = require("../config/db");

const router = express.Router();

// Add a skill to a student's profile
router.post("/add", (req, res) => {
    const {
        userId,
        skillName,
        skillType,
        skillLevel
    } = req.body;

    if (!userId || !skillName || !skillType) {
        return res.status(400).json({
            message: "User ID, skill name and skill type are required"
        });
    }

    // Check whether skill already exists
    const findSkill = `
        SELECT skill_id
        FROM skills
        WHERE skill_name = ?
    `;

    db.query(findSkill, [skillName], (err, results) => {

        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Database error"
            });
        }

        // Skill already exists
        if (results.length > 0) {

            addUserSkill(
                results[0].skill_id,
                userId,
                skillType,
                skillLevel,
                res
            );

        } else {

            // Create new skill
            const createSkill = `
                INSERT INTO skills
                (skill_name, category)
                VALUES (?, ?)
            `;

            db.query(
                createSkill,
                [skillName, "General"],
                (err, result) => {

                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            message: "Could not create skill"
                        });
                    }

                    addUserSkill(
                        result.insertId,
                        userId,
                        skillType,
                        skillLevel,
                        res
                    );
                }
            );
        }
    });
});


// Add skill to user_skills table
function addUserSkill(
    skillId,
    userId,
    skillType,
    skillLevel,
    res
) {
    // Check if user already added this skill with this type
    const checkUserSkill = `
        SELECT user_skill_id FROM user_skills
        WHERE user_id = ? AND skill_id = ? AND skill_type = ?
    `;

    db.query(checkUserSkill, [userId, skillId, skillType], (err, existing) => {
        if (err) {
            console.error("Check user skill error:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (existing.length > 0) {
            return res.status(409).json({
                message: `You have already added this skill as ${skillType === 'OFFER' ? 'Can Teach' : 'Want to Learn'}`
            });
        }

        const query = `
            INSERT INTO user_skills
            (user_id, skill_id, skill_type, skill_level)
            VALUES (?, ?, ?, ?)
        `;

        db.query(
            query,
            [
                userId,
                skillId,
                skillType,
                skillLevel || "BEGINNER"
            ],
            (insertErr) => {
                if (insertErr) {
                    console.error("Add skill error:", insertErr);

                    return res.status(500).json({
                        message: "Could not add skill"
                    });
                }

                res.status(201).json({
                    message: "Skill added successfully!"
                });
            }
        );
    });
}


// Get all skills of a student
router.get("/:userId", (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT
            us.user_skill_id,
            s.skill_id,
            s.skill_name,
            us.skill_type,
            us.skill_level
        FROM user_skills us
        JOIN skills s
            ON us.skill_id = s.skill_id
        WHERE us.user_id = ?
        ORDER BY us.user_skill_id DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                message: "Database error"
            });
        }

        res.json(results);
    });
});

// Delete a skill from a student's profile
router.delete("/:userSkillId", (req, res) => {
    const userSkillId = req.params.userSkillId;
    const userId = req.query.userId || req.body.userId;

    let query = "DELETE FROM user_skills WHERE user_skill_id = ?";
    let params = [userSkillId];

    if (userId) {
        query += " AND user_id = ?";
        params.push(userId);
    }

    db.query(query, params, (err, result) => {
        if (err) {
            console.error("Delete skill error:", err);
            return res.status(500).json({ message: "Database error deleting skill" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Skill not found or unauthorized" });
        }

        res.json({ message: "Skill removed successfully!" });
    });
});



module.exports = router;