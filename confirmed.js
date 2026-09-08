/* Ask Maria — the "you're in" screen.
 *
 * Reads what invite.js stored and fills the page in. Nothing is passed in the
 * URL: the route is the visitor's own words and the email is personal data,
 * and a query string ends up inside analytics hits — see cleanUrl() in
 * analytics.js, added after a real subscriber address was caught in a collect
 * call on 2026-08-20.
 */
(function () {
  "use strict";

  var TELEGRAM_URL = "https://t.me/AskMariaTravelBot";

  function get(k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }

  var email  = get("am_email");
  var route  = get("am_route");
  var posted = get("am_posted") !== "0";

  /* The finished deep link is built by invite.js and stored, never rebuilt
     here: tgLink() must stay in step with signup.build_payload() in the
     airfare-monitor repo, and a second implementation is how that drifts.
     Landing here directly (a refresh, a bookmark, storage blocked) has no
     link to carry, so fall back to the bare bot — degraded, never broken. */
  var link = get("am_tg") || TELEGRAM_URL;

  var btn = document.querySelector("[data-tg-open]");
  if (btn) btn.href = link;

  var emailSlot = document.querySelector("[data-slot=email]");
  if (emailSlot && email) emailSlot.textContent = email;

  var routeSlot = document.querySelector("[data-slot=route]");
  if (routeSlot && route) routeSlot.textContent = route;

  /* posted === false means the spam guards fired and nothing was sent to
     MailerLite. The Telegram link is still handed over — access never
     depended on the email arriving — but the page must not claim an email
     was sent that wasn't. */
  var sentLine = document.querySelector("[data-slot=sent]");
  if (sentLine && !posted) sentLine.hidden = true;
})();
