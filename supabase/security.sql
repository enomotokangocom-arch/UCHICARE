-- =============================================================
-- Uchi care 社内ポータル: 第2段階 データの共有とサーバー側の権限管理
--
-- setup.sql を実行したあとに、Supabase の「SQL Editor」に貼り付けて「Run」してください。
-- 何度実行しても問題ありません(データは消えません)。
--
-- 考え方(PHPの業務システムと同じ「サーバー側で守る」設計):
--   ・画面(ブラウザ)は信用しない。誰が何を読めるか・書けるかは、すべてデータベースが判定する
--   ・判定に使う「誰か」は、ログイン情報(auth.uid())から portal_members を引いて決める
--     → ブラウザ側で役職を書き換えても、権限は変わらない
--   ・記録の持ち主(職員)・事業所も、送られてきた値ではなく記録の中身からデータベースが決める
--   ・誰がいつ何を変更したかを監査ログに残す(内容そのものは残さない)
-- =============================================================

-- ---------- 1. ログイン中の職員の情報 ----------

-- 役職の序列(数字が小さいほど上位)。以前の役職名も読み替える
create or replace function public.portal_position_rank(p text)
returns int
language sql
immutable
as $$
  select case p
    when '経営者' then 0
    when '統括部長' then 1
    when '管理者' then 2 when '所長' then 2 when '事務長' then 2
    when '責任者' then 3 when 'リハ責任者' then 3
    when '主任' then 4
    else 5
  end;
$$;

-- ログイン中の職員(有効な人だけ)。ポリシーの中から portal_members を読むため security definer
create or replace function public.portal_me_staff()
returns text
language sql stable security definer set search_path = public
as $$
  select staff_id from public.portal_members where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.portal_me_unit()
returns text
language sql stable security definer set search_path = public
as $$
  select unit_id from public.portal_members where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.portal_me_rank()
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce((select public.portal_position_rank(position) from public.portal_members where user_id = auth.uid() and active limit 1), 99);
$$;

-- 経営者・統括部長(または管理者フラグ)= 全社の管理者
create or replace function public.is_portal_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.portal_members
    where user_id = auth.uid() and active and (is_admin or public.portal_position_rank(position) <= 1)
  );
$$;

create or replace function public.portal_is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.portal_members where user_id = auth.uid() and active);
$$;

-- 指定の事業所(のどれか)を管理する立場か: 全社管理者、またはその事業所の「管理者」
create or replace function public.portal_manages(units text[])
returns boolean
language sql stable
as $$
  select public.is_portal_admin()
    or (public.portal_me_rank() = 2 and public.portal_me_unit() = any(coalesce(units, '{}')));
$$;

-- ---------- 2. 職員アカウントの保護 ----------

-- 職員アカウントの変更を検査する
create or replace function public.portal_members_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  remaining int;
begin
  -- 管理者フラグは役職から決める(経営者・統括部長だけが全社管理者)
  if tg_op in ('INSERT', 'UPDATE') then
    new.is_admin := public.portal_position_rank(new.position) <= 1;
  end if;
  -- 管理者が自分自身の権限を外したり、最後の管理者を消したりできないようにする
  if tg_op in ('UPDATE', 'DELETE') and old.active and (old.is_admin or public.portal_position_rank(old.position) <= 1) then
    if tg_op = 'DELETE' or not (new.active and new.is_admin) then
      select count(*) into remaining from public.portal_members
        where id <> old.id and active and (is_admin or public.portal_position_rank(position) <= 1);
      if remaining = 0 then
        raise exception '最後の管理者(経営者・統括部長)は外せません';
      end if;
    end if;
  end if;
  -- ログインに結びついた user_id は画面から書き換えさせない(登録時のトリガーだけが設定する)
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id and new.user_id is not null and auth.uid() is not null then
    raise exception 'user_id は変更できません';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists portal_members_guard on public.portal_members;
create trigger portal_members_guard
  before insert or update or delete on public.portal_members
  for each row execute function public.portal_members_guard();

-- ---------- 3. ポータルのデータ(共有) ----------

