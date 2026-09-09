/* Ask Maria — invite form.
 *
 * Lifted wholesale from the previous request-invite.html, which is where all
 * of the knowledge below was won. Only the DOM contract changed: the success
 * state is its own page (confirmed.html) instead of a hidden panel on this
 * one. The MailerLite contract, the deep-link builder, the spam guards and
 * their reasoning are unchanged on purpose — every comment here records
 * something that was learned by it going wrong.
 *
 * DO NOT touch tgLink() casually: it MUST stay in step with
 * signup.build_payload() in the airfare-monitor repo, and only
 * tests/test_payload_parity.py keeps the two honest. Drift raises no error
 * anywhere — the decoder accepts whatever arrives, so the symptom is quietly
 * mangled routes.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     SIGNUP ENDPOINT — the one edit that makes this form real.
     Paste the POST URL from MailerLite / Formspree / Tally / Buttondown.

     Empty ON PURPOSE. With nowhere to send the address, the page must not
     claim "You're on the list" — so it shows an honest fallback pointing
     at Telegram, which is the invite flow that genuinely works today.
     Posts JSON: { email, dream, consent }
  ------------------------------------------------------------------ */
  /* ── The one thing to fill in ──────────────────────────────────────────
     Paste the POST URL from your email provider. Nothing is captured until
     you do — the form says so honestly rather than faking success.

     Pick one that does DOUBLE OPT-IN (sends a confirm link before adding
     anyone). The success panel now tells people to go and confirm, so a
     provider that just swallows the address would make that copy a lie:

       MailerLite  — Forms > Embedded form; double opt-in is on by default
       Buttondown  — Settings > Subscribing; tick "require confirmation"
       Formspree   — collects only, sends nothing. Fine as a holding pen,
                     but then change the success copy back.

     Why double opt-in matters here beyond good manners: the address can be
     pre-filled from ?email= in the URL, so without a confirm step anyone
     could sign someone else up. */
  var SIGNUP_ENDPOINT = "https://assets.mailerlite.com/jsonp/2587313/forms/196343745674741229/subscribe";

  /* Bumped whenever the consent wording below the button changes, so a
     stored consent record says which sentence was actually agreed to —
     "we have consent" is not defensible without knowing to what. */
  var CONSENT_VERSION = "2026-08-20";
  var CONSENT_TEXT    = "Send me flight deals and Maria updates.";

  var TELEGRAM_URL    = "https://t.me/AskMariaTravelBot";
  var RENDERED_AT     = Date.now();   // for the bot timing check

  /* Build a Telegram deep link carrying the route, entirely in the browser.
     Telegram allows 64 characters of [A-Za-z0-9_-] in a start payload, which
     fits a short route with room to spare — so no token to mint, no route
     table to store, no invite code. The route survives the jump because it
     IS the link.

     The one-letter tag is attribution: once someone is inside the chat there
     is no referrer and no UTM, so this is the only chance to record whether
     they came from the page or the email. Both variants are built for every
     signup — "w" is rendered on screen, "e" is posted as tg_link for the
     email button — which is what makes the two separately countable.

     Degrades in two steps rather than failing: no route (or one too long to
     encode) still carries the bare source tag, so a join is never
     unattributable. signup.py re-checks every rule server-side. */
  function b64url(s) {
    var bytes = new TextEncoder().encode(s), bin = "";
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

  /* Arriving from the landing page carries the email through, so this page
     asks to confirm it rather than for it cold. */
  var params  = new URLSearchParams(location.search);
  var prefill = (params.get("email") || "").trim();
  var input   = document.querySelector('input[name="email"]');
  if (prefill && input) input.value = prefill;

  var form = document.getElementById("invite-form");
  if (!form) return;

  /* The success state is its own page now, so everything it needs is handed
     over in sessionStorage rather than the URL. That is not a style choice:
     the route is the visitor's own words and the email is personal data, and
     this site already learned once that anything in a query string ends up
     inside an analytics hit — see cleanUrl() in analytics.js, written after a
     real subscriber address was caught in a collect call on 2026-08-20.
     sessionStorage is same-origin, per-tab, and never leaves the browser.

     The finished link is stored rather than the ingredients, so tgLink() is
     computed in exactly one place. Two call sites is how it drifts from
     signup.build_payload().

     opts.posted === false means nothing reached MailerLite (the spam guards
     below), so confirmed.html must not claim an email was sent. */
  function succeed(email, dream, opts) {
    var posted = !(opts && opts.posted === false);
    try {
      sessionStorage.setItem("am_email",  email);
      sessionStorage.setItem("am_route",  dream);
      sessionStorage.setItem("am_posted", posted ? "1" : "0");
      sessionStorage.setItem("am_tg",     tgLink(dream, "web"));
    } catch (e) { /* confirmed.html degrades to the bare link */ }
    location.href = "confirmed.html";
  }

  function fallback(dream, reason) {
    var existing = document.querySelector(".maria-fallback");
    if (existing) existing.remove();   // a resubmit deserves a fresh message
    var note = document.createElement("div");
    note.className = "maria-fallback";
    note.setAttribute("role", "status");
    /* Access no longer depends on the email arriving, so a failure here costs
       the address, not the signup — hand over the link regardless. */
    var lead = (reason === "failed")
      ? "Couldn't save your email \u2014 but that doesn't hold you up. "
      : "Email isn't switched on yet \u2014 but that doesn't hold you up. ";
    note.innerHTML = lead +
      "Open Maria on Telegram now and she'll pick up" +
      (dream ? " from <strong></strong>" : " from here") + ". " +
      '<a href="' + tgLink(dream, "web") + '" target="_blank" rel="noopener" data-tg="fallback">Open Maria on Telegram &rarr;</a>';
    if (dream) note.querySelector("strong").textContent = dream;
    form.appendChild(note);

    /* The submit button used to disable itself and relabel to "Message her
       instead" — naming the next step while being unable to perform it, with
       the actual link buried as underlined text inside the note. On a phone
       that reads as a dead end. Swap it for a real control that does the
       thing, keeping the same styling so it stays the obvious next tap. */
    var btn = form.querySelector('button[type="submit"]');
    if (btn && reason !== "failed") {
      var go = document.createElement("a");
      go.href = tgLink(dream, "web");
      // data-tg is not optional here. analytics.js reads the label off the
      // attribute and never off the wording, so a link built in JS without it
      // reports as "unlabelled" — and these two are the whole failure path,
      // the clicks you most need to be able to count separately.
      go.target = "_blank"; go.rel = "noopener"; go.setAttribute("data-tg", "fallback");
      go.textContent = "Open Maria on Telegram";
      // Copy the CLASS, not the inline style. The old button carried its
      // styling inline; the redesigned one is styled by .btn, so
      // getAttribute("style") returned null and this produced the literal
      // CSS "null;text-decoration:none;" — the replacement link rendered
      // unstyled, on the one path where it is the only way forward.
      go.className = btn.className;
      go.style.textDecoration = "none";
      btn.parentNode.replaceChild(go, btn);
      go.focus({ preventScroll: true });
    }
  }

  /* Pageviews alone can't tell you whether this page works — you need the
     ratio of arrivals to completions. The success state is a panel, not a
     URL, so it would otherwise be invisible to analytics. GoatCounter events
     are cookieless like the rest of it, so this needs no consent. */
  function track(name) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: name, title: "Invite form", event: true });
      }
    } catch (err) { /* never let analytics break a signup */ }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data    = new FormData(form);
    var email   = String(data.get("email") || "").trim();
    var dream   = String(data.get("route") || "").trim();
    var consent = !!data.get("marketing");

    /* Spam guards. Both fail silently and pretend to succeed: telling a bot
       why it was rejected just teaches whoever wrote it what to change.
       "Pretend" stops short of claiming an email was sent — nothing is
       posted on these paths, so the panel shows the link but not the
       confirmation sentence.

       Deliberately mild. The real filter is double opt-in — a bot does not
       click the confirm link, so it never reaches the list. These only exist
       to keep obvious junk out of the provider's quota, and the cost of a
       false positive is severe: a real person silently dropped while being
       shown a success screen. Hence 1.2s, not the 5s some guides suggest —
       arriving from the landing page the email is already filled in, so a
       genuine fast click is entirely plausible. */
    if (String(data.get("company") || "").trim() !== "") { succeed(email, dream, { posted: false }); return; }
    if (Date.now() - RENDERED_AT < 1200) { succeed(email, dream, { posted: false }); return; }

    if (!email) return;

    if (!SIGNUP_ENDPOINT) { track("invite-blocked-no-endpoint"); fallback(dream, "unconfigured"); return; }

    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "Sending\u2026"; }

    /* MailerLite's embedded-form endpoint. Contract established by probing it
       directly on 2026-08-20, not from the docs:
         - form-encoded, not JSON, with fields[...] names
         - it returns Access-Control-Allow-Origin: *, so the browser can READ
           the reply. That is the thing that lets this page tell success from
           failure honestly, rather than the opaque no-cors guesswork the
           /jsonp/ path in the URL implies
         - replies {"success":true} or {"success":false,"errors":{...}}
         - HTTP 200 even on rejection, so r.ok proves nothing; parse the body
         - rate limited (x-ratelimit-limit: 10)
       Deliberately no MailerLite JavaScript: their webforms.min.js would put
       a third-party script on the page and drag signup behind the cookie
       banner. Posting directly keeps the form cookie-free.

       WARNING: a fields[...] key with no matching entry under Subscribers >
       Fields is accepted and silently DISCARDED — no error is returned. So
       dream and consent only land if those custom fields exist; that has to
       be proven by a real submission, never by the absence of an error. */
    var body = new URLSearchParams();
    body.set("fields[email]", email);
    /* Only send dream when there IS one. MailerLite UPDATES an existing
       subscriber rather than rejecting a duplicate, so posting an empty
       string here would silently wipe a route the same person gave on an
       earlier signup — no error, success:true, answer gone. */
    if (dream) body.set("fields[dream]", dream);
    /* The link the EMAIL button points at, tagged "email" so its joins are
       distinguishable from the on-screen button's. MailerLite cannot compute
       base64 in a template, so the browser has to hand it the finished URL.
       NOTE: tg_link must exist under Subscribers > Fields or this is silently
       discarded like any unknown field — no error, success:true, blank button. */
    body.set("fields[tg_link]", tgLink(dream, "email"));
    body.set("fields[consent]", consent ? "yes" : "no");
    body.set("fields[consent_version]", CONSENT_VERSION);
    /* No fields[wants_whatsapp] here, and deliberately not "no": MailerLite
       updates an existing subscriber, so posting "no" from this form would
       overwrite a "yes" the same person gave on the landing page's waitlist. */
    body.set("ml-submit", "1");
    body.set("anticsrf", "true");

    fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    }).then(function (r) {
      return r.json();
    }).then(function (data) {
      if (!data || data.success !== true) throw new Error("rejected");
      track("invite-requested");
      succeed(email, dream);
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = "Get my link to Maria"; }
      track("invite-failed");
      fallback(dream, "failed");
    });
  });
})();