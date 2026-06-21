alter table app_products
add column if not exists sales_price numeric(14, 3) not null default 0,
add column if not exists cost_price numeric(14, 3) not null default 0,
add column if not exists on_hand_qty numeric(14, 3) not null default 0,
add column if not exists category text not null default 'General',
add column if not exists image_url text,
add column if not exists procure_on_demand boolean not null default false,
add column if not exists procure_source text,
add column if not exists minimum_qty numeric(14, 3) not null default 0,
add column if not exists free_to_use_qty numeric(14, 3) not null default 0,
add column if not exists vendor_name text not null default '',
add column if not exists bom_reference text not null default '';

create table if not exists app_sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  reference_no text not null,
  customer text not null,
  salesperson text not null,
  address text not null,
  status text not null default 'Draft',
  order_date date not null default current_date,
  order_time text not null default to_char(now(), 'HH12:MI AM'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reference_no)
);

create table if not exists app_sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references app_sales_orders(id) on delete cascade,
  product_name text not null,
  availability text not null default 'In Stock',
  ordered_quantity numeric(14, 3) not null,
  delivered_quantity numeric(14, 3) not null default 0,
  units text not null default 'Nos',
  unit_price numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists app_manufacturing_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  reference_no text not null,
  finished_product text not null,
  assignee text not null,
  status text not null default 'Draft',
  component_status text not null default 'Available',
  quantity numeric(14, 3) not null default 1,
  unit text not null default 'Units',
  schedule_date date not null default current_date,
  bill_of_material text not null,
  order_date date not null default current_date,
  order_time text not null default to_char(now(), 'HH12:MI AM'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reference_no)
);

