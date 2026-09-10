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

  /* The endpoint, the consent version, the deep-link builder and the
     MailerLite POST all live in maria-core.js now. index.html signs people up
     too since 2026-09-10, and a second copy of tgLink() is precisely what
     tests/test_payload_parity.py exists to prevent — drift raises no error
     anywhere, the decoder just accepts whatever arrives, so the symptom is
     quietly mangled routes.

     maria-core.js MUST load before this file. */
  var M = window.Maria;
  if (!M) return;
  var tgLink      = M.tgLink;
  var RENDERED_AT = Date.now();   // for the bot timing check

  function track(name) { M.track(name, "Invite form"); }
  /* Arriving from the landing page carries the email through, so this page
     asks to confirm it rather than for it cold. */
  var params  = new URLSearchParams(location.search);
  var prefill = (params.get("email") || "").trim();
  var input   = document.querySelector('input[name="email"]');
  if (prefill && input) input.value = prefill;

  /* Arriving from the landing page's demo box, the route the visitor typed
     there is waiting in sessionStorage — handed over that way rather than in
     ?route= because it is their own words, and this site already learned once
     that anything in a query string ends up inside an analytics hit. Consumed
     on read: a stale route reappearing on a later, unrelated visit would be
     Maria claiming to remember something the visitor did not just say. */
  var routeField = document.querySelector('textarea[name="route"]');
  try {
    var carried = sessionStorage.getItem("am_demo_route");
    if (carried && routeField && !routeField.value) routeField.value = carried;
    sessionStorage.removeItem("am_demo_route");
  } catch (e) { /* private mode — the field just starts empty */ }

  var form = document.getElementById("invite-form");
  if (!form) return;

  /* The success state is its own page, and everything it needs is handed
     over in sessionStorage rather than the URL — see Maria.handOff() in
     maria-core.js for why that is not a style choice.

     opts.posted === false means nothing reached MailerLite (the spam guards
     below), so confirmed.html must not claim an email was sent. */
  function succeed(email, dream, opts) {
    M.handOff(email, dream, !(opts && opts.posted === false));
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

    if (!M.hasEndpoint()) { track("invite-blocked-no-endpoint"); fallback(dream, "unconfigured"); return; }

    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "Sending\u2026"; }

    /* The POST itself lives in maria-core.js — the landing-page hero uses it
       too. Everything learned about MailerLite's contract (form-encoded,
       readable CORS reply, HTTP 200 even on rejection, silently discarded
       unknown fields) is documented there.

       consent is passed as a real boolean either way: this form HAS a
       marketing tick, so an unticked box is an answer, not an absence. */
    M.postSignup({ email: email, dream: dream, consent: consent })
      .then(function (ok) {
        if (!ok) throw new Error("rejected");
        track("invite-requested");
        succeed(email, dream);
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = "Get my link to Maria"; }
        track("invite-failed");
        fallback(dream, "failed");
      });
  });
})();