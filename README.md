# Maria — landing page

Static single-page site for the Maria airfare assistant. No build step, no
dependencies: `index.html` is the whole site.

Built from the Claude Design comp (`design-source/claude-design-export.html`),
converted from that tool's `<sc-if>` / `DCLogic` template runtime into plain
HTML + vanilla JS.

## Preview

    ./serve.sh          # http://localhost:8799 (+ a LAN URL for your phone)

## Before it goes live — the one required edit

`index.html` has a config constant near the bottom:

    var SIGNUP_ENDPOINT = "";

**It is empty on purpose.** With no endpoint there is nowhere for an email
address to go, so the form does *not* show "You're on the list" — that would
be a lie to a real visitor. Until it's set, submitting opens Telegram, which
is the flow that genuinely works today.

Paste in the POST URL from MailerLite / Formspree / Tally / Buttondown and the
success panel starts working automatically.

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
