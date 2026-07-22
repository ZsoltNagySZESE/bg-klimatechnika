# Klímatisztítás — weboldal

Egyoldalas (one-page) bemutatkozó weboldal egyéni vállalkozó klímatisztítási
szolgáltatásához, Győr és környéke célközönséggel.

## Fájlok

| Fájl | Mire való |
|------|-----------|
| `index.html` | Az oldal tartalma és szerkezete |
| `styles.css` | Kinézet, színek, elrendezés (itt van a dizájn) |
| `script.js` | Mobil menü, előtte/utána csúszka, GYIK, űrlap |
| `.dev-server.js`, `.claude/` | Csak helyi előnézethez — élesben **nem** kell, törölhető |

## ⚠️ Kitöltendő helyek (keresd a `[ ]` szögletes zárójeleket)

Az oldal ún. **helykitöltő** (placeholder) szövegekkel készült. Cseréld ki
ezeket a valós adataidra. Nyisd meg az `index.html`-t egy szövegszerkesztőben
és keress rá ezekre:

Már kész (beírva): ✅ vállalkozás neve (BG Klímatechnika), ✅ telefonszám
(+36 30 966 7618), ✅ logó (fejléc + lábléc), ✅ színpaletta a logóhoz hangolva.

Még kitöltendő:

- `[email@pelda.hu]` és `mailto:[email@pelda.hu]` — az **e-mail címed**
- `https://m.me/[felhasznalonev]` — a **Messenger linked**
  (a `[felhasznalonev]` helyére a Facebook oldalad felhasználóneve kerül)
- `[XX XXX Ft]` / `[XX XXX Ft-tól]` — az **áraid** (Árak szekció)
- `[Ügyfél neve]` — a **valódi ügyfélvélemények** neve (Referenciák)
- „Ide kerül egy fotó Önről" — a Rólam szekcióba tegyél egy **saját fotót**
- Az előtte/utána csúszkába a **saját munkáid képei** kerülnek (lásd lentebb)

### A logóról

A `kepek/logo.jpg` egy papír-makett fotó volt — ebből készültek a weboldalon
használt, **átlátszó hátterű** változatok: `logo-icon.png` / `logo-icon-white.png`
(ikon a fejléchez/lábléchez) és `logo-full.png` / `logo-full-white.png`
(teljes logó felirattal, ha később kell). A `-white` verziók sötét háttérhez.

## Saját képek beillesztése

### Rólam fotó
A `styles.css`-ben keresd a `.about-photo` részt. A színes háttér helyett
használj képet, pl.:
```css
.about-photo { background: url("kepek/rolam.jpg") center/cover; }
```

### Előtte / utána képek
Jelenleg **minta-illusztrációk** vannak betöltve helykitöltőként:
`kepek/elotte-minta.svg` (koszos) és `kepek/utana-minta.svg` (tiszta).

A saját fotóidra cserélni a `styles.css`-ben a két sort kell (keresd: `.ba-after` / `.ba-before`):
```css
.ba-after  { background-image: url("kepek/utana.jpg"); ... }
.ba-before { background-image: url("kepek/elotte.jpg"); ... }
```
Fontos: a két képet **azonos szögből, azonos kivágással** fotózd (ugyanaz a klíma
előtte–utána), hogy a csúszka elhúzásakor pontosan fedésben legyenek.

## Ajánlatkérő űrlap → Supabase (kész, működik)

Az űrlap kitöltései egy **Supabase** adatbázisba mentődnek. Ez már be van kötve
és tesztelt.

- **Projekt:** `bg-klimatechnika` (külön a `koszorukert` projekttől)
- **Tábla:** `ajanlatkeresek`
- **Biztonság (RLS):** bárki **küldhet** (INSERT), de a beérkezett kéréseket
  **csak te látod** a Supabase felületén — a publikus kulccsal nem lehet kiolvasni.

A böngészőben látható kulcs (`sb_publishable_...` a `script.js`-ben) **publikus**,
kifejezetten kliensoldalra való — nyugodtan látszódhat, nem titok.

### A beérkezett ajánlatkérések megtekintése

1. Lépj be a [Supabase](https://supabase.com/dashboard) fiókodba.
2. Válaszd a **bg-klimatechnika** projektet → bal oldalt **Table Editor**.
3. Nyisd meg az **ajanlatkeresek** táblát — itt látod az összes kitöltést.
   (Beállítható e-mail értesítés is új sorra — szólj, ha kéred.)

## Közzététel: GitHub + Vercel

A projekt már **git repó** egy első commit-tal. A publikáláshoz két lépés maradt,
amit be kell jelentkezve, a saját fiókoddal elvégezned:

### 1. Feltöltés GitHubra
1. Hozz létre egy **új, üres** repót a GitHubon (pl. `bg-klimatechnika`),
   README/gitignore **nélkül**.
2. A projekt mappájában futtasd (a `<felhasznalonev>` a te GitHub neved):
   ```bash
   git remote add origin https://github.com/<felhasznalonev>/bg-klimatechnika.git
   git push -u origin main
   ```

### 2. Deploy Vercelre
1. A [Vercel](https://vercel.com/new) oldalon **Add New → Project**, és importáld
   a most feltöltött GitHub repót.
2. Framework: **Other** (nincs build lépés, statikus oldal). Csak **Deploy**.
3. Pár másodperc múlva élő a `...vercel.app` címen. Ezután minden `git push`
   automatikusan újra-deploy-ol.

Saját domain (pl. `bgklimatechnika.hu`) a Vercel projekt **Settings → Domains**
alatt köthető be.

> Megjegyzés: a Supabase kulcs a kódban van, így Vercelen **nem kell** külön
> környezeti változót beállítani — egyből működik a deploy után.

## Helyi megtekintés

Nyisd meg az `index.html`-t böngészőben, vagy indíts egy helyi szervert
(`node .dev-server.js`) a `http://localhost:8731` címen.