create table if not exists app_manufacturing_order_components (
  id uuid primary key default gen_random_uuid(),
  manufacturing_order_id uuid not null references app_manufacturing_orders(id) on delete cascade,
  component text not null,
  availability text not null default 'Available',
  to_consume_units numeric(14, 3) not null,
  consume_units numeric(14, 3) not null default 0,
  unit_cost numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists app_manufacturing_work_orders (
  id uuid primary key default gen_random_uuid(),
  manufacturing_order_id uuid not null references app_manufacturing_orders(id) on delete cascade,
  operation text not null,
  assignee text not null,
  planned_hours numeric(14, 3) not null,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists app_boms (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  reference_no text not null,
  finished_product text not null,
  quantity numeric(14, 3) not null default 1,
  unit text not null default 'Units',
  alternative text not null default '',
  attached_log text not null default '',
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reference_no)
);

create table if not exists app_bom_components (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references app_boms(id) on delete cascade,
  component text not null,
  availability text not null default 'Available',
  to_consume_units numeric(14, 3) not null,
  consume_units numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists app_bom_work_orders (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references app_boms(id) on delete cascade,
  operation text not null,
  assignee text not null,
  planned_hours numeric(14, 3) not null,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

insert into app_products (tenant_id, sku, name, description, uom, reorder_level, status, sales_price, cost_price, on_hand_qty, category, procure_on_demand, procure_source, minimum_qty, free_to_use_qty, vendor_name, bom_reference)
values
  ('default', 'PRD-000001', 'Door Frames', 'Prebuilt door frame assembly', 'Nos', 10, 'active', 12000, 8200, 50, 'Structure', false, null, 10, 40, 'Masterfast Ltd', ''),
  ('default', 'PRD-000002', 'Lighting Frame', 'Lighting frame module', 'Nos', 8, 'active', 15000, 11000, 12, 'Electrical', false, null, 8, 10, 'Nova Industrial', ''),
  ('default', 'PRD-000003', 'Control Cabinet', 'Industrial control cabinet', 'Nos', 12, 'active', 24000, 18000, 18, 'Electrical', true, 'purchase', 12, 6, 'Vector Materials', ''),
  ('default', 'PRD-000004', 'Assembly Kit', 'Assembly kit for field teams', 'Nos', 6, 'active', 3500, 2700, 8, 'Assembly', false, null, 6, 4, 'Blue Edge Traders', ''),
  ('default', 'PRD-000005', 'Panel Board', 'Power distribution panel board', 'Nos', 15, 'active', 48000, 39000, 92, 'Accessories', true, 'manufacturing', 15, 20, '', 'BOM-000005'),
  ('default', 'PRD-000006', 'Metal Shelf', 'Industrial storage shelf', 'Nos', 7, 'active', 6000, 4900, 24, 'Quality', false, null, 7, 16, 'Apex Supplies', '')
on conflict (tenant_id, sku) do update set
  name = excluded.name,
  description = excluded.description,
  uom = excluded.uom,
  reorder_level = excluded.reorder_level,
  status = excluded.status,
  sales_price = excluded.sales_price,
  cost_price = excluded.cost_price,
  on_hand_qty = excluded.on_hand_qty,
  category = excluded.category,
  procure_on_demand = excluded.procure_on_demand,
  procure_source = excluded.procure_source,
  minimum_qty = excluded.minimum_qty,
  free_to_use_qty = excluded.free_to_use_qty,
  vendor_name = excluded.vendor_name,
  bom_reference = excluded.bom_reference;

insert into app_sales_orders (tenant_id, reference_no, customer, salesperson, address, status, order_date, order_time)
values
  ('default', 'SO-000001', 'Suzuki India', 'Ravi Jadeja', '12, ERP Avenue, Chennai', 'Confirmed', current_date - 1, '09:15 AM'),
  ('default', 'SO-000002', 'Tata Motors', 'Salman Sheikh', '24, Industrial Estate, Chennai', 'Partially Delivered', current_date - 2, '10:30 AM'),
  ('default', 'SO-000003', 'Reliance Retail', 'Amit Sharma', '48, Logistics Park, Chennai', 'Pending', current_date - 3, '11:45 AM'),
  ('default', 'SO-000004', 'Infosys Limited', 'Neha Verma', '77, Tech Park, Bengaluru', 'Delivered', current_date - 4, '01:15 PM')
on conflict (tenant_id, reference_no) do update set
  customer = excluded.customer,
  salesperson = excluded.salesperson,
  address = excluded.address,
  status = excluded.status,
  order_date = excluded.order_date,
  order_time = excluded.order_time,
  updated_at = now();

insert into app_manufacturing_orders (tenant_id, reference_no, finished_product, assignee, status, component_status, quantity, unit, schedule_date, bill_of_material, order_date, order_time)
values
  ('default', 'MO-000001', 'Door Frames', 'Amit Sharma', 'Confirmed', 'Available', 4, 'Units', current_date + 1, 'BOM-0001', current_date - 1, '08:20 AM'),
  ('default', 'MO-000002', 'Lighting Frame', 'Neha Verma', 'In Progress', 'Partial', 2, 'Units', current_date + 2, 'BOM-0002', current_date - 2, '09:45 AM'),
  ('default', 'MO-000003', 'Control Cabinet', 'Ravi Patel', 'Done', 'Available', 1, 'Units', current_date + 3, 'BOM-0003', current_date - 3, '10:10 AM')
on conflict (tenant_id, reference_no) do update set
  finished_product = excluded.finished_product,
  assignee = excluded.assignee,
  status = excluded.status,
  component_status = excluded.component_status,
  quantity = excluded.quantity,
  unit = excluded.unit,
  schedule_date = excluded.schedule_date,
  bill_of_material = excluded.bill_of_material,
  order_date = excluded.order_date,
  order_time = excluded.order_time,
  updated_at = now();

insert into app_boms (tenant_id, reference_no, finished_product, quantity, unit, alternative, attached_log, status)
values
  ('default', 'BOM-000001', 'Door Frames', 4, 'Units', 'Steel', 'BOM-000001.pdf', 'Active'),
  ('default', 'BOM-000002', 'Lighting Frame', 2, 'Units', 'Aluminium', 'BOM-000002.pdf', 'Draft'),
  ('default', 'BOM-000003', 'Control Cabinet', 1, 'Units', 'Premium', 'BOM-000003.pdf', 'Active')
on conflict (tenant_id, reference_no) do update set
  finished_product = excluded.finished_product,
  quantity = excluded.quantity,
  unit = excluded.unit,
  alternative = excluded.alternative,
  attached_log = excluded.attached_log,
  status = excluded.status,
  updated_at = now();

insert into app_sales_order_lines (sales_order_id, product_name, availability, ordered_quantity, delivered_quantity, units, unit_price)
select o.id, v.product_name, v.availability, v.ordered_quantity, v.delivered_quantity, v.units, v.unit_price
from app_sales_orders o
join (
  values
    ('SO-000001', 'Door Frames', 'In Stock', 4::numeric, 4::numeric, 'Nos', 12000::numeric),
    ('SO-000002', 'Lighting Frame', 'Reserved', 3::numeric, 2::numeric, 'Nos', 15000::numeric),
    ('SO-000003', 'Control Cabinet', 'Limited', 2::numeric, 0::numeric, 'Nos', 24000::numeric),
    ('SO-000004', 'Assembly Kit', 'In Stock', 6::numeric, 6::numeric, 'Nos', 3500::numeric)
) as v(reference_no, product_name, availability, ordered_quantity, delivered_quantity, units, unit_price)
  on o.reference_no = v.reference_no
where not exists (
  select 1 from app_sales_order_lines line
  where line.sales_order_id = o.id and line.product_name = v.product_name
);

insert into app_manufacturing_order_components (manufacturing_order_id, component, availability, to_consume_units, consume_units, unit_cost)
select o.id, v.component, v.availability, v.to_consume_units, v.consume_units, v.unit_cost
from app_manufacturing_orders o
join (
  values
    ('MO-000001', 'Aluminium Frame', 'Available', 4::numeric, 4::numeric, 2400::numeric),
    ('MO-000002', 'LED Strip', 'Partial', 2::numeric, 1::numeric, 1800::numeric),
    ('MO-000003', 'Power Board', 'Available', 1::numeric, 1::numeric, 4200::numeric)
) as v(reference_no, component, availability, to_consume_units, consume_units, unit_cost)
  on o.reference_no = v.reference_no
where not exists (
  select 1 from app_manufacturing_order_components component
  where component.manufacturing_order_id = o.id and component.component = v.component
);

insert into app_manufacturing_work_orders (manufacturing_order_id, operation, assignee, planned_hours, status)
select o.id, v.operation, v.assignee, v.planned_hours, v.status
from app_manufacturing_orders o
join (
  values
    ('MO-000001', 'Cutting', 'Amit Sharma', 2::numeric, 'Done'),
    ('MO-000002', 'Assembly', 'Neha Verma', 3::numeric, 'In Progress'),
    ('MO-000003', 'Testing', 'Ravi Patel', 1.5::numeric, 'Ready')
) as v(reference_no, operation, assignee, planned_hours, status)
  on o.reference_no = v.reference_no
where not exists (
  select 1 from app_manufacturing_work_orders work_order
  where work_order.manufacturing_order_id = o.id and work_order.operation = v.operation
);

insert into app_bom_components (bom_id, component, availability, to_consume_units, consume_units)
select b.id, v.component, v.availability, v.to_consume_units, v.consume_units
from app_boms b
join (
  values
    ('BOM-000001', 'Aluminium Frame', 'Available', 4::numeric, 4::numeric),
    ('BOM-000002', 'LED Strip', 'Partial', 2::numeric, 1::numeric),
    ('BOM-000003', 'Power Board', 'Available', 1::numeric, 1::numeric)
) as v(reference_no, component, availability, to_consume_units, consume_units)
  on b.reference_no = v.reference_no
where not exists (
  select 1 from app_bom_components component
  where component.bom_id = b.id and component.component = v.component
);

insert into app_bom_work_orders (bom_id, operation, assignee, planned_hours, status)
select b.id, v.operation, v.assignee, v.planned_hours, v.status
from app_boms b
join (
  values
    ('BOM-000001', 'Cutting', 'Amit Sharma', 2::numeric, 'Done'),
    ('BOM-000002', 'Assembly', 'Neha Verma', 3::numeric, 'Ready'),
    ('BOM-000003', 'Testing', 'Ravi Patel', 1.5::numeric, 'In Progress')
) as v(reference_no, operation, assignee, planned_hours, status)
  on b.reference_no = v.reference_no
where not exists (
  select 1 from app_bom_work_orders work_order
  where work_order.bom_id = b.id and work_order.operation = v.operation
);
