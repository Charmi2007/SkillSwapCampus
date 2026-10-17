package com.skillswap.util;

import com.skillswap.config.AppConfig;

import java.security.SecureRandom;
import java.util.Locale;

public class SecurityUtil {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX_CHARS = "0123456789abcdef".toCharArray();
    private static final char[] ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();

    /**
     * Generates a secure numeric 6-digit OTP code (e.g., 482910).
     */
    public static String generateOtp() {
        int code = 100000 + RANDOM.nextInt(900000);
        return String.valueOf(code);
    }

    /**
     * Generates a cryptographically secure random hexadecimal token (32 bytes = 64 hex chars).
     */
    public static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        char[] hex = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            hex[i * 2] = HEX_CHARS[v >>> 4];
            hex[i * 2 + 1] = HEX_CHARS[v & 0x0F];
        }
        return new String(hex);
    }

    /**
     * Generates a secure random 6-character alphanumeric room passcode.
     */
    public static String generateRoomPasscode() {
        char[] chars = new char[6];
        for (int i = 0; i < chars.length; i++) {
            chars[i] = ALPHANUMERIC[RANDOM.nextInt(ALPHANUMERIC.length)];
        }
        return new String(chars);
    }

    /**
     * Extracts and normalizes the domain from an email address (e.g. user@stanford.edu -> stanford.edu).
     */
    public static String extractEmailDomain(String email) {
        if (email == null) return "";
        email = email.trim().toLowerCase(Locale.ROOT);
        int at = email.lastIndexOf('@');
        if (at >= 0 && at < email.length() - 1) {
            return email.substring(at + 1).trim();
        }
        return "";
    }

    /**
     * Validates whether a given meeting URL or domain matches the configured trusted Jitsi hostname.
     */
    public static boolean isTrustedJitsiUrl(String url) {
        if (url == null || url.trim().isEmpty()) return false;
        String trustedDomain = AppConfig.getJitsiDomain().toLowerCase(Locale.ROOT);
        String cleanUrl = url.trim().toLowerCase(Locale.ROOT);
        return cleanUrl.startsWith("https://" + trustedDomain + "/") ||
               cleanUrl.startsWith("http://" + trustedDomain + "/");
    }

    /**
     * Constructs the official meeting URL from the configured trusted Jitsi domain and room name.
     */
    public static String buildMeetingUrl(String roomName) {
        String domain = AppConfig.getJitsiDomain();
        return "https://" + domain + "/" + roomName;
    }
}
