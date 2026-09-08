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

  var PLACES = [
    ["london", "London"], ["tokyo", "Tokyo"], ["lisbon", "Lisbon"],
    ["cancun", "Cancún"], ["cancún", "Cancún"], ["lima", "Lima"],
    ["cusco", "Cusco"], ["hong kong", "Hong Kong"], ["new york", "New York"],
    ["bangkok", "Bangkok"], ["reykjavik", "Reykjavik"], ["athens", "Athens"],
    ["milan", "Milan"], ["dubai", "Dubai"], ["porto", "Porto"], ["split", "Split"],
    ["marrakesh", "Marrakesh"], ["naples", "Naples"], ["faro", "Faro"],
    /* Added because the demo kept dropping them mid-sentence, which is the
       exact failure this rewrite exists to stop: "Tokyo, Osaka or Seoul"
       showed only Tokyo and said nothing about the other two. */
    ["osaka", "Osaka"], ["seoul", "Seoul"], ["paris", "Paris"], ["rome", "Rome"],
    ["barcelona", "Barcelona"], ["madrid", "Madrid"], ["berlin", "Berlin"],
    ["amsterdam", "Amsterdam"], ["dublin", "Dublin"], ["singapore", "Singapore"],
    ["bali", "Bali"], ["denpasar", "Bali"], ["marrakech", "Marrakesh"],
    ["manchester", "Manchester"], ["edinburgh", "Edinburgh"], ["glasgow", "Glasgow"],
    ["malaga", "Málaga"], ["málaga", "Málaga"], ["alicante", "Alicante"],
    ["nice", "Nice"], ["venice", "Venice"], ["prague", "Prague"], ["vienna", "Vienna"],
    ["budapest", "Budapest"], ["krakow", "Kraków"], ["copenhagen", "Copenhagen"],
    ["istanbul", "Istanbul"], ["cairo", "Cairo"], ["delhi", "Delhi"],
    ["mumbai", "Mumbai"], ["sydney", "Sydney"], ["toronto", "Toronto"],
    ["miami", "Miami"], ["boston", "Boston"], ["chicago", "Chicago"],
    ["los angeles", "Los Angeles"], ["san francisco", "San Francisco"]
  ];

  var MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  var WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

  /* A single total for several legs. This — not the city count — is what makes
     something a trip rather than a handful of separate watches. */
  var WHOLE_TRIP = /\b(for the lot|in total|altogether|all in|the whole (thing|trip|lot)|for everything|for all of it|combined)\b/;

  var EM = "—";

  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Every place mentioned, in the order it was said, with the text that sat
     between it and the one before — because that connector is what says
     whether two cities are legs of one journey or two separate ideas. */
  function findPlaces(low, original) {
    var hits = [];
    PLACES.forEach(function (p) {
      var from = 0, i;
      while ((i = low.indexOf(p[0], from)) > -1) {
        // Whole-word only: "split" must not fire inside "splitting", and
        // "nice" must not fire inside "a nice week".
        var before = i === 0 ? " " : low.charAt(i - 1);
        var after  = low.charAt(i + p[0].length) || " ";
        if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) {
          hits.push({ at: i, end: i + p[0].length, name: p[1] });
        }
        from = i + p[0].length;
      }
    });
    hits.sort(function (a, b) { return a.at - b.at; });

    // Drop a repeat of the immediately preceding city ("London to Tokyo and
    // London to Lisbon" names London twice; the second is a new origin, and
    // that is handled by clause splitting, not here).
    var out = [];
    hits.forEach(function (h) {
      if (out.length && out[out.length - 1].name === h.name &&
          original.slice(out[out.length - 1].end, h.at).trim().length < 2) return;
      out.push(h);
    });
    return out;
  }

  /* "to"/"then"/"->" means a leg of one journey. A comma, "or" or "and"
     between bare city names means separate ideas. */
  function connector(text) {
    if (/\b(to|then|via|onto)\b|->|→/.test(text)) return "leg";
    if (/\b(or|and|plus)\b|,/.test(text)) return "alt";
    return "alt";
  }

  function priceIn(text) {
    var m = text.match(/£\s?(\d[\d,]*)/);
    return m ? m[1] : null;
  }

  function monthIn(low) {
    var found = null;
    MONTHS.forEach(function (mo) { if (!found && low.indexOf(mo) > -1) found = mo; });
    if (!found) return null;
    var when = titleCase(found);
    if (/first two weeks/.test(low)) return "First two weeks of " + when;
    if (/end of/.test(low))          return "End of " + when;
    if (/start of|beginning of/.test(low)) return "Start of " + when;
    return when;
  }

  function whenIn(low) {
    if (/half\s*term/.test(low)) return "Half term";
    var m = monthIn(low);
    if (m) return m;
    if (/christmas/.test(low)) return "Christmas";
    if (/easter/.test(low)) return "Easter";
    return null;
  }

  function travellersIn(low) {
    var n = 1;
    var digit = low.match(/(\d+)\s*(adults?|people|of us|passengers?|travellers?)/);
    var word  = low.match(/\b(one|two|three|four|five|six)\s+(adults?|people|of us|passengers?|travellers?)/);
    if (digit) n = parseInt(digit[1], 10);
    else if (word) n = WORD_NUMS[word[1]];
    return n;
  }

  /* Split into separate asks. " and " / ";" is the reliable separator between
     two complete requests; a comma is NOT — "Cusco to Lima to Cancún, end of
     March, under £300" is one ask carrying three commas. A fragment naming no
     city is not a new ask, so it is folded back into the one before it
     ("...in May, and under £400" is a continuation, not a second watch). */
  function clauses(text) {
    var parts = text.split(/\s*;\s*|\s+and\s+(?=[^,]*\b(?:to|under|in)\b)|\s+and\s+/i);
    var out = [];
    parts.forEach(function (p) {
      if (!p || !p.trim()) return;
      if (findPlaces(p.toLowerCase(), p).length === 0 && out.length) {
        out[out.length - 1] += " and " + p;
      } else {
        out.push(p.trim());
      }
    });
    return out.length ? out : [text];
  }

  function parse(raw) {
    var text = String(raw || "").trim();
    if (!text) {
      return { shape: "empty", watches: [], note:
        "Start typing and she’ll pull the route, the dates and your price out of it." };
    }

    var lowAll  = text.toLowerCase();
    var parts   = clauses(text);
    var wholeT  = WHOLE_TRIP.test(lowAll);
    var prices  = (text.match(/£\s?\d[\d,]*/g) || []);
    var months  = MONTHS.filter(function (m) { return lowAll.indexOf(m) > -1; });

    var watches = [], legsMode = false, unknown = false;

    parts.forEach(function (part) {
      var low    = part.toLowerCase();
      var places = findPlaces(low, part);
      var when   = whenIn(low) || whenIn(lowAll);
      var n      = travellersIn(low) || travellersIn(lowAll);
      var price  = priceIn(part) || (parts.length === 1 ? priceIn(text) : null);
      var each   = /each|per person|\bpp\b/.test(low) || /each|per person|\bpp\b/.test(lowAll);

      if (places.length === 0) {
        /* "Anywhere sunny in half term" is not a failure to parse — it is one
           of the three examples this site advertises, and the FAQ promises it
           works. Treating it as "no place found" made the demo call the
           headline example unintelligible. */
        var open = low.match(/\b(anywhere|somewhere|wherever)\b/);
        if (open) {
          var vibe = (low.match(/\b(sunny|warm|hot|cheap|beach|snow|skiing|city break|quiet)\b/) || [])[1];
          watches.push({
            route: "Anywhere" + (vibe ? " " + vibe : ""),
            when: when, n: n, price: price, each: each, bare: true, open: true
          });
        } else {
          unknown = true;
        }
        return;
      }

      // How are the cities in THIS clause joined?
      var links = [];
      for (var i = 1; i < places.length; i++) {
        links.push(connector(part.slice(places[i - 1].end, places[i].at)));
      }
      var names   = places.map(function (p) { return p.name; });
      var allLegs = links.length > 0 && links.every(function (l) { return l === "leg"; });

      if (allLegs) {
        // A journey. Three or more legs, or an explicit single total, is a
        // trip Maria sums; two cities is an ordinary route.
        legsMode = legsMode || places.length > 2 || wholeT;
        watches.push({ route: names.join(" → "), when: when, n: n, price: price, each: each });
        return;
      }

      /* "London to Tokyo, Osaka or Seoul" — the first link is a leg and the
         rest are alternatives, so London is where they are LEAVING FROM and
         everything after it is a choice of destination. Without this the
         origin was listed as a fourth destination, which is both wrong and
         faintly absurd. */
      if (links.length > 1 && links[0] === "leg" &&
          links.slice(1).every(function (l) { return l === "alt"; })) {
        var origin = names[0];
        names.slice(1).forEach(function (nm) {
          watches.push({ route: origin + " → " + nm, when: when, n: n, price: price, each: each });
        });
        return;
      }

      /* Bare alternatives: "Milan, Naples and Athens". Maria keeps one watch
         per destination sharing the price, so show them as what they are —
         several watches, not an invented itinerary through all three. */
      names.forEach(function (nm) {
        watches.push({ route: nm, when: when, n: n, price: price, each: each, bare: true });
      });
    });

    if (!watches.length) {
      return { shape: "unsure", watches: [], note:
        "She didn’t catch a place in that. Name where you’re flying from and to and she’ll take it from there." };
    }

    /* A destination on its own is not a route. Maria asks rather than assuming
       an origin — the old version filled in "London → " by itself, which is a
       guess presented as a fact, and wrong for most of the country. */
    watches.forEach(function (w) {
      if (w.bare && w.route.indexOf("→") === -1) w.needsOrigin = true;
    });

    var shape = watches.length > 1 ? "many" : (legsMode ? "trip" : "one");
    if (legsMode && watches.length === 1) shape = "trip";

    // ---- the note: say what is missing, or what she would ask -------------
    var missing = [];
    if (watches.some(function (w) { return w.needsOrigin; }))
      missing.push("where you’re flying from");
    if (!prices.length)
      missing.push("a price to alert under");
    if (!watches.every(function (w) { return w.when; }))
      missing.push("when you want to go");
    function asks(lead) {
      if (!missing.length) return "";
      var list = missing.length < 3
        ? missing.join(" and ")
        : missing.slice(0, -1).join(", ") + " and " + missing[missing.length - 1];
      return lead + " " + list + ".";
    }

    /* Count what the watches actually carry, not what the sentence contained.
       Saying "sharing one price" because the text held one "£" was wrong the
       moment two clauses had different dates and only one had a number. */
    var priced   = watches.filter(function (w) { return w.price; });
    var distinct = {};
    priced.forEach(function (w) { distinct[w.price] = 1; });
    var nDistinct = Object.keys(distinct).length;

    var note;
    if (shape === "many" && nDistinct > 1) {
      note = "That’s " + watches.length + " separate watches, each with its own price. " +
             "She alerts on them independently — one going cheap doesn’t wait for the other." +
             (missing.length ? " " + asks("She’d still ask:") : "");
    } else if (shape === "many" && priced.length === watches.length && nDistinct === 1) {
      note = "That’s " + watches.length + " separate watches sharing one price. " +
             "Give any of them its own number and she’ll use that instead." +
             (missing.length ? " " + asks("She’d still ask:") : "");
    } else if (shape === "many") {
      note = "That’s " + watches.length + " separate watches. " + asks("She’d still ask:");
    } else if (shape === "trip" && wholeT) {
      note = "One trip, not separate flights — she adds the legs up and alerts on the total.";
    } else if (shape === "trip") {
      note = "Several legs with one price, so she’d treat it as one trip and total it. " +
             "Say “each” or give them their own numbers if you meant separate flights.";
    } else if (missing.length) {
      note = asks("She’d ask:");
    } else {
      note = "That’s enough to start. She’d check it at 06:30 and 18:30 from today.";
    }

    /* Never let something typed vanish. Two prices collapsed into one watch,
       or a second month with nowhere to sit, used to disappear in silence. */
    if (prices.length > watches.length && shape !== "trip")
      note += " She’s also got " + prices.length + " prices in there — she’ll confirm which belongs to which.";
    if (shape === "many" && priced.length && priced.length < watches.length)
      note += " Only " + priced.length + " of them has a number, so she’ll ask for the rest.";
    if (months.length > 1 && watches.length === 1)
      note += " You named two months; she’ll ask which trip is which.";
    if (unknown)
      note += " Part of that didn’t name a place she recognised — she’ll ask.";

    return { shape: shape, watches: watches, note: note };
  }

  /* ---------- render ------------------------------------------------------ */

  var tryInput = document.getElementById("try-input");
  if (tryInput) {
    var slots = {};
    document.querySelectorAll("[data-parsed]").forEach(function (el) { slots[el.dataset.parsed] = el; });
    var list = document.querySelector("[data-parsed-list]");
    var single = document.querySelector("[data-parsed-single]");

    function fmtPrice(w) {
      if (!w.price) return "No number set";
      return "£" + w.price + (w.each && w.n > 1 ? " each" : "");
    }

    function render() {
      var out = parse(tryInput.value);
      if (slots.note) slots.note.textContent = out.note;

      var many = out.watches.length > 1;
      if (single) single.hidden = many;
      if (list) list.hidden = !many;

      if (many && list) {
        list.innerHTML = "";
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
          bits.push(w.when || "when?");
          bits.push(fmtPrice(w));
          meta.textContent = bits.join(" · ");
          row.appendChild(r); row.appendChild(meta);
          list.appendChild(row);
        });
        return;
      }

      var w = out.watches[0];
      if (slots.route) slots.route.textContent = !w ? EM : w.route;
      if (slots.when) slots.when.textContent = !w ? EM : (w.when || "Flexible");
      if (slots.who) slots.who.textContent =
        !w ? "1 traveller" : (w.n + (w.n === 1 ? " traveller" : " travellers"));
      if (slots.threshold) slots.threshold.textContent = !w ? EM : fmtPrice(w);

      // The label has to change with the shape: £300 across three legs is a
      // whole-trip total, and calling it "alert me under" would read as
      // per-flight.
      var tl = document.querySelector("[data-threshold-label]");
      if (tl) tl.textContent = out.shape === "trip" ? "Whole trip under" : "Alert me under";
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
