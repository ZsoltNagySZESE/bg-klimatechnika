// BG Klímatechnika — foglalás-értesítő Edge Function
// Új foglaláskor e-mailt küld a vállalkozónak és az ügyfélnek, .ics naptár-meghívóval.
// Titkok Supabase Edge Function secretként: RESEND_API_KEY, WEBHOOK_SECRET.
// Opcionális (van alapértelmezés): EMAIL_FROM, OWNER_EMAIL.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "BG Klímatechnika <onboarding@resend.dev>";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "nagy.zsoltee92@gmail.com";
const LOGO_URL = "https://bg-klimatechnika.vercel.app/kepek/logo-icon-white.png";

function pad(n: number) { return (n < 10 ? "0" : "") + n; }
function huDatum(iso: string) {
  // Europe/Budapest helyi idő szerint formázunk (a függvény UTC-ben fut).
  const p = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric", month: "short", day: "numeric",
    weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => (p.find((x) => x.type === t)?.value ?? "");
  return `${g("year")}. ${g("month")} ${g("day")}. (${g("weekday")}) ${g("hour")}:${g("minute")}`;
}
function icsDatum(d: Date) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
}
function ft(n: number) { return Number(n).toLocaleString("hu-HU") + " Ft"; }
function esc(s: unknown) { return String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }

// Márkázott e-mail keret (a weboldal dizájnjához illő, táblázatos, levelezőkompatibilis HTML)
function emailShell(bodyHtml: string) {
  return `<div style="background:#eef4f3;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0c2322;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
    <tr><td style="background:#123c3d;padding:22px 28px;border-radius:16px 16px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;"><img src="${LOGO_URL}" width="70" alt="BG Klímatechnika" style="display:inline-block;vertical-align:middle;"></td>
        <td align="right" style="vertical-align:middle;color:#8fd6c8;font-size:13px;font-weight:bold;letter-spacing:.5px;">Klímatisztítás · Győr</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;padding:28px;">${bodyHtml}</td></tr>
    <tr><td style="background:#0a2a2a;padding:18px 28px;border-radius:0 0 16px 16px;color:#9fc7c0;font-size:12px;line-height:1.6;">
      <strong style="color:#eafffa;">BG Klímatechnika</strong> · Klímatisztítás Győrben és környékén<br>Tel: +36 30 966 7618
    </td></tr>
  </table>
</div>`;
}

