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
     * Verifies a JWT token and returns the DecodedJWT if valid, or null if invalid.
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
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }
        return null;
    }

    /**
     * Authenticates the request and extracts the verified userId.
     * Returns the verified userId from JWT if valid, or fallback userId if allowed, or -1 if unauthenticated.
     */
    public static int getAuthenticatedUserId(HttpServletRequest request) {
        String token = extractBearerToken(request);
        if (token != null) {
            DecodedJWT decoded = verifyToken(token);
            if (decoded != null) {
                // Check "userId" claim
                Integer uid = decoded.getClaim("userId").asInt();
                if (uid != null) {
                    return uid;
                }
            }
        }
        return -1;
    }
}
