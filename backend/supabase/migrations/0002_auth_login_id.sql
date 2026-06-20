alter table app_users
add column if not exists login_id text;

update app_users
set login_id = coalesce(
  nullif(lower(regexp_replace(full_name, '[^a-zA-Z0-9]+', '', 'g')), ''),
  split_part(lower(email), '@', 1),
  'user'
)
where login_id is null;

alter table app_users
alter column login_id set not null;

create unique index if not exists app_users_tenant_login_id_unique
on app_users (tenant_id, lower(login_id));
