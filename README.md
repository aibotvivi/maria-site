# Ask Maria — landing site

Static site for the Maria airfare assistant. No build step, no dependencies
beyond the Google Fonts link.

    index.html          landing page   (step 1: takes an email, hands it on)
    invite.html         signup form    (step 2: confirm email + optional route)
    confirmed.html      success screen (step 3: Telegram link + QR)
    request-invite.html redirect to invite.html — the pre-2026-09 signup URL
    privacy.html        privacy notice (site / bot / booking-link capture)
    terms.html          terms + affiliate disclosure
    tips/index.html     how to get better answers out of Maria

    styles.css          all styles; design tokens in :root
    app.js              the "say it how you'd say it" demo parser, nothing else
    invite.js           the signup form: MailerLite + deep link + spam guards
    confirmed.js        fills the success screen from sessionStorage
    analytics.js        GoatCounter + GA4, and the consent banner
    qr-telegram.svg     QR for the bare bot link, generated locally

`tips/` is a directory, not `tips.html`, so `/tips` resolves on GitHub Pages.
It is the only secondary page WITHOUT `noindex` — it is content rather than
funnel, so it carries a description, a canonical URL and a sitemap entry.

## Three things that are easy to break

**One consent implementation, not two.** `analytics.js` builds the banner and
owns the key `askmaria-consent`, which the Consent Mode block in each page
`<head>` reads. That block MUST stay above the GTM/gtag snippet: a default
declared after the tag has started is a default that arrived too late. The
redesign shipped with a second cookie bar writing `am_cookies` and granting
nothing; it was removed. Do not reintroduce one.

**Nothing personal goes in a URL.** The landing page passes the address to
`/invite` as `?email=`, and on 2026-08-20 a real subscriber address was caught
in a GoatCounter/GA collect call because both report the page URL by default.
`cleanUrl()` in analytics.js strips it. For the same reason invite.js hands the
email and route to `confirmed.html` in `sessionStorage`, never the query string.

**`tgLink()` in invite.js has a parity contract.** It base64url-encodes the
visitor's route into the Telegram `?start=` payload, which is how Maria opens
already knowing the trip — there is no token to mint and no route table. It
MUST stay in step with `signup.build_payload()` in the airfare-monitor repo;
`tests/test_payload_parity.py` there is the only thing keeping them honest.
Drift raises no error anywhere, because the decoder accepts whatever arrives —
the symptom is quietly mangled routes.

## Wiring

**Signup** posts directly to MailerLite's embedded-form endpoint (form-encoded,
`fields[...]` names, double opt-in). Deliberately no MailerLite JavaScript: it
would put a third-party script on the page and drag signup behind the cookie
banner. A `fields[...]` key with no matching entry under Subscribers > Fields
is accepted and silently DISCARDED, so `dream`, `tg_link`, `consent` and
`consent_version` only land if those custom fields exist — prove it with a real
submission, never by the absence of an error.

**The QR** encodes the bare bot link and is committed as a local SVG. It is
deliberately not generated at runtime by a third-party encoder: the
personalised deep link contains the visitor's own words, and sending that to an
image service is exactly the kind of disclosure `cleanUrl()` exists to prevent.
The consequence is that a scan does not carry the route — the emailed link and
the on-screen button do. Regenerate with `segno`:

    segno.make("https://t.me/AskMariaTravelBot", error="m") \
         .save("qr-telegram.svg", scale=8, border=0, dark="#2A2018", light=None)

**The stat strip** on index.html has `data-stat` hooks (`prices`, `routes`,
`alerts`, `since`). The numbers are hand-set from the airfare-monitor SQLite
counts and will go stale; re-read them from `price_history.db` when updating.

## Design tokens

Everything lives in `:root` in styles.css. Newsreader 500 for headings,
Figtree 400/600/700 for everything else.

## Preview

    ./serve.sh          -> http://localhost:8799
