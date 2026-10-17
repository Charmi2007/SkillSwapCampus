package com.skillswap.service;

import com.skillswap.config.AppConfig;
import com.skillswap.dao.MeetingDao;
import com.skillswap.dao.UserDao;
import com.skillswap.model.OnlineMeeting;
import com.skillswap.util.SecurityUtil;

import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class MeetingService {

    private final MeetingDao meetingDao = new MeetingDao();
    private final UserDao userDao = new UserDao();
    private final SameCollegeAuthService authService = new SameCollegeAuthService();

    public static class MeetingResult {
        public boolean success;
        public int statusCode;
        public String message;
        public OnlineMeeting meeting;
    }

    public MeetingResult scheduleMeeting(int sessionId, int requestingUserId, Timestamp scheduledStart, int durationMinutes, String title) throws SQLException {
        MeetingResult res = new MeetingResult();

        if (sessionId <= 0 || requestingUserId <= 0) {
            res.success = false;
            res.statusCode = 400;
            res.message = "Invalid session ID or user ID.";
            return res;
        }

        // 1. Verify session participants and college
        int[] partAndCol = userDao.getSessionParticipantsAndCollege(sessionId);
        if (partAndCol == null) {
            res.success = false;
            res.statusCode = 404;
            res.message = "Session not found.";
            return res;
        }

        int senderId = partAndCol[0];
        int receiverId = partAndCol[1];
        int hostId = requestingUserId;
        int participantId = (hostId == senderId) ? receiverId : senderId;

        // Ensure requesting user is a legitimate participant
        if (requestingUserId != senderId && requestingUserId != receiverId) {
            res.success = false;
            res.statusCode = 403;
            res.message = "Unauthorized: You are not a participant in this learning exchange session.";
            return res;
        }

        // 2. Enforce same-college verification requirement
        SameCollegeAuthService.PeerAuthResult auth = authService.authorizePeerInteraction(senderId, receiverId);
        if (!auth.authorized) {
            res.success = false;
            res.statusCode = auth.statusCode;
            res.message = auth.message;
            return res;
        }

        int collegeId = auth.collegeId;

        // 3. Check if an active meeting already exists for this session
        Optional<OnlineMeeting> existing = meetingDao.findBySessionId(sessionId);
        if (existing.isPresent() && !"CANCELLED".equalsIgnoreCase(existing.get().getStatus())) {
            res.success = true;
            res.statusCode = 200;
            res.message = "Existing online meeting retrieved for this session.";
            res.meeting = existing.get();
            return res;
        }

        // 4. Generate cryptographically secure, high-entropy Jitsi room name and passcode
        String roomUuid = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String roomName = String.format("SkillSwap-Campus-Col%d-Sess%d-%s", collegeId, sessionId, roomUuid);
        String passcode = SecurityUtil.generateRoomPasscode();
        String jitsiDomain = AppConfig.getJitsiDomain();
        String meetingUrl = SecurityUtil.buildMeetingUrl(roomName);

        // Security validation of generated link against trusted Jitsi domain
        if (!SecurityUtil.isTrustedJitsiUrl(meetingUrl)) {
            res.success = false;
            res.statusCode = 500;
            res.message = "Security check failed: Generated meeting URL does not match trusted Jitsi domain.";
            return res;
        }

        if (title == null || title.trim().isEmpty()) {
            title = "SkillSwap Peer Session #" + sessionId;
        }

        if (scheduledStart == null) {
            scheduledStart = new Timestamp(System.currentTimeMillis() + 600000); // default in 10 mins
        }

        if (durationMinutes <= 0) {
            durationMinutes = 60;
        }

        OnlineMeeting meeting = new OnlineMeeting();
        meeting.setSessionId(sessionId);
        meeting.setHostUserId(hostId);
        meeting.setParticipantUserId(participantId);
        meeting.setCollegeId(collegeId);
        meeting.setTitle(title.trim());
        meeting.setRoomName(roomName);
        meeting.setPasscode(passcode);
        meeting.setJitsiDomain(jitsiDomain);
        meeting.setMeetingUrl(meetingUrl);
        meeting.setScheduledStart(scheduledStart);
        meeting.setDurationMinutes(durationMinutes);
        meeting.setStatus("SCHEDULED");

        int meetingId = meetingDao.createMeeting(meeting);
        if (meetingId <= 0) {
            res.success = false;
            res.statusCode = 500;
            res.message = "Database error creating meeting record.";
            return res;
        }

        meeting.setMeetingId(meetingId);
        res.success = true;
        res.statusCode = 201;
        res.message = "Online Jitsi meeting scheduled successfully!";
        res.meeting = meeting;

        return res;
    }

    public MeetingResult getMeetingForSession(int sessionId, int requestingUserId) throws SQLException {
        MeetingResult res = new MeetingResult();

        if (!userDao.isSessionParticipant(sessionId, requestingUserId)) {
            res.success = false;
            res.statusCode = 403;
            res.message = "Unauthorized: You are not an authorized participant of this session.";
            return res;
        }

        Optional<OnlineMeeting> opt = meetingDao.findBySessionId(sessionId);
        if (opt.isEmpty()) {
            res.success = false;
            res.statusCode = 404;
            res.message = "No online meeting has been scheduled for this session yet.";
            return res;
        }

        OnlineMeeting meeting = opt.get();

        // Validate meeting link against trusted Jitsi hostname
        if (!SecurityUtil.isTrustedJitsiUrl(meeting.getMeetingUrl())) {
            res.success = false;
            res.statusCode = 502;
            res.message = "Security error: meeting link domain does not match configured trusted Jitsi hostname.";
            return res;
        }

        res.success = true;
        res.statusCode = 200;
        res.message = "Meeting details retrieved.";
        res.meeting = meeting;
        return res;
    }

    public List<OnlineMeeting> getUserMeetings(int userId) throws SQLException {
        return meetingDao.findByUserId(userId);
    }

    public MeetingResult updateMeetingStatus(int meetingId, int requestingUserId, String status) throws SQLException {
        MeetingResult res = new MeetingResult();

        Optional<OnlineMeeting> opt = meetingDao.findById(meetingId);
        if (opt.isEmpty()) {
            res.success = false;
            res.statusCode = 404;
            res.message = "Meeting not found.";
            return res;
        }

        OnlineMeeting meeting = opt.get();

        if (meeting.getHostUserId() != requestingUserId && meeting.getParticipantUserId() != requestingUserId) {
            res.success = false;
            res.statusCode = 403;
            res.message = "Unauthorized: You cannot alter meetings in which you are not a participant.";
            return res;
        }

        String upperStatus = status.trim().toUpperCase();
        if (!"SCHEDULED".equals(upperStatus) && !"ACTIVE".equals(upperStatus) &&
            !"COMPLETED".equals(upperStatus) && !"CANCELLED".equals(upperStatus)) {
            res.success = false;
            res.statusCode = 400;
            res.message = "Invalid meeting status: " + status;
            return res;
        }

        boolean updated = meetingDao.updateStatus(meetingId, upperStatus);
        if (updated) {
            meeting.setStatus(upperStatus);
            // If completed, also complete associated session
            if ("COMPLETED".equals(upperStatus)) {
                meetingDao.updateAssociatedSessionStatus(meeting.getSessionId(), "COMPLETED");
            }

            res.success = true;
            res.statusCode = 200;
            res.message = "Meeting status updated to " + upperStatus;
            res.meeting = meeting;
        } else {
            res.success = false;
            res.statusCode = 500;
            res.message = "Failed to update meeting status.";
        }

        return res;
    }
}
