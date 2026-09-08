-- Add acknowledgement remark column to employee_leaves
-- This stores the remark/comment provided by the reporting manager or superadmin when acknowledging a leave
ALTER TABLE `employee_leaves`
  ADD COLUMN `acknowledgement_remark` longtext DEFAULT NULL COMMENT 'Remark/comment provided by the person acknowledging the leave (Reporting Manager or SuperAdmin)';
