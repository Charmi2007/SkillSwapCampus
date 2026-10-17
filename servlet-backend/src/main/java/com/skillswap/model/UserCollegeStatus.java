package com.skillswap.model;

import org.json.JSONObject;
import java.sql.Timestamp;

public class UserCollegeStatus {
    private int userId;
    private String name;
    private String email;
    private Integer collegeId;
    private String collegeName;
    private String institutionalEmail;
    private String verificationStatus; // UNVERIFIED, PENDING, VERIFIED
    private Timestamp verifiedAt;

    public UserCollegeStatus() {}

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Integer getCollegeId() { return collegeId; }
    public void setCollegeId(Integer collegeId) { this.collegeId = collegeId; }

    public String getCollegeName() { return collegeName; }
    public void setCollegeName(String collegeName) { this.collegeName = collegeName; }

    public String getInstitutionalEmail() { return institutionalEmail; }
    public void setInstitutionalEmail(String institutionalEmail) { this.institutionalEmail = institutionalEmail; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public Timestamp getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Timestamp verifiedAt) { this.verifiedAt = verifiedAt; }

    public boolean isVerified() {
        return "VERIFIED".equalsIgnoreCase(verificationStatus) && collegeId != null && collegeId > 0;
    }

    public JSONObject toJsonObject() {
        JSONObject json = new JSONObject();
        json.put("userId", userId);
        json.put("name", name != null ? name : "");
        json.put("email", email != null ? email : "");
        json.put("collegeId", collegeId != null ? collegeId : JSONObject.NULL);
        json.put("collegeName", collegeName != null ? collegeName : "");
        json.put("institutionalEmail", institutionalEmail != null ? institutionalEmail : "");
        json.put("verificationStatus", verificationStatus != null ? verificationStatus : "UNVERIFIED");
        json.put("verifiedAt", verifiedAt != null ? verifiedAt.toString() : "");
        json.put("isVerified", isVerified());
        return json;
    }
}
