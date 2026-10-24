package com.skillswap.util;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.skillswap.config.AppConfig;
import jakarta.servlet.http.HttpServletRequest;

public class JwtUtil {

    private static JWTVerifier verifier;

    private static synchronized JWTVerifier getVerifier() {
        if (verifier == null) {
            Algorithm algorithm = Algorithm.HMAC256(AppConfig.getJwtSecret());
            verifier = JWT.require(algorithm).build();
        }
        return verifier;
    }

    /**
     * Verifies a JWT token and returns the DecodedJWT if valid, or null if invalid or expired.
     */
    public static DecodedJWT verifyToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        try {
            return getVerifier().verify(token.trim());
        } catch (JWTVerificationException e) {
            return null;
        }
    }

    /**
     * Extracts the Bearer token from the HTTP Authorization header.
     */
    public static String extractBearerToken(HttpServletRequest request) {
        if (request == null) return null;
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null) {
            authHeader = request.getHeader("authorization");
        }
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return null;
    }

    /**
     * Authenticates the request and extracts the verified userId.
     * Returns the verified positive userId from JWT if valid, or -1 if unauthenticated, missing, or expired.
     */
    public static int getAuthenticatedUserId(HttpServletRequest request) {
        String token = extractBearerToken(request);
        if (token != null) {
            DecodedJWT decoded = verifyToken(token);
            if (decoded != null) {
                // Check "userId" claim
                Integer uid = decoded.getClaim("userId").asInt();
                if (uid == null) {
                    try {
                        String str = decoded.getClaim("userId").asString();
                        if (str != null) {
                            uid = Integer.parseInt(str.trim());
                        }
                    } catch (NumberFormatException ignored) {}
                }
                if (uid != null && uid > 0) {
                    return uid;
                }
            }
        }
        return -1;
    }

    /**
     * Extracts the authenticated user's role from JWT claims.
     */
    public static String getAuthenticatedUserRole(HttpServletRequest request) {
        String token = extractBearerToken(request);
        if (token != null) {
            DecodedJWT decoded = verifyToken(token);
            if (decoded != null) {
                String role = decoded.getClaim("role").asString();
                if (role != null) {
                    return role.trim().toLowerCase();
                }
            }
        }
        return "";
    }

    /**
     * Returns true if the authenticated user has an 'admin' role.
     */
    public static boolean isAdmin(HttpServletRequest request) {
        return "admin".equalsIgnoreCase(getAuthenticatedUserRole(request));
    }
}
