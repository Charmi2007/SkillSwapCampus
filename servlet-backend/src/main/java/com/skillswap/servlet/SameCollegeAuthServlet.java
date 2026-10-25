package com.skillswap.servlet;

import com.skillswap.service.SameCollegeAuthService;
import com.skillswap.util.JsonUtil;
import com.skillswap.util.JwtUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONObject;

import java.io.IOException;
import java.sql.SQLException;

@WebServlet(urlPatterns = {
    "/api/college/authorize-peer",
    "/api/college/verify-access"
})
public class SameCollegeAuthServlet extends HttpServlet {

    private final SameCollegeAuthService authService = new SameCollegeAuthService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/college/verify-access".equals(path)) {
            handleVerifyAccess(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/college/authorize-peer".equals(path)) {
            handleAuthorizePeer(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    private void handleAuthorizePeer(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        JSONObject body = JsonUtil.readJson(req);

        int authUid = JwtUtil.getAuthenticatedUserId(req);
        int userId = body.optInt("userId", authUid > 0 ? authUid : -1);
        int peerId = body.optInt("peerId", -1);

        if (userId <= 0 || peerId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valid userId and peerId are required.");
            return;
        }

        try {
            SameCollegeAuthService.PeerAuthResult result = authService.authorizePeerInteraction(userId, peerId);
            if (!result.authorized) {
                JsonUtil.sendError(resp, result.statusCode, result.message);
                return;
            }

            JSONObject res = new JSONObject();
            res.put("authorized", true);
            res.put("message", result.message);
            res.put("collegeId", result.collegeId);
            res.put("collegeName", result.collegeName);
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [SameCollegeAuthServlet] DB error: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error during college authorization.");
        }
    }

    private void handleVerifyAccess(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        int userId = authUid > 0 ? authUid : -1;
        String uidParam = req.getParameter("userId");
        if (uidParam != null && !uidParam.trim().isEmpty()) {
            try { userId = Integer.parseInt(uidParam.trim()); } catch (NumberFormatException ignored) {}
        }

        if (userId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "User ID or authentication token required.");
            return;
        }

        try {
            boolean verified = authService.isUserVerified(userId);
            JSONObject res = new JSONObject();
            res.put("userId", userId);
            res.put("isVerified", verified);
            res.put("accessGranted", verified);
            if (!verified) {
                res.put("reason", "Student must verify institutional email to access same-college features.");
            }
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [SameCollegeAuthServlet] DB error: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error verifying college access.");
        }
    }
}
