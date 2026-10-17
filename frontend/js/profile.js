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
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${API_BASE}/api/auth/profile/${userId}`, {
            headers: {
                "Authorization": token ? `Bearer ${token}` : ""
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

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

        // Populate College Verification Information
        const vBadge = document.getElementById("profileVerificationBadge");
        const cName = document.getElementById("profileCollegeName");
        const instEmail = document.getElementById("profileInstEmail");
        const vAt = document.getElementById("profileVerifiedAt");
        const vRow = document.getElementById("verifiedAtRow");
        const actionBox = document.getElementById("verifyActionContainer");

        if (cName) cName.textContent = user.college_name || "Not Linked";
        if (instEmail) instEmail.textContent = user.institutional_email || "None linked";

        const status = user.verification_status || "UNVERIFIED";
        if (vBadge) {
            if (status === "VERIFIED") {
                vBadge.className = "badge badge-verified";
                vBadge.textContent = "✓ VERIFIED";
            } else if (status === "PENDING") {
                vBadge.className = "badge badge-pending";
                vBadge.textContent = "⏳ PENDING";
            } else {
                vBadge.className = "badge badge-unverified";
                vBadge.textContent = "⚠️ UNVERIFIED";
            }
        }

        if (user.verified_at && vRow && vAt) {
            vRow.style.display = "block";
            const vDate = new Date(user.verified_at);
            vAt.textContent = vDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } else if (vRow) {
            vRow.style.display = "none";
        }

        if (actionBox) {
            if (status === "VERIFIED") {
                actionBox.innerHTML = `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 6px; text-align: center;">
                        <span style="color: var(--success); font-size: 13px; font-weight: 600;">✓ Verified Student of ${escapeHtml(user.college_name || 'College')}</span>
                    </div>
                `;
            } else if (status === "PENDING") {
                actionBox.innerHTML = `
                    <button onclick="openVerificationModal(true)" class="btn btn-sm btn-warning" style="width: 100%;">
                        ⏳ Enter Verification Code (OTP)
                    </button>
                `;
            } else {
                actionBox.innerHTML = `
                    <button onclick="openVerificationModal(false)" class="btn btn-sm" style="width: 100%;">
                        🎓 Verify College Email
                    </button>
                `;
            }
        }

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
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${API_BASE}/api/auth/profile/${userId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({
                name: nameVal,
                department: deptVal,
                year: yearVal
            })
        });

        if (response.status === 401) {
            logout();
            return;
        }

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

// ==========================================
// College Verification Logic (Java Servlets)
// ==========================================
const verificationModal = document.getElementById("verificationModal");
const verificationModalAlert = document.getElementById("verificationModalAlert");
const verifyStep1 = document.getElementById("verifyStep1");
const verifyStep2 = document.getElementById("verifyStep2");
const verifyCollegeSelect = document.getElementById("verifyCollegeSelect");
const verifyInstEmail = document.getElementById("verifyInstEmail");
const verifyDomainHint = document.getElementById("verifyDomainHint");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyTargetEmail = document.getElementById("verifyTargetEmail");
const verifyOtpCode = document.getElementById("verifyOtpCode");
const devOtpBanner = document.getElementById("devOtpBanner");
const devOtpText = document.getElementById("devOtpText");
const confirmOtpBtn = document.getElementById("confirmOtpBtn");
const requestOtpForm = document.getElementById("requestOtpForm");
const confirmOtpForm = document.getElementById("confirmOtpForm");

let collegesList = [];
let pendingEmail = "";
let pendingVerificationToken = "";

async function loadColleges() {
    if (!verifyCollegeSelect) return;
    try {
        const response = await fetch(`${SERVLET_API_BASE}/api/colleges`);
        const data = await response.json();
        if (response.ok && data.colleges) {
            collegesList = data.colleges;
            verifyCollegeSelect.innerHTML = `<option value="">-- Choose your college --</option>`;
            collegesList.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.collegeId;
                opt.textContent = `${c.collegeName} (${c.emailDomain})`;
                opt.setAttribute("data-domain", c.emailDomain);
                if (currentUserData.college_id && currentUserData.college_id === c.collegeId) {
                    opt.selected = true;
                }
                verifyCollegeSelect.appendChild(opt);
            });
            updateDomainHint();
        } else {
            verifyCollegeSelect.innerHTML = `<option value="">Failed to load colleges</option>`;
        }
    } catch (e) {
        console.error("Error loading colleges:", e);
        verifyCollegeSelect.innerHTML = `<option value="">Error connecting to Java backend</option>`;
    }
}

function updateDomainHint() {
    if (!verifyCollegeSelect || !verifyDomainHint) return;
    const selected = verifyCollegeSelect.selectedOptions[0];
    if (selected && selected.getAttribute("data-domain")) {
        const domain = selected.getAttribute("data-domain");
        verifyDomainHint.textContent = `Approved domain: @${domain} (e.g. your_id@${domain})`;
        verifyDomainHint.style.color = "var(--primary)";
    } else {
        verifyDomainHint.textContent = "Select a college to view approved email domain format.";
        verifyDomainHint.style.color = "var(--text-muted)";
    }
}

if (verifyCollegeSelect) {
    verifyCollegeSelect.addEventListener("change", updateDomainHint);
}

function showModalAlert(text, type) {
    if (!verificationModalAlert) return;
    verificationModalAlert.textContent = text;
    verificationModalAlert.style.display = "block";
    verificationModalAlert.style.background = type === "success" ? "var(--success-light)" : "var(--danger-light)";
    verificationModalAlert.style.color = type === "success" ? "var(--success)" : "var(--danger)";
}

function clearModalAlert() {
    if (!verificationModalAlert) return;
    verificationModalAlert.style.display = "none";
    verificationModalAlert.textContent = "";
}

async function openVerificationModal(skipToStep2) {
    clearModalAlert();
    if (collegesList.length === 0) {
        await loadColleges();
    }

    if (skipToStep2) {
        verifyStep1.style.display = "none";
        verifyStep2.style.display = "block";
        verifyTargetEmail.textContent = currentUserData.institutional_email || "your institutional email";
        verifyOtpCode.value = "";
    } else {
        verifyStep1.style.display = "block";
        verifyStep2.style.display = "none";
        if (currentUserData.institutional_email) {
            verifyInstEmail.value = currentUserData.institutional_email;
        }
    }

    verificationModal.classList.add("open");
}

function closeVerificationModal() {
    verificationModal.classList.remove("open");
    clearModalAlert();
}

function backToStep1() {
    clearModalAlert();
    verifyStep2.style.display = "none";
    verifyStep1.style.display = "block";
}

if (requestOtpForm) {
    requestOtpForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearModalAlert();

        const collegeId = parseInt(verifyCollegeSelect.value, 10);
        const email = verifyInstEmail.value.trim();

        if (!collegeId || !email) {
            showModalAlert("Please select your college and enter your institutional email.", "error");
            return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = "Sending Code...";

        try {
            const token = localStorage.getItem("token") || "";
            const response = await fetch(`${SERVLET_API_BASE}/api/verification/request-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({
                    userId: parseInt(userId, 10),
                    collegeId: collegeId,
                    institutionalEmail: email
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                pendingEmail = email;
                pendingVerificationToken = data.verificationToken || "";
                verifyTargetEmail.textContent = email;
                verifyStep1.style.display = "none";
                verifyStep2.style.display = "block";
                verifyOtpCode.value = "";

                if (data.devOtp && devOtpBanner && devOtpText) {
                    devOtpText.textContent = data.devOtp;
                    devOtpBanner.style.display = "block";
                } else if (devOtpBanner) {
                    devOtpBanner.style.display = "none";
                }

                showModalAlert(data.message || "Verification code sent!", "success");
            } else {
                showModalAlert(data.error || data.message || "Failed to send verification code.", "error");
            }
        } catch (err) {
            console.error("Request OTP error:", err);
            showModalAlert("Unable to reach verification service. Is Tomcat running?", "error");
        } finally {
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = "Send Verification Code";
        }
    });
}

