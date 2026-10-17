// Automated Regression and Security Test Suite for SkillSwap Campus
// Tests backend/routes/sessions.js for authentication, authorization, RBAC, input validation, and business logic

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const http = require("http");
const mysql = require("mysql2/promise");

const HOST = "localhost";
const PORT = 5000;

function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on("error", reject);
        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

function api(method, path, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return request({
        hostname: HOST,
        port: PORT,
        path: path,
        method: method,
        headers: headers
    }, body);
}

async function runSessionsSecurityTests() {
    console.log("=============================================================");
    console.log("   SkillSwap Campus - Sessions Security & RBAC Test Suite");
    console.log("=============================================================\n");

    let passedCount = 0;
    let failedCount = 0;

    function assert(condition, testName, detail = "") {
        if (condition) {
            console.log(`  ✅ [PASS] ${testName}`);
            passedCount++;
        } else {
            console.error(`  ❌ [FAIL] ${testName} - ${detail}`);
            failedCount++;
        }
    }

    const ts = Date.now();
    const password = "ValidPassword123!";

    // --- SETUP: Register test users & obtain tokens ---
    console.log("1. Setting up Test Users and Verified Colleges...");

    // User A (Sender - Vardhaman)
    const emailA = `sess_a_${ts}@test.com`;
    const regA = await api("POST", "/api/auth/register", {
        name: "Session Student A",
        email: emailA,
        password: password,
        department: "CSE",
        year: 3
    });
    const userA_id = regA.body.userId;
    const logA = await api("POST", "/api/auth/login", { email: emailA, password: password });
    const tokenA = logA.body.token;

    // User B (Receiver - Same College Vardhaman)
    const emailB = `sess_b_${ts}@test.com`;
    const regB = await api("POST", "/api/auth/register", {
        name: "Session Student B",
        email: emailB,
        password: password,
        department: "IT",
        year: 3
    });
    const userB_id = regB.body.userId;
    const logB = await api("POST", "/api/auth/login", { email: emailB, password: password });
    const tokenB = logB.body.token;

    // User C (Outsider - Stanford)
    const emailC = `sess_c_${ts}@test.com`;
    const regC = await api("POST", "/api/auth/register", {
        name: "Session Student C",
        email: emailC,
        password: password,
        department: "ECE",
        year: 4
    });
    const userC_id = regC.body.userId;
    const logC = await api("POST", "/api/auth/login", { email: emailC, password: password });
    const tokenC = logC.body.token;

    assert(userA_id && userB_id && userC_id, "Registered test students A, B, and C successfully");

    // Setup MySQL connection
    const dbConfig = {
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "skillswap_campus",
        port: parseInt(process.env.DB_PORT || "3306", 10)
    };
    const db = await mysql.createConnection(dbConfig);

    // Set A and B verified in College 1
    await db.query(
        "UPDATE users SET college_id = 1, institutional_email = ?, verification_status = 'VERIFIED' WHERE user_id IN (?, ?)",
        [`sess_inst_a_${ts}@student.vardhaman.org`, userA_id, userB_id]
    );

    // Set C verified in College 4 (Stanford)
    await db.query(
        "UPDATE users SET college_id = 4, institutional_email = ?, verification_status = 'VERIFIED' WHERE user_id = ?",
        [`sess_inst_c_${ts}@stanford.edu`, userC_id]
    );

    // Create skills and user_skills
    const [skill1Res] = await db.query(
        "INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)",
        [`Algorithms ${ts}`, "Computer Science"]
    );
    const skillA_id = skill1Res.insertId;

    const [skill2Res] = await db.query(
        "INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)",
        [`Web Dev ${ts}`, "Software"]
    );
    const skillB_id = skill2Res.insertId;

    // User A offers skill A, User B offers skill B
    await db.query(
        "INSERT INTO user_skills (user_id, skill_id, skill_type, skill_level) VALUES (?, ?, 'OFFER', 'ADVANCED'), (?, ?, 'OFFER', 'INTERMEDIATE')",
        [userA_id, skillA_id, userB_id, skillB_id]
    );

    // Create an ACCEPTED swap request between User A and User B
    const [swapRes] = await db.query(
        "INSERT INTO swap_requests (sender_id, receiver_id, skill_offered, skill_requested, status) VALUES (?, ?, ?, ?, 'ACCEPTED')",
        [userA_id, userB_id, skillA_id, skillB_id]
    );
    const acceptedRequestId = swapRes.insertId;

    // Create a PENDING swap request (not yet accepted)
    const [pendingRes] = await db.query(
        "INSERT INTO swap_requests (sender_id, receiver_id, skill_offered, skill_requested, status) VALUES (?, ?, ?, ?, 'PENDING')",
        [userA_id, userB_id, skillA_id, skillB_id]
    );
    const pendingRequestId = pendingRes.insertId;

    // --- TEST 1: Unauthenticated Access ---
    console.log("\n2. Testing Unauthenticated Access Protection...");

    // POST /schedule without token
    const schedNoToken = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    });
    assert(schedNoToken.status === 401, "Blocks unauthenticated POST /schedule (401)");

    // POST /schedule with invalid token
    const schedBadToken = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    }, "corrupt.token.value");
    assert(schedBadToken.status === 401, "Blocks POST /schedule with invalid token (401)");

    // GET /user/:userId without token
    const getUserNoToken = await api("GET", `/api/sessions/user/${userA_id}`);
    assert(getUserNoToken.status === 401, "Blocks unauthenticated GET /user/:userId (401)");

    // PUT /:sessionId/status without token
    const putStatusNoToken = await api("PUT", "/api/sessions/1/status", { status: "COMPLETED" });
    assert(putStatusNoToken.status === 401, "Blocks unauthenticated PUT /:sessionId/status (401)");

    // --- TEST 2: Input & Validation on POST /schedule ---
    console.log("\n3. Testing Input & Mode Validation on POST /schedule...");

    // Invalid non-integer requestId
    const badReqId = await api("POST", "/api/sessions/schedule", {
        requestId: "invalid",
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    }, tokenA);
    assert(badReqId.status === 400, "Rejects schedule with non-numeric requestId (400)");

    // Invalid date format
    const badDate = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "11/01/2026",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    }, tokenA);
    assert(badDate.status === 400, "Rejects schedule with invalid date format (400)");

    // Invalid time format
    const badTime = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "25:70",
        duration: 60,
        mode: "ONLINE"
    }, tokenA);
    assert(badTime.status === 400, "Rejects schedule with invalid time format (400)");

    // Duration below limit (< 15 mins)
    const badDurLow = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 5,
        mode: "ONLINE"
    }, tokenA);
    assert(badDurLow.status === 400, "Rejects schedule with duration < 15 minutes (400)");

    // Duration above limit (> 480 mins)
    const badDurHigh = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 600,
        mode: "ONLINE"
    }, tokenA);
    assert(badDurHigh.status === 400, "Rejects schedule with duration > 480 minutes (400)");

    // Invalid mode (must not silently default to ONLINE)
    const badMode = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "VIRTUAL_REALITY" // Invalid! Must reject, not default
    }, tokenA);
    assert(badMode.status === 400, "Rejects invalid mode instead of defaulting to ONLINE (400 Bad Request)");

    // Missing mode entirely
    const noMode = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60
    }, tokenA);
    assert(noMode.status === 400, "Rejects schedule request missing mode (400 Bad Request)");

    // Attempt to schedule a PENDING (unaccepted) swap request
    const pendingSched = await api("POST", "/api/sessions/schedule", {
        requestId: pendingRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    }, tokenA);
    assert(pendingSched.status === 400, "Blocks scheduling an unaccepted (PENDING) swap request (400)");

    // --- TEST 3: Scheduling by Non-Participants & Impersonation ---
    console.log("\n4. Testing Scheduling Participant Authorization & Impersonation...");

    // User C (outsider) attempts to schedule session for User A and User B's swap request
    const outsiderSched = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    }, tokenC);
    assert(outsiderSched.status === 403, 
           "Blocks non-participant (User C) from scheduling session (403 Forbidden)");

    // User C attempts to bypass check by passing userId: userA_id in body
    const spoofSched = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        userId: userA_id, // Body impersonation attempt!
        sessionDate: "2026-11-01",
        sessionTime: "10:00:00",
        duration: 60,
        mode: "ONLINE"
    }, tokenC);
    assert(spoofSched.status === 403, 
           "Blocks body userId spoofing on POST /schedule (403 Forbidden)");

    // --- TEST 4: Cross-User Session List Access (RBAC) ---
    console.log("\n5. Testing Cross-User Session List Authorization (RBAC)...");

    // User A attempts to view User B's session list
    const getOtherSessions = await api("GET", `/api/sessions/user/${userB_id}`, null, tokenA);
    assert(getOtherSessions.status === 403, "Blocks User A from reading User B's sessions (403 Forbidden)");

    // User A views their own session list
    const getOwnSessions = await api("GET", `/api/sessions/user/${userA_id}`, null, tokenA);
    assert(getOwnSessions.status === 200 && Array.isArray(getOwnSessions.body), 
           "Allows User A to view their own sessions (200 OK)");

    // User B views their own session list
    const getOwnSessionsB = await api("GET", `/api/sessions/user/${userB_id}`, null, tokenB);
    assert(getOwnSessionsB.status === 200 && Array.isArray(getOwnSessionsB.body), 
           "Allows User B to view their own sessions (200 OK)");

    // --- TEST 5: Valid Participant Scheduling Workflow ---
    console.log("\n6. Testing Valid Participant Scheduling Workflow...");

    // User A (sender) schedules the session
    const validSched = await api("POST", "/api/sessions/schedule", {
        requestId: acceptedRequestId,
        sessionDate: "2026-11-05",
        sessionTime: "14:30:00",
        duration: 90,
        mode: "ONLINE"
    }, tokenA);
    assert(validSched.status === 201 && validSched.body.sessionId, 
           "Allows participant (User A) to schedule session (201 Created)");
    const sessionId = validSched.body.sessionId;

    // Verify session appears in both User A's and User B's lists
    const aList = await api("GET", `/api/sessions/user/${userA_id}`, null, tokenA);
    const bList = await api("GET", `/api/sessions/user/${userB_id}`, null, tokenB);
    const sessInA = aList.body.some(s => s.session_id === sessionId);
    const sessInB = bList.body.some(s => s.session_id === sessionId);
    assert(sessInA && sessInB, "Scheduled session appears in both participants' session lists");

    // --- TEST 6: Session Status Updates & Authorization ---
    console.log("\n7. Testing Session Status Update Authorization (PUT /:sessionId/status)...");

    // Non-numeric sessionId
    const badSessId = await api("PUT", "/api/sessions/abc/status", { status: "COMPLETED" }, tokenA);
    assert(badSessId.status === 400, "Rejects non-numeric sessionId (400)");

    // Invalid status string
    const badStatus = await api("PUT", `/api/sessions/${sessionId}/status`, { status: "DESTROYED" }, tokenA);
    assert(badStatus.status === 400, "Rejects invalid status value (400)");

    // Non-existent session ID
    const notFoundSess = await api("PUT", "/api/sessions/999999/status", { status: "COMPLETED" }, tokenA);
    assert(notFoundSess.status === 404, "Returns 404 Not Found for non-existent session");

    // Outsider (User C) attempts to update session status
    const outsiderStatus = await api("PUT", `/api/sessions/${sessionId}/status`, {
        status: "CANCELLED"
    }, tokenC);
    assert(outsiderStatus.status === 403, "Blocks outsider from updating session status (403 Forbidden)");

    // Outsider (User C) attempts body userId impersonation
    const spoofStatus = await api("PUT", `/api/sessions/${sessionId}/status`, {
        status: "CANCELLED",
        userId: userB_id // Spoofed body userId!
    }, tokenC);
    assert(spoofStatus.status === 403, "Blocks body userId spoofing on status update (403 Forbidden)");

    // Legitimate participant (User B) updates session to COMPLETED
    const validUpdate = await api("PUT", `/api/sessions/${sessionId}/status`, {
        status: "COMPLETED"
    }, tokenB);
    assert(validUpdate.status === 200 && validUpdate.body.status === "COMPLETED", 
           "Allows legitimate participant (User B) to update session status (200 OK)");

    // Verify updated status in database
    const verifyList = await api("GET", `/api/sessions/user/${userA_id}`, null, tokenA);
    const updatedRow = verifyList.body.find(s => s.session_id === sessionId);
    assert(updatedRow && updatedRow.status === "COMPLETED", "Session status successfully persisted as COMPLETED");

    await db.end();

    console.log("\n=============================================================");
    console.log(`   TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("=============================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runSessionsSecurityTests().catch(err => {
    console.error("\n❌ Sessions Security Test Suite encountered unexpected error:", err);
    process.exit(1);
});
