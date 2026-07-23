// BG Klímatechnika — foglalás-értesítő Edge Function
// Új foglaláskor e-mailt küld a vállalkozónak és az ügyfélnek, .ics naptár-meghívóval.
// Titkok Supabase Edge Function secretként: RESEND_API_KEY, WEBHOOK_SECRET.
// Opcionális (van alapértelmezés): EMAIL_FROM, OWNER_EMAIL.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "BG Klímatechnika <onboarding@resend.dev>";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "nagy.zsoltee92@gmail.com";

function pad(n: number) { return (n < 10 ? "0" : "") + n; }
function huDatum(iso: string) {
  const d = new Date(iso);
  const nap = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"][d.getDay()];
  const ho = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."][d.getMonth()];
  return `${d.getFullYear()}. ${ho} ${d.getDate()}. (${nap}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function icsDatum(d: Date) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
}
function ft(n: number) { return Number(n).toLocaleString("hu-HU") + " Ft"; }
function esc(s: unknown) { return String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }

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

  const cim = [f.irsz, f.cim].filter(Boolean).join(" ")
    + (f.emelet ? `, ${f.emelet}. em.` : "") + (f.ajto ? ` ${f.ajto}. ajtó` : "");
  const idopontSzoveg = huDatum(kezdes);
  const ics = buildIcs(kezdes, f, f.id, cim);

  const ownerHtml = `
    <h2>Új foglalás érkezett</h2>
    <p><strong>Időpont:</strong> ${esc(idopontSzoveg)}</p>
    <p><strong>Ügyfél:</strong> ${esc(f.nev_cegnev)}<br>
       <strong>Telefon:</strong> ${esc(f.telefon)}<br>
       <strong>E-mail:</strong> ${esc(f.email)}</p>
    <p><strong>Cím:</strong> ${esc(cim)}<br>
       <strong>Belmagasság:</strong> ${esc(f.belmagassag || "-")}</p>
    <p><strong>Klíma:</strong> ${esc([f.klima_marka, f.klima_tipus, f.klima_teljesitmeny].filter(Boolean).join(" / ") || "-")} (${esc(f.klima_darab)} db)<br>
       <strong>Ár:</strong> ${esc(ft(f.ar))} (fizetés a helyszínen)</p>
    ${f.szamla_megegyezik ? "" : `<p><strong>Számlázás:</strong> ${esc([f.szamla_nev, f.szamla_irsz, f.szamla_cim].filter(Boolean).join(", "))}</p>`}
    ${f.adoszam ? `<p><strong>Adószám:</strong> ${esc(f.adoszam)}</p>` : ""}
    ${f.megjegyzes ? `<p><strong>Megjegyzés:</strong> ${esc(f.megjegyzes)}</p>` : ""}
    <p style="color:#555">A csatolt naptár-meghívót a Google Naptár automatikusan felajánlja hozzáadásra.</p>`;

  const customerHtml = `
    <h2>Köszönjük a foglalását!</h2>
    <p>Kedves ${esc(f.nev_cegnev)}, foglalását rögzítettük az alábbi időpontra:</p>
    <p style="font-size:18px"><strong>${esc(idopontSzoveg)}</strong></p>
    <p><strong>Helyszín:</strong> ${esc(cim)}<br>
       <strong>Klíma:</strong> ${esc(f.klima_darab)} db<br>
       <strong>Ár:</strong> ${esc(ft(f.ar))} — fizetés a helyszínen</p>
    <p>Hamarosan felvesszük Önnel a kapcsolatot. Kérdés esetén hívjon: +36 30 966 7618.</p>
    <p>A csatolt naptár-meghívóval az időpontot a saját naptárához adhatja.</p>
    <p>Üdvözlettel,<br>BG Klímatechnika</p>`;

  const eredmeny: Record<string, string> = {};
  try { await sendEmail(OWNER_EMAIL, `Új foglalás – ${idopontSzoveg}`, ownerHtml, ics); eredmeny.owner = "ok"; }
  catch (e) { eredmeny.owner = "hiba: " + (e as Error).message; }
  try { await sendEmail(f.email, "Foglalás visszaigazolása – BG Klímatechnika", customerHtml, ics); eredmeny.customer = "ok"; }
  catch (e) { eredmeny.customer = "hiba: " + (e as Error).message; }

  return new Response(JSON.stringify(eredmeny), { headers: { "Content-Type": "application/json" } });
});