if (confirmOtpForm) {
    confirmOtpForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearModalAlert();

        const otp = verifyOtpCode.value.trim();
        if (!otp || otp.length < 6) {
            showModalAlert("Please enter the complete 6-digit OTP code.", "error");
            return;
        }

        confirmOtpBtn.disabled = true;
        confirmOtpBtn.textContent = "Verifying...";

        try {
            const token = localStorage.getItem("token") || "";
            const response = await fetch(`${SERVLET_API_BASE}/api/verification/verify-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({
                    userId: parseInt(userId, 10),
                    verificationToken: pendingVerificationToken,
                    otp: otp
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                closeVerificationModal();
                showMessage("🎉 Institutional email verified successfully! Same-college access unlocked.", "success");

                // Update localStorage with verified status
                if (data.status) {
                    localStorage.setItem("collegeId", data.status.collegeId);
                    localStorage.setItem("verificationStatus", data.status.verificationStatus);
                }

                // Reload profile data
                await loadProfileData();
            } else {
                showModalAlert(data.error || data.message || "Invalid or expired verification code.", "error");
            }
        } catch (err) {
            console.error("Verify OTP error:", err);
            showModalAlert("Unable to reach verification service. Is Tomcat running?", "error");
        } finally {
            confirmOtpBtn.disabled = false;
            confirmOtpBtn.textContent = "Verify & Complete";
        }
    });
}
