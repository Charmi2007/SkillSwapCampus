package com.skillswap.model;

import org.json.JSONObject;
import java.sql.Timestamp;

public class College {
    private int collegeId;
    private String collegeName;
    private String emailDomain;
    private String city;
    private String state;
    private String country;
    private Timestamp createdAt;

    public College() {}

    public College(int collegeId, String collegeName, String emailDomain, String city, String state, String country, Timestamp createdAt) {
        this.collegeId = collegeId;
        this.collegeName = collegeName;
        this.emailDomain = emailDomain;
        this.city = city;
        this.state = state;
        this.country = country;
        this.createdAt = createdAt;
    }

    public int getCollegeId() { return collegeId; }
    public void setCollegeId(int collegeId) { this.collegeId = collegeId; }

    public String getCollegeName() { return collegeName; }
    public void setCollegeName(String collegeName) { this.collegeName = collegeName; }

    public String getEmailDomain() { return emailDomain; }
    public void setEmailDomain(String emailDomain) { this.emailDomain = emailDomain; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public JSONObject toJsonObject() {
        JSONObject json = new JSONObject();
        json.put("collegeId", collegeId);
        json.put("collegeName", collegeName);
        json.put("emailDomain", emailDomain);
        json.put("city", city != null ? city : "");
        json.put("state", state != null ? state : "");
        json.put("country", country != null ? country : "");
        return json;
    }
}
