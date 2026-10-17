// Sessions & Reviews Logic for SkillSwap Campus

const userId = requireAuth();
if (userId) {
    renderNavbar("sessions");
}

const message = document.getElementById("message");
const sessionsList = document.getElementById("sessionsList");
const countAll = document.getElementById("countAll");
const countScheduled = document.getElementById("countScheduled");
const countCompleted = document.getElementById("countCompleted");
const countCancelled = document.getElementById("countCancelled");

// Schedule Modal Elements
const scheduleModal = document.getElementById("scheduleModal");
const scheduleForm = document.getElementById("scheduleForm");
const scheduleRequestSelect = document.getElementById("scheduleRequestSelect");
const sessionDate = document.getElementById("sessionDate");
const sessionTime = document.getElementById("sessionTime");
const sessionDuration = document.getElementById("sessionDuration");
const sessionMode = document.getElementById("sessionMode");
const scheduleSubmitBtn = document.getElementById("scheduleSubmitBtn");

// Review Modal Elements
const reviewModal = document.getElementById("reviewModal");
const reviewForm = document.getElementById("reviewForm");
const reviewPartnerName = document.getElementById("reviewPartnerName");
const starContainer = document.getElementById("starContainer");
const reviewRating = document.getElementById("reviewRating");
const reviewComment = document.getElementById("reviewComment");
const submitReviewBtn = document.getElementById("submitReviewBtn");

let allSessions = [];
let currentFilter = "ALL";
let activeReviewSessionId = null;

document.addEventListener("DOMContentLoaded", async () => {
    // Set min date for scheduling to today
    const today = new Date().toISOString().split("T")[0];
    if (sessionDate) sessionDate.min = today;

    setupStarRating();
    await loadSessions();

    // Check if requestId was passed in query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedRequestId = urlParams.get("requestId");
    if (preselectedRequestId) {
        openScheduleModal(parseInt(preselectedRequestId, 10));
    }
});

function filterSessions(status) {
    currentFilter = status;
    const tabs = ["tabAllBtn", "tabScheduledBtn", "tabCompletedBtn", "tabCancelledBtn"];
    tabs.forEach(t => {
        const btn = document.getElementById(t);
        if (btn) btn.classList.remove("active");
    });

    if (status === "ALL") document.getElementById("tabAllBtn").classList.add("active");
    if (status === "SCHEDULED") document.getElementById("tabScheduledBtn").classList.add("active");
    if (status === "COMPLETED") document.getElementById("tabCompletedBtn").classList.add("active");
    if (status === "CANCELLED") document.getElementById("tabCancelledBtn").classList.add("active");

    renderSessions();
}

async function loadSessions() {
    try {
        const response = await fetch(`${API_BASE}/api/sessions/user/${userId}`);
        const data = await response.json();

        if (!response.ok) {
            sessionsList.innerHTML = `<div class="empty-state"><p>Error loading sessions.</p></div>`;
            return;
        }

        allSessions = data;

        // Update counts
        const scheduled = allSessions.filter(s => s.status === "SCHEDULED").length;
        const completed = allSessions.filter(s => s.status === "COMPLETED").length;
        const cancelled = allSessions.filter(s => s.status === "CANCELLED").length;

        countAll.textContent = allSessions.length;
        countScheduled.textContent = scheduled;
        countCompleted.textContent = completed;
        countCancelled.textContent = cancelled;

        renderSessions();

    } catch (error) {
        console.error("Load sessions error:", error);
        sessionsList.innerHTML = `<div class="empty-state"><p>Unable to connect to server.</p></div>`;
    }
}