-- すべての一覧(職員・車両・運行記録・売上など)を1つの表に入れる。
-- collection = 一覧の種類、id = 記録のID、data = 記録の中身
-- owner_staff / unit_ids は data から自動で決める(送られてきた値は使わない)
create table if not exists public.portal_records (
  collection text not null,
  id text not null,
  data jsonb not null,
  sort double precision not null default 0,
  owner_staff text,
  unit_ids text[] not null default '{}',
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (collection, id),
  constraint portal_records_collection_check check (collection in (
    'settings', 'links', 'staff', 'vehicles', 'committees', 'criteria', 'notices', 'vehicleLogs', 'alcoholChecks',
    'minutes', 'evaluations', 'parkingLots', 'parkingSpaces', 'jobDescriptions', 'nanbyoPatients', 'nanbyoEntries',
    'salesActivities', 'finance', 'subsidies', 'personalSales', 'goals', 'goalSheets', 'consultationDesks',
    'dailySales', 'feeRates', 'staffCosts', 'fixedCosts'
  )),
  -- 1件あたりの大きさを制限する(画像などを入れられないように)
  constraint portal_records_size_check check (octet_length(data::text) <= 200000)
);

create index if not exists portal_records_owner on public.portal_records (collection, owner_staff);

-- 記録の種類を増やしたとき用(以前に作った表の制約を新しい一覧に置き換える)
alter table public.portal_records drop constraint if exists portal_records_collection_check;
alter table public.portal_records add constraint portal_records_collection_check check (collection in (
  'settings', 'links', 'staff', 'vehicles', 'committees', 'criteria', 'notices', 'vehicleLogs', 'alcoholChecks',
  'minutes', 'evaluations', 'parkingLots', 'parkingSpaces', 'jobDescriptions', 'nanbyoPatients', 'nanbyoEntries',
  'salesActivities', 'finance', 'subsidies', 'personalSales', 'goals', 'goalSheets', 'consultationDesks',
  'dailySales', 'feeRates', 'staffCosts', 'fixedCosts'
));

alter table public.portal_records enable row level security;

-- 記録の持ち主(職員ID)と事業所を、記録の中身から決める
create or replace function public.portal_records_derive()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  owner text;
  units text[];
begin
  if tg_op = 'UPDATE' and (new.collection <> old.collection or new.id <> old.id) then
    raise exception '記録の種類・IDは変更できません';
  end if;
  new.data := jsonb_set(new.data, '{id}', to_jsonb(new.id));
  owner := case new.collection
    when 'vehicleLogs' then new.data ->> 'driverId'
    when 'alcoholChecks' then new.data ->> 'driverId'
    when 'notices' then new.data ->> 'authorId'
    when 'staff' then new.id
    else nullif(new.data ->> 'staffId', '')
  end;
  new.owner_staff := nullif(owner, '');

  if jsonb_typeof(new.data -> 'units') = 'array' then
    select coalesce(array_agg(u), '{}') into units from jsonb_array_elements_text(new.data -> 'units') u;
  elsif new.data ? 'unitId' and coalesce(new.data ->> 'unitId', '') <> '' then
    units := array[new.data ->> 'unitId'];
  elsif new.collection = 'nanbyoEntries' then
    select array[p.data ->> 'unitId'] into units from public.portal_records p
      where p.collection = 'nanbyoPatients' and p.id = new.data ->> 'patientId';
  elsif new.owner_staff is not null then
    -- 持ち主の職員が所属する事業所
    select array[s.data ->> 'unitId'] into units from public.portal_records s
      where s.collection = 'staff' and s.id = new.owner_staff;
  end if;
  new.unit_ids := coalesce(units, '{}');
  new.updated_by := auth.uid();
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; end if;
  return new;
end;
$$;

drop trigger if exists portal_records_derive on public.portal_records;
create trigger portal_records_derive
  before insert or update on public.portal_records
  for each row execute function public.portal_records_derive();

-- 職員の事業所が変わったら、その職員の記録(売上など)の事業所も付け直す
create or replace function public.portal_staff_unit_changed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.collection = 'staff' and (new.data ->> 'unitId') is distinct from (old.data ->> 'unitId') then
    update public.portal_records r set updated_at = now()
      where r.owner_staff = new.id and r.collection <> 'staff' and not (r.data ? 'unitId') and jsonb_typeof(r.data -> 'units') is distinct from 'array';
  end if;
  return null;
end;
$$;

drop trigger if exists portal_staff_unit_changed on public.portal_records;
create trigger portal_staff_unit_changed
  after update on public.portal_records
  for each row when (new.collection = 'staff') execute function public.portal_staff_unit_changed();

