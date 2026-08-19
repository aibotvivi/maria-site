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
