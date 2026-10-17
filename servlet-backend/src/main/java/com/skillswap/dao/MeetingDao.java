package com.skillswap.dao;

import com.skillswap.config.DatabaseConfig;
import com.skillswap.model.OnlineMeeting;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class MeetingDao {

    public int createMeeting(OnlineMeeting meeting) throws SQLException {
        String sql = "INSERT INTO online_meetings (session_id, host_user_id, participant_user_id, college_id, title, room_name, passcode, jitsi_domain, meeting_url, scheduled_start, duration_minutes, status) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            stmt.setInt(1, meeting.getSessionId());
            stmt.setInt(2, meeting.getHostUserId());
            stmt.setInt(3, meeting.getParticipantUserId());
            stmt.setInt(4, meeting.getCollegeId());
            stmt.setString(5, meeting.getTitle());
            stmt.setString(6, meeting.getRoomName());
            stmt.setString(7, meeting.getPasscode());
            stmt.setString(8, meeting.getJitsiDomain());
            stmt.setString(9, meeting.getMeetingUrl());
            stmt.setTimestamp(10, meeting.getScheduledStart());
            stmt.setInt(11, meeting.getDurationMinutes());
            stmt.setString(12, meeting.getStatus() != null ? meeting.getStatus() : "SCHEDULED");

            stmt.executeUpdate();
            try (ResultSet rs = stmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    public Optional<OnlineMeeting> findById(int meetingId) throws SQLException {
        String sql = "SELECT m.*, u1.name AS host_name, u2.name AS participant_name, c.college_name " +
                     "FROM online_meetings m " +
                     "JOIN users u1 ON m.host_user_id = u1.user_id " +
                     "JOIN users u2 ON m.participant_user_id = u2.user_id " +
                     "JOIN colleges c ON m.college_id = c.college_id " +
                     "WHERE m.meeting_id = ? LIMIT 1";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, meetingId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    public Optional<OnlineMeeting> findBySessionId(int sessionId) throws SQLException {
        String sql = "SELECT m.*, u1.name AS host_name, u2.name AS participant_name, c.college_name " +
                     "FROM online_meetings m " +
                     "JOIN users u1 ON m.host_user_id = u1.user_id " +
                     "JOIN users u2 ON m.participant_user_id = u2.user_id " +
                     "JOIN colleges c ON m.college_id = c.college_id " +
                     "WHERE m.session_id = ? " +
                     "ORDER BY m.meeting_id DESC LIMIT 1";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, sessionId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    public List<OnlineMeeting> findByUserId(int userId) throws SQLException {
        List<OnlineMeeting> list = new ArrayList<>();
        String sql = "SELECT m.*, u1.name AS host_name, u2.name AS participant_name, c.college_name " +
                     "FROM online_meetings m " +
                     "JOIN users u1 ON m.host_user_id = u1.user_id " +
                     "JOIN users u2 ON m.participant_user_id = u2.user_id " +
                     "JOIN colleges c ON m.college_id = c.college_id " +
                     "WHERE m.host_user_id = ? OR m.participant_user_id = ? " +
                     "ORDER BY m.scheduled_start DESC";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            stmt.setInt(2, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRow(rs));
                }
            }
        }
        return list;
    }

    public boolean updateStatus(int meetingId, String status) throws SQLException {
        String sql = "UPDATE online_meetings SET status = ? WHERE meeting_id = ?";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, status.toUpperCase());
            stmt.setInt(2, meetingId);
            return stmt.executeUpdate() > 0;
        }
    }

    public boolean updateAssociatedSessionStatus(int sessionId, String status) throws SQLException {
        String sql = "UPDATE sessions SET status = ? WHERE session_id = ?";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, status.toUpperCase());
            stmt.setInt(2, sessionId);
            return stmt.executeUpdate() > 0;
        }
    }

    private OnlineMeeting mapRow(ResultSet rs) throws SQLException {
        OnlineMeeting m = new OnlineMeeting();
        m.setMeetingId(rs.getInt("meeting_id"));
        m.setSessionId(rs.getInt("session_id"));
        m.setHostUserId(rs.getInt("host_user_id"));
        m.setParticipantUserId(rs.getInt("participant_user_id"));
        m.setCollegeId(rs.getInt("college_id"));
        m.setTitle(rs.getString("title"));
        m.setRoomName(rs.getString("room_name"));
        m.setPasscode(rs.getString("passcode"));
        m.setJitsiDomain(rs.getString("jitsi_domain"));
        m.setMeetingUrl(rs.getString("meeting_url"));
        m.setScheduledStart(rs.getTimestamp("scheduled_start"));
        m.setDurationMinutes(rs.getInt("duration_minutes"));
        m.setStatus(rs.getString("status"));
        m.setCreatedAt(rs.getTimestamp("created_at"));
        m.setUpdatedAt(rs.getTimestamp("updated_at"));
        m.setHostName(rs.getString("host_name"));
        m.setParticipantName(rs.getString("participant_name"));
        m.setCollegeName(rs.getString("college_name"));
        return m;
    }
}
