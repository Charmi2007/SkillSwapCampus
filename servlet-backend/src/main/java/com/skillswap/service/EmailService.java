
package com.skillswap.service;

import com.skillswap.config.AppConfig;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class EmailService {

    private static final String BREVO_API_URL =
            "https://api.brevo.com/v3/smtp/email";

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public boolean sendOtpEmail(
            String recipientEmail,
            String studentName,
            String collegeName,
            String otpCode) {

        String apiKey = System.getenv("BREVO_API_KEY");
        String from = AppConfig.getSmtpFrom();

        if (apiKey == null || apiKey.isBlank()) {
            System.err.println(
                    "[EmailService] BREVO_API_KEY is not configured.");
            return false;
        }

        if (from == null || from.isBlank()) {
            System.err.println(
                    "[EmailService] Sender email is not configured.");
            return false;
        }

        if (recipientEmail == null || recipientEmail.isBlank()
                || otpCode == null || otpCode.isBlank()) {
            System.err.println(
                    "[EmailService] Recipient email or OTP is missing.");
            return false;
        }

        String name = (studentName == null || studentName.isBlank())
                ? "Student" : studentName;

        String college = (collegeName == null || collegeName.isBlank())
                ? "your college" : collegeName;

        String subject = "Your SkillSwap Campus Verification Code";

        String content = String.format(
                "Hello %s,%n%n"
                + "Your verification code for %s on SkillSwap Campus is:"
                + "%n%n%s%n%n"
                + "This code is valid for 15 minutes. Enter it to verify "
                + "your college status and unlock campus-exclusive "
                + "skill exchanges and online sessions.%n%n"
                + "If you did not request this, please ignore this email."
                + "%n%n"
                + "The SkillSwap Campus Team",
                name, college, otpCode
        );

        String payload = "{"
                + "\"sender\":{"
                + "\"name\":\"SkillSwap Campus\","
                + "\"email\":\"" + escapeJson(from) + "\""
                + "},"
                + "\"to\":[{"
                + "\"email\":\"" + escapeJson(recipientEmail) + "\""
                + "}],"
                + "\"subject\":\"" + escapeJson(subject) + "\","
                + "\"textContent\":\"" + escapeJson(content) + "\""
                + "}";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(BREVO_API_URL))
                    .timeout(Duration.ofSeconds(30))
                    .header("accept", "application/json")
                    .header("api-key", apiKey)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            int status = response.statusCode();

            if (status >= 200 && status < 300) {
                System.out.println(
                        "[EmailService] Brevo accepted the OTP email "
                        + "request for " + recipientEmail);
                return true;
            }

            // Do not log the API key or OTP.
            System.err.println(
                    "[EmailService] Brevo API returned HTTP status "
                    + status);
            return false;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println(
                    "[EmailService] Email request was interrupted.");
            return false;

        } catch (IOException | IllegalArgumentException e) {
            System.err.println(
                    "[EmailService] Unable to send email through Brevo: "
                    + e.getClass().getSimpleName());
            return false;
        }
    }

    private static String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder();

        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);

            switch (c) {
                case '"':
                    escaped.append("\\\"");
                    break;
                case '\\':
                    escaped.append("\\\\");
                    break;
                case '\b':
                    escaped.append("\\b");
                    break;
                case '\f':
                    escaped.append("\\f");
                    break;
                case '\n':
                    escaped.append("\\n");
                    break;
                case '\r':
                    escaped.append("\\r");
                    break;
                case '\t':
                    escaped.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) c));
                    } else {
                        escaped.append(c);
                    }
            }
        }

        return escaped.toString();
    }
}
