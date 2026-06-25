-- Insert or update company information in app_settings table
-- Run this once to set company details that will be used in all reports and PDFs

INSERT INTO app_settings (setting_key, setting_value) VALUES
('company_name', 'Dynaclean Industries Pvt. Ltd.'),
('company_address_line1', '1st Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,'),
('company_address_line2', 'Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu - 641006'),
('company_email', 'sales@dynacleanindustries.com')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value);
