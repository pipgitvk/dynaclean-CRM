ALTER TABLE product_stock_request
ADD COLUMN customer_id INT NULL,
ADD COLUMN client_name VARCHAR(255) NULL,
ADD COLUMN client_company_name VARCHAR(255) NULL,
ADD COLUMN client_number VARCHAR(50) NULL,
ADD COLUMN client_email VARCHAR(255) NULL,
ADD COLUMN client_gstin VARCHAR(50) NULL,
ADD COLUMN customer_address TEXT NULL;
