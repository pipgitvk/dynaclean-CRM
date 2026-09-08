-- Add acknowledgement remark column to attendance_regularization_requests
-- This stores the remark/comment provided by admin/manager when acknowledging an attendance regularization request
ALTER TABLE `attendance_regularization_requests`
  ADD COLUMN `acknowledgement_remark` longtext DEFAULT NULL COMMENT 'Remark/comment provided by the person acknowledging the attendance regularization request';
