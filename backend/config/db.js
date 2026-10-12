const mysql = require("mysql2");
const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

// Create a connection pool for production resilience against timeouts and idle disconnects
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "skillswap_campus",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Verify initial database connectivity
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ MySQL connection pool failed:", err.message);
        return;
    }

    console.log("✅ MySQL connected successfully via connection pool!");
    connection.release();
});

module.exports = db;