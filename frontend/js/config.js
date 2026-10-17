/**
 * SkillSwap Campus - API Configuration
 *
 * Production setup:
 * 1. If backend and frontend are hosted together (e.g. Express on Render, Railway, AWS, etc.):
 *    Leave API_BASE_URL as "" (empty string). The app automatically uses window.location.origin.
 * 2. If frontend is hosted separately (e.g. Vercel, Netlify, GitHub Pages):
 *    Set API_BASE_URL to your deployed backend URL:
 *    Example: API_BASE_URL: "https://MY-BACKEND-URL"
 *
 * Local Development:
 * - Automatically uses current host or falls back to http://localhost:5000.
 */

var API_CONFIG = {
    // Set your production backend URL here if needed (e.g. "https://MY-BACKEND-URL")
    // When left empty, same-origin is used automatically in production
    API_BASE_URL: "",

    // Default fallback for local development when viewing via file://
    DEV_BASE_URL: "http://localhost:5000"
};

// Compute effective API_BASE
var API_BASE = (() => {
    // 1. Explicitly configured production backend URL
    if (API_CONFIG.API_BASE_URL && API_CONFIG.API_BASE_URL.trim() !== "") {
        return API_CONFIG.API_BASE_URL.trim().replace(/\/+$/, "");
    }

    // 2. Web browser over HTTP/HTTPS (auto-detects domain and port)
    if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
        return window.location.origin;
    }

    // 3. Fallback for opening static HTML files via file://
    return API_CONFIG.DEV_BASE_URL;
})();

var SERVLET_CONFIG = {
    // Set your production Java Tomcat backend URL here if needed
    // Example: "https://my-tomcat-host.com/skillswap-servlet"
    // When left empty and in production, falls back to "/skillswap-servlet" or localhost:8080
    SERVLET_BASE_URL: "",

    // Default fallback for local development
    DEV_BASE_URL: "http://localhost:8080/skillswap-servlet"
};

// Compute effective SERVLET_API_BASE
var SERVLET_API_BASE = (() => {
    // 1. Explicitly configured global URL (e.g. injected via window.SERVLET_API_URL)
    if (typeof window !== "undefined" && window.SERVLET_API_URL && window.SERVLET_API_URL.trim() !== "") {
        return window.SERVLET_API_URL.trim().replace(/\/+$/, "");
    }

    // 2. Explicitly configured in config object
    if (SERVLET_CONFIG.SERVLET_BASE_URL && SERVLET_CONFIG.SERVLET_BASE_URL.trim() !== "") {
        return SERVLET_CONFIG.SERVLET_BASE_URL.trim().replace(/\/+$/, "");
    }

    // 3. Fallback for local development
    return SERVLET_CONFIG.DEV_BASE_URL;
})();

// Attach to window object for global availability
if (typeof window !== "undefined") {
    window.API_BASE = API_BASE;
    window.API_CONFIG = API_CONFIG;
    window.SERVLET_API_BASE = SERVLET_API_BASE;
    window.SERVLET_CONFIG = SERVLET_CONFIG;
}
