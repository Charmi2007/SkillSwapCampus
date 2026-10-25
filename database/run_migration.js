const db = require('../backend/config/db');

async function runMigration() {
    try {
        console.log("Applying database migration v2...");

        // 1. Colleges Table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS colleges (
                college_id INT AUTO_INCREMENT PRIMARY KEY,
                college_name VARCHAR(150) NOT NULL,
                email_domain VARCHAR(100) NOT NULL UNIQUE,
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100) DEFAULT 'India',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ colleges table created.");

        // Seed initial colleges
        await db.promise().query(`
            INSERT IGNORE INTO colleges (college_id, college_name, email_domain, city, state, country) VALUES
            (1, 'Vardhaman College of Engineering', 'student.vardhaman.org', 'Hyderabad', 'Telangana', 'India'),
            (2, 'Vardhaman College of Engineering (Staff)', 'vardhaman.org', 'Hyderabad', 'Telangana', 'India'),
            (3, 'National College of Engineering', 'college.edu', 'Bangalore', 'Karnataka', 'India'),
            (4, 'Stanford University', 'stanford.edu', 'Stanford', 'California', 'USA'),
            (5, 'Massachusetts Institute of Technology', 'mit.edu', 'Cambridge', 'Massachusetts', 'USA'),
            (6, 'Indian Institute of Technology', 'iit.ac.in', 'Delhi', 'Delhi', 'India'),
            (7, 'SkillSwap Campus Demo College', 'campus.edu', 'Mumbai', 'Maharashtra', 'India');
        `);
        console.log("✅ colleges seeded.");

        // 2. Check and add columns on users table
        const [cols] = await db.promise().query('DESCRIBE users;');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('college_id')) {
            await db.promise().query('ALTER TABLE users ADD COLUMN college_id INT NULL, ADD CONSTRAINT fk_user_college FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE SET NULL;');
            console.log("✅ Added college_id column to users table.");
        }
        if (!colNames.includes('institutional_email')) {
            await db.promise().query('ALTER TABLE users ADD COLUMN institutional_email VARCHAR(150) NULL;');
            console.log("✅ Added institutional_email column to users table.");
        }
        if (!colNames.includes('verification_status')) {
            await db.promise().query("ALTER TABLE users ADD COLUMN verification_status ENUM('UNVERIFIED', 'PENDING', 'VERIFIED') DEFAULT 'UNVERIFIED';");
            console.log("✅ Added verification_status column to users table.");
        }
        if (!colNames.includes('verified_at')) {
            await db.promise().query('ALTER TABLE users ADD COLUMN verified_at TIMESTAMP NULL;');
            console.log("✅ Added verified_at column to users table.");
        }

        // 3. College Verifications Table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS college_verifications (
                verification_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                college_id INT NOT NULL,
                institutional_email VARCHAR(150) NOT NULL,
                otp_code VARCHAR(10) NOT NULL,
                verification_token VARCHAR(100) NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                attempts INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_token (verification_token)
            );
        `);
        console.log("✅ college_verifications table created.");

        // 4. Online Meetings Table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS online_meetings (
                meeting_id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                host_user_id INT NOT NULL,
                participant_user_id INT NOT NULL,
                college_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                room_name VARCHAR(150) NOT NULL UNIQUE,
                passcode VARCHAR(50),
                jitsi_domain VARCHAR(100) NOT NULL,
                meeting_url VARCHAR(500) NOT NULL,
                scheduled_start DATETIME NOT NULL,
                duration_minutes INT DEFAULT 60,
                status ENUM('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'SCHEDULED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
                FOREIGN KEY (host_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (participant_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (college_id) REFERENCES colleges(college_id) ON DELETE CASCADE,
                INDEX idx_session_id (session_id),
                INDEX idx_host_participant (host_user_id, participant_user_id)
            );
        `);
        console.log("✅ online_meetings table created.");

        const [tables] = await db.promise().query('SHOW TABLES;');
        console.log("All tables in database:", tables.map(t => Object.values(t)[0]));

        console.log("🎉 Database Migration v2 applied successfully without disrupting existing data!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

runMigration();
