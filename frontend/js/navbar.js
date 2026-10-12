// Common Navigation & Auth Helper for SkillSwap Campus
// Uses API_BASE provided by config.js (window.API_BASE)

// Ensure user is logged in
function requireAuth() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        window.location.href = "login.html";
        return null;
    }
    return userId;
}

// Global logout function
function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

// Render dynamic navbar
function renderNavbar(activePage) {
    const navPlaceholder = document.getElementById("navbar");
    if (!navPlaceholder) return;

    const userName = localStorage.getItem("userName") || "Student";

    navPlaceholder.innerHTML = `
        <nav class="navbar">
            <div class="nav-container">
                <a href="dashboard.html" class="nav-brand">
                    <span>🎓</span> SkillSwap Campus
                </a>
                <ul class="nav-links">
                    <li><a href="dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a></li>
                    <li><a href="skills.html" class="${activePage === 'skills' ? 'active' : ''}">Manage Skills</a></li>
                    <li><a href="find-skills.html" class="${activePage === 'find-skills' ? 'active' : ''}">Find Students</a></li>
                    <li><a href="swap-requests.html" class="${activePage === 'swap-requests' ? 'active' : ''}">Swap Requests</a></li>
                    <li><a href="sessions.html" class="${activePage === 'sessions' ? 'active' : ''}">Sessions</a></li>
                    <li><a href="profile.html" class="${activePage === 'profile' ? 'active' : ''}">My Profile</a></li>
                </ul>
                <div class="nav-user">
                    <span class="user-badge">👤 ${escapeHtml(userName)}</span>
                    <button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button>
                </div>
            </div>
        </nav>
    `;
}

// Utility to escape HTML to prevent XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
