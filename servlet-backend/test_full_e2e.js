// End-to-End Integration Test for SkillSwap Campus
// Tests both Node.js Express backend and Java Servlet backend with MySQL

const http = require("http");

const NODE_HOST = "localhost";
const NODE_PORT = 5000;
const SERVLET_PORT = 8080;
const SERVLET_PATH_PREFIX = "/skillswap-servlet";

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

function nodeApi(method, path, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return request({
        hostname: NODE_HOST,
        port: NODE_PORT,
        path: path,
        method: method,
        headers: headers
    }, body);
}

function servletApi(method, path, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return request({
        hostname: NODE_HOST,
        port: SERVLET_PORT,
        path: SERVLET_PATH_PREFIX + path,
        method: method,
        headers: headers
    }, body);
}

async function runTest() {
    console.log("=============================================================");
    console.log("   SkillSwap Campus - Comprehensive E2E System Test");
    console.log("=============================================================\n");

    const ts = Date.now();
    const user1Email = `alice_${ts}@test.com`;
    const user2Email = `bob_${ts}@test.com`;
    const user3Email = `charlie_${ts}@test.com`;

    // 1. Health Checks
    console.log("1. Checking Health Endpoints...");
    const nodeHealth = await nodeApi("GET", "/api/health");
    console.log("   Node.js Health:", nodeHealth.status, nodeHealth.body.status);
    if (nodeHealth.status !== 200) throw new Error("Node.js health check failed");

    const servletHealth = await servletApi("GET", "/api/health");
    console.log("   Servlet Health:", servletHealth.status, servletHealth.body.status, "DB connected:", servletHealth.body.databaseConnected);
    if (servletHealth.status !== 200 || !servletHealth.body.databaseConnected) throw new Error("Servlet health check failed");

    // 2. Register Users in Node.js
    console.log("\n2. Registering Students via Node.js API...");
    const reg1 = await nodeApi("POST", "/api/auth/register", {
        name: `Alice Vardhaman ${ts}`,
        email: user1Email,
        password: "Password123!",
        department: "CSE",
        year: 3
    });
    console.log("   Student 1 registered:", reg1.status, reg1.body.userId);
    const u1Id = reg1.body.userId;

    const reg2 = await nodeApi("POST", "/api/auth/register", {
        name: `Bob Vardhaman ${ts}`,
        email: user2Email,
        password: "Password123!",
        department: "ECE",
        year: 3
    });
    console.log("   Student 2 registered:", reg2.status, reg2.body.userId);
    const u2Id = reg2.body.userId;

    const reg3 = await nodeApi("POST", "/api/auth/register", {
        name: `Charlie CBIT ${ts}`,
        email: user3Email,
        password: "Password123!",
        department: "IT",
        year: 4
    });
    console.log("   Student 3 registered (different college):", reg3.status, reg3.body.userId);
    const u3Id = reg3.body.userId;

    // Login to get tokens
    const log1 = await nodeApi("POST", "/api/auth/login", { email: user1Email, password: "Password123!" });
    const log2 = await nodeApi("POST", "/api/auth/login", { email: user2Email, password: "Password123!" });
    const log3 = await nodeApi("POST", "/api/auth/login", { email: user3Email, password: "Password123!" });
    const t1 = log1.body.token;
    const t2 = log2.body.token;
    const t3 = log3.body.token;

    // 3. College Verification via Java Servlet
    console.log("\n3. Testing College Verification (Java Servlets)...");
    
    // College 1: Vardhaman (collegeId: 1, domain: student.vardhaman.org)
    // College 2: CBIT (collegeId: 2, domain: student.cbit.ac.in)
    
    // Request OTP for Student 1 (Vardhaman)
    const otpReq1 = await servletApi("POST", "/api/verification/request-otp", {
        userId: u1Id,
        collegeId: 1,
        institutionalEmail: `alice_${ts}@student.vardhaman.org`
    }, t1);
    console.log("   Student 1 OTP requested:", otpReq1.status, "devOtp:", otpReq1.body.devOtp);
    const devOtp1 = otpReq1.body.devOtp;

    // Verify OTP for Student 1
    const verify1 = await servletApi("POST", "/api/verification/verify-otp", {
        userId: u1Id,
        otp: devOtp1
    }, t1);
    console.log("   Student 1 OTP verified:", verify1.status, verify1.body.status.verificationStatus);
    if (verify1.body.status.verificationStatus !== "VERIFIED") throw new Error("Student 1 verification failed");

    // Request & Verify OTP for Student 2 (Vardhaman - same college)
    const otpReq2 = await servletApi("POST", "/api/verification/request-otp", {
        userId: u2Id,
        collegeId: 1,
        institutionalEmail: `bob_${ts}@student.vardhaman.org`
    }, t2);
    const verify2 = await servletApi("POST", "/api/verification/verify-otp", {
        userId: u2Id,
        otp: otpReq2.body.devOtp
    }, t2);
    console.log("   Student 2 OTP verified (Same College):", verify2.status, verify2.body.status.verificationStatus);

    // Request & Verify OTP for Student 3 (Stanford - different college, collegeId: 4)
    const otpReq3 = await servletApi("POST", "/api/verification/request-otp", {
        userId: u3Id,
        collegeId: 4,
        institutionalEmail: `charlie_${ts}@stanford.edu`
    }, t3);
    console.log("   Student 3 OTP requested:", otpReq3.status, "devOtp:", otpReq3.body.devOtp);
    const verify3 = await servletApi("POST", "/api/verification/verify-otp", {
        userId: u3Id,
        otp: otpReq3.body.devOtp
    }, t3);
    console.log("   Student 3 OTP verified (Different College - Stanford):", verify3.status, verify3.body.status.verificationStatus);

    // 4. Skills Addition via Node.js
    console.log("\n4. Adding Student Skills...");
    // Let's add skills for Student 1 (teaches Java, wants React)
    await nodeApi("POST", "/api/skills/add", {
        userId: u1Id,
        skillName: `Core Java ${ts}`,
        category: "Programming",
        skillType: "OFFER",
        skillLevel: "ADVANCED"
    });
    await nodeApi("POST", "/api/skills/add", {
        userId: u1Id,
        skillName: `React JS ${ts}`,
        category: "Web Development",
        skillType: "WANT",
        skillLevel: "BEGINNER"
    });

    // Student 2 (teaches React, wants Java)
    await nodeApi("POST", "/api/skills/add", {
        userId: u2Id,
        skillName: `React JS ${ts}`,
        category: "Web Development",
        skillType: "OFFER",
        skillLevel: "INTERMEDIATE"
    });
    await nodeApi("POST", "/api/skills/add", {
        userId: u2Id,
        skillName: `Core Java ${ts}`,
        category: "Programming",
        skillType: "WANT",
        skillLevel: "BEGINNER"
    });

    // Student 3 (Stanford, teaches Python)
    await nodeApi("POST", "/api/skills/add", {
        userId: u3Id,
        skillName: `Python AI ${ts}`,
        category: "AI",
        skillType: "OFFER",
        skillLevel: "ADVANCED"
    });

    // Fetch actual skill records from database
    const u1SkillsRes = await nodeApi("GET", `/api/skills/${u1Id}`);
    const u2SkillsRes = await nodeApi("GET", `/api/skills/${u2Id}`);
    const u3SkillsRes = await nodeApi("GET", `/api/skills/${u3Id}`);

    const u1JavaSkill = u1SkillsRes.body.find(s => s.skill_type === "OFFER");
    const u2ReactSkill = u2SkillsRes.body.find(s => s.skill_type === "OFFER");
    const u3PythonSkill = u3SkillsRes.body.find(s => s.skill_type === "OFFER");

    console.log("   Skills added and verified:", {
        u1JavaId: u1JavaSkill.skill_id,
        u2ReactId: u2ReactSkill.skill_id,
        u3PythonId: u3PythonSkill.skill_id
    });

    // 5. Matching & Searching
    console.log("\n5. Searching Student Tutors...");
    const searchRes = await nodeApi("GET", `/api/match/search?excludeUserId=${u1Id}&collegeId=1`);
    console.log("   Same-college search results count:", searchRes.body.length);
    const foundBob = searchRes.body.find(s => s.user_id === u2Id);
    console.log("   Found Bob in same college search:", !!foundBob, "College:", foundBob?.college_name);
    if (!foundBob) throw new Error("Bob not found in same-college search");

    // 6. Cross-College Swap Request Blocking (Node.js Enforcement)
    console.log("\n6. Testing Cross-College Swap Restriction (College 1 vs College 2)...");
    const crossSwap = await nodeApi("POST", "/api/swap/request", {
        senderId: u1Id,
        receiverId: u3Id,
        skillOffered: u1JavaSkill.skill_id,   // Java
        skillRequested: u3PythonSkill.skill_id // Python
    });
    console.log("   Cross-college swap attempt status:", crossSwap.status, "(Expected: 403)");
    console.log("   Cross-college response message:", crossSwap.body.message);
    if (crossSwap.status !== 403) throw new Error("Cross-college swap was not blocked!");

    // 7. Same-College Swap Request Allowing
    console.log("\n7. Testing Same-College Swap Request...");
    const sameSwap = await nodeApi("POST", "/api/swap/request", {
        senderId: u1Id,
        receiverId: u2Id,
        skillOffered: u1JavaSkill.skill_id,  // Java
        skillRequested: u2ReactSkill.skill_id // React
    });
    console.log("   Same-college swap status:", sameSwap.status, "Request ID:", sameSwap.body.requestId);
    if (sameSwap.status !== 201) throw new Error("Same-college swap failed!");
    const requestId = sameSwap.body.requestId;

    // 8. Accept Swap Request
    console.log("\n8. Accepting Swap Request...");
    const acceptRes = await nodeApi("PUT", `/api/swap/respond/${requestId}`, {
        status: "ACCEPTED",
        userId: u2Id
    });
    console.log("   Swap request accepted status:", acceptRes.status, acceptRes.body.status);

    // 9. Schedule Session
    console.log("\n9. Scheduling Skill Exchange Session...");
    const schedRes = await nodeApi("POST", "/api/sessions/schedule", {
        requestId: requestId,
        userId: u1Id,
        sessionDate: "2026-10-25",
        sessionTime: "14:00:00",
        duration: 60,
        mode: "ONLINE"
    });
    console.log("   Session scheduled status:", schedRes.status, "Session ID:", schedRes.body.sessionId);
    if (schedRes.status !== 201) throw new Error("Session scheduling failed");
    const sessionId = schedRes.body.sessionId;

    // 10. Java Servlet Online Meeting Scheduling
    console.log("\n10. Scheduling Online Meeting via Java Servlet...");
    const meetSched = await servletApi("POST", "/api/meetings/schedule", {
        userId: u1Id,
        sessionId: sessionId,
        title: "Peer Skill Exchange: Java & React",
        durationMinutes: 60
    }, t1);
    console.log("   Meeting schedule status:", meetSched.status);
    console.log("   Meeting Room:", meetSched.body.meeting.roomName);
    console.log("   Meeting Jitsi URL:", meetSched.body.meeting.jitsiUrl);
    console.log("   Meeting Passcode:", meetSched.body.meeting.passcode);
    if (meetSched.status !== 201 || !meetSched.body.meeting.jitsiUrl) {
        throw new Error("Online meeting generation failed");
    }

    // 11. Meeting Access Authorization Check
    console.log("\n11. Testing Meeting Participant Retrieval Authorization...");
    // Alice (Participant 1)
    const getAlice = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}&userId=${u1Id}`, null, t1);
    console.log("   Alice (Participant 1) retrieval:", getAlice.status, "Passcode retrieved:", getAlice.body.meeting.passcode);
    if (getAlice.status !== 200) throw new Error("Alice could not retrieve meeting");

    // Bob (Participant 2)
    const getBob = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}&userId=${u2Id}`, null, t2);
    console.log("   Bob (Participant 2) retrieval:", getBob.status, "Passcode retrieved:", getBob.body.meeting.passcode);
    if (getBob.status !== 200) throw new Error("Bob could not retrieve meeting");

    // Charlie (Unauthorized Outsider - College 2)
    const getCharlie = await servletApi("GET", `/api/meetings/session?sessionId=${sessionId}&userId=${u3Id}`, null, t3);
    console.log("   Charlie (Outsider) retrieval:", getCharlie.status, "(Expected: 403 Forbidden)");
    if (getCharlie.status !== 403) throw new Error("Unauthorized user was not blocked from meeting!");

    // 12. Check Node.js sessions endpoint for meeting linkage
    console.log("\n12. Verifying Session List reflects Online Meeting info...");
    const user1Sessions = await nodeApi("GET", `/api/sessions/user/${u1Id}`);
    const sessRow = user1Sessions.body.find(s => s.session_id === sessionId);
    console.log("   Session row retrieved from Node.js:", {
        session_id: sessRow.session_id,
        mode: sessRow.mode,
        meeting_id: sessRow.meeting_id,
        meeting_status: sessRow.meeting_status
    });
    if (!sessRow.meeting_id) throw new Error("Meeting ID was not linked to session row");

    // 13. Complete Session & Meeting Lifecycle
    console.log("\n13. Completing Online Meeting via Java Servlet...");
    const completeMeeting = await servletApi("PUT", "/api/meetings/status", {
        meetingId: meetSched.body.meeting.meetingId,
        userId: u1Id,
        status: "COMPLETED"
    }, t1);
    console.log("   Meeting status updated to COMPLETED:", completeMeeting.status, completeMeeting.body.meeting.status);

    // 14. Submit Peer Review in Node.js
    console.log("\n14. Submitting Review for Session...");
    const revRes = await nodeApi("POST", "/api/reviews/add", {
        sessionId: sessionId,
        reviewerId: u1Id,
        rating: 5,
        comment: "Outstanding peer session! Explained React hooks crystal clear."
    });
    console.log("   Review added status:", revRes.status, revRes.body.message);

    const getReviews = await nodeApi("GET", `/api/reviews/user/${u2Id}`);
    console.log("   Bob's received reviews count:", getReviews.body.reviews.length, "Rating:", getReviews.body.reviews[0].rating);

    console.log("\n=============================================================");
    console.log("🎉 ALL E2E INTEGRATION TESTS PASSED PERFECTLY!");
    console.log("=============================================================\n");
}

runTest().catch(err => {
    console.error("\n❌ E2E Test Failed:", err);
    process.exit(1);
});
