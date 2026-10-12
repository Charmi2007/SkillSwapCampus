// Swap Requests Management Logic

const userId = requireAuth();
if (userId) {
    renderNavbar("swap-requests");
}

const message = document.getElementById("message");
const incomingList = document.getElementById("incomingList");
const outgoingList = document.getElementById("outgoingList");
const incomingCount = document.getElementById("incomingCount");
const outgoingCount = document.getElementById("outgoingCount");
const tabIncomingBtn = document.getElementById("tabIncomingBtn");
const tabOutgoingBtn = document.getElementById("tabOutgoingBtn");
const incomingTabContent = document.getElementById("incomingTabContent");
const outgoingTabContent = document.getElementById("outgoingTabContent");

document.addEventListener("DOMContentLoaded", () => {
    loadRequests();
});

function switchTab(tab) {
    if (tab === "incoming") {
        tabIncomingBtn.classList.add("active");
        tabOutgoingBtn.classList.remove("active");
        incomingTabContent.style.display = "block";
        outgoingTabContent.style.display = "none";
    } else {
        tabIncomingBtn.classList.remove("active");
        tabOutgoingBtn.classList.add("active");
        incomingTabContent.style.display = "none";
        outgoingTabContent.style.display = "block";
    }
}

async function loadRequests() {
    await Promise.all([loadIncomingRequests(), loadOutgoingRequests()]);
}

async function loadIncomingRequests() {
    try {
        const response = await fetch(`${API_BASE}/api/swap/received/${userId}`);
        const requests = await response.json();

        if (!response.ok) {
            incomingList.innerHTML = `<div class="empty-state"><p>Error loading incoming requests.</p></div>`;
            return;
        }

        incomingCount.textContent = requests.length;

        if (requests.length === 0) {
            incomingList.innerHTML = `
                <div class="empty-state">
                    <h4>No incoming swap requests</h4>
                    <p>When peers ask to learn your skills, their proposals will appear here.</p>
                </div>
            `;
            return;
        }

        incomingList.innerHTML = "";
        requests.forEach(req => {
            const card = document.createElement("div");
            card.className = "card";
            card.style.marginBottom = "16px";

            const createdDate = new Date(req.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const statusBadge = `<span class="badge badge-${req.status.toLowerCase()}">${req.status}</span>`;

            let actionButtons = "";
            if (req.status === "PENDING") {
                actionButtons = `
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="respondRequest(${req.request_id}, 'ACCEPTED')" class="btn btn-success btn-sm">
                            ✓ Accept Request
                        </button>
                        <button onclick="respondRequest(${req.request_id}, 'REJECTED')" class="btn btn-danger btn-sm">
                            ✕ Reject
                        </button>
                    </div>
                `;
            } else if (req.status === "ACCEPTED") {
                actionButtons = `
                    <div style="margin-top: 15px;">
                        <a href="sessions.html?requestId=${req.request_id}" class="btn btn-sm">
                            📅 Schedule Session Now
                        </a>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <strong style="font-size: 16px; color: var(--text-main);">From: ${escapeHtml(req.sender_name)}</strong>
                        <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                            ${escapeHtml(req.sender_department || 'Student')} ${req.sender_year ? '• Year ' + req.sender_year : ''} • Received ${createdDate}
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: var(--bg-page); padding: 14px; border-radius: 8px;">
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--secondary); font-weight: 600; display: block;">They Can Teach You</span>
                        <strong style="font-size: 15px; color: var(--primary);">${escapeHtml(req.skill_offered)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--secondary); font-weight: 600; display: block;">They Want To Learn</span>
                        <strong style="font-size: 15px; color: var(--warning);">${escapeHtml(req.skill_requested)}</strong>
                    </div>
                </div>

                ${actionButtons}
            `;

            incomingList.appendChild(card);
        });

    } catch (error) {
        console.error("Load incoming requests error:", error);
        incomingList.innerHTML = `<div class="empty-state"><p>Unable to connect to server.</p></div>`;
    }
}

async function loadOutgoingRequests() {
    try {
        const response = await fetch(`${API_BASE}/api/swap/sent/${userId}`);
        const requests = await response.json();

        if (!response.ok) {
            outgoingList.innerHTML = `<div class="empty-state"><p>Error loading outgoing requests.</p></div>`;
            return;
        }

        outgoingCount.textContent = requests.length;

        if (requests.length === 0) {
            outgoingList.innerHTML = `
                <div class="empty-state">
                    <h4>No outgoing swap requests</h4>
                    <p>Search for students offering skills you want and send them a swap request!</p>
                    <a href="find-skills.html" class="btn btn-secondary btn-sm" style="margin-top: 10px;">Find Students</a>
                </div>
            `;
            return;
        }

        outgoingList.innerHTML = "";
        requests.forEach(req => {
            const card = document.createElement("div");
            card.className = "card";
            card.style.marginBottom = "16px";

            const createdDate = new Date(req.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const statusBadge = `<span class="badge badge-${req.status.toLowerCase()}">${req.status}</span>`;

            let actionButton = "";
            if (req.status === "ACCEPTED") {
                actionButton = `
                    <div style="margin-top: 15px;">
                        <a href="sessions.html?requestId=${req.request_id}" class="btn btn-sm">
                            📅 Schedule Session Now
                        </a>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <strong style="font-size: 16px; color: var(--text-main);">To: ${escapeHtml(req.receiver_name)}</strong>
                        <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                            ${escapeHtml(req.receiver_department || 'Student')} ${req.receiver_year ? '• Year ' + req.receiver_year : ''} • Sent ${createdDate}
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: var(--bg-page); padding: 14px; border-radius: 8px;">
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--secondary); font-weight: 600; display: block;">You Will Teach</span>
                        <strong style="font-size: 15px; color: var(--primary);">${escapeHtml(req.skill_offered)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--secondary); font-weight: 600; display: block;">You Want To Learn</span>
                        <strong style="font-size: 15px; color: var(--warning);">${escapeHtml(req.skill_requested)}</strong>
                    </div>
                </div>

                ${actionButton}
            `;

            outgoingList.appendChild(card);
        });

    } catch (error) {
        console.error("Load outgoing requests error:", error);
        outgoingList.innerHTML = `<div class="empty-state"><p>Unable to connect to server.</p></div>`;
    }
}

// Accept or Reject Request
async function respondRequest(requestId, status) {
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} this request?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/swap/respond/${requestId}`, {
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
            showMessage(data.message || `Request ${status.toLowerCase()}!`, "success");
            loadRequests();
        } else {
            showMessage(data.message || "Could not update request.", "error");
        }
    } catch (error) {
        console.error("Respond request error:", error);
        showMessage("Unable to connect to the server.", "error");
    }
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
    message.style.display = "block";
    setTimeout(() => {
        message.style.display = "none";
    }, 4500);
}
