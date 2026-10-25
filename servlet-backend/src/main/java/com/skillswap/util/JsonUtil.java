package com.skillswap.util;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;

public class JsonUtil {

    public static JSONObject readJson(HttpServletRequest request) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = request.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        }
        String body = sb.toString().trim();
        if (body.isEmpty()) {
            return new JSONObject();
        }
        return new JSONObject(body);
    }

    public static void sendJson(HttpServletResponse response, int statusCode, JSONObject json) throws IOException {
        response.setStatus(statusCode);
        response.setContentType("application/json; charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        try (PrintWriter writer = response.getWriter()) {
            writer.print(json.toString());
            writer.flush();
        }
    }

    public static void sendError(HttpServletResponse response, int statusCode, String message) throws IOException {
        JSONObject json = new JSONObject();
        json.put("error", true);
        json.put("message", message);
        json.put("status", statusCode);
        sendJson(response, statusCode, json);
    }

    public static void sendSuccess(HttpServletResponse response, int statusCode, String message, JSONObject data) throws IOException {
        JSONObject json = new JSONObject();
        json.put("success", true);
        json.put("message", message);
        if (data != null) {
            for (String key : data.keySet()) {
                json.put(key, data.get(key));
            }
        }
        sendJson(response, statusCode, json);
    }
}
