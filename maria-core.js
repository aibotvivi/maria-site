/* Ask Maria — the pieces every page shares.
 *
 * Created 2026-09-10, when the landing page gained a one-step hero signup and
 * the demo box gained a "start this watch" button. Before that, tgLink() and
 * the MailerLite POST lived inside invite.js because invite.html was the only
 * page that signed anyone up. Three pages need them now.
 *
 * The alternative — copying tgLink into app.js — is specifically the thing
 * invite.js warns against in its own header: it MUST stay in step with
 * signup.build_payload() in the airfare-monitor repo, drift raises no error
 * anywhere (the decoder accepts whatever arrives, so the symptom is quietly
 * mangled routes), and only tests/test_payload_parity.py catches it. That test
 * runs the real function out of the shipped file, so there must go on being
 * exactly one of them. It now reads this file.
 *
 * Nothing here touches the DOM. Pages wire their own forms.
 */
(function () {
  "use strict";

  /* ── The one thing to fill in ──────────────────────────────────────────
     The POST URL from MailerLite (Forms > Embedded form). Double opt-in is
     on by default there and is required, not optional: the address can be
     pre-filled from a previous page, so without a confirm step anyone could
     sign someone else up.

     Empty ON PURPOSE would mean no page may claim an address was saved —
     every caller below has to handle a false return for that reason. */
  var SIGNUP_ENDPOINT = "https://assets.mailerlite.com/jsonp/2587313/forms/196343745674741229/subscribe";

  /* Bumped whenever the consent wording next to a signup button changes, so a
     stored consent record says which sentence was actually agreed to —
     "we have consent" is not defensible without knowing to what. */
  var CONSENT_VERSION = "2026-08-20";

  var TELEGRAM_URL    = "https://t.me/AskMariaTravelBot";

  /* ── route packing ───────────────────────────────────────────────────────
     Telegram allows 64 characters in a start payload and base64 costs 4/3, so
     only ~45 plain characters survive. Measured 2026-09-15 on nine realistic
     demo-box inputs: FIVE were truncated, including this site's own
     placeholder example — the first sentence a new user read showed them
     their own words visibly mangled.

     Deflate does not help (72 -> 75 characters on the placeholder, measured);
     on strings this short its overhead exceeds the redundancy it removes.
     The vocabulary is what helps: " to ", "under ", month names. One byte each.

     A token byte is 0x80|index, which collides with UTF-8 continuation bytes,
     so any literal byte >= 0x7F is escaped with a leading 0x7F. CJK therefore
     costs six bytes a character rather than three, and packing can come out
     LARGER than plain text — so this returns whichever is smaller and marks
     the choice with a leading version byte. No marker means plain UTF-8, which
     is also every link minted before today.

     ROUTE_TOKENS is generated from the same source as signup.py's copy and
     tests/test_payload_parity.py fails if the two drift. Do not edit by hand. */
  var ROUTE_TOKENS = ["first two weeks of ", "second half of ", "school holidays", "beginning of ", "last two weeks of ", "for the lot", "the cheapest", "somewhere ", "September", "return flight", "half term", "Christmas", "New Year", "February", "November", "December", "anywhere", "weekend", "nonstop", "one way", "January", "October", "August", "adults", "direct", "nights", "flight", "people", "Easter", "summer", "winter", "spring", "autumn", "cheap", "under ", "March", "April", "June", "July", "each", "kids", "adult", "month", "sunny", "warm", "week", "days", "from ", "and ", "May", " to ", " or ", " in ", " on ", " a "];
  var PACK_MARK = 0x01, ESCAPE = 0x7F;

  function packRoute(text) {
    var out = [PACK_MARK], i = 0, enc = new TextEncoder();
    while (i < text.length) {
      var hit = -1;
      for (var k = 0; k < ROUTE_TOKENS.length; k++) {
        if (text.startsWith(ROUTE_TOKENS[k], i)) { hit = k; break; }
      }
      if (hit >= 0) { out.push(0x80 | hit); i += ROUTE_TOKENS[hit].length; }
      else {
        // Code POINT, not code unit: an astral character is two units and
        // must be encoded whole or its surrogates arrive broken.
        var cp = String.fromCodePoint(text.codePointAt(i));
        enc.encode(cp).forEach(function (b) {
          if (b >= ESCAPE) out.push(ESCAPE);
          out.push(b);
        });
        i += cp.length;
      }
    }
    var plain = enc.encode(text);
    return out.length < plain.length ? new Uint8Array(out) : plain;
  }

  function b64url(s) {
    // Packs first. Every caller passes a route string, and the packing must
    // happen on both the fits() probe and the emitted body or the two
    // disagree about what fits.
    var bytes = packRoute(s), bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* Telegram's 64-character start payload is far smaller than it looks:
     base64 expands by 4/3, and "rw-" costs three more, so only about 45
     plain-ASCII characters survive — fewer with accents, far fewer with kana.
     The placeholder in the form below is itself 45 characters, so the very
     example we show people sits exactly on the edge.

     The first version dropped the whole route when it overflowed, silently,
     and served the generic welcome instead. That is the worst of the options:
     the visitor typed something specific, was shown a confirmation, and Maria
     then opened as though they had said nothing.

     So trim to fit instead, at a word boundary, and mark it with an ellipsis
     that signup.py detects — Maria then invites them to fill in the rest
     rather than pretending she got it all. The FULL text is still posted to
     the email provider, so nothing they typed is lost; only the link is
     capacity-bound. */
  /* MUST STAY IN STEP WITH signup.build_payload() in the airfare-monitor repo.
     They are the same algorithm in two languages because a browser cannot call
     the Python, and they live in separate repositories, so nothing but a test
     keeps them honest: tests/test_payload_parity.py runs a fixture list
     through both and fails if a single output differs. Drift here would not
     raise an error anywhere — the decoder accepts whatever arrives, so the
     symptom would be quietly mangled routes. */
  function tgLink(route, source) {
    var tag = { web: "w", email: "e", shared: "s" }[source] || "w";
    var clean = String(route || "").replace(/\s+/g, " ").trim()
                                   .replace(/[…. ]+$/, "");
    if (!clean) return TELEGRAM_URL + "?start=" + tag;

    var fits = function (s, t) { return ("r" + t + "-" + b64url(s)).length <= 64; };
    if (fits(clean, tag)) return TELEGRAM_URL + "?start=r" + tag + "-" + b64url(clean);

    // Truncation is flagged by upper-casing the tag, never by a character in
    // the text — a visitor can type an ellipsis, and iOS makes one from "..."
    // on its own.
    var up = tag.toUpperCase(), words = clean.split(" "), i, tail, head, cand;

    // Keep BOTH ends, eliding the middle. Trimming the tail reads as the
    // natural thing to do and is exactly wrong: a route ends "...under £600",
    // so the tail is the price ceiling — the one part Maria cannot infer and
    // the part that decides when she alerts.
    var tailSizes = [3, 2, 1, 0];
    for (i = 0; i < tailSizes.length; i++) {
      var keep = tailSizes[i];
      if (keep >= words.length) continue;
      tail = keep ? words.slice(words.length - keep).join(" ") : "";
      head = keep ? words.slice(0, words.length - keep) : words.slice();
      while (head.length) {
        cand = head.join(" ") + "…" + tail;
        if (fits(cand, up)) return TELEGRAM_URL + "?start=r" + up + "-" + b64url(cand);
        head.pop();
      }
    }

    // No spaces to trim on: CJK arrives as a single "word" at three bytes per
    // character, so it overflows soonest and gains least from word trimming.
    // Array.from, not slice, so an astral character is never cut into a
    // broken surrogate pair.
    var chars = Array.from(clean);
    while (chars.length > 1) {
      chars.pop();
      cand = chars.join("") + "…";
      if (fits(cand, up)) return TELEGRAM_URL + "?start=r" + up + "-" + b64url(cand);
    }
    return TELEGRAM_URL + "?start=" + tag;
  }

  /* ---- end of the pure block ---------------------------------------------
     Everything above is pure and is what test_payload_parity.py extracts and
     runs under node. Keep side effects below this line. */

  /* MailerLite's embedded-form endpoint. Contract established by probing it
     directly on 2026-08-20, not from the docs:
       - form-encoded, not JSON, with fields[...] names
       - it returns Access-Control-Allow-Origin: *, so the browser can READ
         the reply. That is the thing that lets a page tell success from
         failure honestly, rather than the opaque no-cors guesswork the
         /jsonp/ path in the URL implies
       - replies {"success":true} or {"success":false,"errors":{...}}
       - HTTP 200 even on rejection, so r.ok proves nothing; parse the body
       - rate limited (x-ratelimit-limit: 10)
     Deliberately no MailerLite JavaScript: their webforms.min.js would put a
     third-party script on the page and drag signup behind the cookie banner.
     Posting directly keeps signup cookie-free.

     WARNING: a fields[...] key with no matching entry under Subscribers >
     Fields is accepted and silently DISCARDED — no error is returned. So
     dream, tg_link, consent and consent_version only land if those custom
     fields exist; that has to be proven by a real submission, never by the
     absence of an error.

     Returns a Promise<boolean>. It never rejects: every caller's honest
     behaviour on failure is the same — hand over the Telegram link anyway,
     because access does not depend on the email arriving — and a promise that
     throws invites a caller to forget that. */
  function postSignup(opts) {
    var email   = String((opts && opts.email) || "").trim();
    var dream   = String((opts && opts.dream) || "").trim();
    /* true | false | undefined — and the three mean different things.
       true/false come from a form that HAS a marketing tick, so both are a
       real answer and both get written. undefined means the form had no tick
       at all (the landing-page hero), and there the key must not be sent:
       MailerLite updates an existing subscriber, so writing "no" from a form
       that never asked would silently revoke a "yes" the same person gave on
       the invite form — the same overwrite trap as dream below, pointed at
       the one field that has to be legally defensible. */
    var consent = (opts && opts.consent);

    if (!email || !SIGNUP_ENDPOINT) return Promise.resolve(false);

    var body = new URLSearchParams();
    body.set("fields[email]", email);
    /* Only send dream when there IS one. MailerLite UPDATES an existing
       subscriber rather than rejecting a duplicate, so posting an empty
       string would silently wipe a route the same person gave earlier — no
       error, success:true, answer gone. That is also why the hero form, which
       has no route field, must not send this key at all. */
    if (dream) body.set("fields[dream]", dream);
    /* The link the EMAIL button points at, tagged "email" so its joins are
       distinguishable from the on-screen button's. MailerLite cannot compute
       base64 in a template, so the browser hands it the finished URL. */
    body.set("fields[tg_link]", tgLink(dream, "email"));
    if (consent === true || consent === false) {
      body.set("fields[consent]", consent ? "yes" : "no");
      body.set("fields[consent_version]", CONSENT_VERSION);
    }
    body.set("ml-submit", "1");
    body.set("anticsrf", "true");

    return fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).then(function (r) {
      return r.json();
    }).then(function (data) {
      return !!(data && data.success === true);
    }).catch(function () {
      return false;
    });
  }

  /* Hand the success state to confirmed.html. sessionStorage, not the URL:
     the route is the visitor's own words and the email is personal data, and
     this site already learned once that anything in a query string ends up
     inside an analytics hit — see cleanUrl() in analytics.js, written after a
     real subscriber address was caught in a collect call on 2026-08-20.
     sessionStorage is same-origin, per-tab, and never leaves the browser.

     The finished link is stored rather than the ingredients, so tgLink() is
     called in one place per journey. posted === false means nothing reached
     MailerLite, so confirmed.html must not claim an email was sent. */
  function handOff(email, route, posted) {
    try {
      sessionStorage.setItem("am_email",  email || "");
      sessionStorage.setItem("am_route",  route || "");
      sessionStorage.setItem("am_posted", posted ? "1" : "0");
      sessionStorage.setItem("am_tg",     tgLink(route, "web"));
    } catch (e) { /* confirmed.html degrades to the bare link */ }
  }

  /* Cookieless GoatCounter event, same as the rest of the site, so it needs
     no consent. Never let analytics break a signup. */
  function track(name, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: name, title: title || "Signup", event: true });
      }
    } catch (err) { /* ignore */ }
  }

  window.Maria = {
    TELEGRAM_URL:    TELEGRAM_URL,
    CONSENT_VERSION: CONSENT_VERSION,
    hasEndpoint:     function () { return !!SIGNUP_ENDPOINT; },
    b64url:          b64url,
    tgLink:          tgLink,
    postSignup:      postSignup,
    handOff:         handOff,
    track:           track
  };
})();
