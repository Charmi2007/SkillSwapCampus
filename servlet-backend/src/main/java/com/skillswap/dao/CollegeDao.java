package com.skillswap.dao;

import com.skillswap.config.DatabaseConfig;
import com.skillswap.model.College;
import com.skillswap.util.SecurityUtil;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class CollegeDao {

    public List<College> getAllColleges() throws SQLException {
        List<College> list = new ArrayList<>();
        String sql = "SELECT college_id, college_name, email_domain, city, state, country, created_at FROM colleges ORDER BY college_name ASC";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                list.add(mapRow(rs));
            }
        }
        return list;
    }

    public Optional<College> findByDomain(String domain) throws SQLException {
        if (domain == null || domain.trim().isEmpty()) return Optional.empty();
        String sql = "SELECT college_id, college_name, email_domain, city, state, country, created_at FROM colleges WHERE LOWER(email_domain) = LOWER(?) LIMIT 1";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, domain.trim());
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    public Optional<College> findMatchingCollegeByEmail(String email) throws SQLException {
        String domain = SecurityUtil.extractEmailDomain(email);
        if (domain.isEmpty()) return Optional.empty();
        return findByDomain(domain);
    }

    public Optional<College> findById(int collegeId) throws SQLException {
        String sql = "SELECT college_id, college_name, email_domain, city, state, country, created_at FROM colleges WHERE college_id = ? LIMIT 1";
        try (Connection conn = DatabaseConfig.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, collegeId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        }
        return Optional.empty();
    }

    private College mapRow(ResultSet rs) throws SQLException {
        return new College(
            rs.getInt("college_id"),
            rs.getString("college_name"),
            rs.getString("email_domain"),
            rs.getString("city"),
            rs.getString("state"),
            rs.getString("country"),
            rs.getTimestamp("created_at")
        );
    }
}
