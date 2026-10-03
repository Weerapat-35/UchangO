-- Add a stable human-readable order number used by the product-order flow.
alter table public.product_orders
add column if not exists order_number text;

create unique index if not exists product_orders_order_number_unique
on public.product_orders(order_number)
where order_number is not null;
