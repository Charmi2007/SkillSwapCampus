const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/auth");
const skillRoutes = require("./routes/skills");
const matchRoutes = require("./routes/match");
const swapRoutes = require("./routes/swap");
const sessionRoutes = require("./routes/sessions");
const reviewRoutes = require("./routes/reviews");

const app = express();

// Configure CORS for production and development
const corsOptions = {
    origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map(url => url.trim())
        : true, // Dynamically allow request origin when CORS_ORIGIN is not specified
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());

// Production-safe path to serve frontend static assets
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// API health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "SkillSwap Campus API is running!",
        environment: process.env.NODE_ENV || "development"
    });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/swap", swapRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/reviews", reviewRoutes);

// Fallback for non-API client routes to serve frontend index.html (Express 5 compatible)
app.use((req, res) => {
    if (req.path.startsWith("/api")) {
        return res.status(404).json({ message: "API endpoint not found" });
    }
    res.sendFile(path.join(frontendPath, "index.html"));
});

// Production-safe port configuration
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 SkillSwap Campus server running on port ${PORT}`);
});