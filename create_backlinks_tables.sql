-- Backlinks Table
CREATE TABLE IF NOT EXISTS backlinks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  website VARCHAR(500) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  followup_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_to VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_website (website),
  INDEX idx_keyword (keyword),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_followup_date (followup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
