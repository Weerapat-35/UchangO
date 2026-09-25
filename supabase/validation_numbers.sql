-- อู่ช่างโอ: validation/number safety constraints
-- ใช้ NOT VALID เพื่อไม่ให้ข้อมูลเก่าที่มีอยู่ทำให้ migration ล้มเหลว
-- แต่ข้อมูลใหม่/การแก้ไขหลังจากนี้จะต้องผ่าน CHECK เหล่านี้

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_number_format_ck
  CHECK (phone_number IS NULL OR phone_number ~ '^0[0-9]{9}$') NOT VALID;

ALTER TABLE public.products
  ADD CONSTRAINT products_unit_price_nonnegative_ck
  CHECK (unit_price >= 0) NOT VALID,
  ADD CONSTRAINT products_cost_price_nonnegative_ck
  CHECK (cost_price >= 0) NOT VALID,
  ADD CONSTRAINT products_stock_nonnegative_ck
  CHECK (stock_quantity >= 0) NOT VALID;

ALTER TABLE public.services
  ADD CONSTRAINT services_base_price_nonnegative_ck
  CHECK (base_price >= 0) NOT VALID,
  ADD CONSTRAINT services_duration_positive_ck
  CHECK (estimated_duration_minutes >= 1) NOT VALID;

ALTER TABLE public.shopping_cart_items
  ADD CONSTRAINT shopping_cart_items_quantity_positive_ck
  CHECK (quantity >= 1) NOT VALID;

ALTER TABLE public.product_order_items
  ADD CONSTRAINT product_order_items_quantity_positive_ck
  CHECK (quantity >= 1) NOT VALID,
  ADD CONSTRAINT product_order_items_unit_price_nonnegative_ck
  CHECK (unit_price >= 0) NOT VALID,
  ADD CONSTRAINT product_order_items_total_price_nonnegative_ck
  CHECK (total_price >= 0) NOT VALID;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_subtotal_nonnegative_ck
  CHECK (subtotal_amount >= 0) NOT VALID,
  ADD CONSTRAINT product_orders_delivery_fee_nonnegative_ck
  CHECK (delivery_fee >= 0) NOT VALID,
  ADD CONSTRAINT product_orders_total_nonnegative_ck
  CHECK (total_amount >= 0) NOT VALID;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_quantity_positive_ck
  CHECK (quantity >= 1) NOT VALID;

ALTER TABLE public.garage_capacity
  ADD CONSTRAINT garage_capacity_max_bookings_nonnegative_ck
  CHECK (max_bookings >= 0) NOT VALID;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_year_range_ck
  CHECK (year IS NULL OR (year >= 1950 AND year <= 2100)) NOT VALID;

ALTER TABLE public.delivery_addresses
  ADD CONSTRAINT delivery_addresses_postal_code_format_ck
  CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$') NOT VALID,
  ADD CONSTRAINT delivery_addresses_latitude_range_ck
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) NOT VALID,
  ADD CONSTRAINT delivery_addresses_longitude_range_ck
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)) NOT VALID;
