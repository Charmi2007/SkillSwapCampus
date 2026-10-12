// Find Students & Request Skill Swap Logic

const userId = requireAuth();
if (userId) {
    renderNavbar("find-skills");
}

const searchForm = document.getElementById("searchForm");
const searchSkill = document.getElementById("searchSkill");
const filterLevel = document.getElementById("filterLevel");
const filterDept = document.getElementById("filterDept");
const filterYear = document.getElementById("filterYear");
const resetBtn = document.getElementById("resetBtn");
const results = document.getElementById("results");
const resultsCount = document.getElementById("resultsCount");
const message = document.getElementById("message");

// Modal Elements
const swapModal = document.getElementById("swapModal");
const modalReceiverName = document.getElementById("modalReceiverName");
const modalRequestedSkill = document.getElementById("modalRequestedSkill");
const modalOfferedSkillSelect = document.getElementById("modalOfferedSkillSelect");
const offeredSkillSelectionGroup = document.getElementById("offeredSkillSelectionGroup");
const noOfferSkillsWarning = document.getElementById("noOfferSkillsWarning");
const proposeSwapForm = document.getElementById("proposeSwapForm");
const sendSwapBtn = document.getElementById("sendSwapBtn");

let activeReceiverId = null;
let activeRequestedSkillId = null;

// Initial Load: search all available students (excluding self)
document.addEventListener("DOMContentLoaded", () => {
    executeSearch();
});

searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    executeSearch();
});

resetBtn.addEventListener("click", () => {
    searchSkill.value = "";
    filterLevel.value = "ALL";
    filterDept.value = "";
    filterYear.value = "ALL";
    executeSearch();
});

async function executeSearch() {
    results.innerHTML = `<div class="empty-state"><p>Searching for classmates...</p></div>`;

    const skill = searchSkill.value.trim();
    const level = filterLevel.value;
    const department = filterDept.value.trim();
    const year = filterYear.value;

    const params = new URLSearchParams();
    if (skill) params.append("skill", skill);
    if (level && level !== "ALL") params.append("level", level);
    if (department && department !== "ALL") params.append("department", department);
    if (year && year !== "ALL") params.append("year", year);
    if (userId) params.append("excludeUserId", userId);

    try {
        const response = await fetch(`${API_BASE}/api/match/search?${params.toString()}`);
        const students = await response.json();

        if (!response.ok) {
            results.innerHTML = `<div class="empty-state"><p>Unable to load students.</p></div>`;
            return;
        }

        if (students.length === 0) {
            resultsCount.textContent = "Available Student Tutors (0)";
            results.innerHTML = `
                <div class="empty-state">
                    <h4>No student tutors found</h4>
                    <p>Try modifying your search criteria or searching for another skill.</p>
                </div>
            `;
            return;
        }

        resultsCount.textContent = `Available Student Tutors (${students.length})`;
        results.innerHTML = "";

        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
        grid.style.gap = "18px";

        students.forEach(student => {
            const card = document.createElement("div");
            card.style.padding = "20px";
            card.style.border = "1px solid var(--border-color)";
            card.style.borderRadius = "10px";
            card.style.background = "#fff";
            card.style.boxShadow = "var(--shadow-sm)";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.justifyContent = "space-between";

            const deptText = student.department ? student.department : "Dept N/A";
            const yearText = student.year ? `Year ${student.year}` : "";

            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <strong style="font-size: 16px; color: var(--text-main);">${escapeHtml(student.name)}</strong>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                                ${escapeHtml(deptText)} ${yearText ? '• ' + escapeHtml(yearText) : ''}
                            </div>
                        </div>
                        <span class="badge badge-offer">${escapeHtml(student.skill_level || 'BEGINNER')}</span>
                    </div>

                    <div style="margin: 14px 0; background: var(--primary-light); padding: 10px 14px; border-radius: 8px;">
                        <span style="font-size: 12px; color: var(--secondary); text-transform: uppercase; font-weight: 600; display: block;">Can Teach</span>
                        <strong style="font-size: 15px; color: var(--primary);">${escapeHtml(student.skill_name)}</strong>
                    </div>
                </div>

                <button 
                    onclick="openSwapModal(${student.user_id}, '${escapeHtml(student.name)}', ${student.skill_id}, '${escapeHtml(student.skill_name)}')"
                    class="btn" style="width: 100%; margin-top: 10px;">
                    Request Skill Swap
                </button>
            `;

            grid.appendChild(card);
        });

        results.appendChild(grid);

    } catch (error) {
        console.error("Search error:", error);
        results.innerHTML = `<div class="empty-state"><p>Unable to connect to the server.</p></div>`;
    }
}

// Open Request Swap Modal
async function openSwapModal(receiverId, receiverName, skillRequestedId, skillRequestedName) {
    activeReceiverId = receiverId;
    activeRequestedSkillId = skillRequestedId;

    modalReceiverName.textContent = receiverName;
    modalRequestedSkill.textContent = skillRequestedName;
    modalOfferedSkillSelect.innerHTML = `<option value="">Loading your skills...</option>`;
    offeredSkillSelectionGroup.style.display = "block";
    noOfferSkillsWarning.style.display = "none";
    sendSwapBtn.disabled = false;
    sendSwapBtn.textContent = "Send Request";

    swapModal.classList.add("open");

    // Load logged-in user's OFFER skills
    try {
        const response = await fetch(`${API_BASE}/api/skills/${userId}`);
        const skills = await response.json();

        if (!response.ok) {
            modalOfferedSkillSelect.innerHTML = `<option value="">Error loading your skills</option>`;
            return;
        }

        const offeredSkills = skills.filter(s => s.skill_type === "OFFER");

        if (offeredSkills.length === 0) {
            offeredSkillSelectionGroup.style.display = "none";
            noOfferSkillsWarning.style.display = "block";
            sendSwapBtn.disabled = true;
            return;
        }

        modalOfferedSkillSelect.innerHTML = `<option value="">-- Choose a skill to offer in return --</option>`;
        offeredSkills.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.skill_id;
            opt.textContent = `${s.skill_name} (${s.skill_level})`;
            modalOfferedSkillSelect.appendChild(opt);
        });

    } catch (err) {
        console.error("Load user skills error:", err);
        modalOfferedSkillSelect.innerHTML = `<option value="">Error loading skills</option>`;
    }
}

function closeSwapModal() {
    swapModal.classList.remove("open");
}

// Submit Swap Request
proposeSwapForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedSkillOffered = modalOfferedSkillSelect.value;
    if (!selectedSkillOffered) {
        alert("Please select a skill you can offer in return.");
        return;
    }

    sendSwapBtn.disabled = true;
    sendSwapBtn.textContent = "Sending Request...";

    try {
        const response = await fetch(`${API_BASE}/api/swap/request`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                senderId: userId,
                receiverId: activeReceiverId,
                skillOffered: selectedSkillOffered,
                skillRequested: activeRequestedSkillId
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeSwapModal();
            showMessage(data.message || "Skill swap request sent successfully!", "success");
        } else {
            alert(data.message || "Failed to send request.");
            sendSwapBtn.disabled = false;
            sendSwapBtn.textContent = "Send Request";
        }
    } catch (error) {
        console.error("Send swap request error:", error);
        alert("Unable to connect to the server.");
        sendSwapBtn.disabled = false;
        sendSwapBtn.textContent = "Send Request";
    }
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
    message.style.display = "block";
    setTimeout(() => {
        message.style.display = "none";
    }, 4500);
}