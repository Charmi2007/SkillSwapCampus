package com.skillswap.service;

import com.skillswap.config.AppConfig;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

import java.util.Properties;

public class EmailService {

    public boolean sendOtpEmail(String recipientEmail, String studentName, String collegeName, String otpCode) {
        String host = AppConfig.getSmtpHost();
        int port = AppConfig.getSmtpPort();
        String user = AppConfig.getSmtpUser();
        String pass = AppConfig.getSmtpPassword();
        String from = AppConfig.getSmtpFrom();

        String subject = "Your SkillSwap Campus Verification Code: " + otpCode;
        String content = String.format(
            "Hello %s,\n\n" +
            "Your verification code for %s on SkillSwap Campus is:\n\n" +
            "   >>>  %s  <<<\n\n" +
            "This OTP code is valid for 15 minutes. Enter this code to verify your college status and unlock campus-exclusive skill exchanges and online sessions.\n\n" +
            "If you did not request this, please ignore this email.\n\n" +
            "— The SkillSwap Campus Team",
            studentName != null ? studentName : "Student",
            collegeName,
            otpCode
        );

        if (host == null || host.trim().isEmpty()) {
            if (AppConfig.isProduction()) {
                System.err.println("❌ [EmailService] SMTP host is not configured in production mode. Cannot deliver OTP email.");
                return false;
            }
            // Development / Test mode: Securely log to console so testing is completely feasible without third-party mailer
            System.out.println("==================================================================");
            System.out.println("📧 [EmailService] SMTP not configured. Development/Test OTP Dispatch:");
            System.out.println("   To: " + recipientEmail);
            System.out.println("   College: " + collegeName);
            System.out.println("   OTP Code: " + otpCode);
            System.out.println("==================================================================");
            return true;
        }

        try {
            Properties props = new Properties();
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.host", host);
            props.put("mail.smtp.port", String.valueOf(port));

            Session session = Session.getInstance(props, new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication(user, pass);
                }
            });

            Message message = new MimeMessage(session);
            message.setFrom(new InternetAddress(from));
            message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(recipientEmail));
            message.setSubject(subject);
            message.setText(content);

            Transport.send(message);
            System.out.println("✅ [EmailService] Sent OTP email to: " + recipientEmail);
            return true;
        } catch (MessagingException e) {
            System.err.println("❌ [EmailService] Failed to send email via SMTP: " + e.getMessage());
            if (!AppConfig.isProduction()) {
                // Fallback log for development recovery only
                System.out.println("📧 [EmailService Fallback OTP]: " + otpCode + " for " + recipientEmail);
            }
            return false;
        }
    }
}
