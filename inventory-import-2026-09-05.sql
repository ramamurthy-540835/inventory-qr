DECLARE import_date DATE DEFAULT DATE '2026-09-05';
DECLARE import_timestamp TIMESTAMP DEFAULT TIMESTAMP '2026-09-05 00:00:00+05:30';

MERGE `aidirac-503309.inventory_management.inventory_stock` T
USING UNNEST([
  STRUCT('STK-XLSX-001' AS stock_id, 'Rice' AS material_name, 'rice-grains' AS category, 5 AS quantity, 'KG' AS unit, 160.30 AS price, 32.06 AS rate_per_kg),
  STRUCT('STK-XLSX-002', 'Raw Rice', 'rice-grains', 1, 'KG', 67.00, 67.00),
  STRUCT('STK-XLSX-003', 'Atta', 'atta-flour', 1, 'KG', 51.80, 51.80),
  STRUCT('STK-XLSX-004', 'Sugar', 'essentials', 500, 'GRAM', 47.60, NULL),
  STRUCT('STK-XLSX-005', 'Samba Rava / Sooji', 'atta-flour', 500, 'GRAM', 28.00, NULL),
  STRUCT('STK-XLSX-006', 'Toor Dal', 'dals-pulses', 1, 'KG', 182.00, 182.00),
  STRUCT('STK-XLSX-007', 'Black Channa', 'dals-pulses', 500, 'GRAM', 59.50, NULL),
  STRUCT('STK-XLSX-008', 'Sambar Powder', 'spices', 100, 'GRAM', 50.40, NULL),
  STRUCT('STK-XLSX-009', 'Elaichi / Cardamom', 'spices', 5, 'GRAM', 33.60, NULL),
  STRUCT('STK-XLSX-010', 'Soombu / Saunf', 'spices', 100, 'GRAM', 56.00, NULL),
  STRUCT('STK-XLSX-011', 'Jeera', 'spices', 100, 'GRAM', 47.60, NULL),
  STRUCT('STK-XLSX-012', 'Pepper', 'spices', 100, 'GRAM', 112.00, NULL),
  STRUCT('STK-XLSX-013', 'Groundnut', 'snacks', 100, 'GRAM', 23.80, NULL),
  STRUCT('STK-XLSX-014', 'Gingelly Oil', 'oil-ghee', 1, 'LITRE', 420.00, NULL),
  STRUCT('STK-XLSX-015', 'Cashew Nut', 'snacks', 50, 'GRAM', 67.20, NULL),
  STRUCT('STK-XLSX-016', 'Puli / Tamarind', 'essentials', 500, 'GRAM', 210.00, NULL),
  STRUCT('STK-XLSX-017', 'Gram Dal / Channa Dal', 'dals-pulses', 500, 'GRAM', 67.20, NULL),
  STRUCT('STK-XLSX-018', 'Moong Dal', 'dals-pulses', 500, 'GRAM', 77.00, NULL)
]) S
ON T.stock_id = S.stock_id
WHEN MATCHED THEN UPDATE SET
  material_name = S.material_name, category = S.category, quantity = CAST(S.quantity AS NUMERIC),
  unit = S.unit, price = CAST(S.price AS NUMERIC), rate_per_kg = CAST(S.rate_per_kg AS NUMERIC),
  status = 'AVAILABLE', stock_date = import_date, updated_at = import_timestamp
WHEN NOT MATCHED THEN INSERT
  (stock_id, material_id, material_name, category, quantity, unit, price, rate_per_kg,
   stock_date, packing_date, expiry_date, status, created_at, updated_at)
VALUES
  (S.stock_id, NULL, S.material_name, S.category, CAST(S.quantity AS NUMERIC), S.unit, CAST(S.price AS NUMERIC), CAST(S.rate_per_kg AS NUMERIC),
   import_date, NULL, NULL, 'AVAILABLE', import_timestamp, import_timestamp);
