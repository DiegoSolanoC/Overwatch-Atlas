/**
 * One-off: copy birth / made / goes-online place from data/events.json
 * into data/story-archive-heroes.json relevantLocations (first row).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const eventsPath = path.join(root, "data", "events.json");
const heroesPath = path.join(root, "data", "story-archive-heroes.json");

const COUNTRY_FIX = {
  "Antartica?": "Antarctica",
};

const BIRTH_REASONING = "Place of Birth";

function splitLabelCountry(fullLocationName, explicitCountry) {
  const full = (fullLocationName || "").trim();
  let country = (explicitCountry || "").trim();
  country = COUNTRY_FIX[country] || country;

  if (!full) {
    return { locationName: "", country };
  }

  const lastComma = full.lastIndexOf(",");
  if (lastComma === -1) {
    return { locationName: full, country };
  }

  const label = full.slice(0, lastComma).trim();
  const tail = full.slice(lastComma + 1).trim();
  if (!country) country = tail;
  return { locationName: label || full, country: country || tail };
}

function placeFromEvent(ev) {
  const rows = ev.secondaryCountryPlaces;
  let full = ev.cityDisplayName || "";
  let country = "";

  if (Array.isArray(rows) && rows.length) {
    const r0 = rows[0];
    if (r0?.locationName?.trim()) {
      full = r0.locationName;
    }
    if (r0?.country?.trim()) {
      country = r0.country.trim();
    }
  }

  const { locationName, country: c } = splitLabelCountry(full, country);
  return {
    locationName: locationName || full,
    country: COUNTRY_FIX[c] || c,
  };
}

const events = JSON.parse(fs.readFileSync(eventsPath, "utf8")).events;
const heroesDoc = JSON.parse(fs.readFileSync(heroesPath, "utf8"));
const heroes = heroesDoc.events;

const nameRe = /\s(is born|is made|goes online)$/i;
const byHero = new Map();

for (const ev of events) {
  if (!ev?.name || !nameRe.test(ev.name)) continue;
  const filters = ev.filters;
  if (!Array.isArray(filters) || !filters.length) continue;

  const heroKey = filters[0];

  const { locationName, country } = placeFromEvent(ev);
  if (!country && !locationName) continue;

  byHero.set(heroKey, { locationName, country, eventName: ev.name });
}

for (const h of heroes) {
  if (h.name === "Ana") continue;

  const row = byHero.get(h.name);
  if (!row) continue;

  const entry = {
    locationName: row.locationName,
    country: row.country,
    reasoning: BIRTH_REASONING,
  };

  const existing = Array.isArray(h.relevantLocations) ? h.relevantLocations : [];
  const already = existing.some(
    (r) =>
      r?.reasoning === BIRTH_REASONING ||
      (r?.locationName === entry.locationName && r?.country === entry.country)
  );
  if (already) continue;

  h.relevantLocations = [entry, ...existing];
}

fs.writeFileSync(heroesPath, JSON.stringify(heroesDoc, null, 2) + "\n", "utf8");
console.log("Updated", heroesPath);
for (const [k, v] of byHero) {
  const found = heroes.some((h) => h.name === k);
  if (!found) console.warn("No hero row for filter:", k, v.eventName);
}
