// Skill Management Logic for SkillSwap Campus

const userId = requireAuth();
if (userId) {
    renderNavbar("skills");
}

const skillForm = document.getElementById("skillForm");
const message = document.getElementById("message");
const skillsList = document.getElementById("skillsList");
const addSkillBtn = document.getElementById("addSkillBtn");

// Add skill
skillForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const skillName = document.getElementById("skillName").value.trim();
    const skillType = document.getElementById("skillType").value;
    const skillLevel = document.getElementById("skillLevel").value;

    if (!skillName || !skillType) {
        showMessage("Skill name and type are required.", "error");
        return;
    }

    addSkillBtn.disabled = true;
    addSkillBtn.textContent = "Adding Skill...";
    message.style.display = "none";

    try {
        const response = await fetch(`${API_BASE}/api/skills/add`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: userId,
                skillName: skillName,
                skillType: skillType,
                skillLevel: skillLevel
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || "Skill added successfully!", "success");
            skillForm.reset();
            loadSkills();
        } else {
            showMessage(data.message || "Failed to add skill.", "error");
        }
    } catch (error) {
        console.error("Add skill fetch error:", error);
        showMessage("Unable to connect to server.", "error");
    } finally {
        addSkillBtn.disabled = false;
        addSkillBtn.textContent = "Add Skill to Profile";
    }
});

// Load student's skills
async function loadSkills() {
    try {
        const response = await fetch(`${API_BASE}/api/skills/${userId}`);
        const skills = await response.json();

        if (!response.ok) {
            skillsList.innerHTML = `<div class="empty-state"><p>Error loading skills.</p></div>`;
            return;
        }

        if (skills.length === 0) {
            skillsList.innerHTML = `
                <div class="empty-state">
                    <h4>No skills added yet</h4>
                    <p>Add skills you can teach or want to learn to start swapping with classmates.</p>
                </div>
            `;
            return;
        }

        skillsList.innerHTML = "";

        // Separate offer and want skills
        const offerSkills = skills.filter(s => s.skill_type === "OFFER");
        const wantSkills = skills.filter(s => s.skill_type === "WANT");

        if (offerSkills.length > 0) {
            const h4 = document.createElement("h4");
            h4.style.fontSize = "14px";
            h4.style.color = "var(--primary)";
            h4.style.marginBottom = "10px";
            h4.textContent = `💡 Skills I Can Teach (${offerSkills.length})`;
            skillsList.appendChild(h4);

            offerSkills.forEach(skill => {
                skillsList.appendChild(createSkillCard(skill));
            });
        }

        if (wantSkills.length > 0) {
            const h4 = document.createElement("h4");
            h4.style.fontSize = "14px";
            h4.style.color = "var(--warning)";
            h4.style.margin = "16px 0 10px 0";
            h4.textContent = `🎯 Skills I Want to Learn (${wantSkills.length})`;
            skillsList.appendChild(h4);

            wantSkills.forEach(skill => {
                skillsList.appendChild(createSkillCard(skill));
            });
        }

    } catch (error) {
        console.error("Load skills error:", error);
        skillsList.innerHTML = `<div class="empty-state"><p>Unable to connect to server.</p></div>`;
    }
}

function createSkillCard(skill) {
    const div = document.createElement("div");
    div.style.padding = "12px 16px";
    div.style.marginBottom = "8px";
    div.style.border = "1px solid var(--border-color)";
    div.style.borderRadius = "8px";
    div.style.background = "#fff";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";

    const badgeClass = skill.skill_type === "OFFER" ? "badge-offer" : "badge-want";

    div.innerHTML = `
        <div>
            <strong style="font-size: 15px; color: var(--text-main);">${escapeHtml(skill.skill_name)}</strong>
            <div style="margin-top: 4px; display: flex; gap: 8px; align-items: center;">
                <span class="badge ${badgeClass}">${skill.skill_type === 'OFFER' ? 'Can Teach' : 'Wants to Learn'}</span>
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">Level: ${escapeHtml(skill.skill_level)}</span>
            </div>
        </div>
        <div>
            <button onclick="deleteSkill(${skill.user_skill_id})" class="btn btn-secondary btn-sm" style="color: var(--danger);" title="Remove Skill">
                🗑️
            </button>
        </div>
    `;

    return div;
}

// Delete skill
async function deleteSkill(userSkillId) {
    if (!confirm("Are you sure you want to remove this skill from your profile?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/skills/${userSkillId}?userId=${userId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || "Skill removed successfully!", "success");
            loadSkills();
        } else {
            showMessage(data.message || "Failed to remove skill.", "error");
        }
    } catch (error) {
        console.error("Delete skill error:", error);
        showMessage("Unable to connect to server.", "error");
    }
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
    message.style.display = "block";
    setTimeout(() => {
        message.style.display = "none";
    }, 4000);
}

// Load skills on page load
loadSkills();