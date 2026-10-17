package com.skillswap.servlet;

import com.skillswap.config.AppConfig;
import com.skillswap.config.DatabaseConfig;
import com.skillswap.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONObject;

import java.io.IOException;
import java.sql.Connection;

@WebServlet("/api/health")
public class HealthServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        JSONObject res = new JSONObject();
        res.put("status", "ok");
        res.put("service", "SkillSwap Campus Java Servlet Module");
        res.put("version", "1.0.0");
        res.put("jitsiDomain", AppConfig.getJitsiDomain());

        boolean dbOk = false;
        try (Connection conn = DatabaseConfig.getConnection()) {
            dbOk = conn.isValid(2);
        } catch (Exception e) {
            dbOk = false;
        }

        res.put("databaseConnected", dbOk);
        JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
    }
}
