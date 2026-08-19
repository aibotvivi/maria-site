# Maria — landing page

Static site for the Maria airfare assistant. No build step, no dependencies.

    index.html           landing page  (step 1: takes an email, hands off)
    request-invite.html  invite form   (step 2: asks where they want to fly)

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

Also replace before publishing:
- `REPLACE-WITH-YOUR-DOMAIN` (canonical + og:image URLs, 3 places)
- add an `og.png` (1200x630) for link previews

## Honesty constraints baked into the copy

Deliberate, and worth preserving if the copy is edited:
- no "24/7" or "instant" claims — it says "usually within a minute or two"
- no cheapest-price guarantee
- footer states Maria is an information service, not a travel agent

The two quotes are Vivien's own real results. The comp had them attributed to
invented people ("Sophie L., 31, London" / "Daniel O., 44, Manchester");
those were replaced with her own attribution rather than ship fabricated
endorsements. If you'd rather have real third-party testimonials, get them
from actual beta users.

## Fill these before publishing

    OPERATOR_NAME            privacy.html, terms.html — UK GDPR needs a named controller
    CONTACT_EMAIL            privacy.html, terms.html — a working address people can use
    REPLACE-WITH-YOUR-DOMAIN index.html — canonical + og:image

GOATCOUNTER YOUR-CODE   all four pages — create a free goatcounter.com
                        account, then activate the commented script tag
                        (cookieless analytics: page views, referrers,
                        countries; no cookies, no consent banner needed)

Use a dedicated address (hello@yourdomain), not a personal inbox — it goes on
a public page.

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
