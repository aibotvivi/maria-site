/* Ask Maria — landing-page interactions.
 *
 * Only the "Say it how you'd say it" demo lives here. Consent is owned by
 * analytics.js (which builds the banner Consent Mode actually listens to) and
 * the signup flow by invite.js — both deliberately, so there is one
 * implementation of each rather than two that disagree.
 */
(function () {
  "use strict";

  /* ---------- "Say it how you'd say it" ------------------------------------
     A front-end illusion over a fixed city list. It cannot parse language and
     is not trying to; what it MUST get right is the SHAPE of the ask, because
     the shape is the thing the panel is making a promise about.

     Maria stores two different things, and the demo has to tell them apart:

       routes      independent watches, each with its own price. Twenty max.
       trip_combos several legs summed into ONE running total. Four max.

     The signal is not how many cities were named — it is how many PRICES.
     "Cusco to Lima to Cancún under £300 for the lot" is one trip with one
     total. "Tokyo under £600 and Lisbon under £90" is two watches with two.

     The first version had a single shape — a chain of cities — and forced
     everything into it, silently dropping whatever did not fit: a second
     price, a second month, an entire second trip. "Tokyo under £600 and
     Lisbon under £90" rendered as "Tokyo → Lisbon, under £600", which is not
     a rough answer, it is a wrong one, and it is wrong in the direction that
     costs most — it teaches a visitor that Maria mangles what you tell her,
     on the one screen built to prove she doesn't.

     So the rules here, in priority order:

       1. Never silently drop anything. If a price or a date was typed and is
          not shown, say so.
       2. When the shape is ambiguous, say what Maria would ASK. An honest
          "she'd check which of these you meant" is worth more than a
          confident guess, and it is also what actually happens next.
       3. Only claim a reading when the input supports it.

     To make this real rather than an illusion, POST the textarea value to an
     endpoint running the same Claude parse step the bot uses, and render the
     returned fields into the [data-parsed] slots. */

  /* Cities it can name confidently. This list is a CONVENIENCE, not the
     parser's understanding of the world — everything below works on sentence
     structure, and an unrecognised word is reported as unrecognised rather
     than dropped. The first version matched vocabulary instead of structure,
     so "london to japan to hong kong to florence" silently became
     "London → Hong Kong": two of the four places were not on the list, and
     nothing said so. A fixed list is always incomplete; the bug was trusting
     it to be complete. */
  var CITIES = {
    "london":"London","tokyo":"Tokyo","lisbon":"Lisbon","cancun":"Cancún",
    "cancún":"Cancún","lima":"Lima","cusco":"Cusco","hong kong":"Hong Kong",
    "new york":"New York","bangkok":"Bangkok","reykjavik":"Reykjavik",
    "athens":"Athens","milan":"Milan","dubai":"Dubai","porto":"Porto",
    "marrakesh":"Marrakesh","marrakech":"Marrakesh","naples":"Naples",
    "faro":"Faro","osaka":"Osaka","seoul":"Seoul","paris":"Paris","rome":"Rome",
    "florence":"Florence","venice":"Venice","barcelona":"Barcelona",
    "madrid":"Madrid","berlin":"Berlin","amsterdam":"Amsterdam","dublin":"Dublin",
    "singapore":"Singapore","bali":"Bali","denpasar":"Bali","manchester":"Manchester",
    "edinburgh":"Edinburgh","glasgow":"Glasgow","malaga":"Málaga","málaga":"Málaga",
    "alicante":"Alicante","nice":"Nice","prague":"Prague","vienna":"Vienna",
    "budapest":"Budapest","krakow":"Kraków","copenhagen":"Copenhagen",
    "istanbul":"Istanbul","cairo":"Cairo","delhi":"Delhi","mumbai":"Mumbai",
    "sydney":"Sydney","toronto":"Toronto","miami":"Miami","boston":"Boston",
    "chicago":"Chicago","los angeles":"Los Angeles","san francisco":"San Francisco",
    "split":"Split"
  };

  /* A country is not a destination she can watch — it has several airports and
     the fare depends entirely on which. Naming them separately lets the panel
     say something useful ("Japan is a country — which airport?") instead of
     treating it as an unknown word. */
  var COUNTRIES = {
    "japan":"Japan","italy":"Italy","spain":"Spain","france":"France",
    "portugal":"Portugal","greece":"Greece","thailand":"Thailand",
    "india":"India","china":"China","australia":"Australia","morocco":"Morocco",
    "turkey":"Turkey","germany":"Germany","netherlands":"Netherlands",
    "mexico":"Mexico","brazil":"Brazil","vietnam":"Vietnam","indonesia":"Indonesia",
    "usa":"the USA","america":"the USA","united states":"the USA","uk":"the UK",
    "scotland":"Scotland","ireland":"Ireland","croatia":"Croatia","poland":"Poland"
  };

  var MONTHS = ["january","february","march","april","may","june","july",
                "august","september","october","november","december"];
  /* "28th Aug-19th Jan" reported no dates at all, because only the full names
     were known. Longest-first within each month so "sept" wins over "sep". */
  var MONTH_ALIASES = [
    ["january",["jan"]], ["february",["feb"]], ["march",["mar"]],
    ["april",["apr"]], ["may",[]], ["june",["jun"]], ["july",["jul"]],
    ["august",["aug"]], ["september",["sept","sep"]], ["october",["oct"]],
    ["november",["nov"]], ["december",["dec"]]
  ];
  var WORD_NUMS = { one:1, two:2, three:3, four:4, five:5, six:6 };

  /* A single total across several legs. This — not the number of cities — is
     what makes something a trip Maria sums rather than separate watches. */
  var WHOLE_TRIP = /\b(?:for\s+)?(?:the\s+)?whole\s+(?:thing|trip|lot|journey)\b|\bfor the lot\b|\bin total\b|\baltogether\b|\ball in\b|\bfor everything\b|\bfor all of it\b|\bcombined\b|\btotal\b/;

  /* Words that end a place phrase. Without these, "Tokyo in April" resolves as
     a city called "Tokyo In April". */
  var STOP = /^(in|on|at|under|below|within|for|around|about|during|next|this|each|per|from|by|before|after|until|till|and|or|with|when|its|it|i|want|know|to|whole|trip|journey|lot|total|altogether|everything|combined|return|returning|outbound)$/;

  var EM = "—";

  /* Levenshtein, small strings only. Exists so that "novermber" is read as a
     date rather than becoming a city called Novermber — which is what happened,
     complete with a confident "she doesn't recognise Novermber" underneath. */
  function editDistance(a, b) {
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[b.length];
  }

  function monthIndexOf(w) {
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      if (MONTH_ALIASES[i][0] === w) return i;
      if (MONTH_ALIASES[i][1].indexOf(w) > -1) return i;
    }
    return -1;
  }

  /* Deliberately tight. At distance 2 on a five-letter word, "watch" matches
     "march" — and "Watch London to Tokyo" would sprout a March date out of
     nowhere. So: one edit up to six letters, two only from seven. */
  function fuzzyMonth(w) {
    if (w.length < 5 || CITIES[w] || COUNTRIES[w] || STOP.test(w)) return -1;
    var allow = w.length >= 7 ? 2 : 1;
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      var full = MONTH_ALIASES[i][0];
      if (Math.abs(full.length - w.length) > allow) continue;
      if (editDistance(w, full) <= allow) return i;
    }
    return -1;
  }

  function isMonthWord(w) {
    for (var i = 0; i < MONTH_ALIASES.length; i++) {
      if (MONTH_ALIASES[i][0] === w) return true;
      if (MONTH_ALIASES[i][1].indexOf(w) > -1) return true;
    }
    return false;
  }

  function titleWords(s) {
    return s.replace(/\S+/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }

  /* Turn one segment of a "A to B to C" chain into a place. Unknown is a
     first-class outcome, not a failure to be swallowed. */
  function resolvePlace(raw) {
    var t = String(raw || "").toLowerCase()
      .replace(/[.!?]+$/, "")
      .replace(/^\s*(please\s+)?(watch|track|monitor|check|find me|i want to (watch|know|go)|i'd like)\s+/, "")
      .replace(/^\s*(from|fly(ing)? (from|to)|go(ing)? to)\s+/, "")
      .replace(/[^a-zà-ÿ'’\- ]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return null;

    // A place phrase ENDS at the first stop-word: "Athens in June" is Athens,
    // not a city called "Athens In June". Trimming only the ends left the
    // whole phrase unresolvable, and an unresolvable phrase was dropped.
    var words = t.split(" ");
    while (words.length && STOP.test(words[0])) words.shift();
    var cut = [];
    for (var wi = 0; wi < words.length; wi++) {
      if (STOP.test(words[wi]) || isMonthWord(words[wi])) break;
      cut.push(words[wi]);
    }
    words = cut;
    t = words.join(" ");
    if (!t) return null;

    if (CITIES[t])    return { name: CITIES[t],    kind: "city" };
    if (COUNTRIES[t]) return { name: COUNTRIES[t], kind: "country" };
    if (t.length > 20 || words.length > 3) return null;   // a sentence, not a place
    return { name: titleWords(t), kind: "unknown" };
  }

  /* The route is the run of "X to Y to Z" before the first comma. Structure,
     not vocabulary: this finds four legs whether or not it has heard of any
     of them. */
  function chainIn(part) {
    var head = part.split(",")[0];
    if (!/\s+to\s+/i.test(head)) return null;
    var segs = head.split(/\s+to\s+/i);
    var out = [];
    for (var i = 0; i < segs.length; i++) {
      var p = resolvePlace(segs[i]);
      if (p) out.push(p);
    }
    return out.length >= 2 ? out : null;
  }

  /* "London to Tokyo, Osaka or Seoul" — destinations listed after the chain,
     sharing its origin. Read only up to the first stop-word or digit, so
     "Osaka or Seoul in April under £600" contributes Osaka and Seoul and not
     the rest of the sentence. */
  function altsAfter(part) {
    var rest = part.slice(part.indexOf(",") + 1);
    if (part.indexOf(",") === -1) return null;
    var take = [];
    rest.trim().split(/\s+/).some(function (w) {
      var bare = w.toLowerCase().replace(/[^a-zà-ÿ'’,-]/gi, "");
      if (/\d/.test(w)) return true;
      if (STOP.test(bare.replace(/,$/, "")) && !/^(or|and)$/.test(bare.replace(/,$/, ""))) return true;
      take.push(w);
      return false;
    });
    var phrase = take.join(" ");
    if (!/\bor\b|\band\b|,/.test(phrase)) return null;
    var names = phrase.split(/\s*,\s*|\s+\bor\b\s+|\s+\band\b\s+/i);
    var resolved = [];
    names.forEach(function (n) { var p = resolvePlace(n); if (p) resolved.push(p); });
    if (resolved.length < 2) return null;
    if (!resolved.some(function (r) { return r.kind === "city"; })) return null;
    return resolved;
  }

  /* Bare destinations with no "to" at all: "Milan, Naples and Athens". */
  function bareList(part) {
    var names = part.split(/\s*,\s*|\s+\bor\b\s+|\s+\band\b\s+/i);
    var resolved = [];
    names.forEach(function (n) {
      var p = resolvePlace(n);
      if (p && (p.kind === "city" || p.kind === "country")) resolved.push(p);
    });
    return resolved.length ? resolved : null;
  }

  /* Price, with or without a currency. "within 200" is a real budget and the
     old version saw no "£" and reported "No number set" — which reads as the
     user having forgotten to give one. The currency being absent is worth
     saying; the number being absent is not the same thing. */
  function trimNum(n) { return String(n).replace(/[,.]+$/, ""); }

  function priceIn(text) {
    var m = text.match(/([£$€])\s?(\d[\d,]*)/);
    // [\d,]* happily swallows the comma that ENDS the clause, so "£555, 28th
    // Aug" produced the amount "555," and rendered as "£555,".
    if (m) return { amount: trimNum(m[2]), symbol: m[1] };
    var w = text.match(/\b(\d[\d,]*)\s?(gbp|pounds?|usd|dollars?|eur|euros?)\b/i);
    if (w) {
      var sym = /gbp|pound/i.test(w[2]) ? "£" : (/usd|dollar/i.test(w[2]) ? "$" : "€");
      return { amount: trimNum(w[1]), symbol: sym };
    }
    var b = text.match(/\b(?:under|within|below|max(?:imum)?|up to|less than|no more than|around|about)\s*(\d[\d,]*)\b/i);
    if (b) return { amount: trimNum(b[1]), symbol: null };
    return null;
  }

  /* Dates, in the order they were TYPED. The old version walked the month
     list January-first and returned whichever came earliest in the calendar,
     so "20th july - may 19" reported "May". */
  function datesIn(text) {
    var low = text.toLowerCase(), hits = [], re = /[a-z\u00e0-\u00ff]+/g, m;
    while ((m = re.exec(low)) !== null) {
      var w = m[0];
      var idx = monthIndexOf(w), fuzzy = false;
      if (idx === -1) { idx = fuzzyMonth(w); fuzzy = idx > -1; }
      if (idx > -1) {
        hits.push({ at: m.index, end: m.index + w.length, idx: idx,
                    label: titleWords(MONTH_ALIASES[idx][0]), fuzzy: fuzzy, raw: w });
      }
    }

    hits.forEach(function (h) {
      var before = low.slice(Math.max(0, h.at - 9), h.at);
      var after  = low.slice(h.end, h.end + 8);
      var d = before.match(/(\d{1,2})(?:st|nd|rd|th)?\s*$/) || after.match(/^\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
      if (d) h.day = parseInt(d[1], 10);
    });

    return hits;
  }

  /* Rough day count between two (month, day) points, wrapping the year. Only
     needs to be good enough to say "14 nights inside an 18-day window". */
  var MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
  function dayOfYear(idx, day) {
    var n = day || 1;
    for (var i = 0; i < idx; i++) n += MONTH_DAYS[i];
    return n;
  }
  function windowDays(a, b) {
    if (!a || !b || !a.day || !b.day) return null;
    var d = dayOfYear(b.idx, b.day) - dayOfYear(a.idx, a.day);
    return d < 0 ? d + 365 : d;
  }

  /* "3 days in Tokyo, 5 days in Osaka" is an ITINERARY — a single trip through
     all of them, in that order. Read as alternatives it becomes three separate
     watches, which is the opposite of what was asked for. Giving a length of
     stay for each place is the strongest signal in the sentence and it was
     being ignored entirely. */
  function staysIn(text) {
    var out = [], re = /(\d+)\s*(day|days|night|nights|week|weeks)\s+in\s+([a-z\u00e0-\u00ff'\u2019 -]+)/gi, m;
    while ((m = re.exec(text)) !== null) {
      var p = resolvePlace(m[3]);
      if (!p) continue;
      var n = parseInt(m[1], 10);
      if (/week/i.test(m[2])) n *= 7;
      out.push({ nights: n, place: p });
    }
    return out;
  }

  function dateLabel(h) { return (h.day ? h.day + " " : "") + h.label; }

  function whenIn(text) {
    var low = text.toLowerCase();
    var hits = datesIn(text);
    if (hits.length >= 2) {
      var between = low.slice(hits[0].end, hits[1].at);
      var isRange = /[-–—]|(\bto\b)|(\buntil\b)|(\btill\b)|(\bthrough\b)/.test(between);
      return {
        label: dateLabel(hits[0]) + (isRange ? " – " : " and ") + dateLabel(hits[1]),
        hits: hits, range: isRange
      };
    }
    if (hits.length === 1) return { label: rangeWords(low, dateLabel(hits[0])), hits: hits, range: false };
    if (/half\s*term/.test(low)) return { label: "Half term", hits: [], range: false };
    if (/christmas/.test(low))   return { label: "Christmas", hits: [], range: false };
    if (/easter/.test(low))      return { label: "Easter", hits: [], range: false };
    return null;
  }

  function rangeWords(low, label) {
    if (/first two weeks/.test(low))        return "First two weeks of " + label;
    if (/end of/.test(low))                 return "End of " + label;
    if (/start of|beginning of/.test(low))  return "Start of " + label;
    return label;
  }

  function travellersIn(low) {
    var d = low.match(/(\d+)\s*(adults?|people|of us|passengers?|travellers?)/);
    var w = low.match(/\b(one|two|three|four|five|six)\s+(adults?|people|of us|passengers?|travellers?)/);
    if (d) return parseInt(d[1], 10);
    if (w) return WORD_NUMS[w[1]];
    return 1;
  }

  /* " and " / ";" separates two complete asks; a comma does NOT — "Cusco to
     Lima to Cancún, end of March, under £300" is one ask with three commas.
     A fragment naming no place is a continuation, not a new watch. */
  function clauses(text) {
    var parts = text.split(/\s*;\s*|\s+and\s+/i), out = [];
    parts.forEach(function (p) {
      if (!p || !p.trim()) return;
      var hasPlace = chainIn(p) || bareList(p);
      if (!hasPlace && out.length) out[out.length - 1] += " and " + p;
      else out.push(p.trim());
    });
    return out.length ? out : [text];
  }

  function parse(raw) {
    var text = String(raw || "").trim();
    if (!text) {
      return { shape: "empty", watches: [], flags: [], note:
        "Start typing and she’ll pull the route, the dates and your price out of it." };
    }

    var lowAll  = text.toLowerCase();
    var parts   = clauses(text);
    var wholeT  = WHOLE_TRIP.test(lowAll);
    var whenAll = whenIn(text);
    var nAll    = travellersIn(lowAll);
    var each    = /\beach\b|per person|\bpp\b/.test(lowAll);

    var watches = [], flags = [], legs = 0, unknowns = [], countries = [], openAsk = false;

    /* An itinerary beats everything else in the sentence. Giving a length of
       stay for each place says "one trip, in this order" more strongly than
       "or" says "pick one" — people write "Tokyo, Osaka or Seoul" while
       meaning all three, and then spell out the nights. Read as alternatives
       it produced three separate watches, which is the opposite of the ask. */
    var stays = staysIn(text);
    if (stays.length >= 2) {
      var firstChain = chainIn(parts[0]);
      var origin = firstChain ? firstChain[0] : null;
      if (origin) noteUnknownInto(origin, unknowns, countries);
      stays.forEach(function (st) { noteUnknownInto(st.place, unknowns, countries); });

      var seq = stays.map(function (st) { return st.place.name; });
      var routeStr = (origin ? origin.name + " → " : "") + seq.join(" → ");
      watches.push({ route: routeStr, when: whenAll, n: nAll, price: priceIn(text) });

      var nights = stays.reduce(function (t, st) { return t + st.nights; }, 0);
      var win = whenAll && whenAll.hits.length >= 2
        ? windowDays(whenAll.hits[0], whenAll.hits[1]) : null;

      flags.push("She’s read that as one trip through all " + stays.length +
        (/\bor\b/i.test(text) ? ", not a choice between them — you wrote “or”, but you gave a length of stay for each." : "."));
      flags.push(stays.map(function (st) {
          return st.nights + (st.nights === 1 ? " day in " : " days in ") + st.place.name;
        }).join(", ") + " — " + nights + " days" +
        (win ? " inside a " + win + "-day window, leaving " + (win - nights) + " for travel." : "."));

      if (whenAll) whenAll.hits.forEach(function (h) {
        if (h.fuzzy) flags.push("Reading “" + h.raw + "” as " + h.label + ".");
      });
      if (!priceIn(text)) flags.push("No price yet. Give her a number and she’ll only message you under it.");
      else if (!priceIn(text).symbol) flags.push("You said " + priceIn(text).amount +
        " with no currency — she’ll take that as £" + priceIn(text).amount + " unless you tell her otherwise.");
      if (countries.length) flags.push(countries.join(" and ") +
        (countries.length > 1 ? " are countries" : " is a country") + " — she’ll ask which airport.");
      if (unknowns.length) flags.push("She doesn’t recognise " +
        unknowns.map(function (u) { return "“" + u + "”"; }).join(" or ") + " yet — she’ll check what you meant.");

      return { shape: "trip", watches: watches, flags: flags,
               note: wholeT
                 ? "One trip, not separate flights — she adds the legs up and alerts on the total."
                 : "One trip through " + stays.length + " stops. She’d total the legs unless you give each its own price." };
    }

    function noteUnknownInto(p, unk, ctry) {
      if (p.kind === "unknown" && unk.indexOf(p.name) === -1) unk.push(p.name);
      if (p.kind === "country" && ctry.indexOf(p.name) === -1) ctry.push(p.name);
    }

    function noteUnknown(p) {
      if (p.kind === "unknown" && unknowns.indexOf(p.name) === -1) unknowns.push(p.name);
      if (p.kind === "country" && countries.indexOf(p.name) === -1) countries.push(p.name);
    }

    parts.forEach(function (part) {
      var low   = part.toLowerCase();
      var when  = whenIn(part) || whenAll;
      var n     = travellersIn(low) !== 1 ? travellersIn(low) : nAll;
      var price = priceIn(part) || (parts.length === 1 ? priceIn(text) : null);

      var chain = chainIn(part);
      if (chain) {
        chain.forEach(noteUnknown);
        var alts = altsAfter(part);
        if (chain.length === 2 && alts) {
          alts.forEach(noteUnknown);
          // chain[1] is a destination too — "London to Tokyo, Osaka or Seoul"
          // is three options, not two. Dropping it was the same silent loss
          // this rewrite exists to stop.
          var dests = [chain[1]].concat(alts.filter(function (a) {
            return a.name !== chain[1].name;
          }));
          dests.forEach(function (d) {
            watches.push({ route: chain[0].name + " → " + d.name, when: when, n: n, price: price });
          });
          return;
        }
        legs = Math.max(legs, chain.length - 1);
        watches.push({
          route: chain.map(function (c) { return c.name; }).join(" → "),
          when: when, n: n, price: price
        });
        return;
      }

      var open = low.match(/\b(anywhere|somewhere|wherever)\b/);
      if (open) {
        openAsk = true;
        var vibe = (low.match(/\b(sunny|warm|hot|cheap|beach|snow|skiing|quiet)\b/) || [])[1];
        watches.push({ route: "Anywhere" + (vibe ? " " + vibe : ""), when: when, n: n,
                       price: price, needsOrigin: true });
        return;
      }

      var bare = bareList(part);
      if (bare) {
        bare.forEach(noteUnknown);
        bare.forEach(function (b) {
          watches.push({ route: b.name, when: when, n: n, price: price, needsOrigin: true });
        });
      }
    });

    if (!watches.length) {
      return { shape: "unsure", watches: [], flags: [], note:
        "She didn’t catch a place in that. Name where you’re flying from and to and she’ll take it from there." };
    }

    var shape = watches.length > 1 ? "many" : (legs >= 2 || wholeT ? "trip" : "one");

    /* ---- flags: the things she would come back and check -------------------
       These are shown in the panel, not only mentioned in the note. The whole
       complaint about the old version was that a dropped word was invisible
       unless you happened to read a sentence at the bottom. */

    if (countries.length) {
      flags.push(countries.join(" and ") + (countries.length > 1 ? " are countries" : " is a country") +
                 " — she’ll ask which airport, because the fare depends on it.");
    }
    if (unknowns.length) {
      flags.push("She doesn’t recognise " +
        unknowns.map(function (u) { return "“" + u + "”"; }).join(" or ") +
        " yet — she’ll check what you meant rather than guess.");
    }

    var priced = watches.filter(function (w) { return w.price; });
    if (priced.length && !priced[0].price.symbol) {
      flags.push("You said " + priced[0].price.amount + " with no currency — she’ll take that as £" +
                 priced[0].price.amount + " unless you tell her otherwise.");
    }
    if (!priced.length) {
      flags.push("No price yet. Give her a number and she’ll only message you under it.");
    }

    if (whenAll && whenAll.hits.length >= 2 && whenAll.range) {
      var a = whenAll.hits[0], b = whenAll.hits[1];
      // A range whose second month is earlier in the calendar has crossed the
      // new year — which is ordinary for a long trip, not an error. Say which
      // reading she is taking rather than accusing them of typing it wrong.
      var span = (b.idx - a.idx + 12) % 12;
      if (b.idx < a.idx) {
        flags.push("That crosses the new year — she’ll read it as " + dateLabel(a) +
                   " to " + dateLabel(b) + " the following year. Say so if you meant two separate trips.");
      }
      if (span > 5) {
        flags.push("That’s a " + span + "-month window — she’ll ask whether you want one long stay, " +
                   "or the cheapest week anywhere inside it.");
      }
    } else if (whenAll && whenAll.hits.length >= 2 && !whenAll.range) {
      flags.push("You named two dates — she’ll ask which is the outbound and which the return.");
    }
    if (!whenAll) {
      flags.push("No dates yet — she’ll ask when you want to go.");
    }
    if (watches.some(function (w) { return w.needsOrigin; }) && !openAsk) {
      flags.push("She’ll ask which airport you’re leaving from.");
    } else if (openAsk) {
      flags.push("She’ll ask where you’re flying from, then suggest somewhere that fits.");
    }

    /* "Tokyo, Osaka or Seoul" says pick one; "whole trip £555" says add them
       up. Both cannot be true, and neither reading is safe to assume — one
       watches three fares against £555 each, the other watches a single
       journey totalling £555. So say so instead of silently choosing. */
    if (shape === "many" && wholeT) {
      flags.push("You’ve said “or” — a choice of destinations — but given one whole-trip total. " +
                 "She’ll ask whether that’s the budget for whichever one you pick, or for a single " +
                 "journey through all of them.");
    }

    /* ---- the headline sentence -------------------------------------------- */
    var distinct = {};
    priced.forEach(function (w) { distinct[w.price.amount] = 1; });
    var nDistinct = Object.keys(distinct).length;

    var note;
    if (shape === "many" && nDistinct > 1) {
      note = "That’s " + watches.length + " separate watches, each with its own price. " +
             "She alerts on them independently — one going cheap doesn’t wait for the other.";
    } else if (shape === "many") {
      note = "That’s " + watches.length + " separate watches" +
             (nDistinct === 1 && priced.length === watches.length ? " sharing one price." : ".");
    } else if (shape === "trip" && wholeT) {
      note = "One trip, not separate flights — she adds the legs up and alerts on the total.";
    } else if (shape === "trip") {
      note = (legs + 1) + " stops with one price, so she’d treat it as one trip and total the legs. " +
             "Say “each” if you meant a separate limit per flight.";
    } else if (!flags.length) {
      note = "That’s enough to start. She’d check it at 06:30 and 18:30 from today.";
    } else {
      note = "She’s got the shape of it. The rest she’d ask you:";
    }

    return { shape: shape, watches: watches, flags: flags, note: note };
  }

  /* ---------- render ------------------------------------------------------ */

  var tryInput = document.getElementById("try-input");
  if (tryInput) {
    var slots = {};
    document.querySelectorAll("[data-parsed]").forEach(function (el) { slots[el.dataset.parsed] = el; });
    var listEl   = document.querySelector("[data-parsed-list]");
    var singleEl = document.querySelector("[data-parsed-single]");
    var flagsEl  = document.querySelector("[data-parsed-flags]");
    var labelEl  = document.querySelector("[data-threshold-label]");

    /* A number with no currency is shown as "£200?" rather than "£200": the
       question mark is the difference between what she was told and what she
       is assuming, and the flag below says so in words. */
    function fmtPrice(w) {
      if (!w.price) return "Not set yet";
      var sym = w.price.symbol || "£";
      return sym + w.price.amount + (w.price.symbol ? "" : "?") +
             (w.each && w.n > 1 ? " each" : "");
    }

    function render() {
      var out = parse(tryInput.value);
      if (slots.note) slots.note.textContent = out.note;

      var many = out.watches.length > 1;
      if (singleEl) singleEl.hidden = many;
      if (listEl)   listEl.hidden = !many;

      if (many && listEl) {
        listEl.innerHTML = "";
        out.watches.forEach(function (w) {
          var row = document.createElement("div");
          row.className = "watch";
          var r = document.createElement("span");
          r.className = "watch__route";
          r.textContent = w.route;
          var meta = document.createElement("span");
          meta.className = "watch__meta";
          var bits = [];
          if (w.needsOrigin) bits.push("from?");
          bits.push(w.when ? w.when.label : "when?");
          bits.push(fmtPrice(w));
          meta.textContent = bits.join(" · ");
          row.appendChild(r); row.appendChild(meta);
          listEl.appendChild(row);
        });
      } else {
        var w = out.watches[0];
        if (slots.route)     slots.route.textContent = w ? w.route : EM;
        if (slots.when)      slots.when.textContent  = w && w.when ? w.when.label : (w ? "Not set yet" : EM);
        if (slots.who)       slots.who.textContent   = w ? w.n + (w.n === 1 ? " traveller" : " travellers") : "1 traveller";
        if (slots.threshold) slots.threshold.textContent = w ? fmtPrice(w) : EM;
        // £300 across three legs is a whole-trip total; calling that "alert me
        // under" would read as a per-flight limit.
        if (labelEl) labelEl.textContent = out.shape === "trip" ? "Whole trip under" : "Alert me under";
      }

      /* The flags are the point of this rewrite. Anything she could not read,
         had to assume, or would come back and ask about is stated here, in
         the panel — not buried in a sentence underneath it, and never left
         out. A demo that quietly drops a word teaches exactly the wrong thing
         about the thing it is demonstrating. */
      if (flagsEl) {
        flagsEl.innerHTML = "";
        flagsEl.hidden = !out.flags.length;
        out.flags.forEach(function (f) {
          var li = document.createElement("li");
          li.textContent = f;
          flagsEl.appendChild(li);
        });
      }
    }

    tryInput.addEventListener("input", render);

    var EXAMPLES = [
      "Anywhere sunny in half term, two of us, under £400 each",
      "Watch London to Tokyo, first two weeks of April, under £600",
      "Cusco to Lima to Cancún, end of March, under £300 for the lot",
      "Tokyo under £600 and Lisbon under £90"
    ];
    var chips = document.getElementById("try-chips");
    if (chips) {
      EXAMPLES.forEach(function (label) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = label;
        b.addEventListener("click", function () { tryInput.value = label; render(); });
        chips.appendChild(b);
      });
    }

    render();
  }
})();
