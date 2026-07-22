# Időpontfoglaló rendszer — terv (spec)

**Projekt:** BG Klímatechnika weboldal
**Dátum:** 2026-07-22
**Cél:** A jelenlegi ajánlatkérő űrlap leváltása egy teljes online **időpontfoglaló rendszerre**.

---

## 1. Áttekintés és célok

Az ügyfél a weboldalon kiválaszt egy szabad, **1,5 órás** időpontot a következő **6 hétből**, megadja az adatait, és lefoglalja. A foglalás:
- beérkezik az **adatbázisba**,
- e-mailben **értesíti a vállalkozót** (BG Klímatechnika),
- **naptár-meghívót** (.ics) küld, amit a Gmail a naptárba tesz,
- *(domain igazolása után)* **visszaigazoló e-mailt** küld az ügyfélnek is, szintén naptár-meghívóval.

A szabad időpontokat a vállalkozó egy **jelszóval védett admin felületen** állítja be, és ott látja a beérkezett foglalásokat is.

### Nem cél (v1-ben nincs benne)
- Online fizetés (a fizetés a helyszínen történik).
- Ügyfél általi önálló lemondás/módosítás (telefonon/e-mailben intézhető).
- SMS-értesítés.

---

## 2. Architektúra

Statikus weboldal (HTML/CSS/JS, Vercel) + **Supabase** (adatbázis, auth, edge function) + **Resend** (e-mail). Nincs saját szerver.

```
Publikus foglaló oldal (foglalas.html)
        │  supabase-js (publikus kulcs)
        ▼
Supabase RPC: foglalas_letrehozasa()   ── atomikusan lefoglalja a sávot + menti a foglalást
        │
        ▼  (Database Webhook: foglalasok INSERT)
Edge Function: foglalas-ertesito        ── e-mailek + .ics összeállítása
        │  Resend API
        ▼
E-mailek (vállalkozó most; ügyfél a domain után)

Admin oldal (admin.html) ── Supabase Auth (belépés) ── időpontok + foglalások kezelése
```

---

## 3. Adatmodell (Supabase, `bg-klimatechnika` projekt)

### 3.1 `sablon_savok` — heti sablon
A vállalkozó heti mintája, amiből a szabad időpontok generálódnak.
| oszlop | típus | leírás |
|---|---|---|
| id | uuid PK | |
| nap | int2 | hét napja 1=hétfő … 7=vasárnap |
| kezdes | time | sáv kezdete (pl. 16:00) |

**Kezdő adat (a megbeszélt beosztás):**
- Hétfő–Péntek (1–5): `16:00`, `17:30`
- Szombat (6): `08:00`, `09:30`, `11:00`, `12:30`, `14:00`, `15:30`

### 3.2 `idopontok` — konkrét sávok
| oszlop | típus | leírás |
|---|---|---|
| id | uuid PK | |
| kezdes | timestamptz | a sáv kezdő időpontja (a hossz fix 90 perc) |
| statusz | text | `szabad` \| `foglalt` \| `letiltva` |
| forras | text | `sablon` \| `egyedi` (kézzel felvett extra) |

- Egyediségi megkötés a `kezdes`-en (nincs két azonos sáv).
- A publikus oldal **csak** a `szabad` és jövőbeli sávokat látja.

### 3.3 `foglalasok` — beérkezett foglalások
| oszlop | típus | leírás |
|---|---|---|
| id | uuid PK | |
| created_at | timestamptz | |
| idopont_id | uuid FK → idopontok | a lefoglalt sáv |
| nev_cegnev | text | Név / cégnév |
| irsz | text | irányítószám |
| cim | text | utca, házszám |
| emelet | text | emelet (opcionális) |
| ajto | text | ajtó (opcionális) |
| belmagassag | text | milyen magasan van a klíma (lásd 6. pont) |
| telefon | text | |
| email | text | |
| szamla_megegyezik | bool | számlázási cím = a fenti cím |
| szamla_nev | text | számlázási név (ha eltér) |
| szamla_irsz | text | |
| szamla_cim | text | |
| adoszam | text | cég esetén (opcionális) |
| klima_marka | text | legördülőből |
| klima_tipus | text | legördülőből |
| klima_teljesitmeny | text | legördülőből |
| klima_darab | int2 | hány klímát kell tisztítani (≥1) |
| ar | int4 | **szerveroldalon** számolt ár, Ft |
| megjegyzes | text | opcionális |

Karakterhossz-korlátok minden szöveges mezőn (spam/visszaélés ellen).

