package com.skillswap.servlet;

import com.skillswap.model.UserCollegeStatus;
import com.skillswap.service.CollegeVerificationService;
import com.skillswap.util.JsonUtil;
import com.skillswap.util.JwtUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONObject;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Optional;

@WebServlet(urlPatterns = {
    "/api/verification/request-otp",
    "/api/verification/verify-otp",
    "/api/verification/status"
})
public class CollegeVerificationServlet extends HttpServlet {

    private final CollegeVerificationService verificationService = new CollegeVerificationService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/verification/status".equals(path)) {
            handleStatus(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/verification/request-otp".equals(path)) {
            handleRequestOtp(req, resp);
        } else if ("/api/verification/verify-otp".equals(path)) {
            handleVerifyOtp(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    private void handleStatus(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        int userId = resolveUserId(req);
        if (userId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required or userId must be specified.");
            return;
        }

        try {
            Optional<UserCollegeStatus> statusOpt = verificationService.getUserStatus(userId);
            if (statusOpt.isEmpty()) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Student not found.");
                return;
            }

            JSONObject json = new JSONObject();
            json.put("success", true);
            json.put("status", statusOpt.get().toJsonObject());
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, json);
        } catch (SQLException e) {
            System.err.println("❌ [CollegeVerificationServlet] DB error: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error retrieving verification status.");
        }
    }

    private void handleRequestOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        JSONObject body = JsonUtil.readJson(req);
        int userId = resolveUserIdFromBodyOrAuth(req, body);
        String email = body.optString("institutionalEmail", "").trim();

        if (userId <= 0 || email.isEmpty()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "User ID and valid institutional email are required.");
            return;
        }

        try {
            CollegeVerificationService.VerificationRequestResult result = verificationService.requestVerificationOtp(userId, email);
            if (!result.success) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, result.message);
                return;
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("message", result.message);
            res.put("verificationToken", result.token);
            res.put("collegeName", result.collegeName);
            res.put("collegeId", result.collegeId);
            if (result.devOtp != null) {
                res.put("devOtp", result.devOtp); // Included for local test automation
            }
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [CollegeVerificationServlet] DB error: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error during OTP request.");
        }
    }

    private void handleVerifyOtp(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        JSONObject body = JsonUtil.readJson(req);
        int userId = resolveUserIdFromBodyOrAuth(req, body);
        String token = body.optString("verificationToken", "").trim();
        String otp = body.optString("otpCode", "").trim();
        if (otp.isEmpty()) {
            otp = body.optString("otp", "").trim();
        }

        if (userId <= 0 || otp.isEmpty()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "User ID and OTP code are required.");
            return;
        }

        try {
            CollegeVerificationService.VerificationResult result = verificationService.verifyOtp(userId, token, otp);
            if (!result.success) {
                JsonUtil.sendError(resp, result.statusCode, result.message);
                return;
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("message", result.message);
            if (result.userStatus != null) {
                res.put("status", result.userStatus.toJsonObject());
            }
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [CollegeVerificationServlet] DB error: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error verifying OTP.");
        }
    }

    private int resolveUserId(HttpServletRequest req) {
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        if (authUid > 0) return authUid;
        String uidParam = req.getParameter("userId");
        if (uidParam != null && !uidParam.trim().isEmpty()) {
            try { return Integer.parseInt(uidParam.trim()); } catch (NumberFormatException ignored) {}
        }
        return -1;
    }

    private int resolveUserIdFromBodyOrAuth(HttpServletRequest req, JSONObject body) {
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        if (authUid > 0) return authUid;
        int bodyUid = body.optInt("userId", -1);
        if (bodyUid > 0) return bodyUid;
        return resolveUserId(req);
    }
}
