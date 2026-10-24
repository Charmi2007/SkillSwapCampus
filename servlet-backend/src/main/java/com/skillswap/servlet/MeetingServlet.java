package com.skillswap.servlet;

import com.skillswap.model.OnlineMeeting;
import com.skillswap.service.MeetingService;
import com.skillswap.util.JsonUtil;
import com.skillswap.util.JwtUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;

@WebServlet(urlPatterns = {
    "/api/meetings/schedule",
    "/api/meetings/session",
    "/api/meetings/user",
    "/api/meetings/status"
})
public class MeetingServlet extends HttpServlet {

    private final MeetingService meetingService = new MeetingService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/meetings/session".equals(path)) {
            handleGetSessionMeeting(req, resp);
        } else if ("/api/meetings/user".equals(path)) {
            handleGetUserMeetings(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/meetings/schedule".equals(path)) {
            handleSchedule(req, resp);
        } else if ("/api/meetings/status".equals(path)) {
            handleUpdateStatus(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getServletPath();
        if ("/api/meetings/status".equals(path)) {
            handleUpdateStatus(req, resp);
        } else {
            JsonUtil.sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
        }
    }

    /**
     * POST /api/meetings/schedule
     * Requires valid JWT. Derives acting identity from JWT. Rejects body userId spoofing with 403.
     * Validates sessionId, durationMinutes, title length, and scheduledStart strictly.
     */
    private void handleSchedule(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // 1. Authentication check
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        if (authUid <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required. Missing, invalid, or expired token.");
            return;
        }

        boolean isAdmin = JwtUtil.isAdmin(req);
        JSONObject body = JsonUtil.readJson(req);

        // 2. User ID protection & validation: reject non-positive userId or impersonation
        if (body.has("userId") && !body.isNull("userId")) {
            int bodyUid = body.optInt("userId", -1);
            if (bodyUid <= 0) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid userId in request body: must be a positive integer.");
                return;
            }
            if (bodyUid != authUid && !isAdmin) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Forbidden: User impersonation detected in request body.");
                return;
            }
        }
        int userId = authUid;

        // 3. Input validation: sessionId
        int sessionId = body.optInt("sessionId", -1);
        if (sessionId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valid positive integer sessionId is required to schedule an online meeting.");
            return;
        }

        // 4. Input validation: durationMinutes (15 to 480 minutes)
        int duration = 60;
        if (body.has("durationMinutes") && !body.isNull("durationMinutes")) {
            duration = body.optInt("durationMinutes", -1);
            if (duration < 15 || duration > 480) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "durationMinutes must be between 15 and 480.");
                return;
            }
        }

        // 5. Input validation: title length
        String title = body.optString("title", "").trim();
        if (title.length() > 255) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Meeting title cannot exceed 255 characters.");
            return;
        }

        // 6. Strict validation: scheduledStart
        Timestamp scheduledStart = null;
        if (body.has("scheduledStart") && !body.isNull("scheduledStart")) {
            Object rawStart = body.get("scheduledStart");
            if (rawStart instanceof String) {
                String startStr = ((String) rawStart).trim();
                if (!startStr.isEmpty()) {
                    try {
                        String norm = startStr.replace("T", " ");
                        if (norm.length() == 16) norm += ":00";
                        scheduledStart = Timestamp.valueOf(norm);
                    } catch (IllegalArgumentException e) {
                        JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid scheduledStart timestamp format. Must be YYYY-MM-DD HH:MM:SS or ISO-8601.");
                        return;
                    }
                }
            } else {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "scheduledStart must be a valid date-time string.");
                return;
            }
        }

        try {
            MeetingService.MeetingResult result = meetingService.scheduleMeeting(sessionId, userId, scheduledStart, duration, title, isAdmin);
            if (!result.success) {
                JsonUtil.sendError(resp, result.statusCode, result.message);
                return;
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("message", result.message);
            res.put("meeting", result.meeting.toJsonObject());
            JsonUtil.sendJson(resp, result.statusCode, res);
        } catch (SQLException e) {
            System.err.println("❌ [MeetingServlet] DB error scheduling meeting: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error scheduling online meeting.");
        }
    }

    /**
     * GET /api/meetings/session?sessionId=X&userId=Y
     * Requires valid JWT. Derives acting identity from JWT. Rejects query userId spoofing with 403.
     * Enforces that only authorized participants can retrieve the session meeting.
     */
    private void handleGetSessionMeeting(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // 1. Authentication check
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        if (authUid <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required. Missing, invalid, or expired token.");
            return;
        }

        boolean isAdmin = JwtUtil.isAdmin(req);

        // 2. User ID protection & validation: reject non-positive userId or impersonation
        String uidParam = req.getParameter("userId");
        if (uidParam != null && !uidParam.trim().isEmpty()) {
            try {
                int paramUid = Integer.parseInt(uidParam.trim());
                if (paramUid <= 0) {
                    JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid userId query parameter. Must be a positive integer.");
                    return;
                }
                if (paramUid != authUid && !isAdmin) {
                    JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Forbidden: User impersonation detected in query parameters.");
                    return;
                }
            } catch (NumberFormatException e) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid userId query parameter. Must be a positive integer.");
                return;
            }
        }
        int userId = authUid;

        // 3. Input validation: sessionId
        int sessionId;
        String sessParam = req.getParameter("sessionId");
        if (sessParam == null || sessParam.trim().isEmpty()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "sessionId query parameter is required.");
            return;
        }
        try {
            sessionId = Integer.parseInt(sessParam.trim());
        } catch (NumberFormatException e) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid sessionId query parameter. Must be a positive integer.");
            return;
        }

        if (sessionId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valid positive integer sessionId query parameter is required.");
            return;
        }

        try {
            MeetingService.MeetingResult result = meetingService.getMeetingForSession(sessionId, userId, isAdmin);
            if (!result.success) {
                JsonUtil.sendError(resp, result.statusCode, result.message);
                return;
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("meeting", result.meeting.toJsonObject());
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [MeetingServlet] DB error retrieving session meeting: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error retrieving online meeting.");
        }
    }

    /**
     * GET /api/meetings/user?userId=X
     * Requires valid JWT. Derives acting identity from JWT. Allows users to retrieve only their own meetings.
     */
    private void handleGetUserMeetings(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // 1. Authentication check
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        if (authUid <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required. Missing, invalid, or expired token.");
            return;
        }

        boolean isAdmin = JwtUtil.isAdmin(req);

        // 2. User ID protection & validation: reject non-positive userId or impersonation
        int targetUserId = authUid;
        String uidParam = req.getParameter("userId");
        if (uidParam != null && !uidParam.trim().isEmpty()) {
            try {
                int paramUid = Integer.parseInt(uidParam.trim());
                if (paramUid <= 0) {
                    JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid userId query parameter. Must be a positive integer.");
                    return;
                }
                if (paramUid != authUid && !isAdmin) {
                    JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Forbidden: You are only authorized to view your own meetings.");
                    return;
                }
                targetUserId = paramUid;
            } catch (NumberFormatException e) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid userId query parameter. Must be a positive integer.");
                return;
            }
        }

        try {
            List<OnlineMeeting> meetings = meetingService.getUserMeetings(targetUserId, authUid, isAdmin);
            JSONArray arr = new JSONArray();
            for (OnlineMeeting m : meetings) {
                arr.put(m.toJsonObject());
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("count", meetings.size());
            res.put("meetings", arr);
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SecurityException e) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN, e.getMessage());
        } catch (IllegalArgumentException e) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (SQLException e) {
            System.err.println("❌ [MeetingServlet] DB error retrieving user meetings: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error retrieving user meetings.");
        }
    }

    /**
     * PUT or POST /api/meetings/status
     * Requires valid JWT. Derives acting identity from JWT. Rejects body userId spoofing with 403.
     * Enforces that only authorized participants can alter meeting status.
     */
    private void handleUpdateStatus(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // 1. Authentication check
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        if (authUid <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required. Missing, invalid, or expired token.");
            return;
        }

        boolean isAdmin = JwtUtil.isAdmin(req);
        JSONObject body = JsonUtil.readJson(req);

        // 2. User ID protection & validation: reject non-positive userId or impersonation
        if (body.has("userId") && !body.isNull("userId")) {
            int bodyUid = body.optInt("userId", -1);
            if (bodyUid <= 0) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid userId in request body: must be a positive integer.");
                return;
            }
            if (bodyUid != authUid && !isAdmin) {
                JsonUtil.sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Forbidden: User impersonation detected in request body.");
                return;
            }
        }
        int userId = authUid;

        // 3. Input validation: meetingId
        int meetingId = body.optInt("meetingId", -1);
        if (meetingId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valid positive integer meetingId is required.");
            return;
        }

        // 4. Input validation: status
        String status = body.optString("status", "").trim();
        if (status.isEmpty()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Meeting status is required.");
            return;
        }
        String upperStatus = status.toUpperCase();
        if (!"SCHEDULED".equals(upperStatus) && !"ACTIVE".equals(upperStatus) &&
            !"COMPLETED".equals(upperStatus) && !"CANCELLED".equals(upperStatus)) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid meeting status: " + status + ". Allowed statuses are SCHEDULED, ACTIVE, COMPLETED, CANCELLED.");
            return;
        }

        try {
            MeetingService.MeetingResult result = meetingService.updateMeetingStatus(meetingId, userId, upperStatus, isAdmin);
            if (!result.success) {
                JsonUtil.sendError(resp, result.statusCode, result.message);
                return;
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("message", result.message);
            res.put("meeting", result.meeting.toJsonObject());
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [MeetingServlet] DB error updating meeting status: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error updating meeting status.");
        }
    }
}
