package com.skillswap.service;

import com.skillswap.config.AppConfig;
import com.skillswap.dao.CollegeDao;
import com.skillswap.dao.UserDao;
import com.skillswap.dao.VerificationDao;
import com.skillswap.model.College;
import com.skillswap.model.CollegeVerification;
import com.skillswap.model.UserCollegeStatus;
import com.skillswap.util.SecurityUtil;

import java.sql.SQLException;
import java.util.Optional;

public class CollegeVerificationService {

    private final CollegeDao collegeDao = new CollegeDao();
    private final VerificationDao verificationDao = new VerificationDao();
    private final UserDao userDao = new UserDao();
    private final EmailService emailService = new EmailService();

    public static class VerificationRequestResult {
        public boolean success;
        public String message;
        public String token;
        public String collegeName;
        public int collegeId;
        public String devOtp; // Only populated for development/test convenience
    }

    public static class VerificationResult {
        public boolean success;
        public String message;
        public int statusCode;
        public UserCollegeStatus userStatus;
    }

    public VerificationRequestResult requestVerificationOtp(int userId, String institutionalEmail) throws SQLException {
        VerificationRequestResult res = new VerificationRequestResult();

        if (institutionalEmail == null || institutionalEmail.trim().isEmpty() || !institutionalEmail.contains("@")) {
            res.success = false;
            res.message = "Please provide a valid institutional email address.";
            return res;
        }

        institutionalEmail = institutionalEmail.trim().toLowerCase();

        // 1. Verify user exists
        Optional<UserCollegeStatus> userOpt = userDao.getUserCollegeStatus(userId);
        if (userOpt.isEmpty()) {
            res.success = false;
            res.message = "User not found.";
            return res;
        }
        UserCollegeStatus user = userOpt.get();

        // 2. Validate email domain against colleges registry
        Optional<College> collegeOpt = collegeDao.findMatchingCollegeByEmail(institutionalEmail);
        if (collegeOpt.isEmpty()) {
            String domain = SecurityUtil.extractEmailDomain(institutionalEmail);
            res.success = false;
            res.message = "Email domain '@" + domain + "' is not recognized as an approved institutional domain in our college registry.";
            return res;
        }
        College college = collegeOpt.get();

        // 3. Generate secure OTP and verification token
        String otp = SecurityUtil.generateOtp();
        String token = SecurityUtil.generateToken();
        int expiryMinutes = 15;

        // 4. Save to database
        verificationDao.createVerification(userId, college.getCollegeId(), institutionalEmail, otp, token, expiryMinutes);

        // 5. Dispatch email
        boolean emailSent = emailService.sendOtpEmail(institutionalEmail, user.getName(), college.getCollegeName(), otp);
        if (!emailSent && AppConfig.isProduction()) {
            res.success = false;
            res.message = "Failed to dispatch verification email. Institutional email delivery service is not configured or unavailable.";
            return res;
        }

        res.success = true;
        res.message = "Verification OTP has been sent to " + institutionalEmail + ". Valid for " + expiryMinutes + " minutes.";
        res.token = token;
        res.collegeName = college.getCollegeName();
        res.collegeId = college.getCollegeId();
        if (!AppConfig.isProduction()) {
            res.devOtp = otp; // Returned ONLY in development/testing mode
        }

        return res;
    }

    public VerificationResult verifyOtp(int userId, String token, String submittedOtp) throws SQLException {
        VerificationResult res = new VerificationResult();

        if (submittedOtp == null || submittedOtp.trim().isEmpty()) {
            res.success = false;
            res.statusCode = 400;
            res.message = "OTP code is required.";
            return res;
        }

        Optional<CollegeVerification> verOpt = Optional.empty();
        if (token != null && !token.trim().isEmpty()) {
            verOpt = verificationDao.findActiveByToken(token.trim());
        } else if (userId > 0) {
            verOpt = verificationDao.findActiveByUserId(userId);
        }

        if (verOpt.isEmpty()) {
            res.success = false;
            res.statusCode = 400;
            res.message = "Invalid or expired verification session. Please request a new OTP.";
            return res;
        }

        CollegeVerification ver = verOpt.get();

        // Security check: ensure the token belongs to the requesting user
        if (ver.getUserId() != userId) {
            res.success = false;
            res.statusCode = 403;
            res.message = "Token does not belong to the authenticated user.";
            return res;
        }

        // Rate limiting: Maximum 5 incorrect attempts allowed
        if (ver.getAttempts() >= 5) {
            res.success = false;
            res.statusCode = 429;
            res.message = "Maximum verification attempts exceeded. Please request a new OTP.";
            return res;
        }

        // Compare OTP code securely
        if (!ver.getOtpCode().equals(submittedOtp.trim())) {
            verificationDao.incrementAttempts(ver.getVerificationId());
            int remaining = 4 - ver.getAttempts();
            res.success = false;
            res.statusCode = 400;
            res.message = "Incorrect OTP code. " + (remaining > 0 ? remaining + " attempt(s) remaining." : "Session locked. Request a new OTP.");
            return res;
        }

        // Complete verification: update verification record and user profile
        verificationDao.completeVerification(ver.getVerificationId(), ver.getUserId(), ver.getCollegeId(), ver.getInstitutionalEmail());

        res.success = true;
        res.statusCode = 200;
        res.message = "Institutional email verified successfully! Welcome to your college community.";
        res.userStatus = userDao.getUserCollegeStatus(userId).orElse(null);

        return res;
    }

    public Optional<UserCollegeStatus> getUserStatus(int userId) throws SQLException {
        return userDao.getUserCollegeStatus(userId);
    }
}
