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

    private void handleSchedule(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        JSONObject body = JsonUtil.readJson(req);

        int authUid = JwtUtil.getAuthenticatedUserId(req);
        int userId = body.optInt("userId", authUid > 0 ? authUid : -1);
        int sessionId = body.optInt("sessionId", -1);
        int duration = body.optInt("durationMinutes", 60);
        String title = body.optString("title", "").trim();
        String startStr = body.optString("scheduledStart", "").trim();

        if (userId <= 0 || sessionId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valid userId and sessionId are required to schedule an online meeting.");
            return;
        }

        Timestamp scheduledStart = null;
        if (!startStr.isEmpty()) {
            try {
                // Accepts "2026-10-25 14:00:00" or ISO timestamps
                String norm = startStr.replace("T", " ");
                if (norm.length() == 16) norm += ":00";
                scheduledStart = Timestamp.valueOf(norm);
            } catch (Exception e) {
                // Fallback: 10 mins from now
                scheduledStart = new Timestamp(System.currentTimeMillis() + 600000);
            }
        }

        try {
            MeetingService.MeetingResult result = meetingService.scheduleMeeting(sessionId, userId, scheduledStart, duration, title);
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

    private void handleGetSessionMeeting(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        int authUid = JwtUtil.getAuthenticatedUserId(req);
        int userId = authUid > 0 ? authUid : -1;
        String uidParam = req.getParameter("userId");
        if (uidParam != null && !uidParam.trim().isEmpty()) {
            try { userId = Integer.parseInt(uidParam.trim()); } catch (NumberFormatException ignored) {}
        }

        int sessionId = -1;
        String sessParam = req.getParameter("sessionId");
        if (sessParam != null && !sessParam.trim().isEmpty()) {
            try { sessionId = Integer.parseInt(sessParam.trim()); } catch (NumberFormatException ignored) {}
        }

        if (userId <= 0 || sessionId <= 0) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valid userId and sessionId query parameters are required.");
            return;
        }

        try {
            MeetingService.MeetingResult result = meetingService.getMeetingForSession(sessionId, userId);
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

    private void handleGetUserMeetings(HttpServletRequest req, HttpServletResponse resp) throws IOException {
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
            List<OnlineMeeting> meetings = meetingService.getUserMeetings(userId);
            JSONArray arr = new JSONArray();
            for (OnlineMeeting m : meetings) {
                arr.put(m.toJsonObject());
            }

            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("count", meetings.size());
            res.put("meetings", arr);
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [MeetingServlet] DB error retrieving user meetings: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error retrieving user meetings.");
        }
    }

    private void handleUpdateStatus(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        JSONObject body = JsonUtil.readJson(req);

        int authUid = JwtUtil.getAuthenticatedUserId(req);
        int userId = body.optInt("userId", authUid > 0 ? authUid : -1);
        int meetingId = body.optInt("meetingId", -1);
        String status = body.optString("status", "").trim();

        if (userId <= 0 || meetingId <= 0 || status.isEmpty()) {
            JsonUtil.sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "meetingId, userId, and new status are required.");
            return;
        }

        try {
            MeetingService.MeetingResult result = meetingService.updateMeetingStatus(meetingId, userId, status);
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
