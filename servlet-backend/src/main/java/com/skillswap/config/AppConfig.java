package com.skillswap.config;

/**
 * Application-wide configuration and environment variable accessor.
 */
public class AppConfig {

    public static String getDbHost() {
        return DotenvLoader.get("DB_HOST", "localhost");
    }

    public static int getDbPort() {
        try {
            return Integer.parseInt(DotenvLoader.get("DB_PORT", "3306"));
        } catch (NumberFormatException e) {
            return 3306;
        }
    }

    public static String getDbUser() {
        return DotenvLoader.get("DB_USER", "root");
    }

    public static String getDbPassword() {
        return DotenvLoader.get("DB_PASSWORD", "");
    }

    public static String getDbName() {
        return DotenvLoader.get("DB_NAME", "skillswap_campus");
    }

    public static String getJwtSecret() {
        String secret = DotenvLoader.get("JWT_SECRET");
        if (secret == null || secret.trim().isEmpty()) {
            throw new IllegalStateException("FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing or empty.");
        }
        return secret.trim();
    }

    public static String getJitsiDomain() {
        String domain = DotenvLoader.get("JITSI_DOMAIN", "meet.jit.si");
        // Remove trailing slashes or protocol if mistakenly supplied
        domain = domain.replaceAll("^https?://", "").replaceAll("/+$", "");
        return domain;
    }

    public static String getCorsOrigin() {
        return DotenvLoader.get("CORS_ORIGIN", "*");
    }

    public static String getSmtpHost() {
        return DotenvLoader.get("SMTP_HOST", "");
    }

    public static int getSmtpPort() {
        try {
            return Integer.parseInt(DotenvLoader.get("SMTP_PORT", "587"));
        } catch (NumberFormatException e) {
            return 587;
        }
    }

    public static String getSmtpUser() {
        return DotenvLoader.get("SMTP_USER", "");
    }

    public static String getSmtpPassword() {
        return DotenvLoader.get("SMTP_PASS", "");
    }

    public static String getSmtpFrom() {
        return DotenvLoader.get("SMTP_FROM", "no-reply@skillswapcampus.edu");
    }

    public static boolean isProduction() {
        String env = DotenvLoader.get("APP_ENV", DotenvLoader.get("NODE_ENV", DotenvLoader.get("ENVIRONMENT", "development")));
        if ("production".equalsIgnoreCase(env) || "prod".equalsIgnoreCase(env)) {
            return true;
        }
        String prodFlag = DotenvLoader.get("PRODUCTION", "false");
        return "true".equalsIgnoreCase(prodFlag) || "1".equals(prodFlag);
    }

    public static boolean isEmailConfigured() {
        String host = getSmtpHost();
        return host != null && !host.trim().isEmpty();
    }

    public static boolean isDbSslEnabled() {
        String ssl = DotenvLoader.get("DB_SSL", DotenvLoader.get("DB_USE_SSL", ""));
        if (!ssl.isEmpty()) {
            return "true".equalsIgnoreCase(ssl) || "1".equals(ssl) || "required".equalsIgnoreCase(ssl);
        }
        String host = getDbHost();
        return host != null && !host.equalsIgnoreCase("localhost") && !host.equals("127.0.0.1");
    }
}
