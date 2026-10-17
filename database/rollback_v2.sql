-- ====================================================================
-- SkillSwap Campus - Rollback Migration v2
-- Use ONLY if you need to revert the college verification and online meetings migration
-- ====================================================================

-- 1. Drop online_meetings table
DROP TABLE IF EXISTS online_meetings;

-- 2. Drop college_verifications table
DROP TABLE IF EXISTS college_verifications;

-- 3. Drop foreign key and columns from users table
ALTER TABLE users DROP FOREIGN KEY fk_user_college;
ALTER TABLE users DROP COLUMN IF EXISTS college_id;
ALTER TABLE users DROP COLUMN IF EXISTS institutional_email;
ALTER TABLE users DROP COLUMN IF EXISTS verification_status;
ALTER TABLE users DROP COLUMN IF EXISTS verified_at;

-- 4. Drop colleges table
DROP TABLE IF EXISTS colleges;
