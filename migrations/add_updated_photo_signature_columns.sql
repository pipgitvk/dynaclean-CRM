
-- Add columns to employee_profile_submissions for updated/reassigned images
ALTER TABLE employee_profile_submissions 
ADD COLUMN IF NOT EXISTS updated_profile_photo VARCHAR(500) NULL,
ADD COLUMN IF NOT EXISTS updated_signature VARCHAR(500) NULL;

-- Add columns to employee_profiles for storing the final approved updated images
ALTER TABLE employee_profiles 
ADD COLUMN IF NOT EXISTS updated_profile_photo VARCHAR(500) NULL,
ADD COLUMN IF NOT EXISTS updated_signature VARCHAR(500) NULL;
