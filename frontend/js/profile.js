// Profile Management Logic for SkillSwap Campus

const userId = requireAuth();
if (userId) {
    renderNavbar("profile");
}

const message = document.getElementById("message");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileDept = document.getElementById("profileDept");
const profileYear = document.getElementById("profileYear");
const profileJoined = document.getElementById("profileJoined");
const profileAvgRating = document.getElementById("profileAvgRating");
const profileStars = document.getElementById("profileStars");
const profileReviewCount = document.getElementById("profileReviewCount");
const profileOfferCount = document.getElementById("profileOfferCount");
const profileOfferSkills = document.getElementById("profileOfferSkills");
const profileWantCount = document.getElementById("profileWantCount");
const profileWantSkills = document.getElementById("profileWantSkills");
const profileReviewsList = document.getElementById("profileReviewsList");

// Edit Profile Modal
const editProfileModal = document.getElementById("editProfileModal");
const editProfileForm = document.getElementById("editProfileForm");
const editName = document.getElementById("editName");
const editDepartment = document.getElementById("editDepartment");
const editYear = document.getElementById("editYear");
const saveProfileBtn = document.getElementById("saveProfileBtn");

let currentUserData = {};

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
        loadProfileData(),
        loadUserSkills(),
        loadUserReviews()
    ]);
});

async function loadProfileData() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/profile/${userId}`);
        const data = await response.json();

        if (!response.ok) {
            showMessage("Could not load profile information.", "error");
            return;
        }

        const user = data.user || {};
        const stats = data.stats || {};
        currentUserData = user;

        profileName.textContent = user.name || "Student";
        profileEmail.textContent = user.email || "-";
        profileDept.textContent = user.department || "Not specified";
        profileYear.textContent = user.year ? `Year ${user.year}` : "Not specified";

        if (user.created_at) {
            const d = new Date(user.created_at);
            profileJoined.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            profileJoined.textContent = "N/A";
        }

        const avg = stats.averageRating || 0;
        profileAvgRating.textContent = avg.toFixed(1);
        profileStars.textContent = renderStars(avg);
        profileReviewCount.textContent = `Based on ${stats.reviewCount || 0} peer reviews`;

    } catch (error) {
        console.error("Load profile error:", error);
    }
}

async function loadUserSkills() {
    try {
        const response = await fetch(`${API_BASE}/api/skills/${userId}`);
        const skills = await response.json();

        if (!response.ok) return;

        const offer = skills.filter(s => s.skill_type === "OFFER");
        const want = skills.filter(s => s.skill_type === "WANT");

        profileOfferCount.textContent = offer.length;
        profileWantCount.textContent = want.length;

        if (offer.length === 0) {
            profileOfferSkills.innerHTML = `<span style="font-size: 13px; color: var(--text-muted);">None added yet.</span>`;
        } else {
            profileOfferSkills.innerHTML = "";
            offer.forEach(s => {
                const span = document.createElement("span");
                span.className = "badge badge-offer";
                span.textContent = `${s.skill_name} (${s.skill_level})`;
                profileOfferSkills.appendChild(span);
            });
        }

        if (want.length === 0) {
            profileWantSkills.innerHTML = `<span style="font-size: 13px; color: var(--text-muted);">None added yet.</span>`;
        } else {
            profileWantSkills.innerHTML = "";
            want.forEach(s => {
                const span = document.createElement("span");
                span.className = "badge badge-want";
                span.textContent = `${s.skill_name} (${s.skill_level})`;
                profileWantSkills.appendChild(span);
            });
        }

    } catch (error) {
        console.error("Load skills error:", error);
    }
}

async function loadUserReviews() {
    try {
        const response = await fetch(`${API_BASE}/api/reviews/user/${userId}`);
        const data = await response.json();

        if (!response.ok) {
            profileReviewsList.innerHTML = `<div class="empty-state"><p>Error loading reviews.</p></div>`;
            return;
        }

        const reviews = data.reviews || [];

        if (reviews.length === 0) {
            profileReviewsList.innerHTML = `
                <div class="empty-state">
                    <p>No reviews received yet. Complete skill sessions with classmates to receive ratings!</p>
                </div>
            `;
            return;
        }

        profileReviewsList.innerHTML = "";
        reviews.forEach(r => {
            const div = document.createElement("div");
            div.style.padding = "14px";
            div.style.marginBottom = "10px";
            div.style.border = "1px solid var(--border-color)";
            div.style.borderRadius = "8px";
            div.style.background = "#fff";

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                        <strong style="color: var(--text-main); font-size: 14px;">${escapeHtml(r.reviewer_name)}</strong>
                        <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">(${escapeHtml(r.reviewer_department || 'Student')})</span>
                    </div>
                    <div style="color: #f59e0b; font-size: 14px;">
                        ${renderStars(r.rating)}
                    </div>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
                    Session Date: ${r.session_date} • Exchanged: ${escapeHtml(r.skill_offered)} ↔ ${escapeHtml(r.skill_requested)}
                </div>
                ${r.comment ? `<p style="font-size: 13px; color: var(--text-main); line-height: 1.4; margin-top: 4px;">"${escapeHtml(r.comment)}"</p>` : ''}
            `;
            profileReviewsList.appendChild(div);
        });

    } catch (error) {
        console.error("Load reviews error:", error);
        profileReviewsList.innerHTML = `<div class="empty-state"><p>Unable to connect to server.</p></div>`;
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

// Edit Profile Modal
function openEditProfileModal() {
    editName.value = currentUserData.name || "";
    editDepartment.value = currentUserData.department || "";
    editYear.value = currentUserData.year || "1";
    editProfileModal.classList.add("open");
}

function closeEditProfileModal() {
    editProfileModal.classList.remove("open");
}

editProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameVal = editName.value.trim();
    const deptVal = editDepartment.value.trim();
    const yearVal = editYear.value;

    if (!nameVal) {
        alert("Name is required");
        return;
    }

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE}/api/auth/profile/${userId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: nameVal,
                department: deptVal,
                year: yearVal
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeEditProfileModal();
            showMessage(data.message || "Profile updated successfully!", "success");

            // Update localStorage
            localStorage.setItem("userName", nameVal);
            localStorage.setItem("userDepartment", deptVal);
            localStorage.setItem("userYear", yearVal);

            // Re-render navbar and reload data
            renderNavbar("profile");
            await loadProfileData();
        } else {
            alert(data.message || "Could not update profile");
        }
    } catch (error) {
        console.error("Update profile error:", error);
        alert("Unable to connect to server");
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Save Changes";
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
