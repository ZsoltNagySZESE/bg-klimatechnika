# Foglaló rendszer – 1. fázis: Adatbázis-alap – Implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Supabase adatbázis-réteg felépítése az időpontfoglaláshoz: táblák, kezdőadatok, sorszintű biztonság (RLS), automatikus időpont-generálás és atomikus (dupla-foglalás elleni) foglalási függvény.

**Architecture:** Minden logika a Postgresben él (Supabase `bg-klimatechnika`, id: `psmdpfxionlpiaxawupf`). A publikus oldal később a `foglalas_letrehozasa` RPC-t és a `szabad` időpontok olvasását használja; az admin a többi táblát belépve kezeli. A séma-műveletek `apply_migration`, az ellenőrzések `execute_sql` MCP-hívással futnak.

**Tech Stack:** Supabase Postgres 17, PL/pgSQL, RLS, pg_cron.

## Global Constraints

- Projekt: `bg-klimatechnika`, project_id: `psmdpfxionlpiaxawupf`, régió eu-central-1.
- Időzóna: a sávok helyi ideje **Europe/Budapest**; tárolás `timestamptz` (UTC).
- Sáv hossza fix **90 perc**.
- Árazás: `ar = 20000 + (klima_darab - 1) * 15000`, `klima_darab` 1–50.
- Heti sablon: H–P (1–5) `16:00`,`17:30`; Szo (6) `08:00`,`09:30`,`11:00`,`12:30`,`14:00`,`15:30`.
- Publikus (`anon`) szerep: csak `szabad`+jövőbeli `idopontok` és `aktiv` `klima_opciok` olvasható; `foglalasok` közvetlenül nem érhető el (csak a SECURITY DEFINER RPC-n át).
- Spec: `docs/superpowers/specs/2026-07-22-idopontfoglalo-rendszer-design.md`.

---

### Task 1: Táblák és indexek

**Files:**
- Migráció (MCP `apply_migration`, name: `foglalo_tablak`)

**Interfaces:**
- Produces: `public.sablon_savok`, `public.idopontok`, `public.klima_opciok`, `public.foglalasok` táblák a spec 3. pontja szerint.

- [ ] **Step 1: Migráció alkalmazása**

`apply_migration(project_id="psmdpfxionlpiaxawupf", name="foglalo_tablak", query=…)`:

```sql
create table public.sablon_savok (
  id uuid primary key default gen_random_uuid(),
  nap int2 not null check (nap between 1 and 7),
  kezdes time not null,
  unique (nap, kezdes)
);

create table public.idopontok (
  id uuid primary key default gen_random_uuid(),
  kezdes timestamptz not null unique,
  statusz text not null default 'szabad' check (statusz in ('szabad','foglalt','letiltva')),
  forras text not null default 'sablon' check (forras in ('sablon','egyedi'))
);
create index idopontok_szabad_idx on public.idopontok (kezdes) where statusz = 'szabad';

create table public.klima_opciok (
  id uuid primary key default gen_random_uuid(),
  kategoria text not null check (kategoria in ('marka','tipus','teljesitmeny')),
  ertek text not null,
  sorrend int2 not null default 0,
  aktiv bool not null default true
);

create table public.foglalasok (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  idopont_id uuid not null references public.idopontok(id),
  nev_cegnev text not null check (char_length(nev_cegnev) between 1 and 200),
  irsz text not null check (char_length(irsz) between 1 and 20),
  cim text not null check (char_length(cim) between 1 and 200),
  emelet text check (char_length(emelet) <= 50),
  ajto text check (char_length(ajto) <= 50),
  belmagassag text check (char_length(belmagassag) <= 200),
  telefon text not null check (char_length(telefon) between 1 and 50),
  email text not null check (char_length(email) between 3 and 200),
  szamla_megegyezik bool not null default true,
  szamla_nev text check (char_length(szamla_nev) <= 200),
  szamla_irsz text check (char_length(szamla_irsz) <= 20),
  szamla_cim text check (char_length(szamla_cim) <= 200),
  adoszam text check (char_length(adoszam) <= 30),
  klima_marka text check (char_length(klima_marka) <= 100),
  klima_tipus text check (char_length(klima_tipus) <= 100),
  klima_teljesitmeny text check (char_length(klima_teljesitmeny) <= 100),
  klima_darab int2 not null check (klima_darab between 1 and 50),
  ar int4 not null,
  megjegyzes text check (char_length(megjegyzes) <= 2000)
);
```

- [ ] **Step 2: Ellenőrzés**

