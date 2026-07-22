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

## Az ajánlatkérő űrlap élesítése

Jelenleg az űrlap **nem küld valódi e-mailt** — csak visszajelez a böngészőben.
Mivel ez egy statikus oldal (nincs mögötte szerver), a legegyszerűbb egy ingyenes
űrlap-szolgáltatás, pl. [Formspree](https://formspree.io) vagy
[Web3Forms](https://web3forms.com). Regisztráció után kapsz egy „action" linket,
amit az `index.html`-ben a `<form ...>` sorba kell beírni. Szólj, és beállítom.

Alternatíva: a Kapcsolat blokk telefon/Messenger/e-mail linkjei már most
működnek, sok ügyfél úgyis azokat használja.

## Helyi megtekintés

Csak nyisd meg az `index.html`-t böngészőben (dupla kattintás).

## Közzététel (ingyenes tárhelyek)

A három fő fájl (`index.html`, `styles.css`, `script.js`) feltölthető bármelyik
statikus tárhelyre: **Netlify**, **Vercel**, **Cloudflare Pages** vagy
**GitHub Pages**. Ha kérsz, ebben is segítek — és köthető hozzá saját
domain (pl. `klimatisztitas-gyor.hu`).
