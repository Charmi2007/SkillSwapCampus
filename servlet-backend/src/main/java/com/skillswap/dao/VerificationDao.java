package com.skillswap.dao;

import com.skillswap.config.DatabaseConfig;
import com.skillswap.model.CollegeVerification;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;

public class VerificationDao {

    public void createVerification(int userId, int collegeId, String institutionalEmail, String otpCode, String token, int expiryMinutes) throws SQLException {
        // Expire / invalidate any previous pending verifications for this user
        String invalidateSql = "DELETE FROM college_verifications WHERE user_id = ? AND is_verified = FALSE";
        String insertSql = "INSERT INTO college_verifications (user_id, college_id, institutional_email, otp_code, verification_token, expires_at) " +
                           "VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))";

        try (Connection conn = DatabaseConfig.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement stmt = conn.prepareStatement(invalidateSql)) {
                    stmt.setInt(1, userId);
                    stmt.executeUpdate();
                }

                try (PreparedStatement stmt = conn.prepareStatement(insertSql)) {
                    stmt.setInt(1, userId);
                    stmt.setInt(2, collegeId);
                    stmt.setString(3, institutionalEmail.trim());
                    stmt.setString(4, otpCode.trim());
                    stmt.setString(5, token.trim());
                    stmt.setInt(6, expiryMinutes);
                    stmt.executeUpdate();
                }

                // Update user status to PENDING
                String updatePending = "UPDATE users SET verification_status = 'PENDING', institutional_email = ?, college_id = ? WHERE user_id = ? AND verification_status != 'VERIFIED'";
                try (PreparedStatement stmt = conn.prepareStatement(updatePending)) {
                    stmt.setString(1, institutionalEmail.trim());
                    stmt.setInt(2, collegeId);
                    stmt.setInt(3, userId);
                    stmt.executeUpdate();
                }

                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public Optional<CollegeVerification> findActiveByToken(String token) throws SQLException {
        String sql = "SELECT verification_id, user_id, college_id, institutional_email, otp_code, verification_token, expires_at, is_verified, attempts, created_at " +
                     "FROM college_verifications WHERE verification_token = ? AND is_verified = FALSE AND expires_at > NOW() LIMIT 1";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, token.trim());
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    CollegeVerification v = new CollegeVerification();
                    v.setVerificationId(rs.getInt("verification_id"));
                    v.setUserId(rs.getInt("user_id"));
                    v.setCollegeId(rs.getInt("college_id"));
                    v.setInstitutionalEmail(rs.getString("institutional_email"));
                    v.setOtpCode(rs.getString("otp_code"));
                    v.setVerificationToken(rs.getString("verification_token"));
                    v.setExpiresAt(rs.getTimestamp("expires_at"));
                    v.setVerified(rs.getBoolean("is_verified"));
                    v.setAttempts(rs.getInt("attempts"));
                    v.setCreatedAt(rs.getTimestamp("created_at"));
                    return Optional.of(v);
                }
            }
        }
        return Optional.empty();
    }

    public Optional<CollegeVerification> findActiveByUserId(int userId) throws SQLException {
        String sql = "SELECT verification_id, user_id, college_id, institutional_email, otp_code, verification_token, expires_at, is_verified, attempts, created_at " +
                     "FROM college_verifications WHERE user_id = ? AND is_verified = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, userId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    CollegeVerification v = new CollegeVerification();
                    v.setVerificationId(rs.getInt("verification_id"));
                    v.setUserId(rs.getInt("user_id"));
                    v.setCollegeId(rs.getInt("college_id"));
                    v.setInstitutionalEmail(rs.getString("institutional_email"));
                    v.setOtpCode(rs.getString("otp_code"));
                    v.setVerificationToken(rs.getString("verification_token"));
                    v.setExpiresAt(rs.getTimestamp("expires_at"));
                    v.setVerified(rs.getBoolean("is_verified"));
                    v.setAttempts(rs.getInt("attempts"));
                    v.setCreatedAt(rs.getTimestamp("created_at"));
                    return Optional.of(v);
                }
            }
        }
        return Optional.empty();
    }

    public void incrementAttempts(int verificationId) throws SQLException {
        String sql = "UPDATE college_verifications SET attempts = attempts + 1 WHERE verification_id = ?";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, verificationId);
            stmt.executeUpdate();
        }
    }

    public void completeVerification(int verificationId, int userId, int collegeId, String institutionalEmail) throws SQLException {
        String markVerifiedSql = "UPDATE college_verifications SET is_verified = TRUE WHERE verification_id = ?";
        String updateUserSql = "UPDATE users SET college_id = ?, institutional_email = ?, verification_status = 'VERIFIED', verified_at = NOW() WHERE user_id = ?";

        try (Connection conn = DatabaseConfig.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement stmt = conn.prepareStatement(markVerifiedSql)) {
                    stmt.setInt(1, verificationId);
                    stmt.executeUpdate();
                }

                try (PreparedStatement stmt = conn.prepareStatement(updateUserSql)) {
                    stmt.setInt(1, collegeId);
                    stmt.setString(2, institutionalEmail.trim());
                    stmt.setInt(3, userId);
                    stmt.executeUpdate();
                }

                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }
}
