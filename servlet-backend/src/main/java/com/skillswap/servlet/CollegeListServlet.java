package com.skillswap.servlet;

import com.skillswap.dao.CollegeDao;
import com.skillswap.model.College;
import com.skillswap.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

@WebServlet("/api/colleges")
public class CollegeListServlet extends HttpServlet {

    private final CollegeDao collegeDao = new CollegeDao();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            List<College> list = collegeDao.getAllColleges();
            JSONArray arr = new JSONArray();
            for (College c : list) {
                arr.put(c.toJsonObject());
            }
            JSONObject res = new JSONObject();
            res.put("success", true);
            res.put("count", list.size());
            res.put("colleges", arr);
            JsonUtil.sendJson(resp, HttpServletResponse.SC_OK, res);
        } catch (SQLException e) {
            System.err.println("❌ [CollegeListServlet] DB error: " + e.getMessage());
            JsonUtil.sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Database error retrieving college registry.");
        }
    }
}
