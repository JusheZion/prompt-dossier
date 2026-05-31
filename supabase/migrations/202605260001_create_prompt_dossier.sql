create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt_text text not null,
  category text not null check (category in ('character', 'look', 'scene', 'style', 'system', 'project', 'misc')),
  notes text,
  model text,
  status text not null default 'active',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prompt_dossier_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.prompt_dossier_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.prompt_dossier_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.prompt_dossier_looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.prompt_dossier_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.prompt_dossier_prompt_tags (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  tag_id uuid not null references public.prompt_dossier_tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (prompt_id, tag_id)
);

create table public.prompt_dossier_prompt_collections (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  collection_id uuid not null references public.prompt_dossier_collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (prompt_id, collection_id)
);

create table public.prompt_dossier_prompt_characters (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  character_id uuid not null references public.prompt_dossier_characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (prompt_id, character_id)
);

create table public.prompt_dossier_prompt_looks (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  look_id uuid not null references public.prompt_dossier_looks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (prompt_id, look_id)
);

create table public.prompt_dossier_prompt_scenes (
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  scene_id uuid not null references public.prompt_dossier_scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (prompt_id, scene_id)
);

create table public.prompt_dossier_variables (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  variable_name text not null,
  default_value text,
  is_required boolean not null default false,
  unique (prompt_id, variable_name)
);

create table public.prompt_dossier_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null,
  prompt_text text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (prompt_id, version_number)
);

create index prompts_user_updated_idx on public.prompts(user_id, updated_at desc);
create index prompts_user_category_idx on public.prompts(user_id, category);
create index prompts_user_favorite_idx on public.prompts(user_id, is_favorite);
create index prompt_versions_prompt_idx on public.prompt_dossier_versions(prompt_id, version_number desc);

create or replace function public.set_prompt_dossier_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prompts_set_updated_at
before update on public.prompts
for each row
execute function public.set_prompt_dossier_updated_at();

alter table public.prompts enable row level security;
alter table public.prompt_dossier_collections enable row level security;
alter table public.prompt_dossier_tags enable row level security;
alter table public.prompt_dossier_characters enable row level security;
alter table public.prompt_dossier_looks enable row level security;
alter table public.prompt_dossier_scenes enable row level security;
alter table public.prompt_dossier_prompt_tags enable row level security;
alter table public.prompt_dossier_prompt_collections enable row level security;
alter table public.prompt_dossier_prompt_characters enable row level security;
alter table public.prompt_dossier_prompt_looks enable row level security;
alter table public.prompt_dossier_prompt_scenes enable row level security;
alter table public.prompt_dossier_variables enable row level security;
alter table public.prompt_dossier_versions enable row level security;

create policy "Users manage own prompts" on public.prompts
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own collections" on public.prompt_dossier_collections
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own tags" on public.prompt_dossier_tags
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own characters" on public.prompt_dossier_characters
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own looks" on public.prompt_dossier_looks
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own scenes" on public.prompt_dossier_scenes
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt tags" on public.prompt_dossier_prompt_tags
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt collections" on public.prompt_dossier_prompt_collections
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt characters" on public.prompt_dossier_prompt_characters
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt looks" on public.prompt_dossier_prompt_looks
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt scenes" on public.prompt_dossier_prompt_scenes
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt variables" on public.prompt_dossier_variables
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users manage own prompt versions" on public.prompt_dossier_versions
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.prompts to anon;
grant select, insert, update, delete on
  public.prompts,
  public.prompt_dossier_collections,
  public.prompt_dossier_tags,
  public.prompt_dossier_characters,
  public.prompt_dossier_looks,
  public.prompt_dossier_scenes,
  public.prompt_dossier_prompt_tags,
  public.prompt_dossier_prompt_collections,
  public.prompt_dossier_prompt_characters,
  public.prompt_dossier_prompt_looks,
  public.prompt_dossier_prompt_scenes,
  public.prompt_dossier_variables,
  public.prompt_dossier_versions
to authenticated;
