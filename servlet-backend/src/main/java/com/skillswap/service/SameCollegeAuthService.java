package com.skillswap.service;

import com.skillswap.dao.UserDao;
import com.skillswap.model.UserCollegeStatus;

import java.sql.SQLException;
import java.util.Optional;

public class SameCollegeAuthService {

    private final UserDao userDao = new UserDao();

    public static class PeerAuthResult {
        public boolean authorized;
        public int statusCode;
        public String message;
        public Integer collegeId;
        public String collegeName;
    }

    /**
     * Authorizes an interaction between two students, requiring both to be VERIFIED members of the SAME college.
     */
    public PeerAuthResult authorizePeerInteraction(int user1Id, int user2Id) throws SQLException {
        PeerAuthResult res = new PeerAuthResult();

        if (user1Id <= 0 || user2Id <= 0) {
            res.authorized = false;
            res.statusCode = 400;
            res.message = "Invalid student IDs provided.";
            return res;
        }

        if (user1Id == user2Id) {
            res.authorized = false;
            res.statusCode = 400;
            res.message = "Self-interaction prohibited.";
            return res;
        }

        Optional<UserCollegeStatus> u1Opt = userDao.getUserCollegeStatus(user1Id);
        Optional<UserCollegeStatus> u2Opt = userDao.getUserCollegeStatus(user2Id);

        if (u1Opt.isEmpty() || u2Opt.isEmpty()) {
            res.authorized = false;
            res.statusCode = 404;
            res.message = "One or both students were not found.";
            return res;
        }

        UserCollegeStatus u1 = u1Opt.get();
        UserCollegeStatus u2 = u2Opt.get();

        if (!u1.isVerified()) {
            res.authorized = false;
            res.statusCode = 403;
            res.message = "Access restricted: you must verify your institutional college email before exchanging skills or joining meetings.";
            return res;
        }

        if (!u2.isVerified()) {
            res.authorized = false;
            res.statusCode = 403;
            res.message = "Access restricted: peer student " + u2.getName() + " has not completed institutional email verification.";
            return res;
        }

        if (!u1.getCollegeId().equals(u2.getCollegeId())) {
            res.authorized = false;
            res.statusCode = 403;
            res.message = "Cross-college interaction prohibited: students belong to different institutions (" +
                          u1.getCollegeName() + " vs " + u2.getCollegeName() + "). SkillSwap Campus restricts peer exchanges to the same college community.";
            return res;
        }

        res.authorized = true;
        res.statusCode = 200;
        res.message = "Same-college authorization granted for " + u1.getCollegeName();
        res.collegeId = u1.getCollegeId();
        res.collegeName = u1.getCollegeName();

        return res;
    }

    /**
     * Checks if a single user has completed institutional verification.
     */
    public boolean isUserVerified(int userId) throws SQLException {
        Optional<UserCollegeStatus> opt = userDao.getUserCollegeStatus(userId);
        return opt.isPresent() && opt.get().isVerified();
    }
}
