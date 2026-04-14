

-- 1) Pipeline fields + optional hire_date until hired (split so one duplicate does not block the rest)
ALTER TABLE candidates
  ADD COLUMN emp_contact VARCHAR(64) NULL DEFAULT NULL AFTER candidate_name;

ALTER TABLE candidates
  ADD COLUMN marital_status VARCHAR(32) NULL DEFAULT NULL AFTER emp_contact;

ALTER TABLE candidates
  ADD COLUMN experience_type VARCHAR(32) NULL DEFAULT NULL COMMENT 'fresher | experience' AFTER marital_status;

ALTER TABLE candidates
  ADD COLUMN interview_at DATETIME NULL DEFAULT NULL AFTER experience_type;

ALTER TABLE candidates
  ADD COLUMN interview_mode VARCHAR(64) NULL DEFAULT NULL AFTER interview_at;

ALTER TABLE candidates
  ADD COLUMN status VARCHAR(80) NOT NULL DEFAULT 'Shortlisted for interview' AFTER interview_mode;

ALTER TABLE candidates
  ADD COLUMN tag VARCHAR(64) NULL DEFAULT NULL AFTER status;

ALTER TABLE candidates
  MODIFY COLUMN hire_date DATE NULL DEFAULT NULL;

-- 2) Rescheduled / next follow-up slots
ALTER TABLE candidates
  ADD COLUMN rescheduled_at DATETIME NULL COMMENT 'New interview slot when status is Rescheduled'
    AFTER interview_at;

ALTER TABLE candidates
  ADD COLUMN next_followup_at DATETIME NULL COMMENT 'Next follow-up slot when status is next-follow-up'
    AFTER rescheduled_at;

-- 3) Offer package + probation
ALTER TABLE candidates
  ADD COLUMN `package` VARCHAR(255) NULL DEFAULT NULL AFTER hire_date;

ALTER TABLE candidates
  ADD COLUMN probation_months TINYINT UNSIGNED NULL DEFAULT NULL AFTER `package`;

-- 4) Selected-candidate + scores + HR rating + salary (API requires hr_interview_score, hr_score_rating, current_salary on save)
ALTER TABLE candidates
  ADD COLUMN selected_resume VARCHAR(500) NULL DEFAULT NULL AFTER probation_months;

ALTER TABLE candidates
  ADD COLUMN mgmt_interview_score TINYINT UNSIGNED NULL DEFAULT NULL AFTER selected_resume;

ALTER TABLE candidates
  ADD COLUMN hr_interview_score TINYINT UNSIGNED NULL DEFAULT NULL AFTER mgmt_interview_score;

ALTER TABLE candidates
  ADD COLUMN hr_score_rating VARCHAR(32) NULL DEFAULT NULL COMMENT 'average | poor | good | very-good'
  AFTER hr_interview_score;

ALTER TABLE candidates
  ADD COLUMN current_salary VARCHAR(255) NULL DEFAULT NULL AFTER hr_score_rating;

ALTER TABLE candidates
  ADD COLUMN expected_salary VARCHAR(255) NULL DEFAULT NULL AFTER current_salary;
