/* Ask Maria — analytics.
 *
 * Two trackers, deliberately treated differently, because the law treats them
 * differently:
 *
 *   GoatCounter sets no cookies and stores no identifiers. Under PECR that
 *   means no consent is needed, so it runs for every visitor and gives an
 *   honest visit count.
 *
 *   Google Analytics 4 sets cookies. UK PECR reg 6 requires opt-in consent
 *   BEFORE such a cookie is written — "carry on browsing = consent" is not
 *   lawful here, and neither is loading gtag.js first and asking after. So GA
 *   is injected only once someone has actively accepted, and never before.
 *
 * The consequence to expect: GA will under-count, because it only sees people
 * who accepted. GoatCounter is the number to trust for "how many visits";
 * GA is for behaviour within the consenting subset.
 *
 * Configure below. Empty string = that tracker is off.
 * If GA_MEASUREMENT_ID is empty, no banner appears at all — asking consent for
 * something that isn't running would be theatre.
 */
var GOATCOUNTER_CODE  = "";              // e.g. "askmaria"  -> askmaria.goatcounter.com
var GA_MEASUREMENT_ID = "";              // e.g. "G-XXXXXXXXXX"

(function () {
  "use strict";

  var STORE_KEY = "askmaria-consent";    // "granted" | "denied"

  function readConsent() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function writeConsent(v) {
    try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
  }

  /* ── GoatCounter: cookieless, no consent needed ─────────────────────────── */
  function loadGoatCounter() {
    if (!GOATCOUNTER_CODE) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "//gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter",
      "https://" + GOATCOUNTER_CODE + ".goatcounter.com/count");
    document.head.appendChild(s);
  }

  /* ── GA4: only ever called after an explicit accept ─────────────────────── */
  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded || !GA_MEASUREMENT_ID) return;
    gaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    // Consent Mode v2. Analytics is on because they just said so; advertising
    // and personalisation stay denied — this site does not advertise, and
    // consenting to visit stats is not consent to ad profiling.
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted"
    });

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
    document.head.appendChild(s);

    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);
  }

  /* ── Consent banner ─────────────────────────────────────────────────────── */
  var banner = null;

  function dismiss(choice) {
    writeConsent(choice);
    if (choice === "granted") loadGA();
    if (banner) { banner.remove(); banner = null; }
  }

  function showBanner() {
    if (banner) return;

    banner = document.createElement("div");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Analytics cookies");
    banner.style.cssText = [
      "position:fixed", "left:16px", "right:16px", "bottom:16px", "z-index:9999",
      "max-width:560px", "margin:0 auto",
      "display:flex", "flex-wrap:wrap", "gap:14px", "align-items:center",
      "padding:18px 20px", "border-radius:20px",
      "background:rgba(255,255,255,.86)",
      "border:1px solid rgba(255,255,255,.9)",
      "backdrop-filter:blur(20px)", "-webkit-backdrop-filter:blur(20px)",
      "box-shadow:0 18px 50px rgba(96,62,92,.22)",
      "font-family:Jost,system-ui,sans-serif", "color:#35283c",
      "font-size:14px", "line-height:1.55"
    ].join(";");

    var text = document.createElement("p");
    text.style.cssText = "margin:0;flex:1 1 260px;font-weight:300;max-width:none;";
    text.innerHTML = "Can we use Google Analytics to see how the site is used? " +
      "It sets cookies. Visit counts are collected either way, without cookies. " +
      '<a href="/privacy.html" style="color:#7d4510;text-decoration:underline;">Privacy</a>';

    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;flex:0 0 auto;";

    // Both buttons are the same size and weight on purpose: a decline that is
    // harder to find than the accept is not freely given consent (ICO).
    function button(label, choice, primary) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = [
        "font-family:inherit", "font-size:14px", "font-weight:400",
        "padding:10px 18px", "border-radius:999px", "cursor:pointer",
        "border:1px solid " + (primary ? "transparent" : "rgba(120,80,50,.35)"),
        "background:" + (primary ? "#a8621b" : "transparent"),
        "color:" + (primary ? "#fff" : "#5c4b43")
      ].join(";");
      b.addEventListener("click", function () { dismiss(choice); });
      return b;
    }

    row.appendChild(button("No thanks", "denied", false));
    row.appendChild(button("Allow", "granted", true));
    banner.appendChild(text);
    banner.appendChild(row);
    document.body.appendChild(banner);
  }

  /* Withdrawing has to be as easy as giving — the "Cookies" footer link calls
     this to re-open the choice. */
  window.askMariaCookieSettings = function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    showBanner();
  };

  function start() {
    loadGoatCounter();

    if (!GA_MEASUREMENT_ID) return;          // nothing to consent to
    var consent = readConsent();
    if (consent === "granted") loadGA();
    else if (consent !== "denied") showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
