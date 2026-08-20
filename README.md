# Ask Maria — landing site

Static site for the Maria airfare assistant. No build step, no dependencies.

    index.html           landing page  (step 1: takes an email, hands off)
    request-invite.html  invite form   (step 2: asks where they want to fly)
    privacy.html         privacy notice (site / bot / booking-link capture)
    terms.html           terms + affiliate disclosure

Signup is deliberately two steps, as in the comp: the landing page only
carries the address across in the query string, and `request-invite.html`
owns the real submit. Nothing is stored until that second page.

Built from the Claude Design comp (`design-source/claude-design-export.html`),
converted from that tool's `<sc-if>` / `DCLogic` template runtime into plain
HTML + vanilla JS.

## Preview

    ./serve.sh          # http://localhost:8799 (+ a LAN URL for your phone)

## Before it goes live — the one required edit

`request-invite.html` has a config constant near the bottom (this is the
only place a signup endpoint is needed — the landing page never submits):

    var SIGNUP_ENDPOINT = "";

**It is empty on purpose.** With no endpoint there is nowhere for an email
address to go, so the form does *not* show "You're on the list" — that would
be a lie to a real visitor. Until it's set, submitting opens Telegram, which
is the flow that genuinely works today.

Paste in the POST URL from MailerLite / Formspree / Tally / Buttondown and the
success panel starts working automatically. It posts JSON:

    { "email": "...", "dream": "Tokyo in April", "consent": true }

`dream` is the "where are you dreaming of flying next?" answer — the field
worth having, since it segments the list from day one and tells you who to
admit next.

## Domain and deployment

The domain is **askmaria.app** (bought 2026-08-20). It is already wired in:

    CNAME        askmaria.app        — GitHub Pages reads this file
    robots.txt   allows /, blocks /request-invite.html, points at the sitemap
    sitemap.xml  the landing page only (the other pages are noindex)
    og.png       1200x630 link preview, referenced absolutely in index.html
                 rebuild it from design-source/og-card.html:
                 chrome --headless --screenshot=og.png --window-size=1200,630 \
                        file://.../og-card.html

**`.app` is on the HSTS preload list** — browsers refuse plain HTTP for it, with
no click-through warning. There is no "put it up now, add HTTPS later" option:
whatever hosts it must serve a valid certificate from the first request.
GitHub Pages issues one automatically (tick *Enforce HTTPS* once DNS resolves;
the certificate can take up to an hour to appear).

DNS for the apex domain — four A records, all four needed:

    A     @     185.199.108.153
    A     @     185.199.109.153
    A     @     185.199.110.153
    A     @     185.199.111.153
    CNAME www   <github-username>.github.io.

Note GitHub Pages needs a **public** repo on a free account. Nothing here is
secret (no keys, no endpoint yet), so publishing the source is fine — but it is
a deliberate choice, not an accident.

## Honesty constraints baked into the copy

Deliberate, and worth preserving if the copy is edited:
- no "24/7" or "instant" claims — it says "usually within a minute or two"
- no cheapest-price guarantee
- footer states Maria is an information service, not a travel agent

The two quotes are Vivien's own real results, attributed to the trip itself
("London → Hong Kong, £386 return" / "Found while building Maria"). The comp
had them attributed to invented people; fabricated consumer reviews are
illegal in the UK (DMCC Act fake-review ban, CMA-enforced). Swap in real
first-name reviews from beta users, with permission, once they exist.

## Fill these before publishing

    OPERATOR_NAME            all four pages (footers + legal) — UK GDPR needs
                             a named controller; also E-commerce Regs 2002
    CONTACT_EMAIL            all four pages — a working address people can use

    GOATCOUNTER YOUR-CODE    all four pages — create a free goatcounter.com
                             account, then uncomment the script tag
                             (cookieless: no consent banner needed)

Use a dedicated address (hello@askmaria.app), not a personal inbox — it goes on
a public page. Owning the domain does not by itself give you mail on it; add a
forwarder at the registrar, or Fastmail / Google Workspace, and confirm mail
actually arrives before the address goes on a legal page.

## Copy decisions that are deliberate

- The hero says "like having a friend who's brilliant at finding flights",
  **not** "a travel agent". The earlier wording contradicted the footer
  disclaimer, and "travel agent" is a regulated description in the UK
  (ATOL/bonding). Don't reintroduce it.
- The two quotes are labelled "Vivien, who built Maria / Her own trips — not
  a customer review". They are real results but not customer testimonials;
  presenting them as testimonials would be a fabricated endorsement.
- No "24/7" or "instant" claims; no cheapest-price guarantee.
- privacy.html / terms.html are plain-English and honest, but **not
  solicitor-reviewed**. Get them checked before charging anyone.
