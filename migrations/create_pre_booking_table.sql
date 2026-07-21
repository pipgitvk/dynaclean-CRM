    CREATE TABLE IF NOT EXISTS pre_booking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    item_code VARCHAR(100),
    quantity INT DEFAULT 1,
    expected_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    INDEX idx_customer_id (customer_id),
    INDEX idx_created_at (created_at)
    );
