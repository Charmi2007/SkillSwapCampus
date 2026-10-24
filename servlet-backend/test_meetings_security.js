// Automated Security & RBAC Test Suite for MeetingServlet and MeetingService
// Tests servlet-backend MeetingServlet against authentication, user impersonation,
// authorization, input validation, and valid participant workflows.

const path = require("path");
require(path.resolve(__dirname, "../backend/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../backend/.env") });
const http = require("http");
const mysql = require(path.resolve(__dirname, "../backend/node_modules/mysql2/promise"));
const jwt = require(path.resolve(__dirname, "../backend/node_modules/jsonwebtoken"));

const NODE_PORT = 5000;
const SERVLET_PORT = 8080;
const SERVLET_PATH = "/skillswap-servlet";

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

function nodeApi(method, reqPath, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return request({
        hostname: "localhost",
        port: NODE_PORT,
        path: reqPath,
        method: method,
        headers: headers
    }, body);
}

function servletApi(method, reqPath, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return request({
        hostname: "localhost",
        port: SERVLET_PORT,
        path: SERVLET_PATH + reqPath,
        method: method,
        headers: headers
    }, body);
}

async function runMeetingSecurityTests() {
    console.log("=============================================================");
    console.log("   SkillSwap Campus - Meeting Servlet Security & RBAC Suite");
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

    const emailA = `meet_sec_a_${ts}@test.com`;
    const regA = await nodeApi("POST", "/api/auth/register", {
        name: "Meeting Student A",
        email: emailA,
        password: password,
        department: "CSE",
        year: 3
    });
    const userA_id = regA.body.userId;
    const logA = await nodeApi("POST", "/api/auth/login", { email: emailA, password: password });
    const tokenA = logA.body.token;

    const emailB = `meet_sec_b_${ts}@test.com`;
    const regB = await nodeApi("POST", "/api/auth/register", {
        name: "Meeting Student B",
        email: emailB,
        password: password,
        department: "IT",
        year: 3
    });
    const userB_id = regB.body.userId;
    const logB = await nodeApi("POST", "/api/auth/login", { email: emailB, password: password });
    const tokenB = logB.body.token;

    const emailC = `meet_sec_c_${ts}@test.com`;
    const regC = await nodeApi("POST", "/api/auth/register", {
        name: "Meeting Student C (Outsider)",
        email: emailC,
        password: password,
        department: "ECE",
        year: 4
    });
    const userC_id = regC.body.userId;
    const logC = await nodeApi("POST", "/api/auth/login", { email: emailC, password: password });
    const tokenC = logC.body.token;

    assert(userA_id && userB_id && userC_id, "Registered test students A, B, and C successfully");

    // Admin token
    const jwtSecret = process.env.JWT_SECRET;
    const tokenAdmin = jwt.sign({ userId: 99999, email: "admin@skillswap.org", role: "admin" }, jwtSecret, { expiresIn: "1h" });

    // Expired token
    const tokenExpired = jwt.sign({ userId: userA_id, email: emailA }, jwtSecret, { expiresIn: "-10s" });

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
        [`inst_meet_a_${ts}@student.vardhaman.org`, userA_id, userB_id]
    );

    // Set C verified in College 4 (Stanford)
    await db.query(
        "UPDATE users SET college_id = 4, institutional_email = ?, verification_status = 'VERIFIED' WHERE user_id = ?",
        [`inst_meet_c_${ts}@stanford.edu`, userC_id]
    );

    // Create skills
    const [skill1Res] = await db.query(
        "INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)",
        [`Java Meet ${ts}`, "Computer Science"]
    );
    const skillA_id = skill1Res.insertId;

    const [skill2Res] = await db.query(
        "INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)",
        [`Python Meet ${ts}`, "Computer Science"]
    );
    const skillB_id = skill2Res.insertId;

    await db.query("INSERT INTO user_skills (user_id, skill_id, skill_type, skill_level) VALUES (?, ?, 'OFFER', 'INTERMEDIATE')", [userA_id, skillA_id]);
    await db.query("INSERT INTO user_skills (user_id, skill_id, skill_type, skill_level) VALUES (?, ?, 'OFFER', 'INTERMEDIATE')", [userB_id, skillB_id]);

    // Create accepted swap request
    const [swapRes] = await db.query(
        "INSERT INTO swap_requests (sender_id, receiver_id, skill_offered, skill_requested, status) VALUES (?, ?, ?, ?, 'ACCEPTED')",
        [userA_id, userB_id, skillA_id, skillB_id]
    );
    const requestId = swapRes.insertId;

    // Create scheduled session between A and B
    const [sessRes] = await db.query(
        "INSERT INTO sessions (request_id, session_date, session_time, duration, mode, status) VALUES (?, '2026-10-30', '15:00:00', 60, 'ONLINE', 'SCHEDULED')",
        [requestId]
    );
    const sessionId = sessRes.insertId;

    // --- TEST 2: Unauthenticated Access (401 Unauthorized) ---
    console.log("\n2. Testing Authentication Enforcement (401 on Missing/Invalid Tokens)...");

    const noAuthSchedule = await servletApi("POST", "/api/meetings/schedule", { sessionId: sessionId, title: "No Auth Meeting" });
    assert(noAuthSchedule.status === 401, "Blocks unauthenticated POST /api/meetings/schedule (401)", `Got ${noAuthSchedule.status}`);

    const noAuthGetSession = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}`);
    assert(noAuthGetSession.status === 401, "Blocks unauthenticated GET /api/meetings/session (401)", `Got ${noAuthGetSession.status}`);

    const noAuthGetUser = await servletApi("GET", `/api/meetings/user?userId=${userA_id}`);
    assert(noAuthGetUser.status === 401, "Blocks unauthenticated GET /api/meetings/user (401)", `Got ${noAuthGetUser.status}`);

    const noAuthStatus = await servletApi("PUT", "/api/meetings/status", { meetingId: 1, status: "COMPLETED" });
    assert(noAuthStatus.status === 401, "Blocks unauthenticated PUT /api/meetings/status (401)", `Got ${noAuthStatus.status}`);

    const invalidAuthSchedule = await servletApi("POST", "/api/meetings/schedule", { sessionId: sessionId, title: "Bad Token" }, "invalid.token.here");
    assert(invalidAuthSchedule.status === 401, "Blocks POST /api/meetings/schedule with invalid token (401)", `Got ${invalidAuthSchedule.status}`);

    const expiredAuthSchedule = await servletApi("POST", "/api/meetings/schedule", { sessionId: sessionId, title: "Expired Token" }, tokenExpired);
    assert(expiredAuthSchedule.status === 401, "Blocks POST /api/meetings/schedule with expired token (401)", `Got ${expiredAuthSchedule.status}`);

    const expiredAuthGetSession = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}`, null, tokenExpired);
    assert(expiredAuthGetSession.status === 401, "Blocks GET /api/meetings/session with expired token (401)", `Got ${expiredAuthGetSession.status}`);

    // --- TEST 3: User ID Protection & Spoofing Prevention (403 Forbidden) ---
    console.log("\n3. Testing User ID Spoofing / Impersonation (403 Forbidden)...");

    // Client supplies userId B, but token is for User A
    const spoofSchedule = await servletApi("POST", "/api/meetings/schedule", {
        sessionId: sessionId,
        userId: userB_id,
        title: "Spoofed Meeting",
        durationMinutes: 60
    }, tokenA);
    assert(spoofSchedule.status === 403, "Blocks POST /api/meetings/schedule when body userId mismatches JWT (403)", `Got ${spoofSchedule.status}`);

    // Client supplies userId B in query, but token is for User A on GET /session
    const spoofGetSession = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}&userId=${userB_id}`, null, tokenA);
    assert(spoofGetSession.status === 403, "Blocks GET /api/meetings/session when query userId mismatches JWT (403)", `Got ${spoofGetSession.status}`);

    // Client supplies userId B in query, but token is for User A on GET /user
    const spoofGetUser = await servletApi("GET", `/api/meetings/user?userId=${userB_id}`, null, tokenA);
    assert(spoofGetUser.status === 403, "Blocks GET /api/meetings/user when query userId mismatches JWT (403)", `Got ${spoofGetUser.status}`);

    // Client supplies userId B in body, but token is for User A on PUT /status
    const spoofStatus = await servletApi("PUT", "/api/meetings/status", {
        meetingId: 1,
        userId: userB_id,
        status: "COMPLETED"
    }, tokenA);
    assert(spoofStatus.status === 403, "Blocks PUT /api/meetings/status when body userId mismatches JWT (403)", `Got ${spoofStatus.status}`);

    // --- TEST 4: Input Validation (400 Bad Request) ---
    console.log("\n4. Testing Input Validation (400 Bad Request)...");

    // Missing sessionId
    const valNoSession = await servletApi("POST", "/api/meetings/schedule", { title: "Test", durationMinutes: 60 }, tokenA);
    assert(valNoSession.status === 400, "Rejects schedule request missing sessionId (400)", `Got ${valNoSession.status}`);

    // Non-positive sessionId
    const valBadSession = await servletApi("POST", "/api/meetings/schedule", { sessionId: -5, durationMinutes: 60 }, tokenA);
    assert(valBadSession.status === 400, "Rejects schedule request with negative sessionId (400)", `Got ${valBadSession.status}`);

    // Duration < 15
    const valShortDuration = await servletApi("POST", "/api/meetings/schedule", { sessionId: sessionId, durationMinutes: 10 }, tokenA);
    assert(valShortDuration.status === 400, "Rejects schedule request with duration < 15 min (400)", `Got ${valShortDuration.status}`);

    // Duration > 480
    const valLongDuration = await servletApi("POST", "/api/meetings/schedule", { sessionId: sessionId, durationMinutes: 500 }, tokenA);
    assert(valLongDuration.status === 400, "Rejects schedule request with duration > 480 min (400)", `Got ${valLongDuration.status}`);

    // Invalid scheduledStart format
    const valBadDate = await servletApi("POST", "/api/meetings/schedule", {
        sessionId: sessionId,
        durationMinutes: 60,
        scheduledStart: "invalid-timestamp"
    }, tokenA);
    assert(valBadDate.status === 400, "Rejects schedule request with malformed scheduledStart date (400)", `Got ${valBadDate.status}`);

    // Title length > 255
    const longTitle = "A".repeat(300);
    const valLongTitle = await servletApi("POST", "/api/meetings/schedule", {
        sessionId: sessionId,
        durationMinutes: 60,
        title: longTitle
    }, tokenA);
    assert(valLongTitle.status === 400, "Rejects schedule request with title exceeding 255 chars (400)", `Got ${valLongTitle.status}`);

    // GET /session with non-positive sessionId
    const valGetBadSession = await servletApi("GET", "/api/meetings/session?sessionId=-1", null, tokenA);
    assert(valGetBadSession.status === 400, "Rejects GET /session with non-positive sessionId (400)", `Got ${valGetBadSession.status}`);

    // GET /user with non-positive userId
    const valGetBadUser = await servletApi("GET", "/api/meetings/user?userId=-10", null, tokenA);
    assert(valGetBadUser.status === 400, "Rejects GET /user with non-positive userId (400)", `Got ${valGetBadUser.status}`);

    // PUT /status with non-positive meetingId
    const valBadMeetingId = await servletApi("PUT", "/api/meetings/status", { meetingId: -1, status: "COMPLETED" }, tokenA);
    assert(valBadMeetingId.status === 400, "Rejects status update with non-positive meetingId (400)", `Got ${valBadMeetingId.status}`);

    // PUT /status with unsupported status
    const valBadStatus = await servletApi("PUT", "/api/meetings/status", { meetingId: 1, status: "SUPER_DESTROYED" }, tokenA);
    assert(valBadStatus.status === 400, "Rejects status update with unsupported status value (400)", `Got ${valBadStatus.status}`);

    // --- TEST 5: Nonparticipant Authorization (403 Forbidden) ---
    console.log("\n5. Testing Participant Authorization & Nonparticipant Blocking (403 Forbidden)...");

    // Outsider User C tries to schedule meeting for session between A and B
    const nonPartSched = await servletApi("POST", "/api/meetings/schedule", {
        sessionId: sessionId,
        title: "Hacked Meeting by Outsider",
        durationMinutes: 60
    }, tokenC);
    assert(nonPartSched.status === 403, "Blocks non-participant from scheduling meeting for session (403)", `Got ${nonPartSched.status}`);

    // --- TEST 6: Valid Participant Scheduling Workflow ---
    console.log("\n6. Testing Valid Participant Meeting Scheduling & Retrieval...");

    // Participant User A schedules valid meeting
    const schedRes = await servletApi("POST", "/api/meetings/schedule", {
        sessionId: sessionId,
        title: "Valid Peer Study Session",
        scheduledStart: "2026-10-30 15:00:00",
        durationMinutes: 60
    }, tokenA);
    assert(schedRes.status === 201, "Participant A schedules meeting successfully (201 Created)", `Got ${schedRes.status}`);
    const meeting = schedRes.body.meeting;
    assert(meeting && meeting.meetingId > 0, "Response includes valid meetingId");
    assert(meeting.roomName && meeting.roomName.startsWith("SkillSwap-Campus-"), "Room name follows secure prefixed format");
    assert(meeting.jitsiUrl && meeting.jitsiUrl.startsWith("https://meet.jit.si/"), "Jitsi URL points to trusted Jitsi Meet domain");
    assert(meeting.passcode && meeting.passcode.length === 6, "Passcode is a 6-character token");
    const createdMeetingId = meeting.meetingId;

    // Participant A retrieves meeting
    const getMeetingA = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}`, null, tokenA);
    assert(getMeetingA.status === 200, "Participant A retrieves session meeting (200 OK)", `Got ${getMeetingA.status}`);
    assert(getMeetingA.body.meeting.meetingId === createdMeetingId, "Retrieved meeting ID matches created meeting");

    // Participant B (peer) retrieves meeting
    const getMeetingB = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}`, null, tokenB);
    assert(getMeetingB.status === 200, "Participant B retrieves session meeting (200 OK)", `Got ${getMeetingB.status}`);
    assert(getMeetingB.body.meeting.jitsiUrl === meeting.jitsiUrl, "Participant B retrieves identical meeting URL");
    assert(getMeetingB.body.meeting.passcode === meeting.passcode, "Participant B retrieves identical passcode");

    // Non-participant User C tries to retrieve session meeting -> MUST BE 403
    const getMeetingC = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}`, null, tokenC);
    assert(getMeetingC.status === 403, "Blocks non-participant User C from retrieving session meeting (403 Forbidden)", `Got ${getMeetingC.status}`);

    // --- TEST 7: Cross-User Meeting List Access (403 Forbidden) ---
    console.log("\n7. Testing Cross-User Meeting List Access...");

    // User A retrieves own meetings list
    const listA = await servletApi("GET", "/api/meetings/user", null, tokenA);
    assert(listA.status === 200 && Array.isArray(listA.body.meetings), "User A retrieves own meetings list (200 OK)", `Got ${listA.status}`);
    const foundMeeting = listA.body.meetings.some(m => m.meetingId === createdMeetingId);
    assert(foundMeeting, "User A's meetings list contains newly created meeting");

    // Non-participant User C tries to update status of meeting -> MUST BE 403
    const nonPartUpdate = await servletApi("PUT", "/api/meetings/status", {
        meetingId: createdMeetingId,
        status: "CANCELLED"
    }, tokenC);
    assert(nonPartUpdate.status === 403, "Blocks non-participant User C from updating meeting status (403 Forbidden)", `Got ${nonPartUpdate.status}`);

    // Participant B updates status to COMPLETED
    const validUpdate = await servletApi("PUT", "/api/meetings/status", {
        meetingId: createdMeetingId,
        status: "COMPLETED"
    }, tokenB);
    assert(validUpdate.status === 200, "Participant B successfully updates meeting status to COMPLETED (200 OK)", `Got ${validUpdate.status}`);
    assert(validUpdate.body.meeting.status === "COMPLETED", "Returned meeting status reflects COMPLETED");

    // Verify DB reflection
    const [sessCheck] = await db.query("SELECT status FROM sessions WHERE session_id = ?", [sessionId]);
    assert(sessCheck[0].status === "COMPLETED", "Associated session row in MySQL automatically marked COMPLETED");

    // --- TEST 8: Admin Role Access (Elevated Access) ---
    console.log("\n8. Testing Admin Role Privilege...");

    // Admin retrieves User A's meetings
    const adminGetUser = await servletApi("GET", `/api/meetings/user?userId=${userA_id}`, null, tokenAdmin);
    assert(adminGetUser.status === 200, "Admin can retrieve any user's meetings list (200 OK)", `Got ${adminGetUser.status}`);

    // Admin retrieves session meeting
    const adminGetSession = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}`, null, tokenAdmin);
    assert(adminGetSession.status === 200, "Admin can retrieve any session's meeting (200 OK)", `Got ${adminGetSession.status}`);

    await db.end();

    console.log("\n=============================================================");
    console.log(`   TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("=============================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runMeetingSecurityTests().catch(err => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