function reszletTabla(sorok: [string, string][]) {
  const rows = sorok.map((r, i) => {
    const b = i ? "border-top:1px solid #eef0ef;" : "";
    return `<tr><td style="padding:7px 0;color:#4a615f;width:130px;vertical-align:top;${b}">${r[0]}</td><td style="padding:7px 0;${b}">${r[1]}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:#0c2322;">${rows}</table>`;
}

function buildIcs(kezdesIso: string, f: any, uid: string, cim: string) {
  const start = new Date(kezdesIso);
  const end = new Date(start.getTime() + 90 * 60000);
  const leiras = [
    `Ügyfél: ${f.nev_cegnev}`, `Telefon: ${f.telefon}`, `E-mail: ${f.email}`,
    `Klíma: ${[f.klima_marka, f.klima_tipus, f.klima_teljesitmeny].filter(Boolean).join(" / ") || "-"} (${f.klima_darab} db)`,
    `Ár: ${ft(f.ar)} (fizetés a helyszínen)`,
    f.belmagassag ? `Belmagasság: ${f.belmagassag}` : "",
    f.megjegyzes ? `Megjegyzés: ${f.megjegyzes}` : "",
  ].filter(Boolean).join("\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BG Klimatechnika//HU", "METHOD:REQUEST", "BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${icsDatum(new Date(kezdesIso))}`, `DTSTART:${icsDatum(start)}`, `DTEND:${icsDatum(end)}`,
    `SUMMARY:Klímatisztítás – ${f.nev_cegnev}`, `LOCATION:${cim.replace(/,/g, "\\,")}`,
    `DESCRIPTION:${leiras}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

async function sendEmail(to: string, subject: string, html: string, ics: string) {
  const icsB64 = btoa(unescape(encodeURIComponent(ics)));
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM, to: [to], subject, html,
      attachments: [{ filename: "idopont.ics", content: icsB64 }],
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json();
}

serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await req.json();
  const f = body.record;
  const kezdes = body.idopont_kezdes;
  if (!f || !kezdes) return new Response("Bad request", { status: 400 });

  const cim = [f.irsz, f.telepules].filter(Boolean).join(" ")
    + (f.cim ? `, ${f.cim}` : "")
    + (f.emelet ? `, ${f.emelet}. em.` : "") + (f.ajto ? ` ${f.ajto}. ajtó` : "");
  const idopontSzoveg = huDatum(kezdes);
  const klimaSzoveg = (esc([f.klima_marka, f.klima_tipus, f.klima_teljesitmeny].filter(Boolean).join(" / ")) || "-") + ` (${esc(f.klima_darab)} db)`;
  const ics = buildIcs(kezdes, f, f.id, cim);

  // ----- Értesítő a vállalkozónak -----
  const ownerSorok: [string, string][] = [
    ["Ügyfél", `<strong>${esc(f.nev_cegnev)}</strong>`],
    ["Telefon", `<a href="tel:${esc(f.telefon)}" style="color:#2e8688;text-decoration:none;">${esc(f.telefon)}</a>`],
    ["E-mail", `<a href="mailto:${esc(f.email)}" style="color:#2e8688;text-decoration:none;">${esc(f.email)}</a>`],
    ["Cím", esc(cim)],
    ["Belmagasság", esc(f.belmagassag || "-")],
    ["Klíma", klimaSzoveg],
  ];
  if (!f.szamla_megegyezik) ownerSorok.push(["Számlázás", esc([f.szamla_nev, f.szamla_irsz, f.szamla_telepules, f.szamla_cim].filter(Boolean).join(", "))]);
  if (f.adoszam) ownerSorok.push(["Adószám", esc(f.adoszam)]);
  if (f.megjegyzes) ownerSorok.push(["Megjegyzés", esc(f.megjegyzes)]);

  const ownerBody = `
    <h1 style="margin:0 0 6px;font-size:22px;color:#123c3d;">Új foglalás érkezett</h1>
    <p style="margin:0 0 4px;color:#4a615f;font-size:15px;">Egy ügyfél időpontot foglalt a weboldalon.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#eef7f6;border:1px solid #cfe6e2;border-radius:12px;"><tr>
      <td style="padding:16px 20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#2e8688;font-weight:bold;">Időpont</div>
        <div style="font-size:20px;font-weight:bold;color:#123c3d;margin-top:3px;">${esc(idopontSzoveg)}</div>
      </td>
      <td align="right" style="padding:16px 20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#2e8688;font-weight:bold;">Ár</div>
        <div style="font-size:20px;font-weight:bold;color:#123c3d;margin-top:3px;">${esc(ft(f.ar))}</div>
      </td>
    </tr></table>
    ${reszletTabla(ownerSorok)}
    <p style="margin:18px 0 4px;color:#4a615f;font-size:13px;">📅 A csatolt naptár-meghívót a Google Naptár automatikusan felajánlja hozzáadásra.</p>`;

  // ----- Visszaigazolás az ügyfélnek -----
  const customerBody = `
    <h1 style="margin:0 0 10px;font-size:22px;color:#123c3d;">Köszönjük a foglalását!</h1>
    <p style="margin:0 0 4px;color:#0c2322;font-size:15px;line-height:1.6;">Kedves <strong>${esc(f.nev_cegnev)}</strong>, foglalását rögzítettük. Az alábbi időpontban érkezünk:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#eef7f6;border:1px solid #cfe6e2;border-radius:12px;"><tr>
      <td style="padding:18px 20px;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#2e8688;font-weight:bold;">Foglalt időpont</div>
        <div style="font-size:22px;font-weight:bold;color:#123c3d;margin-top:4px;">${esc(idopontSzoveg)}</div>
      </td>
    </tr></table>
    ${reszletTabla([
      ["Helyszín", `<strong>${esc(cim)}</strong>`],
      ["Tisztítandó", `${esc(f.klima_darab)} db klíma`],
      ["Ár", `<strong>${esc(ft(f.ar))}</strong> <span style="color:#4a615f;">— fizetés a helyszínen</span>`],
    ])}
    <p style="margin:20px 0 0;color:#0c2322;font-size:15px;line-height:1.6;">Hamarosan felvesszük Önnel a kapcsolatot. Kérdés esetén hívjon: <a href="tel:+36309667618" style="color:#2e8688;font-weight:bold;text-decoration:none;">+36 30 966 7618</a>.</p>
    <p style="margin:14px 0 0;color:#4a615f;font-size:13px;">📅 A csatolt naptár-meghívóval az időpontot a saját naptárához adhatja.</p>
    <p style="margin:22px 0 0;color:#123c3d;font-size:15px;">Üdvözlettel,<br><strong>BG Klímatechnika</strong></p>`;

  const eredmeny: Record<string, string> = {};
  try { await sendEmail(OWNER_EMAIL, `Új foglalás – ${idopontSzoveg}`, emailShell(ownerBody), ics); eredmeny.owner = "ok"; }
  catch (e) { eredmeny.owner = "hiba: " + (e as Error).message; }
  try { await sendEmail(f.email, "Foglalás visszaigazolása – BG Klímatechnika", emailShell(customerBody), ics); eredmeny.customer = "ok"; }
  catch (e) { eredmeny.customer = "hiba: " + (e as Error).message; }

  return new Response(JSON.stringify(eredmeny), { headers: { "Content-Type": "application/json" } });
});