`execute_sql`: `select table_name from information_schema.tables where table_schema='public' and table_name in ('sablon_savok','idopontok','klima_opciok','foglalasok') order by 1;`
Expected: 4 sor (foglalasok, idopontok, klima_opciok, sablon_savok).

---

### Task 2: Kezdőadatok (heti sablon + legördülők)

**Files:**
- Migráció (`apply_migration`, name: `foglalo_seed`)

**Interfaces:**
- Consumes: Task 1 táblái.
- Produces: 16 `sablon_savok` sor; `klima_opciok` seed (márka/típus/teljesítmény).

- [ ] **Step 1: Seed migráció**

```sql
-- Heti sablon: H–P 16:00,17:30 ; Szo 8:00–15:30
insert into public.sablon_savok (nap, kezdes)
select nap, kezdes from (values
  (1,time '16:00'),(1,time '17:30'),
  (2,time '16:00'),(2,time '17:30'),
  (3,time '16:00'),(3,time '17:30'),
  (4,time '16:00'),(4,time '17:30'),
  (5,time '16:00'),(5,time '17:30'),
  (6,time '08:00'),(6,time '09:30'),(6,time '11:00'),(6,time '12:30'),(6,time '14:00'),(6,time '15:30')
) as t(nap,kezdes);

-- Legördülők
insert into public.klima_opciok (kategoria, ertek, sorrend) values
  ('marka','Daikin',1),('marka','Mitsubishi Electric',2),('marka','Mitsubishi Heavy',3),
  ('marka','Fujitsu',4),('marka','Panasonic',5),('marka','Toshiba',6),('marka','LG',7),
  ('marka','Samsung',8),('marka','Gree',9),('marka','Midea',10),('marka','Haier',11),
  ('marka','Hisense',12),('marka','Sinclair',13),('marka','Cooper&Hunter',14),('marka','Egyéb',99),
  ('tipus','Fali split',1),('tipus','Multi (több beltéri egység)',2),('tipus','Kazettás (mennyezeti)',3),
  ('tipus','Parapetes / padlón álló',4),('tipus','Egyéb / nem tudom',99),
  ('teljesitmeny','2,0 kW',1),('teljesitmeny','2,5 kW',2),('teljesitmeny','3,5 kW',3),
  ('teljesitmeny','5,0 kW',4),('teljesitmeny','7,1 kW',5),('teljesitmeny','Nem tudom',99);
```

- [ ] **Step 2: Ellenőrzés**

`execute_sql`: `select (select count(*) from public.sablon_savok) as sablon, (select count(*) from public.klima_opciok) as opciok;`
Expected: `sablon=16`, `opciok=26`.

---

### Task 3: RLS + jogosultságok

**Files:**
- Migráció (`apply_migration`, name: `foglalo_rls`)

**Interfaces:**
- Consumes: Task 1 táblái.
- Produces: RLS engedélyezve minden táblán; policy-k a Global Constraints szerint.

- [ ] **Step 1: RLS migráció**

```sql
alter table public.idopontok enable row level security;
alter table public.foglalasok enable row level security;
alter table public.sablon_savok enable row level security;
alter table public.klima_opciok enable row level security;

-- idopontok: anon csak szabad+jövőbeli olvas; admin minden
create policy idopontok_anon_read on public.idopontok
  for select to anon using (statusz = 'szabad' and kezdes > now());
create policy idopontok_admin_all on public.idopontok
  for all to authenticated using (true) with check (true);

-- foglalasok: anon semmi (nincs policy); admin minden
create policy foglalasok_admin_all on public.foglalasok
  for all to authenticated using (true) with check (true);

-- sablon_savok: csak admin
create policy sablon_admin_all on public.sablon_savok
  for all to authenticated using (true) with check (true);

-- klima_opciok: anon aktívat olvas; admin minden
create policy opciok_anon_read on public.klima_opciok
  for select to anon using (aktiv = true);
create policy opciok_admin_all on public.klima_opciok
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Biztonsági ellenőrzés (advisor)**

`get_advisors(project_id="psmdpfxionlpiaxawupf", type="security")`
Expected: nincs „RLS disabled" figyelmeztetés a 4 új táblára.

---

### Task 4: `generate_idopontok(hetek)` – időpont-generálás sablonból

**Files:**
- Migráció (`apply_migration`, name: `foglalo_generate_fn`)

**Interfaces:**
- Consumes: `sablon_savok`, `idopontok`.
- Produces: `public.generate_idopontok(hetek int default 6) returns int` (a beszúrt sávok száma). SECURITY DEFINER; csak `authenticated` hívhatja.

- [ ] **Step 1: Függvény migráció**

```sql
create or replace function public.generate_idopontok(hetek int default 6)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
  s record;
  ts timestamptz;
  darab int := 0;
