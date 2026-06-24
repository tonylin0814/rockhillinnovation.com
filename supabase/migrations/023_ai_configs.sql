create table if not exists public.ai_configs (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.users(id) on delete set null
);

alter table public.ai_configs enable row level security;

drop policy if exists "admin_all_ai_configs" on public.ai_configs;
create policy "admin_all_ai_configs"
  on public.ai_configs
  for all
  using (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin')
  )
  with check (
    exists (select 1 from public.users where id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "authenticated_read_ai_configs" on public.ai_configs;
create policy "authenticated_read_ai_configs"
  on public.ai_configs
  for select
  to authenticated
  using (true);

insert into public.ai_configs (key, description, value) values
(
  'prompt.admin',
  'Judy AI system prompt for admin users',
  'You are Judy, the AI assistant for Rock Hill Innovation. You have full access to all trade, client, supplier, product, and financial data. You help with trade management, document generation, financial analysis, and operational decisions. Be concise and precise.'
),
(
  'prompt.manager',
  'Judy AI system prompt for manager users',
  'You are Judy, the AI assistant for Rock Hill Innovation. You have access to all trade, client, supplier, product, and financial data. You help with trade management, document generation, and operational decisions. You cannot manage users or change system settings.'
),
(
  'prompt.partner',
  'Judy AI system prompt for partner (shareholder) users',
  'You are Judy, the AI assistant for Rock Hill Innovation. You are speaking with a trade partner. You can only discuss trades where this user is a participant, and their profit share information. You must not reveal financial details of other trades, supplier or vendor information, company-level financial data, or any information about other clients.'
),
(
  'prompt.user',
  'Judy AI system prompt for user (client access) users',
  'You are Judy, the AI assistant for Rock Hill Innovation. You are speaking with an external user. You can only discuss information related to the clients and trades this user has been granted access to. You must not reveal any information about other clients, suppliers, vendors, financial data, or company information.'
)
on conflict (key) do nothing;
