package com.skillswap.dao;

import com.skillswap.config.DatabaseConfig;
import com.skillswap.model.UserCollegeStatus;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

public class UserDao {

    public Optional<UserCollegeStatus> getUserCollegeStatus(int userId) throws SQLException {
        String sql = "SELECT u.user_id, u.name, u.email, u.college_id, c.college_name, u.institutional_email, u.verification_status, u.verified_at " +
                     "FROM users u " +
                     "LEFT JOIN colleges c ON u.college_id = c.college_id " +
                     "WHERE u.user_id = ? LIMIT 1";

        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    UserCollegeStatus s = new UserCollegeStatus();
                    s.setUserId(rs.getInt("user_id"));
                    s.setName(rs.getString("name"));
                    s.setEmail(rs.getString("email"));
                    int cId = rs.getInt("college_id");
                    if (!rs.wasNull()) {
                        s.setCollegeId(cId);
                    }
                    s.setCollegeName(rs.getString("college_name"));
                    s.setInstitutionalEmail(rs.getString("institutional_email"));
                    s.setVerificationStatus(rs.getString("verification_status"));
                    s.setVerifiedAt(rs.getTimestamp("verified_at"));
                    return Optional.of(s);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Checks if both users are verified members of the EXACT same college.
     */
    public boolean areInSameCollege(int userId1, int userId2) throws SQLException {
        if (userId1 == userId2) return true;

        String sql = "SELECT college_id, verification_status FROM users WHERE user_id IN (?, ?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId1);
            stmt.setInt(2, userId2);
            try (ResultSet rs = stmt.executeQuery()) {
                Integer col1 = null;
                Integer col2 = null;
                while (rs.next()) {
                    String status = rs.getString("verification_status");
                    int cId = rs.getInt("college_id");
                    if (!"VERIFIED".equalsIgnoreCase(status) || rs.wasNull() || cId <= 0) {
                        return false; // at least one is unverified
                    }
                    if (col1 == null) {
                        col1 = cId;
                    } else {
                        col2 = cId;
                    }
                }
                return col1 != null && col2 != null && col1.equals(col2);
            }
        }
    }

    /**
     * Checks if a user is a participant (sender or receiver) in the swap session.
     */
    public boolean isSessionParticipant(int sessionId, int userId) throws SQLException {
        String sql = "SELECT s.session_id, sr.sender_id, sr.receiver_id " +
                     "FROM sessions s " +
                     "JOIN swap_requests sr ON s.request_id = sr.request_id " +
                     "WHERE s.session_id = ? AND (sr.sender_id = ? OR sr.receiver_id = ?)";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, sessionId);
            stmt.setInt(2, userId);
            stmt.setInt(3, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next();
            }
        }
    }

    /**
     * Returns an array [senderId, receiverId, collegeId] for a given session.
     */
    public int[] getSessionParticipantsAndCollege(int sessionId) throws SQLException {
        String sql = "SELECT s.session_id, sr.sender_id, sr.receiver_id, u_sender.college_id AS sender_col, u_recv.college_id AS recv_col " +
                     "FROM sessions s " +
                     "JOIN swap_requests sr ON s.request_id = sr.request_id " +
                     "JOIN users u_sender ON sr.sender_id = u_sender.user_id " +
                     "JOIN users u_recv ON sr.receiver_id = u_recv.user_id " +
                     "WHERE s.session_id = ?";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, sessionId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    int senderId = rs.getInt("sender_id");
                    int receiverId = rs.getInt("receiver_id");
                    int col1 = rs.getInt("sender_col");
                    int col2 = rs.getInt("recv_col");
                    int commonCol = (col1 > 0 && col1 == col2) ? col1 : 0;
                    return new int[]{senderId, receiverId, commonCol};
                }
            }
        }
        return null;
    }
}