-- ---------- 4. 権限の表(誰が読めるか・書けるか) ----------
--
--  種類                         読める人                                  書ける人
--  設定・職員・リンク等(マスタ)  全員                                      経営者・統括部長(取り込み設定は管理者も)
--  お知らせ                      全員(対象の事業所)                        責任者以上
--  車両・駐車区画・議事録        全員                                      車両・区画=主任以上、議事録=全員
--  運行記録                      全員                                      本人・主任以上
--  アルコールチェック            本人・確認者・主任以上                    本人・確認者・主任以上
--  個人売上・日次売上            本人・自事業所の管理者・全社管理者        自事業所の管理者・全社管理者
--  個人の目標・目標シート        本人・自事業所の管理者・全社管理者        本人・自事業所の管理者・全社管理者
--  部門の目標                    全員                                      その事業所の管理者・全社管理者
--  経営数値・補助金              その事業所の管理者・全社管理者            その事業所の管理者・全社管理者
--  給与(利益ラインの計算)        本人・その事業所の管理者・全社管理者      全社管理者のみ
--  事業所の固定費                その事業所の管理者・全社管理者            全社管理者のみ
--  人事評価                      本人・評価者・自事業所の管理者・全社管理者 同左
--  営業記録                      本人・自事業所の責任者以上・全社管理者    本人・自事業所の管理者・全社管理者
--  難病の上限管理(患者情報)      同じ事業所の職員・全社管理者              同左

create or replace function public.portal_can_read(c text, owner text, units text[], data jsonb)
returns boolean
language sql stable
as $$
  select public.portal_is_member() and (
    public.is_portal_admin()
    or case c
      when 'settings' then true
      when 'links' then true
      when 'staff' then true
      when 'committees' then true
      when 'criteria' then true
      when 'jobDescriptions' then true
      when 'consultationDesks' then true
      when 'feeRates' then true
      when 'parkingLots' then true
      when 'vehicles' then true
      when 'parkingSpaces' then true
      when 'minutes' then true
      when 'vehicleLogs' then true
      when 'notices' then cardinality(units) = 0 or public.portal_me_unit() = any(units) or owner = public.portal_me_staff()
      when 'alcoholChecks' then owner = public.portal_me_staff() or data ->> 'checkerId' = public.portal_me_staff() or public.portal_me_rank() <= 4
      when 'personalSales' then owner = public.portal_me_staff() or public.portal_manages(units)
      -- 職員と結びつかなかった行は、管理者以上が扱う
      when 'dailySales' then owner = public.portal_me_staff() or public.portal_manages(units) or (owner is null and public.portal_me_rank() <= 2)
      when 'goals' then case when data ->> 'scope' = 'unit' then true else owner = public.portal_me_staff() or public.portal_manages(units) end
      when 'goalSheets' then owner = public.portal_me_staff() or public.portal_manages(units)
      when 'finance' then public.portal_manages(units)
      when 'subsidies' then public.portal_manages(units)
      -- 給与(人件費)は本人・その事業所の管理者・経営者/統括部長だけ。固定費は管理者以上
      when 'staffCosts' then owner = public.portal_me_staff() or public.portal_manages(units)
      when 'fixedCosts' then public.portal_manages(units)
      when 'evaluations' then owner = public.portal_me_staff() or data ->> 'evaluatorId' = public.portal_me_staff() or public.portal_manages(units)
      when 'salesActivities' then owner = public.portal_me_staff() or (public.portal_me_rank() <= 3 and public.portal_me_unit() = any(units))
      when 'nanbyoPatients' then public.portal_me_unit() = any(units)
      when 'nanbyoEntries' then public.portal_me_unit() = any(units)
      else false
    end
  );
$$;

create or replace function public.portal_can_write(c text, rid text, owner text, units text[], data jsonb)
returns boolean
language sql stable
as $$
  select public.portal_is_member() and (
    public.is_portal_admin()
    or case c
      when 'settings' then rid in ('salesImportMappings', 'goalSheetTemplates') and public.portal_me_rank() <= 2
      when 'notices' then public.portal_me_rank() <= 3
      when 'vehicles' then public.portal_me_rank() <= 4
      when 'parkingSpaces' then public.portal_me_rank() <= 4
      when 'minutes' then true
      when 'vehicleLogs' then owner = public.portal_me_staff() or public.portal_me_rank() <= 4
      when 'alcoholChecks' then owner = public.portal_me_staff() or data ->> 'checkerId' = public.portal_me_staff() or public.portal_me_rank() <= 4
      when 'personalSales' then public.portal_manages(units)
      when 'dailySales' then public.portal_manages(units) or (owner is null and public.portal_me_rank() <= 2)
      when 'goals' then case when data ->> 'scope' = 'unit' then public.portal_manages(units) else owner = public.portal_me_staff() or public.portal_manages(units) end
      when 'goalSheets' then owner = public.portal_me_staff() or public.portal_manages(units)
      when 'finance' then public.portal_manages(units)
      when 'subsidies' then public.portal_manages(units) and cardinality(units) > 0
      when 'evaluations' then owner = public.portal_me_staff() or data ->> 'evaluatorId' = public.portal_me_staff() or public.portal_manages(units)
      when 'salesActivities' then owner = public.portal_me_staff() or public.portal_manages(units)
      when 'nanbyoPatients' then public.portal_me_unit() = any(units)
      when 'nanbyoEntries' then public.portal_me_unit() = any(units)
      -- 職員・リンク・委員会・評価項目・職務記述書・相談窓口・報酬単価・駐車場 は全社管理者のみ
      else false
    end
  );
