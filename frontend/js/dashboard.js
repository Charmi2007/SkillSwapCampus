// Dashboard Logic for SkillSwap Campus

document.addEventListener("DOMContentLoaded", async () => {
    const userId = requireAuth();
    if (!userId) return;

    renderNavbar("dashboard");

    await loadDashboardData(userId);
    await loadUpcomingSessions(userId);
});

async function loadDashboardData(userId) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/profile/${userId}`);
        if (!response.ok) {
            console.error("Failed to load profile stats");
            return;
        }

        const data = await response.json();
        const user = data.user || {};
        const stats = data.stats || {};

        // Update welcome message
        const welcomeTitle = document.getElementById("welcomeTitle");
        if (welcomeTitle) {
            welcomeTitle.textContent = `Welcome back, ${user.name}! 👋`;
        }

        const welcomeSubtitle = document.getElementById("welcomeSubtitle");
        if (welcomeSubtitle && user.department) {
            welcomeSubtitle.textContent = `${user.department} Department • Year ${user.year || 1} • College Skill Exchange`;
        }

        // Update stat counters
        document.getElementById("statOffered").textContent = stats.skillsOffered || 0;
        document.getElementById("statWanted").textContent = stats.skillsWanted || 0;
        document.getElementById("statPending").textContent = stats.pendingRequests || 0;
        document.getElementById("statSessions").textContent = stats.upcomingSessions || 0;
        document.getElementById("statRating").textContent = (stats.averageRating || 0).toFixed(1);
        document.getElementById("statReviews").textContent = `Campus Rating (${stats.reviewCount || 0} reviews)`;

        // Update profile summary card
        document.getElementById("userName").textContent = user.name || "Student";
        document.getElementById("userEmail").textContent = user.email || "-";
        document.getElementById("userDept").textContent = user.department || "Not specified";
        document.getElementById("userYear").textContent = user.year ? `Year ${user.year}` : "Not specified";

        const ratingVal = stats.averageRating || 0;
        document.getElementById("userRatingStars").innerHTML = `
            <span class="stars-display">${renderStars(ratingVal)}</span>
            <strong style="margin-left: 6px;">${ratingVal.toFixed(1)}</strong>
            <span style="color: var(--text-muted); font-size: 13px;">(${stats.reviewCount || 0} reviews)</span>
        `;

        // Update localStorage cache with latest name/dept/year
        if (user.name) localStorage.setItem("userName", user.name);
        if (user.email) localStorage.setItem("userEmail", user.email);
        if (user.department) localStorage.setItem("userDepartment", user.department);
        if (user.year) localStorage.setItem("userYear", user.year);

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

async function loadUpcomingSessions(userId) {
    const listContainer = document.getElementById("upcomingSessionsList");
    if (!listContainer) return;

    try {
        const response = await fetch(`${API_BASE}/api/sessions/user/${userId}`);
        if (!response.ok) {
            listContainer.innerHTML = `<div class="empty-state"><p>Unable to load sessions.</p></div>`;
            return;
        }

        const sessions = await response.json();
        const upcoming = sessions.filter(s => s.status === "SCHEDULED");

        if (upcoming.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p style="margin-bottom: 10px;">No upcoming sessions scheduled right now.</p>
                    <a href="find-skills.html" class="btn btn-secondary btn-sm">Find Students to Swap Skills</a>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = "";
        upcoming.slice(0, 3).forEach(s => {
            const isSender = (parseInt(userId, 10) === s.sender_id);
            const partnerName = isSender ? s.receiver_name : s.sender_name;
            const mySkill = isSender ? s.skill_offered : s.skill_requested;
            const partnerSkill = isSender ? s.skill_requested : s.skill_offered;

            const div = document.createElement("div");
            div.style.padding = "14px";
            div.style.marginBottom = "10px";
            div.style.border = "1px solid var(--border-color)";
            div.style.borderRadius = "8px";
            div.style.background = "#fff";

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="color: var(--primary);">With: ${escapeHtml(partnerName)}</strong>
                    <span class="badge badge-${s.mode.toLowerCase()}">${s.mode}</span>
                </div>
                <div style="font-size: 13px; color: var(--secondary); margin-bottom: 6px;">
                    📅 <strong>${s.session_date}</strong> at <strong>${s.session_time}</strong> (${s.duration || 60} mins)
                </div>
                <div style="font-size: 13px;">
                    Teaching: <strong>${escapeHtml(mySkill)}</strong> ↔ Learning: <strong>${escapeHtml(partnerSkill)}</strong>
                </div>
            `;
            listContainer.appendChild(div);
        });

    } catch (error) {
        console.error("Error loading upcoming sessions:", error);
        listContainer.innerHTML = `<div class="empty-state"><p>Error connecting to server.</p></div>`;
    }
}

function renderStars(rating) {
    const rounded = Math.round(rating);
    let stars = "";
    for (let i = 1; i <= 5; i++) {
        stars += i <= rounded ? "★" : "☆";
    }
    return stars;
}
