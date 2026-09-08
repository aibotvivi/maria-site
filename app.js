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
  var WORD_NUMS = { one:1, two:2, three:3, four:4, five:5, six:6 };

  /* A single total across several legs. This — not the number of cities — is
     what makes something a trip Maria sums rather than separate watches. */
  var WHOLE_TRIP = /\b(for the lot|in total|altogether|all in|the whole (thing|trip|lot)|for everything|for all of it|combined)\b/;

  /* Words that end a place phrase. Without these, "Tokyo in April" resolves as
     a city called "Tokyo In April". */
  var STOP = /^(in|on|at|under|below|within|for|around|about|during|next|this|each|per|from|by|before|after|until|till|and|or|with|when|its|it|i|want|know|to)$/;

  var EM = "—";

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
      if (STOP.test(words[wi])) break;
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
      if (!p) return null;
      out.push(p);
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
  function priceIn(text) {
    var m = text.match(/([£$€])\s?(\d[\d,]*)/);
    if (m) return { amount: m[2], symbol: m[1] };
    var w = text.match(/\b(\d[\d,]*)\s?(gbp|pounds?|usd|dollars?|eur|euros?)\b/i);
    if (w) {
      var sym = /gbp|pound/i.test(w[2]) ? "£" : (/usd|dollar/i.test(w[2]) ? "$" : "€");
      return { amount: w[1], symbol: sym };
    }
    var b = text.match(/\b(?:under|within|below|max(?:imum)?|up to|less than|no more than|around|about)\s*(\d[\d,]*)\b/i);
    if (b) return { amount: b[1], symbol: null };
    return null;
  }

  /* Dates, in the order they were TYPED. The old version walked the month
     list January-first and returned whichever came earliest in the calendar,
     so "20th july - may 19" reported "May". */
  function datesIn(text) {
    var low = text.toLowerCase(), hits = [];
    MONTHS.forEach(function (m, idx) {
      var at = low.indexOf(m);
      while (at > -1) {
        hits.push({ at: at, end: at + m.length, idx: idx, label: titleWords(m) });
        at = low.indexOf(m, at + m.length);
      }
    });
    hits.sort(function (a, b) { return a.at - b.at; });

    hits.forEach(function (h) {
      var before = low.slice(Math.max(0, h.at - 9), h.at);
      var after  = low.slice(h.end, h.end + 8);
      var d = before.match(/(\d{1,2})(?:st|nd|rd|th)?\s*$/) || after.match(/^\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
      if (d) h.day = parseInt(d[1], 10);
    });

    return hits;
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
      if (b.idx < a.idx) {
        flags.push("“" + whenAll.label + "” runs backwards — she’ll ask whether you meant " +
                   dateLabel(b) + " the following year, or two separate trips.");
      } else if (b.idx - a.idx > 5) {
        flags.push("That’s a " + (b.idx - a.idx) + "-month window — she’ll ask whether you meant " +
                   "one long stay or the cheapest week in it.");
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
