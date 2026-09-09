#!/usr/bin/env node
/* Fixtures for the "Say it how you'd say it" parser in app.js.
 *
 *   node test-parser.js
 *
 * Why this exists. Every single fix to that parser has silently broken
 * something else, and always in the same way — a place, a price or a date
 * quietly stops appearing, the panel still looks confident, and nothing
 * errors. Tokyo vanished from "London to Tokyo, Osaka or Seoul" when
 * alternatives were added; Athens vanished from "Milan, Naples and Athens in
 * June" when place phrases learned to stop at "in"; "whole trip" became a
 * destination when trip totals were added. None of those threw.
 *
 * So the check that matters is not "does it run" but "does it still hear
 * everything it heard yesterday". Run this after ANY edit to the parser.
 *
 * It reads parse() out of app.js rather than importing, because app.js is a
 * browser IIFE with no module system and adding one to a no-build site to
 * make it testable would be the tail wagging the dog.
 */

const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const body = src.slice(src.indexOf("  var CITIES"), src.indexOf("  /* ---------- render"));
const parse = new Function(body + "; return parse;")();

/* Each case says what MUST appear. `routes` is exact and ordered — that is the
   silent-drop guard. `flags` are substrings, so wording can be improved
   without breaking the suite, but the fact that something was flagged at all
   cannot be lost. */
const CASES = [
  { in: "",
    shape: "empty", routes: [] },

  { in: "Watch London to Tokyo, first two weeks of April, under £600",
    shape: "one", routes: ["London → Tokyo"],
    when: "First two weeks of April", price: "£600", noFlags: true },

  { in: "Cusco to Lima to Cancún, end of March, under £300 for the lot",
    shape: "trip", routes: ["Cusco → Lima → Cancún"],
    when: "End of March", price: "£300", noFlags: true },

  // Every leg survives, including the two it has never heard of.
  { in: "london to japan to hong kong to florence, 20th july- may 19, 2 people, i want to know when its within 200",
    shape: "trip", routes: ["London → Japan → Hong Kong → Florence"],
    when: "20 July – 19 May", price: "?200", travellers: 2,
    flags: ["is a country", "no currency", "crosses the new year", "10-month window"] },

  // The chain's own destination is not replaced by the alternatives.
  { in: "London to Tokyo, Osaka or Seoul in April under £600",
    shape: "many", routes: ["London → Tokyo", "London → Osaka", "London → Seoul"] },

  // "whole trip" is a marker, never a place; the price loses its trailing comma.
  { in: "London to Tokyo, Osaka or Seoul, whole trip £555, 28th Aug-19th Jan",
    shape: "many", routes: ["London → Tokyo", "London → Osaka", "London → Seoul"],
    when: "28 August – 19 January", price: "£555",
    flags: ["crosses the new year", "whole-trip total"] },

  // Athens must not be eaten by "in June".
  { in: "Watch Milan, Naples and Athens in June",
    shape: "many", routes: ["Milan", "Naples", "Athens"],
    flags: ["No price yet", "leaving from"] },

  { in: "Tokyo under £600 and Lisbon under £90",
    shape: "many", routes: ["Tokyo", "Lisbon"],
    flags: ["No dates yet", "leaving from"] },

  // A date with no comma before it must not become part of the place name.
  { in: "Manchester to Faro 3 Sept to 17 Sept, under 250",
    shape: "one", routes: ["Manchester → Faro"],
    when: "3 September – 17 September", price: "?250" },

  { in: "edinburgh to nice 12 dec, 2 adults, max €400",
    shape: "one", routes: ["Edinburgh → Nice"],
    when: "12 December", price: "€400", travellers: 2, noFlags: true },

  // One of the three examples this site advertises.
  { in: "Anywhere sunny in half term, two of us, under £400 each",
    shape: "one", routes: ["Anywhere sunny"],
    when: "Half term", price: "£400", travellers: 2 },

  { in: "Tokyo",
    shape: "one", routes: ["Tokyo"],
    flags: ["leaving from", "No price yet", "No dates yet"] },

  // A length of stay for each place means ONE trip through all of them, even
  // though the sentence also says "or". Also: a misspelled month must read as
  // a date, not become a city called Novermber.
  { in: 'London to Tokyo, Osaka or Seoul", novermber 18-december 5, 3 days in tokyo, 5 days in osaka, 6 days in seoul for now, ranging maximum 800 total',
    shape: "trip", routes: ["London → Tokyo → Osaka → Seoul"],
    when: "18 November – 5 December", price: "?800",
    flags: ["one trip through all 3", "3 days in Tokyo, 5 days in Osaka, 6 days in Seoul",
            "17-day window", "Reading “novermber” as November", "no currency"] },

  // Guard for the fuzzy month matcher: at two edits on a five-letter word,
  // "watch" matches "march". The threshold must keep this at no date.
  { in: "Watch Barcelona under £120",
    shape: "one", routes: ["Barcelona"],
    flags: ["No dates yet"] }
];

let failed = 0;

function check(label, got, want) {
  if (got !== want) {
    console.log(`    ${label}\n      expected: ${JSON.stringify(want)}\n      got:      ${JSON.stringify(got)}`);
    return false;
  }
  return true;
}

for (const c of CASES) {
  const out = parse(c.in);
  const routes = out.watches.map(w => w.route);
  const flags = out.flags.join(" | ");
  let ok = true;

  ok = check("shape", out.shape, c.shape) && ok;
  ok = check("routes", routes.join(" ; "), c.routes.join(" ; ")) && ok;

  if (c.when) ok = check("when", out.watches[0] && out.watches[0].when && out.watches[0].when.label, c.when) && ok;
  if (c.price) {
    const p = out.watches[0] && out.watches[0].price;
    ok = check("price", p ? (p.symbol || "?") + p.amount : null, c.price) && ok;
  }
  if (c.travellers) ok = check("travellers", out.watches[0] && out.watches[0].n, c.travellers) && ok;

  for (const f of c.flags || []) {
    if (flags.indexOf(f) === -1) {
      console.log(`    missing flag containing ${JSON.stringify(f)}\n      got: ${flags || "(none)"}`);
      ok = false;
    }
  }
  if (c.noFlags && out.flags.length) {
    console.log(`    expected no flags, got: ${flags}`);
    ok = false;
  }

  console.log(`${ok ? "  ok  " : "  FAIL"}  ${c.in.slice(0, 62) || "(empty)"}`);
  if (!ok) failed++;
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
