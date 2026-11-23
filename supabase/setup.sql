-- =============================================================
-- Uchi care 社内ポータル: ログイン(第1段階)のためのデータベース設定
-- Supabase の「SQL Editor」に貼り付けて「Run」してください。何度実行しても問題ありません。
-- =============================================================

-- ログインできる職員(管理者が登録したメールアドレスだけがアカウントを作れる)
create table if not exists public.portal_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  staff_id text not null,
  name text not null default '',
  unit_id text not null default 'houkan',
  position text not null default 'スタッフ',
  is_admin boolean not null default false,
  active boolean not null default true,
  -- 初回登録用の招待コード(登録が終わると消える)
  invite_code text,
  user_id uuid unique references auth.users (id) on delete set null,
  registered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.portal_members enable row level security;

-- メールアドレスは小文字で比較する
create unique index if not exists portal_members_email_lower on public.portal_members (lower(email));

-- ログイン中の人が管理者か(ポリシーの中で自分自身の表を読むため security definer)
create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.portal_members
    where user_id = auth.uid() and is_admin and active
  );
$$;

drop policy if exists "自分の行を読める" on public.portal_members;
create policy "自分の行を読める" on public.portal_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "管理者はすべて読める" on public.portal_members;
create policy "管理者はすべて読める" on public.portal_members
  for select to authenticated
  using (public.is_portal_admin());

drop policy if exists "管理者は追加できる" on public.portal_members;
create policy "管理者は追加できる" on public.portal_members
  for insert to authenticated
  with check (public.is_portal_admin());

drop policy if exists "管理者は変更できる" on public.portal_members;
create policy "管理者は変更できる" on public.portal_members
  for update to authenticated
  using (public.is_portal_admin())
  with check (public.is_portal_admin());

drop policy if exists "管理者は削除できる" on public.portal_members;
create policy "管理者は削除できる" on public.portal_members
  for delete to authenticated
  using (public.is_portal_admin());

grant select, insert, update, delete on public.portal_members to authenticated;

-- 登録画面から、メールアドレスと招待コードが正しいかを確かめる(どちらが違うかは教えない)
create or replace function public.check_portal_invite(p_email text, p_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.portal_members;
begin
  select * into m from public.portal_members where lower(email) = lower(trim(p_email)) and active;
  if not found or m.invite_code is null or m.invite_code <> upper(trim(p_code)) then
    if found and m.user_id is not null then
      return 'registered';
    end if;
    return 'invalid';
  end if;
  return 'ok';
end;
$$;

grant execute on function public.check_portal_invite(text, text) to anon, authenticated;

-- アカウント作成の前に、登録済みのメールアドレスと招待コードかを確認する(違えば作成させない)
create or replace function public.portal_before_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.portal_members;
begin
  select * into m from public.portal_members where lower(email) = lower(new.email) and active;
  if not found then
    raise exception 'このメールアドレスは登録されていません';
  end if;
  if m.user_id is not null then
    raise exception 'このメールアドレスは登録済みです';
  end if;
  if m.invite_code is null or m.invite_code <> upper(coalesce(new.raw_user_meta_data ->> 'invite_code', '')) then
    raise exception '招待コードが正しくありません';
  end if;
  return new;
end;
$$;

-- アカウントができたら、職員と結びつけて招待コードを消す
create or replace function public.portal_after_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.portal_members
    set user_id = new.id, invite_code = null, registered_at = now()
    where lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists portal_before_signup on auth.users;
create trigger portal_before_signup
  before insert on auth.users
  for each row execute function public.portal_before_signup();

drop trigger if exists portal_after_signup on auth.users;
create trigger portal_after_signup
  after insert on auth.users
  for each row execute function public.portal_after_signup();
