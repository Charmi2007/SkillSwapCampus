// Automated Security and Authentication Test Suite for SkillSwap Campus
// Tests backend/routes/auth.js and backend/middleware/auth.js

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

async function runSecurityTests() {
    console.log("=============================================================");
    console.log("   SkillSwap Campus - Auth Security & RBAC Test Suite");
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
    const userA_email = `sec_user_a_${ts}@test.com`;
    const userB_email = `sec_user_b_${ts}@test.com`;
    const password = "ValidPassword123!";

    // --- TEST 1: Missing JWT_SECRET Startup Failure ---
    console.log("1. Testing JWT_SECRET Enforcement (Startup Protection)...");
    try {
        // Save current JWT_SECRET
        const originalSecret = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        delete require.cache[require.resolve("./middleware/auth")];

        let threwError = false;
        try {
            require("./middleware/auth");
        } catch (err) {
            threwError = true;
            assert(err.message.includes("FATAL CONFIGURATION ERROR: JWT_SECRET"), 
                   "Fails startup immediately when JWT_SECRET is missing");
        }
        assert(threwError, "Throws fatal error when JWT_SECRET is unset");

        // Restore JWT_SECRET
        process.env.JWT_SECRET = originalSecret;
        delete require.cache[require.resolve("./middleware/auth")];
        require("./middleware/auth");
    } catch (e) {
        assert(false, "JWT_SECRET check failed", e.message);
    }

    // --- TEST 2: Registration Input Validation ---
    console.log("\n2. Testing Registration Input Validation...");
    
    // Empty name
    const regNoName = await api("POST", "/api/auth/register", {
        name: "   ",
        email: `invalid_name_${ts}@test.com`,
        password: password
    });
    assert(regNoName.status === 400, "Rejects registration with empty name (400)");

    // Invalid email format
    const regBadEmail = await api("POST", "/api/auth/register", {
        name: "Test User",
        email: "not-an-email",
        password: password
    });
    assert(regBadEmail.status === 400, "Rejects registration with invalid email format (400)");

    // Weak / Short password (< 6 chars)
    const regShortPass = await api("POST", "/api/auth/register", {
        name: "Test User",
        email: `short_pass_${ts}@test.com`,
        password: "123"
    });
    assert(regShortPass.status === 400, "Rejects registration with short password (400)");

    // Invalid year (> 6)
    const regBadYear = await api("POST", "/api/auth/register", {
        name: "Test User",
        email: `bad_year_${ts}@test.com`,
        password: password,
        year: 10
    });
    assert(regBadYear.status === 400, "Rejects registration with invalid year > 6 (400)");

    // Valid registration User A
    const regA = await api("POST", "/api/auth/register", {
        name: "Security User A",
        email: userA_email,
        password: password,
        department: "CSE",
        year: 2
    });
    assert(regA.status === 201 && regA.body.userId, "Registers valid User A successfully (201)");
    const userA_id = regA.body.userId;

    // Valid registration User B
    const regB = await api("POST", "/api/auth/register", {
        name: "Security User B",
        email: userB_email,
        password: password,
        department: "IT",
        year: 3
    });
    assert(regB.status === 201 && regB.body.userId, "Registers valid User B successfully (201)");
    const userB_id = regB.body.userId;

    // Duplicate email registration
    const regDup = await api("POST", "/api/auth/register", {
        name: "Duplicate User",
        email: userA_email,
        password: password
    });
    assert(regDup.status === 409, "Rejects duplicate email registration (409 Conflict)");

    // --- TEST 3: Login Authentication ---
    console.log("\n3. Testing Login Authentication & Token Issuance...");
    
    // Missing credentials
    const logEmpty = await api("POST", "/api/auth/login", { email: "", password: "" });
    assert(logEmpty.status === 400, "Rejects login with missing credentials (400)");

    // Wrong password
    const logWrongPass = await api("POST", "/api/auth/login", { email: userA_email, password: "WrongPassword!" });
    assert(logWrongPass.status === 401, "Rejects login with incorrect password (401)");

    // Non-existent user
    const logNonExistent = await api("POST", "/api/auth/login", { email: `nonexistent_${ts}@test.com`, password: password });
    assert(logNonExistent.status === 401, "Rejects login for non-existent user with generic 401");

    // Successful login User A
    const logA = await api("POST", "/api/auth/login", { email: userA_email, password: password });
    assert(logA.status === 200 && logA.body.token, "Logs in User A and returns signed JWT token (200)");
    const tokenA = logA.body.token;

    // Successful login User B
    const logB = await api("POST", "/api/auth/login", { email: userB_email, password: password });
    assert(logB.status === 200 && logB.body.token, "Logs in User B and returns signed JWT token (200)");
    const tokenB = logB.body.token;

    // --- TEST 4: Profile Authentication Protection ---
    console.log("\n4. Testing GET /profile/:userId Authentication Protection...");

    // Unauthenticated GET (no token header)
    const getNoToken = await api("GET", `/api/auth/profile/${userA_id}`);
    assert(getNoToken.status === 401, "Blocks unauthenticated GET /profile without token (401)");

    // Invalid / Malformed token
    const getBadToken = await api("GET", `/api/auth/profile/${userA_id}`, null, "this.is.a.bad.token");
    assert(getBadToken.status === 401, "Blocks GET /profile with invalid/corrupt token (401)");

    // --- TEST 5: Profile Ownership Authorization Protection ---
    console.log("\n5. Testing Profile Ownership Authorization (Cross-User Access)...");

    // User A attempting to view User B's profile
    const getOtherProfile = await api("GET", `/api/auth/profile/${userB_id}`, null, tokenA);
    assert(getOtherProfile.status === 403, 
           "Blocks User A from accessing User B's profile (403 Forbidden)", 
           `Actual: ${getOtherProfile.status} - ${JSON.stringify(getOtherProfile.body)}`);

    // User A viewing their own profile
    const getOwnProfile = await api("GET", `/api/auth/profile/${userA_id}`, null, tokenA);
    assert(getOwnProfile.status === 200 && getOwnProfile.body.user.name === "Security User A", 
           "Allows User A to view their own profile (200 OK)");

    // User B viewing their own profile
    const getOwnProfileB = await api("GET", `/api/auth/profile/${userB_id}`, null, tokenB);
    assert(getOwnProfileB.status === 200 && getOwnProfileB.body.user.name === "Security User B", 
           "Allows User B to view their own profile (200 OK)");

    // --- TEST 6: Profile Update Authorization & Input Validation ---
    console.log("\n6. Testing PUT /profile/:userId Authorization & Validation...");

    // Unauthenticated PUT
    const putNoToken = await api("PUT", `/api/auth/profile/${userA_id}`, { name: "Hacked Name" });
    assert(putNoToken.status === 401, "Blocks unauthenticated PUT /profile without token (401)");

    // User A attempting to update User B's profile
    const putOtherProfile = await api("PUT", `/api/auth/profile/${userB_id}`, { name: "Tampered by A" }, tokenA);
    assert(putOtherProfile.status === 403, 
           "Blocks User A from updating User B's profile (403 Forbidden)", 
           `Actual: ${putOtherProfile.status} - ${JSON.stringify(putOtherProfile.body)}`);

    // Invalid year on self-update
    const putBadYear = await api("PUT", `/api/auth/profile/${userA_id}`, { name: "Security User A", year: 99 }, tokenA);
    assert(putBadYear.status === 400, "Rejects self-profile update with invalid year (400)");

    // Empty name on self-update
    const putEmptyName = await api("PUT", `/api/auth/profile/${userA_id}`, { name: "  " }, tokenA);
    assert(putEmptyName.status === 400, "Rejects self-profile update with empty name (400)");

    // Valid self-update by User A
    const putOwnProfile = await api("PUT", `/api/auth/profile/${userA_id}`, {
        name: "Security User A Updated",
        department: "Computer Science",
        year: 3
    }, tokenA);
    assert(putOwnProfile.status === 200 && putOwnProfile.body.name === "Security User A Updated", 
           "Allows User A to update their own profile (200 OK)");

    // Verify User A's updated profile reflects changes
    const verifyUpdated = await api("GET", `/api/auth/profile/${userA_id}`, null, tokenA);
    assert(verifyUpdated.status === 200 && 
           verifyUpdated.body.user.name === "Security User A Updated" &&
           verifyUpdated.body.user.year === 3, 
           "Profile changes accurately persisted in database");

    // Confirm User B's profile was not tampered with
    const verifyUntamperedB = await api("GET", `/api/auth/profile/${userB_id}`, null, tokenB);
    assert(verifyUntamperedB.status === 200 && 
           verifyUntamperedB.body.user.name === "Security User B", 
           "User B's profile remains untampered and intact");

    console.log("\n=============================================================");
    console.log(`   TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log("=============================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runSecurityTests().catch(err => {
    console.error("\n❌ Security Test Suite encountered unexpected error:", err);
    process.exit(1);
});