### 3.4 `klima_opciok` — a legördülők tartalma (adminból szerkeszthető)
A klíma márka/típus/teljesítmény legördülők értékei nem a kódban, hanem az adatbázisban vannak, így az admin bármikor bővítheti/módosíthatja őket.
| oszlop | típus | leírás |
|---|---|---|
| id | uuid PK | |
| kategoria | text | `marka` \| `tipus` \| `teljesitmeny` |
| ertek | text | a megjelenő szöveg (pl. „Daikin") |
| sorrend | int2 | megjelenítési sorrend |
| aktiv | bool | ki lehet kapcsolni anélkül, hogy törölni kéne |

- A publikus űrlap az **aktív** értékeket tölti be, `kategoria` + `sorrend` szerint.
- Kezdő (seed) adat = a 8. pontban felsorolt listák.

---

## 4. Szabad időpontok kezelése (sablon + kivételek + egyedi)

- A **sablon** (`sablon_savok`) az alapminta. Az admin szerkesztheti (sávot ad hozzá / vesz el).
- Egy `generate_idopontok(hetek int)` DB-függvény a következő 6 hétre legyártja a hiányzó sávokat a sablonból (múltbeli és már létező sávokat kihagyva).
- **pg_cron** napi feladat automatikusan görgeti az ablakot (mindig ~6 hétre előre generál) és a régi, lejárt sávokat takarítja — így kézi beavatkozás nélkül mindig van foglalható időpont.
- **Kivétel:** egy sáv `letiltva`-ra állítható (pl. szabadság) — nem tűnik el, csak nem foglalható.
- **Egyedi időpont:** az admin a sablonon kívül is felvehet egy sávot (`forras = egyedi`).

---

## 5. Admin felület (`admin.html`)

- **Belépés:** Supabase Auth (e-mail + jelszó). Csak a vállalkozónak van fiókja; a publikus regisztráció ki van kapcsolva.
- **Funkciók:**
  1. **Heti sablon** szerkesztése (sávok hozzáadása/törlése naponként).
  2. **„6 hétre legyártás"** gomb (a `generate_idopontok` hívása).
  3. **Naptárnézet:** az egyes sávok `szabad` / `foglalt` / `letiltva` állapota; egy kattintással letiltás/visszaengedés; **egyedi sáv** felvétele.
  4. **Foglalások listája:** minden beérkezett foglalás az összes adattal, dátum szerint rendezve/szűrve.
  5. **Legördülők kezelése:** a klíma márka/típus/teljesítmény listák értékeinek hozzáadása, átnevezése, sorrendezése, ki/be kapcsolása (`klima_opciok` tábla).
- Megvalósítás: statikus `admin.html` + supabase-js; a belépési munkamenet nélkül nem tölt be adatot. Az adatokhoz a hozzáférést az **RLS** is védi (lásd 9.).

---

## 6. Foglalás menete (publikus `foglalas.html`)

1. **Naptár:** a következő 6 hét szabad, 1,5 órás sávjai (napokra bontva). Ügyfél választ egyet.
2. **Űrlap** kitöltése:
   - **Név / cégnév**
   - **Cím** külön mezőkben: irányítószám, utca/házszám, emelet, ajtó
   - **Belmagasság** — legördülő: „Normál (kb. 2,7 m-ig)" / „Magasabb (2,7–3,5 m)" / „Nagyon magas, galéria (3,5 m felett)" / „Nem tudom megítélni"
   - **Telefonszám**, **E-mail**
   - **Számlázási adatok** — pipa: „Megegyezik a fenti címmel" (bepipálva átmásolja és elrejti a mezőket); eltérésnél: számlázási név, irsz, cím
   - **Adószám** (cég esetén, opcionális)
   - Legördülők: **klíma márkája**, **típusa**, **teljesítménye**
   - **Hány klímát tisztítsunk?** (szám, ≥1) — ez adja az árat
   - **Megjegyzés** (opcionális)
3. **Ár élőben** frissül (lásd 7.).
4. **Beküldés** → `foglalas_letrehozasa` RPC:
   - ellenőrzi, hogy a sáv még `szabad` és jövőbeli,
   - **atomikusan** `foglalt`-ra állítja (ha közben más lefoglalta → hibaüzenet),
   - **szerveroldalon újraszámolja az árat** (nem bízik a kliensben),
   - menti a foglalást.
5. Siker esetén **képernyős visszaigazolás** (időpont, cím, ár), és elindulnak az e-mailek (9.5).

**Spam-védelem:** rejtett honeypot mező (mint a mostani űrlapon).

---

## 7. Árazás

- 1. klíma: **20 000 Ft**
- Minden további klíma: **+15 000 Ft**
- Képlet: `ar = 20000 + (klima_darab - 1) * 15000`
- Példa: 3 klíma = 20 000 + 2 × 15 000 = **50 000 Ft**
- Az oldalon élőben látszik; az árat a **szerver (RPC) számolja és menti**. Fizetés a **helyszínen**.

---

## 8. Legördülő listák (kezdő/seed tartalom — az adminból bármikor szerkeszthető)

Ezek a `klima_opciok` táblába kerülnek kezdő adatként; utána az admin felületen bővíthetők/módosíthatók (lásd 3.4 és 5.5).

- **Márka:** Daikin, Mitsubishi Electric, Mitsubishi Heavy, Fujitsu, Panasonic, Toshiba, LG, Samsung, Gree, Midea, Haier, Hisense, Sinclair, Cooper&Hunter, Egyéb
- **Típus:** Fali split, Multi (több beltéri egység), Kazettás (mennyezeti), Parapetes / padlón álló, Egyéb / nem tudom
- **Teljesítmény:** 2,0 kW, 2,5 kW, 3,5 kW, 5,0 kW, 7,1 kW, Nem tudom

---

## 9. Biztonság, e-mail, Google Naptár

### 9.1 RLS (sorszintű biztonság)
- `idopontok`: anon **csak olvashat** `szabad` + jövőbeli sávot. Írás csak belépett (admin).
- `foglalasok`: anon **nem** olvashat és **nem** írhat közvetlenül; foglalás csak az RPC-n keresztül. Belépett admin mindent olvashat.
- `sablon_savok`: csak belépett admin.
- `klima_opciok`: anon **csak olvashat** aktív értékeket; írás csak belépett admin.
- A foglalást végző `foglalas_letrehozasa` és a `generate_idopontok` `SECURITY DEFINER` függvények, bemenet-ellenőrzéssel.

### 9.2 Admin hozzáférés
- Supabase Auth e-mail+jelszó. Publikus regisztráció kikapcsolva. `authenticated` szerep = a vállalkozó.

### 9.3 E-mail szolgáltatás — Resend (fokozatos)
- **Most (próba-feladó `onboarding@resend.dev`):** a Resend csak a **saját fiók e-mailjére** kézbesít → a **vállalkozónak szóló értesítő + .ics** azonnal működik.
- **Domain igazolása után:** az **ügyfél visszaigazoló e-mailje + .ics** is bekapcsol, kód-módosítás nélkül (a feladó cím konfigurációs érték).
- A Resend API-kulcs az Edge Function **titkos** környezeti változójában van (nem a kliensben).

### 9.4 Naptár-meghívó (.ics)
- Az Edge Function VEVENT-et állít össze (`METHOD:REQUEST`), 90 perces időtartammal, a helyszín címével és a foglalás adataival.
- A vállalkozó Gmailje a meghívót jellemzően automatikusan a naptárba teszi.
- Domain után az ügyfél is kap .ics-et a visszaigazolóban.

### 9.5 Értesítési folyamat
`foglalasok` INSERT → **Supabase Database Webhook** → `foglalas-ertesito` Edge Function → Resend:
- vállalkozónak: értesítő az összes adattal + .ics,
- ügyfélnek: visszaigazoló + .ics *(domain után élesedik)*.
A webhookos megoldás akkor is elküldi az e-mailt, ha az ügyfél böngészője közben bezárul.

---

## 10. Amit a vállalkozónak egyszer be kell állítania (végigvezetve)

1. **Admin fiók** létrehozása (Supabase Auth) + publikus regisztráció kikapcsolása.
2. **Resend** fiók + API-kulcs; a fiók e-mailje legyen a vállalkozó címe, hogy a próba-módú értesítők megérkezzenek.
3. *(Később)* saját **domain** (pl. `bgklimatechnika.hu`) igazolása a Resendben → ügyfél-e-mailek élesítése.

---

## 11. Megerősítendő a spec átnézésekor

- **Legördülő listák** kezdő tartalma (8. pont) — a lista adminból bővíthető, de a *kezdő* értékek jók így?
- **Belmagasság** legördülő szövegei (6. pont) — vagy inkább szabad szöveges mező méterben? (Ez fix, nem adminból szerkesztett.)
- **Admin belépési e-mail:** `nagy.zsoltee92@gmail.com` legyen? (Ide mennek a foglalás-értesítők is.)
- **Foglaló oldal:** külön `foglalas.html` (javasolt), a főoldali „Időpontkérés" gombok ide mutatnak; a telefon/Messenger a főoldalon marad.
```
