-- Create bank_masters table for Bank Management feature
CREATE TABLE IF NOT EXISTS `bank_masters` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bank_name`           VARCHAR(150) NOT NULL,
  `ifsc`                VARCHAR(20)  NULL,
  `account_number`      VARCHAR(50)  NULL,
  `branch_address`      TEXT         NULL,
  `account_holder_name` VARCHAR(200) NULL,
  `created_at`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP    NULL     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add bank_id and account_number columns to statements table
ALTER TABLE `statements`
  ADD COLUMN IF NOT EXISTS `bank_id`        INT UNSIGNED NULL AFTER `cancelled_transaction_id`,
  ADD COLUMN IF NOT EXISTS `account_number` VARCHAR(50)  NULL AFTER `bank_id`;
