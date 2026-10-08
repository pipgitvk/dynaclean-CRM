const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS machine_attendance_punches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  emp_code VARCHAR(32) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  punch_datetime DATETIME NOT NULL,
  m_flag VARCHAR(64) NULL,
  raw_punch_date VARCHAR(64) NOT NULL,
  source_uid VARCHAR(128) NOT NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_machine_punch_source (source_uid),
  INDEX idx_machine_punch_datetime (punch_datetime),
  INDEX idx_machine_punch_emp (emp_code),
  INDEX idx_machine_punch_emp_datetime (emp_code, punch_datetime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const CREATE_SYNC_META = `
CREATE TABLE IF NOT EXISTS machine_attendance_sync_meta (
  id TINYINT PRIMARY KEY,
  last_sync_at DATETIME NOT NULL,
  source VARCHAR(32) NULL,
  synced_by VARCHAR(128) NULL,
  range_from DATE NULL,
  range_to DATE NULL,
  fetched INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function ensureMachineAttendancePunchesTable(conn) {
  await conn.execute(CREATE_TABLE);
  await conn.execute(CREATE_SYNC_META);
}
