-- База приложения «Зал для новичка».
-- Одна строка на пользователя: все его данные (анкета, программы, тренировки) в одном JSON.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Доступ к таблице через API — только вошедшим (гостям нельзя)
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;

-- Защита: каждый видит и меняет только свою строку
alter table public.user_data enable row level security;

create policy "read own"   on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

-- Удаление своего аккаунта (данные удалятся каскадом)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Служебная функция Supabase: закрыть вызов извне
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
