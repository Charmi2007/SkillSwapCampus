// Automated Regression and Security Test Suite for SkillSwap Campus
// Tests backend/routes/swap.js for authentication, authorization, RBAC, input validation, and business logic

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const http = require("http");

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

async function runSwapSecurityTests() {
    console.log("=============================================================");
    console.log("   SkillSwap Campus - Swap Routes Security & RBAC Test Suite");
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
    console.log("1. Setting up Test Users and College Affiliations...");
    
    // User A (College 1 - Vardhaman)
    const emailA = `swap_a_${ts}@test.com`;
    const regA = await api("POST", "/api/auth/register", {
        name: "Swap Student A",
        email: emailA,
        password: password,
        department: "CSE",
        year: 2
    });
    const userA_id = regA.body.userId;
    const logA = await api("POST", "/api/auth/login", { email: emailA, password: password });
    const tokenA = logA.body.token;

    // User B (Same College 1 - Vardhaman)
    const emailB = `swap_b_${ts}@test.com`;
    const regB = await api("POST", "/api/auth/register", {
        name: "Swap Student B",
        email: emailB,
        password: password,
        department: "ECE",
        year: 3
    });
    const userB_id = regB.body.userId;
    const logB = await api("POST", "/api/auth/login", { email: emailB, password: password });
    const tokenB = logB.body.token;

    // User C (Outsider / College 2)
    const emailC = `swap_c_${ts}@test.com`;
    const regC = await api("POST", "/api/auth/register", {
        name: "Swap Student C",
        email: emailC,
        password: password,
        department: "IT",
        year: 4
    });
    const userC_id = regC.body.userId;
    const logC = await api("POST", "/api/auth/login", { email: emailC, password: password });
    const tokenC = logC.body.token;

    assert(userA_id && userB_id && userC_id, "Registered test students A, B, and C successfully");

    // Verify User A and User B in database for same college (college_id: 1)
    const mysql = require("mysql2/promise");
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
        [`inst_a_${ts}@student.vardhaman.org`, userA_id, userB_id]
    );

    // Set C verified in College 4 (Stanford)
    await db.query(
        "UPDATE users SET college_id = 4, institutional_email = ?, verification_status = 'VERIFIED' WHERE user_id = ?",
        [`inst_c_${ts}@stanford.edu`, userC_id]
    );

    // Create skills and user_skills
    const [skill1Res] = await db.query(
        "INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)",
        [`Data Structures ${ts}`, "Computer Science"]
    );
    const skillA_id = skill1Res.insertId;

    const [skill2Res] = await db.query(
        "INSERT INTO skills (skill_name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id=LAST_INSERT_ID(skill_id)",
        [`Circuit Design ${ts}`, "Electronics"]
    );
    const skillB_id = skill2Res.insertId;

    // User A offers skill A
    await db.query(
        "INSERT INTO user_skills (user_id, skill_id, skill_type, skill_level) VALUES (?, ?, 'OFFER', 'ADVANCED')",
        [userA_id, skillA_id]
    );

    // User B offers skill B
    await db.query(
        "INSERT INTO user_skills (user_id, skill_id, skill_type, skill_level) VALUES (?, ?, 'OFFER', 'INTERMEDIATE')",
        [userB_id, skillB_id]
    );

    // --- TEST 1: Unauthenticated Access ---
    console.log("\n2. Testing Unauthenticated Access Protection...");

    // POST /request without token
    const postNoToken = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    });
    assert(postNoToken.status === 401, "Blocks unauthenticated POST /request without token (401)");

    // POST /request with malformed token
    const postBadToken = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, "invalid.bearer.token");
    assert(postBadToken.status === 401, "Blocks POST /request with invalid token (401)");

    // GET /received/:userId without token
    const getRecNoToken = await api("GET", `/api/swap/received/${userA_id}`);
    assert(getRecNoToken.status === 401, "Blocks unauthenticated GET /received/:userId (401)");

    // GET /sent/:userId without token
    const getSentNoToken = await api("GET", `/api/swap/sent/${userA_id}`);
    assert(getSentNoToken.status === 401, "Blocks unauthenticated GET /sent/:userId (401)");

    // GET /accepted/:userId without token
    const getAccNoToken = await api("GET", `/api/swap/accepted/${userA_id}`);
    assert(getAccNoToken.status === 401, "Blocks unauthenticated GET /accepted/:userId (401)");

    // PUT /respond/:requestId without token
    const putRespNoToken = await api("PUT", "/api/swap/respond/1", { status: "ACCEPTED" });
    assert(putRespNoToken.status === 401, "Blocks unauthenticated PUT /respond/:requestId (401)");

    // --- TEST 2: Sender Impersonation Protection ---
    console.log("\n3. Testing Sender Impersonation Prevention on POST /request...");

    // User A attempts to send swap request forging senderId as User B
    const spoofSenderRes = await api("POST", "/api/swap/request", {
        senderId: userB_id, // Spoofed! Token belongs to user A
        receiverId: userC_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, tokenA);
    assert(spoofSenderRes.status === 403, 
           "Blocks sender impersonation when client provides mismatched senderId (403 Forbidden)",
           `Actual: ${spoofSenderRes.status}`);

    // --- TEST 3: Input Validation on POST /request ---
    console.log("\n4. Testing Input & Skill Validation on POST /request...");

    // Invalid receiver ID (string)
    const badReceiver = await api("POST", "/api/swap/request", {
        receiverId: "invalid",
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, tokenA);
    assert(badReceiver.status === 400, "Rejects request with non-numeric receiverId (400)");

    // Invalid negative skill ID
    const badSkill = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: -5,
        skillRequested: skillB_id
    }, tokenA);
    assert(badSkill.status === 400, "Rejects request with invalid negative skill ID (400)");

    // Swap with self
    const swapSelf = await api("POST", "/api/swap/request", {
        receiverId: userA_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, tokenA);
    assert(swapSelf.status === 400, "Blocks swap request sent to oneself (400)");

    // Offering and requesting the same skill ID
    const sameSkill = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: skillA_id,
        skillRequested: skillA_id
    }, tokenA);
    assert(sameSkill.status === 400, "Rejects swap request with identical offered and requested skill (400)");

    // Non-existent skill ID
    const nonExistentSkill = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: 999999,
        skillRequested: skillB_id
    }, tokenA);
    assert(nonExistentSkill.status === 404, "Rejects request with non-existent skill ID (404 Not Found)");

    // Offering a skill that the sender does not teach (skillB is offered by User B, not User A)
    const notSenderSkill = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: skillB_id, // User A does not offer skill B
        skillRequested: skillA_id
    }, tokenA);
    assert(notSenderSkill.status === 400, "Rejects request if sender does not own/offer the offered skill (400)");

    // --- TEST 4: Cross-User Request List Access (RBAC) ---
    console.log("\n5. Testing Cross-User Request List Authorization (RBAC)...");

    // User A tries to view User B's incoming requests
    const getOtherReceived = await api("GET", `/api/swap/received/${userB_id}`, null, tokenA);
    assert(getOtherReceived.status === 403, "Blocks User A from reading User B's received requests (403 Forbidden)");

    // User A tries to view User B's outgoing requests
    const getOtherSent = await api("GET", `/api/swap/sent/${userB_id}`, null, tokenA);
    assert(getOtherSent.status === 403, "Blocks User A from reading User B's sent requests (403 Forbidden)");

    // User A tries to view User B's accepted requests
    const getOtherAccepted = await api("GET", `/api/swap/accepted/${userB_id}`, null, tokenA);
    assert(getOtherAccepted.status === 403, "Blocks User A from reading User B's accepted requests (403 Forbidden)");

    // User A views their own received requests
    const getOwnReceived = await api("GET", `/api/swap/received/${userA_id}`, null, tokenA);
    assert(getOwnReceived.status === 200 && Array.isArray(getOwnReceived.body), "Allows User A to view their own received requests (200 OK)");

    // User A views their own sent requests
    const getOwnSent = await api("GET", `/api/swap/sent/${userA_id}`, null, tokenA);
    assert(getOwnSent.status === 200 && Array.isArray(getOwnSent.body), "Allows User A to view their own sent requests (200 OK)");

    // User A views their own accepted requests
    const getOwnAccepted = await api("GET", `/api/swap/accepted/${userA_id}`, null, tokenA);
    assert(getOwnAccepted.status === 200 && Array.isArray(getOwnAccepted.body), "Allows User A to view their own accepted requests (200 OK)");

    // --- TEST 5: Same-College Enforcement & Creation of Swap Request ---
    console.log("\n6. Testing Same-College Swap Enforcement & Creation...");

    // Cross-college swap attempt: User A (College 1) to User C (College 4)
    const crossCollegeSwap = await api("POST", "/api/swap/request", {
        receiverId: userC_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, tokenA);
    assert(crossCollegeSwap.status === 403, 
           "Blocks cross-college swap request between different colleges (403 Forbidden)");

    // Valid same-college swap request: User A to User B
    const validSwap = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, tokenA);
    assert(validSwap.status === 201 && validSwap.body.requestId, 
           "Creates valid same-college swap request (201 Created)");
    const requestId = validSwap.body.requestId;

    // Verify duplicate pending request is blocked
    const duplicateSwap = await api("POST", "/api/swap/request", {
        receiverId: userB_id,
        skillOffered: skillA_id,
        skillRequested: skillB_id
    }, tokenA);
    assert(duplicateSwap.status === 400, "Blocks duplicate pending swap request (400 Bad Request)");

    // --- TEST 6: Unauthorized Acceptance & Rejection ---
    console.log("\n7. Testing Unauthorized Acceptance / Rejection on PUT /respond/:requestId...");

    // User A (the sender) tries to accept their own request
    const senderAccept = await api("PUT", `/api/swap/respond/${requestId}`, {
        status: "ACCEPTED"
    }, tokenA);
    assert(senderAccept.status === 403, "Blocks sender from accepting their own swap request (403 Forbidden)");

    // User C (unrelated third party) tries to accept User A & B's swap request
    const outsiderAccept = await api("PUT", `/api/swap/respond/${requestId}`, {
        status: "ACCEPTED"
    }, tokenC);
    assert(outsiderAccept.status === 403, "Blocks unrelated user from responding to another's swap request (403 Forbidden)");

    // User C tries to pass receiverId in the body to bypass check
    const bypassAttempt = await api("PUT", `/api/swap/respond/${requestId}`, {
        status: "ACCEPTED",
        userId: userB_id // Trying to impersonate User B in body!
    }, tokenC);
    assert(bypassAttempt.status === 403, "Blocks body userId spoofing attempt on PUT /respond (403 Forbidden)");

    // Invalid status string
    const invalidStatus = await api("PUT", `/api/swap/respond/${requestId}`, {
        status: "INVALID_STATUS"
    }, tokenB);
    assert(invalidStatus.status === 400, "Rejects response with invalid status (400 Bad Request)");

    // Non-existent request ID
    const notFoundReq = await api("PUT", "/api/swap/respond/999999", {
        status: "ACCEPTED"
    }, tokenB);
    assert(notFoundReq.status === 404, "Returns 404 Not Found for non-existent requestId");

    // --- TEST 7: Valid Authorized Acceptance ---
    console.log("\n8. Testing Valid Authorized Acceptance by Legitimate Receiver...");

    // User B (the actual receiver) accepts the request
    const legitimateAccept = await api("PUT", `/api/swap/respond/${requestId}`, {
        status: "ACCEPTED",
        userId: userB_id
    }, tokenB);
    assert(legitimateAccept.status === 200 && legitimateAccept.body.status === "ACCEPTED", 
           "Allows legitimate receiver (User B) to accept the swap request (200 OK)");

    // Attempting to accept/modify a request that is already ACCEPTED
    const reAccept = await api("PUT", `/api/swap/respond/${requestId}`, {
        status: "REJECTED",
        userId: userB_id
    }, tokenB);
    assert(reAccept.status === 400, "Blocks modifying status of an already finalized swap request (400 Bad Request)");

    // Verify request shows up in accepted lists of both User A and User B
    const aAccepted = await api("GET", `/api/swap/accepted/${userA_id}`, null, tokenA);
    const bAccepted = await api("GET", `/api/swap/accepted/${userB_id}`, null, tokenB);
    const foundInA = aAccepted.body.some(r => r.request_id === requestId);
    const foundInB = bAccepted.body.some(r => r.request_id === requestId);
    assert(foundInA && foundInB, "Accepted swap request appears in both sender and receiver accepted lists");

    await db.end();

    console.log("\n=============================================================");
    console.log(`   TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("=============================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runSwapSecurityTests().catch(err => {
    console.error("\n❌ Swap Security Test Suite encountered unexpected error:", err);
    process.exit(1);
});