begin
  for d in
    select generate_series(current_date, current_date + (hetek*7 - 1), interval '1 day')::date
  loop
    for s in select kezdes from public.sablon_savok where nap = extract(isodow from d)::int loop
      ts := (d + s.kezdes) at time zone 'Europe/Budapest';
      if ts > now() and not exists (select 1 from public.idopontok where kezdes = ts) then
        insert into public.idopontok (kezdes, statusz, forras) values (ts, 'szabad', 'sablon');
        darab := darab + 1;
      end if;
    end loop;
  end loop;
  return darab;
end;
$$;

revoke all on function public.generate_idopontok(int) from public, anon;
grant execute on function public.generate_idopontok(int) to authenticated;
```

- [ ] **Step 2: Ellenőrzés – első generálás**

`execute_sql`: `select public.generate_idopontok(6);`
Expected: pozitív szám (a következő 6 hét sávjai; ~90–100 körül a naptól függően).

- [ ] **Step 3: Ellenőrzés – nincs múltbeli, nincs duplikátum, idempotens**

`execute_sql`:
```sql
select
  (select count(*) from public.idopontok where kezdes <= now()) as multbeli,
  (select public.generate_idopontok(6)) as ujra_beszurt;
```
Expected: `multbeli=0`, `ujra_beszurt=0` (második futásra már nincs új).

---

### Task 5: `foglalas_letrehozasa(...)` – atomikus foglalás + szerveroldali ár

**Files:**
- Migráció (`apply_migration`, name: `foglalo_booking_fn`)

**Interfaces:**
- Consumes: `idopontok`, `foglalasok`.
- Produces: `public.foglalas_letrehozasa(p_idopont_id uuid, p_nev_cegnev text, p_irsz text, p_cim text, p_emelet text, p_ajto text, p_belmagassag text, p_telefon text, p_email text, p_szamla_megegyezik bool, p_szamla_nev text, p_szamla_irsz text, p_szamla_cim text, p_adoszam text, p_klima_marka text, p_klima_tipus text, p_klima_teljesitmeny text, p_klima_darab int, p_megjegyzes text) returns uuid`. SECURITY DEFINER; `anon` és `authenticated` hívhatja. A frontend ezt hívja beküldéskor.

- [ ] **Step 1: Függvény migráció**

```sql
create or replace function public.foglalas_letrehozasa(
  p_idopont_id uuid,
  p_nev_cegnev text,
  p_irsz text,
  p_cim text,
  p_emelet text,
  p_ajto text,
  p_belmagassag text,
  p_telefon text,
  p_email text,
  p_szamla_megegyezik bool,
  p_szamla_nev text,
  p_szamla_irsz text,
  p_szamla_cim text,
  p_adoszam text,
  p_klima_marka text,
  p_klima_tipus text,
  p_klima_teljesitmeny text,
  p_klima_darab int,
  p_megjegyzes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ar int;
  v_id uuid;
  v_updated int;
begin
  if p_klima_darab is null or p_klima_darab < 1 or p_klima_darab > 50 then
    raise exception 'Érvénytelen klíma darabszám';
  end if;
  if coalesce(char_length(trim(p_nev_cegnev)),0) = 0
     or coalesce(char_length(trim(p_telefon)),0) = 0
     or coalesce(char_length(trim(p_email)),0) = 0 then
    raise exception 'Hiányzó kötelező mező';
  end if;

  v_ar := 20000 + (p_klima_darab - 1) * 15000;

  update public.idopontok
     set statusz = 'foglalt'
   where id = p_idopont_id and statusz = 'szabad' and kezdes > now();
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'A választott időpont már nem foglalható';
  end if;

  insert into public.foglalasok (
    idopont_id, nev_cegnev, irsz, cim, emelet, ajto, belmagassag, telefon, email,
    szamla_megegyezik, szamla_nev, szamla_irsz, szamla_cim, adoszam,
    klima_marka, klima_tipus, klima_teljesitmeny, klima_darab, ar, megjegyzes
  ) values (
    p_idopont_id, p_nev_cegnev, p_irsz, p_cim, nullif(trim(p_emelet),''), nullif(trim(p_ajto),''),
    nullif(trim(p_belmagassag),''), p_telefon, p_email,
    coalesce(p_szamla_megegyezik, true), nullif(trim(p_szamla_nev),''), nullif(trim(p_szamla_irsz),''),
    nullif(trim(p_szamla_cim),''), nullif(trim(p_adoszam),''),
    nullif(trim(p_klima_marka),''), nullif(trim(p_klima_tipus),''), nullif(trim(p_klima_teljesitmeny),''),
    p_klima_darab, v_ar, nullif(trim(p_megjegyzes),'')
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.foglalas_letrehozasa(uuid,text,text,text,text,text,text,text,text,bool,text,text,text,text,text,text,text,int,text) from public;
grant execute on function public.foglalas_letrehozasa(uuid,text,text,text,text,text,text,text,text,bool,text,text,text,text,text,text,text,int,text) to anon, authenticated;
```

- [ ] **Step 2: Ellenőrzés – sikeres foglalás + helyes ár**

`execute_sql`:
```sql
with sav as (select id from public.idopontok where statusz='szabad' order by kezdes limit 1)
select public.foglalas_letrehozasa(
  (select id from sav),'TESZT Kft','9021','Fő utca 1','2','5','2,7 m','+36301112233','teszt@pelda.hu',
  true,null,null,null,'12345678-2-41','Daikin','Fali split','3,5 kW',3,'teszt'
) as uj_foglalas_id;
```
Expected: visszaad egy uuid-t. Majd: `select ar, klima_darab from public.foglalasok order by created_at desc limit 1;` → `ar=50000`, `klima_darab=3`.

- [ ] **Step 3: Ellenőrzés – a sáv foglalt lett + dupla foglalás hibázik**

`execute_sql`:
```sql
with utolso as (select idopont_id from public.foglalasok order by created_at desc limit 1)
select statusz from public.idopontok where id = (select idopont_id from utolso);
```
Expected: `foglalt`.
Majd ugyanarra a `idopont_id`-ra újra hívva a `foglalas_letrehozasa`-t → hibaüzenet: „A választott időpont már nem foglalható".

- [ ] **Step 4: Tesztadat törlése**

`execute_sql` (a tesztfoglalás törlése és a sávjának felszabadítása egy lépésben):
```sql
with torolt as (
  delete from public.foglalasok
  where email = 'teszt@pelda.hu'
  returning idopont_id
)
update public.idopontok set statusz = 'szabad'
where id in (select idopont_id from torolt);
```
Expected: a tesztfoglalás törölve, a sáv újra `szabad`.
Ellenőrzés: `select count(*) from public.foglalasok;` → `0`.

---

### Task 6: Automatikus napi generálás és takarítás (pg_cron)

**Files:**
- Migráció (`apply_migration`, name: `foglalo_cron`)

**Interfaces:**
- Consumes: `generate_idopontok`, `idopontok`.
- Produces: két ütemezett feladat (napi generálás + régi sávok takarítása). Megjegyzés: a cron UTC szerint fut.

- [ ] **Step 1: pg_cron engedélyezése + ütemezés**

```sql
create extension if not exists pg_cron;

select cron.schedule('napi-idopont-generalas', '0 2 * * *',
  $$ select public.generate_idopontok(6); $$);

select cron.schedule('regi-idopont-takaritas', '30 2 * * *',
  $$ delete from public.idopontok
      where kezdes < now() - interval '1 day' and statusz <> 'foglalt'; $$);
```

- [ ] **Step 2: Ellenőrzés**

`execute_sql`: `select jobname, schedule from cron.job order by jobname;`
Expected: két sor (`napi-idopont-generalas`, `regi-idopont-takaritas`).

---

## Fázis-lezárás / kézi ellenőrzőlista

- [ ] `select statusz, count(*) from public.idopontok group by statusz;` → csak `szabad`, ~90–100 sor.
- [ ] `select count(*) from public.foglalasok;` → 0 (nincs maradék teszt).
- [ ] `get_advisors(type="security")` → nincs RLS-hiba a 4 táblán.

## Következő fázisok (külön tervekben)

- **2. fázis – Publikus foglalás:** naptár + űrlap a főoldalon, `foglalas_letrehozasa` hívása, élő árazás, `klima_opciok`/`idopontok` betöltése a publikus kulccsal.
- **3. fázis – Admin:** `admin.html` + Supabase Auth; sablon, időpontok, foglalások, legördülők kezelése.
- **4. fázis – Értesítések:** `foglalas-ertesito` Edge Function + Database Webhook + Resend + .ics (vállalkozó most, ügyfél a domain után).
