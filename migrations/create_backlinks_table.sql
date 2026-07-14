-- Create Backlinks Table
CREATE TABLE IF NOT EXISTS backlinks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  website VARCHAR(500) NOT NULL,
  keyword VARCHAR(255),
  email VARCHAR(255),
  followup_date DATE,
  status ENUM('pending', 'submitted', 'approved', 'deleted') DEFAULT 'pending',
  assigned_to VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_followup_date (followup_date),
  INDEX idx_website (website)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
