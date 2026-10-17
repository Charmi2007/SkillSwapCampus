const db = require('../backend/config/db');

(async () => {
    const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } else { console.log('PASS:', msg); } };
    const BASE = 'http://localhost:8080/skillswap-servlet';

    try {
        // 1. Create accepted swap request between User 1 and User 2
        const [swapRes] = await db.promise().query(
            "INSERT INTO swap_requests (sender_id, receiver_id, skill_offered, skill_requested, status) VALUES (1, 2, 1, 1, 'ACCEPTED');"
        );
        const reqId = swapRes.insertId;

        // 2. Create scheduled session
        const [sessRes] = await db.promise().query(
            "INSERT INTO sessions (request_id, session_date, session_time, duration, mode, status) VALUES (?, '2026-10-25', '14:00:00', 60, 'ONLINE', 'SCHEDULED');",
            [reqId]
        );
        const sessId = sessRes.insertId;
        console.log('Created test session ID:', sessId);

        // 3. User 3 (Stanford, outsider) tries to schedule meeting for session between User 1 and 2 -> MUST BE FORBIDDEN (403)
        const outsiderSched = await fetch(BASE + '/api/meetings/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessId, userId: 3, title: 'Hacked Meeting' })
        });
        assert(outsiderSched.status === 403, 'Outsider scheduling blocked (403)');

        // 4. User 1 (Participant, Vardhaman) schedules online meeting -> MUST SUCCEED (201)
        const legitSched = await fetch(BASE + '/api/meetings/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: sessId,
                userId: 1,
                title: 'Java and Python Peer Study Session',
                scheduledStart: '2026-10-25 14:00:00',
                durationMinutes: 60
            })
        });
        const schedData = await legitSched.json();
        assert(legitSched.status === 201 && schedData.meeting, 'Meeting created: ' + JSON.stringify(schedData.meeting.roomName));
        const meetingId = schedData.meeting.meetingId;
        const meetingUrl = schedData.meeting.meetingUrl;
        const passcode = schedData.meeting.passcode;
        assert(meetingUrl.startsWith('https://meet.jit.si/'), 'Meeting URL matches trusted Jitsi domain: ' + meetingUrl);
        assert(passcode && passcode.length === 6, 'Meeting passcode generated: ' + passcode);

        // 5. User 3 (Outsider) tries to retrieve meeting link -> MUST BE FORBIDDEN (403)
        const outsiderGet = await fetch(BASE + '/api/meetings/session?sessionId=' + sessId + '&userId=3');
        assert(outsiderGet.status === 403, 'Outsider retrieval blocked (403)');

        // 6. User 2 (Peer participant) retrieves meeting link -> MUST SUCCEED (200) with identical link
        const peerGet = await fetch(BASE + '/api/meetings/session?sessionId=' + sessId + '&userId=2');
        const peerData = await peerGet.json();
        assert(peerGet.ok && peerData.meeting.meetingUrl === meetingUrl, 'Peer retrieved identical meeting URL: ' + peerData.meeting.meetingUrl);

        // 7. Get user meetings list for User 1
        const userMeets = await fetch(BASE + '/api/meetings/user?userId=1');
        const userMeetsData = await userMeets.json();
        assert(userMeets.ok && userMeetsData.meetings.length > 0, 'User 1 meetings list retrieved: ' + userMeetsData.count);

        // 8. Update status to COMPLETED
        const statusUpdate = await fetch(BASE + '/api/meetings/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId: meetingId, userId: 1, status: 'COMPLETED' })
        });
        assert(statusUpdate.ok, 'Meeting status updated to COMPLETED');

        // 9. Verify associated session was updated to COMPLETED in database
        const [sessCheck] = await db.promise().query('SELECT status FROM sessions WHERE session_id = ?;', [sessId]);
        assert(sessCheck[0].status === 'COMPLETED', 'Associated session status automatically updated to COMPLETED');

        console.log('ALL SERVLET MEETING MANAGEMENT CHECKS PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test error:', e);
        process.exit(1);
    }
})();