function renderSessions() {
    let filtered = allSessions;
    if (currentFilter !== "ALL") {
        filtered = allSessions.filter(s => s.status === currentFilter);
    }

    if (filtered.length === 0) {
        sessionsList.innerHTML = `
            <div class="empty-state">
                <h4>No ${currentFilter === 'ALL' ? '' : currentFilter.toLowerCase()} sessions found</h4>
                <p>Schedule a learning session from your accepted swap requests.</p>
                <button onclick="openScheduleModal()" class="btn btn-secondary btn-sm" style="margin-top: 10px;">
                    Schedule Session
                </button>
            </div>
        `;
        return;
    }

    sessionsList.innerHTML = "";
    filtered.forEach(session => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.marginBottom = "16px";

        const isSender = (parseInt(userId, 10) === session.sender_id);
        const partnerName = isSender ? session.receiver_name : session.sender_name;
        const mySkill = isSender ? session.skill_offered : session.skill_requested;
        const partnerSkill = isSender ? session.skill_requested : session.skill_offered;

        const statusBadge = `<span class="badge badge-${session.status.toLowerCase()}">${session.status}</span>`;
        const modeBadge = `<span class="badge badge-${session.mode.toLowerCase()}">${session.mode}</span>`;

        let actionArea = "";
        if (session.status === "SCHEDULED") {
            actionArea = `
                <div style="display: flex; gap: 10px; margin-top: 16px;">
                    <button onclick="updateSessionStatus(${session.session_id}, 'COMPLETED')" class="btn btn-success btn-sm">
                        ✓ Mark as Completed
                    </button>
                    <button onclick="updateSessionStatus(${session.session_id}, 'CANCELLED')" class="btn btn-secondary btn-sm" style="color: var(--danger);">
                        ✕ Cancel Session
                    </button>
                </div>
            `;
        } else if (session.status === "COMPLETED") {
            if (session.has_reviewed > 0) {
                actionArea = `
                    <div style="margin-top: 14px;">
                        <span style="font-size: 13px; color: var(--success); font-weight: 600;">
                            ✓ You have reviewed this session
                        </span>
                    </div>
                `;
            } else {
                actionArea = `
                    <div style="margin-top: 14px;">
                        <button onclick="openReviewModal(${session.session_id}, '${escapeHtml(partnerName)}')" class="btn btn-sm" style="background: var(--warning); color: #fff;">
                            ⭐ Review Session
                        </button>
                    </div>
                `;
            }
        }

        let meetingArea = "";
        if (session.mode === "ONLINE") {
            if (session.meeting_id) {
                meetingArea = `
                    <div class="meeting-panel">
                        <div class="meeting-panel-header">
                            <div>
                                <strong style="color: #15803d; font-size: 14px;">🎥 Online Video Meeting Ready</strong>
                                <span style="font-size: 12px; color: var(--text-muted); display: block; margin-top: 2px;">Jitsi Meet room with secure passcode generated</span>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="openMeetingDetailsModal(${session.session_id})" class="btn btn-sm btn-secondary">
                                    🔑 Passcode & Room
                                </button>
                                <button onclick="quickJoinMeeting(${session.session_id})" class="btn btn-sm btn-success">
                                    🚀 Join Call
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (session.status === "SCHEDULED") {
                meetingArea = `
                    <div style="background: #f8fafc; border: 1px dashed var(--border-color); padding: 12px 14px; border-radius: 8px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">Online Exchange Meeting</span>
                            <span style="font-size: 12px; color: var(--text-muted); display: block;">Generate an encrypted Jitsi video room with passcode</span>
                        </div>
                        <button onclick="createOnlineMeeting(${session.session_id}, '${escapeHtml(mySkill)} ↔ ${escapeHtml(partnerSkill)}', ${session.duration || 60})" class="btn btn-sm" id="genMeetingBtn-${session.session_id}">
                            🎥 Generate Meeting Link
                        </button>
                    </div>
                `;
            }
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                    <strong style="font-size: 17px; color: var(--text-main);">Exchange with ${escapeHtml(partnerName)}</strong>
                    <div style="font-size: 13px; color: var(--secondary); margin-top: 4px;">
                        📅 <strong>${session.session_date}</strong> at <strong>${session.session_time}</strong> (${session.duration || 60} minutes)
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    ${modeBadge}
                    ${statusBadge}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: var(--bg-page); padding: 14px; border-radius: 8px;">
                <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: var(--secondary); font-weight: 600; display: block;">You Teach</span>
                    <strong style="font-size: 15px; color: var(--primary);">${escapeHtml(mySkill)}</strong>
                </div>
                <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: var(--secondary); font-weight: 600; display: block;">You Learn</span>
                    <strong style="font-size: 15px; color: var(--warning);">${escapeHtml(partnerSkill)}</strong>
                </div>
            </div>

            ${meetingArea}
            ${actionArea}
        `;

        sessionsList.appendChild(card);
    });
}

// Update status to COMPLETED or CANCELLED
async function updateSessionStatus(sessionId, status) {
    if (!confirm(`Are you sure you want to mark this session as ${status}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: status,
                userId: userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || `Session status updated to ${status}!`, "success");
            loadSessions();
        } else {
            showMessage(data.message || "Failed to update session.", "error");
        }
    } catch (error) {
        console.error("Update session error:", error);
        showMessage("Unable to connect to server.", "error");
    }
}

// Open Schedule Session Modal
async function openScheduleModal(preselectedRequestId) {
    scheduleRequestSelect.innerHTML = `<option value="">Loading accepted requests...</option>`;
    scheduleSubmitBtn.disabled = false;
    scheduleSubmitBtn.textContent = "Confirm Schedule";
    scheduleModal.classList.add("open");

    try {
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${API_BASE}/api/swap/accepted/${userId}`, {
            headers: {
                "Authorization": token ? `Bearer ${token}` : ""
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const requests = await response.json();

        if (!response.ok || requests.length === 0) {
            scheduleRequestSelect.innerHTML = `<option value="">No accepted swap requests found. Accept a swap first!</option>`;
            scheduleSubmitBtn.disabled = true;
            return;
        }

        scheduleRequestSelect.innerHTML = `<option value="">-- Choose an accepted swap request --</option>`;
        requests.forEach(r => {
            const isSender = (parseInt(userId, 10) === r.sender_id);
            const partnerName = isSender ? r.receiver_name : r.sender_name;
            const opt = document.createElement("option");
            opt.value = r.request_id;
            opt.textContent = `With ${partnerName} (Exchange: ${r.skill_offered} ↔ ${r.skill_requested})`;

            if (preselectedRequestId && r.request_id === preselectedRequestId) {
                opt.selected = true;
            }

            scheduleRequestSelect.appendChild(opt);
        });

    } catch (error) {
        console.error("Load accepted requests error:", error);
        scheduleRequestSelect.innerHTML = `<option value="">Error loading requests</option>`;
    }
}

function closeScheduleModal() {
    scheduleModal.classList.remove("open");
}

// Submit Schedule Form
scheduleForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const requestId = scheduleRequestSelect.value;
    const dateVal = sessionDate.value;
    const timeVal = sessionTime.value;
    const durationVal = sessionDuration.value;
    const modeVal = sessionMode.value;

    if (!requestId || !dateVal || !timeVal) {
        alert("Please select a swap request, date, and time.");
        return;
    }

    scheduleSubmitBtn.disabled = true;
    scheduleSubmitBtn.textContent = "Scheduling...";

    try {
        const response = await fetch(`${API_BASE}/api/sessions/schedule`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                requestId: requestId,
                userId: userId,
                sessionDate: dateVal,
                sessionTime: timeVal,
                duration: durationVal,
                mode: modeVal
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeScheduleModal();
            showMessage(data.message || "Session scheduled successfully!", "success");
            scheduleForm.reset();
            loadSessions();
        } else {
            alert(data.message || "Could not schedule session");
            scheduleSubmitBtn.disabled = false;
            scheduleSubmitBtn.textContent = "Confirm Schedule";
        }
    } catch (error) {
        console.error("Schedule error:", error);
        alert("Unable to connect to server");
        scheduleSubmitBtn.disabled = false;
        scheduleSubmitBtn.textContent = "Confirm Schedule";
    }
});

// Setup Star Rating in Review Modal
function setupStarRating() {
    const stars = starContainer.querySelectorAll(".star");
    stars.forEach(star => {
        star.addEventListener("click", () => {
            const val = parseInt(star.getAttribute("data-value"), 10);
            reviewRating.value = val;
            updateStarDisplay(val);
        });

        star.addEventListener("mouseenter", () => {
            const val = parseInt(star.getAttribute("data-value"), 10);
            updateStarHover(val);
        });
    });

    starContainer.addEventListener("mouseleave", () => {
        updateStarDisplay(parseInt(reviewRating.value, 10));
    });

    updateStarDisplay(5);
}

function updateStarDisplay(val) {
    const stars = starContainer.querySelectorAll(".star");
    stars.forEach(s => {
        const v = parseInt(s.getAttribute("data-value"), 10);
        if (v <= val) {
            s.classList.add("selected");
        } else {
            s.classList.remove("selected");
        }
    });
}

function updateStarHover(val) {
    const stars = starContainer.querySelectorAll(".star");
    stars.forEach(s => {
        const v = parseInt(s.getAttribute("data-value"), 10);
        if (v <= val) {
            s.classList.add("hovered");
        } else {
            s.classList.remove("hovered");
        }
    });
}

// Open Review Modal
function openReviewModal(sessionId, partnerName) {
    activeReviewSessionId = sessionId;
    reviewPartnerName.textContent = partnerName;
    reviewRating.value = "5";
    reviewComment.value = "";
    updateStarDisplay(5);
    submitReviewBtn.disabled = false;
    submitReviewBtn.textContent = "Submit Review";

    reviewModal.classList.add("open");
}

function closeReviewModal() {
    reviewModal.classList.remove("open");
}

// Submit Review Form
reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const ratingVal = parseInt(reviewRating.value, 10);
    const commentVal = reviewComment.value.trim();

    submitReviewBtn.disabled = true;
    submitReviewBtn.textContent = "Submitting Review...";

    try {
        const response = await fetch(`${API_BASE}/api/reviews/add`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sessionId: activeReviewSessionId,
                reviewerId: userId,
                rating: ratingVal,
                comment: commentVal
            })
        });

        const data = await response.json();

        if (response.ok) {
            closeReviewModal();
            showMessage(data.message || "Review submitted successfully!", "success");
            loadSessions();
        } else {
            alert(data.message || "Could not submit review");
            submitReviewBtn.disabled = false;
            submitReviewBtn.textContent = "Submit Review";
        }
    } catch (error) {
        console.error("Submit review error:", error);
        alert("Unable to connect to server");
        submitReviewBtn.disabled = false;
        submitReviewBtn.textContent = "Submit Review";
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
// Online Meeting Management (Java Servlets)
// ==========================================
const meetingModal = document.getElementById("meetingModal");
const meetingSessionTitle = document.getElementById("meetingSessionTitle");
const meetingStatusBadge = document.getElementById("meetingStatusBadge");
const meetingSessionIdDisplay = document.getElementById("meetingSessionIdDisplay");
const meetingUrlDisplay = document.getElementById("meetingUrlDisplay");
const copyMeetingBtn = document.getElementById("copyMeetingBtn");
const meetingPasscodeDisplay = document.getElementById("meetingPasscodeDisplay");
const meetingDurationDisplay = document.getElementById("meetingDurationDisplay");
const joinMeetingBtn = document.getElementById("joinMeetingBtn");

async function createOnlineMeeting(sessionId, title, duration) {
    const btn = document.getElementById(`genMeetingBtn-${sessionId}`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Generating...";
    }

    try {
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${SERVLET_API_BASE}/api/meetings/schedule`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({
                userId: parseInt(userId, 10),
                sessionId: sessionId,
                title: `Skill Exchange: ${title}`,
                durationMinutes: duration || 60
            })
        });

        const data = await response.json();

        if (response.ok && data.success && data.meeting) {
            showMessage("🎉 Jitsi online video room created successfully!", "success");
            await loadSessions();
            populateMeetingModal(data.meeting);
            meetingModal.classList.add("open");
        } else {
            alert(data.error || data.message || "Could not generate online meeting.");
        }
    } catch (err) {
        console.error("Create meeting error:", err);
        alert("Unable to reach online meeting service. Is Tomcat running?");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "🎥 Generate Meeting Link";
        }
    }
}

async function openMeetingDetailsModal(sessionId) {
    try {
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${SERVLET_API_BASE}/api/meetings/session?sessionId=${sessionId}&userId=${userId}`, {
            headers: {
                "Authorization": token ? `Bearer ${token}` : ""
            }
        });

        const data = await response.json();

        if (response.ok && data.success && data.meeting) {
            populateMeetingModal(data.meeting);
            meetingModal.classList.add("open");
        } else {
            alert(data.error || data.message || "Could not retrieve meeting room details.");
        }
    } catch (err) {
        console.error("Fetch meeting error:", err);
        alert("Unable to reach online meeting service.");
    }
}

