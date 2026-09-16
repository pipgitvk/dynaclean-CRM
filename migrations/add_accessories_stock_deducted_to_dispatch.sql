-- Track whether accessory spare stock has been deducted for a dispatch row
ALTER TABLE dispatch
  ADD COLUMN accessories_stock_deducted TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = accessory spare stock deducted for this dispatch row'
    AFTER stock_deducted;
