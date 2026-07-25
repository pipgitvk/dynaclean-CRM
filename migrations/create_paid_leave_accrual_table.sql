-- Create table to track paid leave accrual (FIRST - no dependencies)
CREATE TABLE IF NOT EXISTS `paid_leave_accrual` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `empId` int(11) NOT NULL,
  `accrual_date` date NOT NULL COMMENT 'Date from which this leave will be credited',
  `total_days` int(11) NOT NULL,
  `remaining_days` int(11) NOT NULL DEFAULT 0 COMMENT 'Days not yet used',
  `status` enum('active','expired','cancelled') DEFAULT 'active',
  `expiry_date` date DEFAULT NULL COMMENT 'When this accrual expires',
  `description` varchar(255) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_username` (`username`),
  KEY `idx_accrual_date` (`accrual_date`),
  KEY `idx_empId` (`empId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create table to track which accrual was used for which leave (SECOND - depends on paid_leave_accrual and employee_leaves)
CREATE TABLE IF NOT EXISTS `paid_leave_usage_mapping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `accrual_id` int(11) NOT NULL,
  `leave_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `days_used` int(11) NOT NULL,
  `used_date` date DEFAULT NULL COMMENT 'Date when leave was taken',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_accrual_id` (`accrual_id`),
  KEY `idx_leave_id` (`leave_id`),
  KEY `idx_username` (`username`),
  CONSTRAINT `fk_mapping_accrual` FOREIGN KEY (`accrual_id`) REFERENCES `paid_leave_accrual` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mapping_leave` FOREIGN KEY (`leave_id`) REFERENCES `employee_leaves` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