async function quickJoinMeeting(sessionId) {
    try {
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${SERVLET_API_BASE}/api/meetings/session?sessionId=${sessionId}&userId=${userId}`, {
            headers: {
                "Authorization": token ? `Bearer ${token}` : ""
            }
        });

        const data = await response.json();

        if (response.ok && data.success && data.meeting) {
            const url = data.meeting.jitsiUrl || data.meeting.meetingUrl;
            window.open(url, "_blank", "noopener,noreferrer");
        } else {
            alert(data.error || data.message || "Could not join meeting.");
        }
    } catch (err) {
        console.error("Quick join error:", err);
        alert("Unable to reach online meeting service.");
    }
}

function populateMeetingModal(meeting) {
    if (!meeting) return;
    const url = meeting.jitsiUrl || meeting.meetingUrl || "";
    if (meetingSessionTitle) meetingSessionTitle.textContent = meeting.title || "Skill Exchange Meeting";
    if (meetingSessionIdDisplay) meetingSessionIdDisplay.textContent = meeting.sessionId || "-";
    if (meetingStatusBadge) {
        meetingStatusBadge.textContent = meeting.status || "SCHEDULED";
        meetingStatusBadge.className = `badge badge-${(meeting.status || 'SCHEDULED').toLowerCase()}`;
    }
    if (meetingUrlDisplay) meetingUrlDisplay.value = url;
    if (meetingPasscodeDisplay) meetingPasscodeDisplay.textContent = meeting.passcode || "N/A";
    if (meetingDurationDisplay) meetingDurationDisplay.textContent = `${meeting.durationMinutes || 60} Mins`;
    if (joinMeetingBtn) {
        joinMeetingBtn.href = url || "#";
    }
    if (copyMeetingBtn) {
        copyMeetingBtn.textContent = "📋 Copy";
    }
}

function closeMeetingModal() {
    if (meetingModal) meetingModal.classList.remove("open");
}

function copyMeetingLink() {
    if (!meetingUrlDisplay || !meetingUrlDisplay.value) return;
    navigator.clipboard.writeText(meetingUrlDisplay.value).then(() => {
        if (copyMeetingBtn) {
            copyMeetingBtn.textContent = "✓ Copied!";
            setTimeout(() => {
                copyMeetingBtn.textContent = "📋 Copy";
            }, 2500);
        }
    }).catch(err => {
        console.error("Clipboard copy error:", err);
        meetingUrlDisplay.select();
        document.execCommand("copy");
        if (copyMeetingBtn) copyMeetingBtn.textContent = "✓ Copied!";
    });
}
