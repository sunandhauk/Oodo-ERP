create extension if not exists pgcrypto;

create table if not exists app_tenants (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists app_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists app_role_permissions (
  role_id uuid not null references app_roles(id) on delete cascade,
  permission_id uuid not null references app_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  email text not null,
  password_hash text not null,
  full_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists app_user_roles (
  user_id uuid not null references app_users(id) on delete cascade,
  role_id uuid not null references app_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists app_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  uom text not null default 'unit',
  reorder_level numeric(14, 3) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists app_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null default 'warehouse',
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists app_request_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  tenant_id text not null,
  user_id uuid,
  method text not null,
  path text not null,
  status text not null default 'progress',
  progress_step text,
  progress_percent int not null default 0,
  response_status int,
  request_payload jsonb,
  response_payload jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists app_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  method text not null,
  path text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status int,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (tenant_id, method, path, idempotency_key)
);

create table if not exists app_demands (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  reference_no text not null,
  requested_by uuid,
  department text,
  needed_by date,
  priority text not null default 'normal',
  status text not null default 'draft',
  current_step text not null default 'draft',
  notes text,
  request_job_id uuid references app_request_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reference_no)
);

create table if not exists app_demand_lines (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references app_demands(id) on delete cascade,
  product_id uuid not null references app_products(id),
  quantity numeric(14, 3) not null,
  unit_price numeric(14, 3) not null default 0,
  line_status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists app_procurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  demand_id uuid references app_demands(id) on delete set null,
  po_number text not null,
  supplier_name text not null,
  status text not null default 'draft',
  expected_date date,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, po_number)
);

create table if not exists app_procurement_lines (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references app_procurements(id) on delete cascade,
  product_id uuid not null references app_products(id),
  quantity numeric(14, 3) not null,
  unit_cost numeric(14, 3) not null default 0,
  received_quantity numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists app_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  product_id uuid not null references app_products(id),
  location_id uuid references app_locations(id) on delete set null,
  movement_type text not null,
  quantity numeric(14, 3) not null,
  reference_type text,
  reference_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists app_fulfillments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  demand_id uuid references app_demands(id) on delete set null,
  fulfillment_no text not null,
  status text not null default 'planned',
  shipped_at timestamptz,
  delivered_at timestamptz,
  delivery_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, fulfillment_no)
);

create table if not exists app_fulfillment_lines (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null references app_fulfillments(id) on delete cascade,
  product_id uuid not null references app_products(id),
  quantity numeric(14, 3) not null,
  picked_quantity numeric(14, 3) not null default 0,
  packed_quantity numeric(14, 3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  user_id uuid references app_users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  status text not null default 'queued',
  data jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists app_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  actor_user_id uuid,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references app_tenants(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  bucket_name text not null,
  file_name text not null,
  content_type text not null,
  storage_path text not null,
  public_url text,
  created_by uuid,
  created_at timestamptz not null default now()
);

insert into app_tenants (id, name)
values ('default', 'Default Tenant')
on conflict (id) do nothing;

