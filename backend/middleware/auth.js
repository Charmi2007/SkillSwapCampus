const jwt = require("jsonwebtoken");

// Securely check for JWT_SECRET - fail startup if missing or empty
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || !JWT_SECRET.trim()) {
    throw new Error(
        "FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing or empty. " +
        "Please configure JWT_SECRET securely in your environment or .env file."
    );
}

/**
 * Middleware to authenticate requests using JWT Bearer token.
 * Populates req.user with decoded payload: { userId, email, name, role, ... }
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    let token = null;

    if (authHeader && typeof authHeader === "string") {
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        } else {
            token = authHeader.trim();
        }
    }

    if (!token) {
        return res.status(401).json({
            message: "Authentication token required. Please log in."
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                message: "Invalid or expired authentication token. Please log in again."
            });
        }

        req.user = decoded;
        next();
    });
}

/**
 * Middleware to authorize access to user-specific resources (:userId).
 * Allows access only if the authenticated user matches :userId, or has an explicitly authorized admin role.
 */
function authorizeUserOrAdmin(req, res, next) {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    const targetUserId = parseInt(req.params.userId, 10);
    if (isNaN(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({
            message: "Invalid user ID provided in request parameters."
        });
    }

    const currentUserId = parseInt(req.user.userId, 10);
    const userRole = (req.user.role || "").toLowerCase();

    // Allow user to access their own resources, or allow authorized admin
    if (currentUserId === targetUserId || userRole === "admin") {
        return next();
    }

    return res.status(403).json({
        message: "Forbidden: You are only authorized to access or modify your own profile."
    });
}

module.exports = {
    authenticateToken,
    authorizeUserOrAdmin,
    JWT_SECRET
};
