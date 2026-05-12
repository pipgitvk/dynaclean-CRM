-- Migration to add 'Claimed' to status enum in dd_records table
ALTER TABLE dd_records
MODIFY COLUMN status ENUM('Assigned', 'Filled', 'Issued', 'Sent to Client', 'Claimed') DEFAULT 'Assigned';
