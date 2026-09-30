-- Prospect Submissions (header PDF + notes → reporting manager / superadmin review).
-- Manual run: execute this SQL on your CRM MySQL database (e.g. dynaclean_crmm).
-- Optional: the app also runs CREATE TABLE IF NOT EXISTS via ensureProspectSubmissionsTable()
-- on first API use. Use this file for DBA setup or when the DB user cannot CREATE.

CREATE TABLE IF NOT EXISTS prospect_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submitted_by VARCHAR(255) NOT NULL,
  reporting_manager VARCHAR(255) NULL,
  notes TEXT NULL,
  pdf_path VARCHAR(1000) NOT NULL COMMENT 'Cloudinary secure_url (PDF/image)',
  pdf_original_name VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prospect_submissions_submitted_by (submitted_by),
  INDEX idx_prospect_submissions_reporting_manager (reporting_manager),
  INDEX idx_prospect_submissions_created_at (created_at),
  INDEX idx_prospect_submissions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
