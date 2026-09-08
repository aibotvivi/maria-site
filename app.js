/* Ask Maria — landing-page interactions.
 *
 * Only the "Say it how you'd say it" demo lives here. Consent is owned by
 * analytics.js (which builds the banner Consent Mode actually listens to) and
 * the signup flow by invite.js — both deliberately, so there is one
 * implementation of each rather than two that disagree.
 */
(function () {
  "use strict";

  /* ---------- "Say it how you'd say it" demo parser ----------
     Front-end illusion only. Replace with a call to the real
     Claude parse endpoint when you want it to match the bot. */
  var PLACES = [
    ["london", "London"], ["tokyo", "Tokyo"], ["lisbon", "Lisbon"],
    ["cancun", "Canc\u00fan"], ["canc\u00fan", "Canc\u00fan"], ["lima", "Lima"],
    ["cusco", "Cusco"], ["hong kong", "Hong Kong"], ["new york", "New York"],
    ["bangkok", "Bangkok"], ["reykjavik", "Reykjavik"], ["athens", "Athens"],
    ["milan", "Milan"], ["dubai", "Dubai"], ["porto", "Porto"], ["split", "Split"],
    ["marrakesh", "Marrakesh"], ["naples", "Naples"], ["faro", "Faro"]
  ];
  var MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  var WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

  function parse(raw) {
    var t = (raw || "").trim();
    if (!t) return {
      route: "\u2014", when: "\u2014", who: "1 traveller", threshold: "\u2014",
      note: "Start typing and she'll pull the route, the dates and your price out of it."
    };
    var low = t.toLowerCase();

    var found = [];
    PLACES.forEach(function (p) {
      var i = low.indexOf(p[0]);
      if (i > -1) found.push([i, p[1]]);
    });
    found.sort(function (a, b) { return a[0] - b[0]; });
    var names = [];
    found.forEach(function (f) { if (names.indexOf(f[1]) === -1) names.push(f[1]); });
    var route = names.length >= 2 ? names.join(" \u2192 ")
      : names.length === 1 ? "London \u2192 " + names[0]
      : "Not named yet";

    var m = null;
    MONTHS.forEach(function (mo) { if (!m && low.indexOf(mo) > -1) m = mo; });
    var when = m ? m.charAt(0).toUpperCase() + m.slice(1) : null;
    if (/half\s*term/.test(low)) when = "Half term";
    else if (/first two weeks/.test(low) && m) when = "First two weeks of " + when;
    else if (/end of/.test(low) && m) when = "End of " + when;
    if (!when) when = "Flexible";

    var n = 1;
    var digit = low.match(/(\d+)\s*(adults?|people|of us|passengers?|travellers?)/);
    var word = low.match(/\b(one|two|three|four|five|six)\s+(adults?|people|of us|passengers?|travellers?)/);
    if (digit) n = parseInt(digit[1], 10);
    else if (word) n = WORD_NUMS[word[1]];
    var who = n + (n === 1 ? " traveller" : " travellers");

    var price = t.match(/\u00a3\s?(\d[\d,]*)/);
    var each = /each|per person|pp\b/.test(low);
    var threshold = price ? "\u00a3" + price[1] + (each && n > 1 ? " each" : "") : "No number set";

    var missing = [];
    if (names.length === 1) missing.push("she'll confirm where you're flying from");
    if (!price) missing.push("give her a price and she'll only message you under it");
    var note = missing.length
      ? missing.join(", and ").replace(/^./, function (c) { return c.toUpperCase(); }) + "."
      : "That's enough to start. She'd check it at 06:30 and 18:30 from today.";

    return { route: route, when: when, who: who, threshold: threshold, note: note };
  }

  var tryInput = document.getElementById("try-input");
  if (tryInput) {
    var slots = {};
    document.querySelectorAll("[data-parsed]").forEach(function (el) { slots[el.dataset.parsed] = el; });
    var render = function () {
      var out = parse(tryInput.value);
      Object.keys(slots).forEach(function (k) { slots[k].textContent = out[k]; });
    };
    tryInput.addEventListener("input", render);

    var EXAMPLES = [
      "Anywhere sunny in half term, two of us, under \u00a3400 each",
      "Watch London to Tokyo, first two weeks of April, under \u00a3600",
      "Cusco to Lima to Canc\u00fan, end of March, under \u00a3300 for the lot"
    ];
    var chips = document.getElementById("try-chips");
    EXAMPLES.forEach(function (label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = label;
      b.addEventListener("click", function () { tryInput.value = label; render(); });
      chips.appendChild(b);
    });
  }

})();
