package com.skillswap.model;

import org.json.JSONObject;
import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;

public class OnlineMeeting {
    private int meetingId;
    private int sessionId;
    private int hostUserId;
    private int participantUserId;
    private int collegeId;
    private String title;
    private String roomName;
    private String passcode;
    private String jitsiDomain;
    private String meetingUrl;
    private Timestamp scheduledStart;
    private int durationMinutes;
    private String status; // SCHEDULED, ACTIVE, COMPLETED, CANCELLED
    private Timestamp createdAt;
    private Timestamp updatedAt;

    // Additional display fields
    private String hostName;
    private String participantName;
    private String collegeName;

    public OnlineMeeting() {}

    public int getMeetingId() { return meetingId; }
    public void setMeetingId(int meetingId) { this.meetingId = meetingId; }

    public int getSessionId() { return sessionId; }
    public void setSessionId(int sessionId) { this.sessionId = sessionId; }

    public int getHostUserId() { return hostUserId; }
    public void setHostUserId(int hostUserId) { this.hostUserId = hostUserId; }

    public int getParticipantUserId() { return participantUserId; }
    public void setParticipantUserId(int participantUserId) { this.participantUserId = participantUserId; }

    public int getCollegeId() { return collegeId; }
    public void setCollegeId(int collegeId) { this.collegeId = collegeId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }

    public String getPasscode() { return passcode; }
    public void setPasscode(String passcode) { this.passcode = passcode; }

    public String getJitsiDomain() { return jitsiDomain; }
    public void setJitsiDomain(String jitsiDomain) { this.jitsiDomain = jitsiDomain; }

    public String getMeetingUrl() { return meetingUrl; }
    public void setMeetingUrl(String meetingUrl) { this.meetingUrl = meetingUrl; }

    public Timestamp getScheduledStart() { return scheduledStart; }
    public void setScheduledStart(Timestamp scheduledStart) { this.scheduledStart = scheduledStart; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }

    public String getHostName() { return hostName; }
    public void setHostName(String hostName) { this.hostName = hostName; }

    public String getParticipantName() { return participantName; }
    public void setParticipantName(String participantName) { this.participantName = participantName; }

    public String getCollegeName() { return collegeName; }
    public void setCollegeName(String collegeName) { this.collegeName = collegeName; }

    public JSONObject toJsonObject() {
        JSONObject json = new JSONObject();
        json.put("meetingId", meetingId);
        json.put("sessionId", sessionId);
        json.put("hostUserId", hostUserId);
        json.put("participantUserId", participantUserId);
        json.put("collegeId", collegeId);
        json.put("title", title);
        json.put("roomName", roomName);
        json.put("passcode", passcode != null ? passcode : "");
        json.put("jitsiDomain", jitsiDomain);
        json.put("meetingUrl", meetingUrl);
        json.put("jitsiUrl", meetingUrl);
        json.put("scheduledStart", scheduledStart != null ? scheduledStart.toString() : "");
        json.put("durationMinutes", durationMinutes);
        json.put("status", status);
        if (hostName != null) json.put("hostName", hostName);
        if (participantName != null) json.put("participantName", participantName);
        if (collegeName != null) json.put("collegeName", collegeName);
        return json;
    }
}
