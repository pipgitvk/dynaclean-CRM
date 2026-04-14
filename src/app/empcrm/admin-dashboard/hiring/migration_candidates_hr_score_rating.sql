-- HR qualitative score after numeric HR interview score (average | poor | good | very-good)
ALTER TABLE candidates
  ADD COLUMN hr_score_rating VARCHAR(32) NULL DEFAULT NULL COMMENT 'average | poor | good | very-good'
  AFTER hr_interview_score;