$$;

drop policy if exists "読める記録" on public.portal_records;
create policy "読める記録" on public.portal_records
  for select to authenticated
  using (public.portal_can_read(collection, owner_staff, unit_ids, data));

drop policy if exists "追加できる記録" on public.portal_records;
create policy "追加できる記録" on public.portal_records
  for insert to authenticated
  with check (public.portal_can_write(collection, id, owner_staff, unit_ids, data));

-- 変更は「変更前の記録」と「変更後の記録」の両方に書く権限が必要(他人の記録を自分のものに付け替えられない)
drop policy if exists "変更できる記録" on public.portal_records;
create policy "変更できる記録" on public.portal_records
  for update to authenticated
  using (public.portal_can_write(collection, id, owner_staff, unit_ids, data))
  with check (public.portal_can_write(collection, id, owner_staff, unit_ids, data));

drop policy if exists "削除できる記録" on public.portal_records;
create policy "削除できる記録" on public.portal_records
  for delete to authenticated
  using (public.portal_can_write(collection, id, owner_staff, unit_ids, data));

revoke all on public.portal_records from anon;
grant select, insert, update, delete on public.portal_records to authenticated;

-- お知らせの「既読」だけは誰でも付けられる(本人の分だけ)
create or replace function public.portal_mark_notice_read(p_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me text := public.portal_me_staff();
begin
  if me is null then raise exception 'ログインが必要です'; end if;
  update public.portal_records
    set data = jsonb_set(data, '{readBy}', coalesce(data -> 'readBy', '[]'::jsonb) || to_jsonb(me))
    where collection = 'notices' and id = p_id
      and public.portal_can_read(collection, owner_staff, unit_ids, data)
      and not coalesce(data -> 'readBy', '[]'::jsonb) ? me;
end;
$$;

revoke all on function public.portal_mark_notice_read(text) from public, anon;
grant execute on function public.portal_mark_notice_read(text) to authenticated;

-- ---------- 5. 監査ログ(誰が・いつ・何を変えたか) ----------

create table if not exists public.portal_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_staff text,
  action text not null,
  target text not null,
  record_id text not null
);

create index if not exists portal_audit_log_at on public.portal_audit_log (at desc);

alter table public.portal_audit_log enable row level security;

drop policy if exists "管理者は監査ログを読める" on public.portal_audit_log;
create policy "管理者は監査ログを読める" on public.portal_audit_log
  for select to authenticated
  using (public.is_portal_admin());

-- 書き込みはトリガーだけ(誰も直接は追加・変更・削除できない)
revoke all on public.portal_audit_log from anon, authenticated;
grant select on public.portal_audit_log to authenticated;

create or replace function public.portal_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rid text;
  target text;
begin
  if tg_table_name = 'portal_members' then
    target := 'アカウント';
    rid := coalesce(new.email, old.email);
  else
    target := coalesce(new.collection, old.collection);
    rid := coalesce(new.id, old.id);
  end if;
  insert into public.portal_audit_log (actor, actor_staff, action, target, record_id)
    values (auth.uid(), public.portal_me_staff(), lower(tg_op), target, rid);
  return null;
end;
$$;

drop trigger if exists portal_records_audit on public.portal_records;
create trigger portal_records_audit
  after insert or update or delete on public.portal_records
  for each row execute function public.portal_audit();

drop trigger if exists portal_members_audit on public.portal_members;
create trigger portal_members_audit
  after insert or update or delete on public.portal_members
  for each row execute function public.portal_audit();

-- 2年より古い監査ログを消す(管理者が必要なときに実行: select public.portal_audit_cleanup();)
create or replace function public.portal_audit_cleanup()
returns void
language sql security definer set search_path = public
as $$
  delete from public.portal_audit_log where at < now() - interval '2 years' and public.is_portal_admin();
$$;
