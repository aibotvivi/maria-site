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
var GOATCOUNTER_CODE  = "askmaria";              // e.g. "askmaria"  -> askmaria.goatcounter.com
var GA_MEASUREMENT_ID = "G-GM3WSJVE2V";  // live since 2026-08-20

(function () {
  "use strict";

  var STORE_KEY = "askmaria-consent";    // "granted" | "denied"

  function readConsent() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function writeConsent(v) {
    try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
  }

  /* ── Strip the query string before anything is reported ──────────────────
   * The landing page hands the address to request-invite.html in the query
   * string, so location.href on that page contains a REAL EMAIL ADDRESS.
   * Both trackers report the page URL by default, which would have sent
   * subscribers' emails to Google and to GoatCounter — caught in a network
   * trace on 2026-08-20, where a collect call carried ?email=... verbatim.
   * Nothing here may report a raw URL; route it through this first.
   */
  function cleanUrl(u) {
    if (!u) return "";
    try {
      var x = new URL(u, location.href);
      x.search = "";
      x.hash = "";
      return x.toString();
    } catch (e) {
      return String(u).split("?")[0].split("#")[0];
    }
  }

  /* ── GoatCounter: cookieless, no consent needed ─────────────────────────── */
  function loadGoatCounter() {
    if (!GOATCOUNTER_CODE) return;

    // GoatCounter counts pathname + search by default; override both before
    // count.js loads, or the email lands in the hit.
    window.goatcounter = window.goatcounter || {};
    window.goatcounter.path = function () { return location.pathname; };
    window.goatcounter.referrer = function () { return cleanUrl(document.referrer); };

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
    gtag("config", GA_MEASUREMENT_ID, {
      // Both default to the raw URL, which can carry ?email=... See cleanUrl.
      page_location: cleanUrl(location.href),
      page_referrer: cleanUrl(document.referrer)
    });
  }

  /* ── Consent banner ─────────────────────────────────────────────────────── */
  var banner = null;

  /* The bar is fixed, so it sits over whatever is at the bottom of the
     viewport. Pushing the page down by exactly its height means everything
     can still be scrolled into the clear — without this, page-bottom content
     is unreachable for as long as the banner is up. */
  function reserveSpace() {
    if (!banner) return;
    var prev = document.body.style.paddingBottom;
    if (!banner.dataset.prevPad) banner.dataset.prevPad = prev || "";
    document.body.style.paddingBottom = Math.ceil(banner.getBoundingClientRect().height) + "px";
  }

  function releaseSpace() {
    document.body.style.paddingBottom = (banner && banner.dataset.prevPad) || "";
  }

  function dismiss(choice) {
    writeConsent(choice);
    if (choice === "granted") loadGA();
    releaseSpace();
    if (banner) { banner.remove(); banner = null; }
    window.removeEventListener("resize", reserveSpace);
  }

  function showBanner() {
    if (banner) return;

    banner = document.createElement("div");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Analytics cookies");
    /* Docked to the very bottom, and the page gets matching padding below
       (see reserveSpace). A floating card with a gap under it looks nicer but
       leaves whatever sits in that band permanently unreachable — on a phone
       this banner was covering the invite form's own submit button, so a
       first-time visitor could not press it at all. */
    banner.style.cssText = [
      "position:fixed", "left:0", "right:0", "bottom:0", "z-index:9999",
      "box-sizing:border-box",
      "display:flex", "flex-wrap:wrap", "gap:10px 14px", "align-items:center",
      "justify-content:center",
      "padding:12px 16px",
      "max-height:40vh", "overflow:auto",
      "background:rgba(255,255,255,.94)",
      "border-top:1px solid rgba(120,80,50,.18)",
      "backdrop-filter:blur(20px)", "-webkit-backdrop-filter:blur(20px)",
      "box-shadow:0 -8px 30px rgba(96,62,92,.16)",
      "font-family:'Space Grotesk',system-ui,sans-serif", "color:#35283c",
      "font-size:13.5px", "line-height:1.45"
    ].join(";");

    var text = document.createElement("p");
    text.style.cssText = "margin:0;flex:1 1 280px;max-width:46ch;font-weight:400;";
    text.innerHTML = "Use Google Analytics to see how the site is used? It sets cookies. " +
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
    reserveSpace();
    window.addEventListener("resize", reserveSpace);
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
