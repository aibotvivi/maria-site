# Ask Maria — landing site

Static site for the Maria airfare assistant. No build step, no dependencies.

    index.html           landing page  (step 1: takes an email, hands off)
    request-invite.html  signup form   (step 2: asks where they want to fly)
    tips/index.html      how to get better answers out of Maria
    privacy.html         privacy notice (site / bot / booking-link capture)
    terms.html           terms + affiliate disclosure

`tips/` is a directory, not `tips.html`, so that `/tips` resolves on GitHub
Pages. It is the only secondary page WITHOUT `noindex` — it is content rather
than boilerplate, so it carries a description, a canonical URL, and a
sitemap entry.

Signup is deliberately two steps, as in the comp: the landing page only
carries the address across in the query string, and `request-invite.html`
owns the real submit. Nothing is stored until that second page.

Built from the Claude Design comp (`design-source/claude-design-export.html`),
converted from that tool's `<sc-if>` / `DCLogic` template runtime into plain
HTML + vanilla JS.

## Preview

    ./serve.sh          # http://localhost:8799 (+ a LAN URL for your phone)

## The signup endpoint

`request-invite.html` has a config constant near the bottom (this is the
only place a signup endpoint is needed — the landing page never submits):

    var SIGNUP_ENDPOINT = "https://assets.mailerlite.com/jsonp/.../subscribe"

It was empty until 2026-08-22, on the principle that with nowhere for an
address to go the form must not claim "You're on the list". That guard still
matters if you ever blank it: with no endpoint the page hands over the
Telegram link instead of lying.

Wired to MailerLite since 2026-08-22. It posts form-encoded fields, not JSON:

    fields[email]            the address
    fields[dream]            "where are you dreaming of flying next?"
    fields[tg_link]          the Telegram deep link for the EMAIL button
    fields[consent]          yes | no
    fields[consent_version]  which wording they agreed to
    fields[wants_whatsapp]   yes | no

Two of these need care.

`fields[dream]` is only sent when non-empty. MailerLite UPDATES an existing
subscriber rather than rejecting a duplicate, so posting an empty string would
silently wipe a route somebody gave on an earlier signup.

`fields[tg_link]` requires a custom field named `tg_link` to exist under
Subscribers > Fields. An unknown field name is accepted and SILENTLY
DISCARDED — no error, `success:true`, and a blank button in every email.

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

## Analytics

Both trackers are configured in one place, `analytics.js`, and every page
loads that one file. One contract lives outside it: every `t.me` link carries
a **`data-tg`** attribute (`primary` | `returning` | `footer`) and the click
tracker reads that attribute. It used to infer the label from the link's
wording, which broke the moment the copy was reworded — anything untagged now
reports as `unlabelled` rather than guessing.

    GOATCOUNTER_CODE   = "askmaria"        live since 2026-08-20
    GA_MEASUREMENT_ID  = "G-GM3WSJVE2V"    live since 2026-08-20

Google Tag Manager (`GTM-TWRBWLNP`) is also on every page, pasted by hand into
each `<head>` — there is no build step to keep those copies in sync, so if you
edit one, edit all five (`index`, `request-invite`, `privacy`, `terms`,
`tips/index`).

They are treated differently on purpose. GoatCounter sets no cookies, so under
PECR it needs no consent and runs for everyone.

GA4 does set cookies — but PECR governs the STORAGE, not the script. Since
2026-08-25 `gtag.js` loads for every visitor with **Consent Mode v2** declared
in each page head ABOVE both tags: `analytics_storage` starts `denied`, so the
tag runs cookieless and writes nothing until Allow is pressed. Advertising
storage is denied permanently and never updated.

**Why it loads for everyone, when it used to load only on accept:** a tag that
appears only after a button press cannot be found by anything that does not
press the button. GA4 reported "your Google tag wasn't detected on your
website" for as long as loading depended on a click.

The consent DEFAULT must stay in the page head, above the tags. A default
declared after a tag has started is a default that arrived too late — and if
it lives in `analytics.js` instead, GTM has no consent state at all and
anything added to the container fires straight through the banner.

Every footer has a **Cookies** link that reopens the choice, because
withdrawing consent has to be as easy as giving it — and reopening it revokes
the previous grant immediately rather than leaving storage on while the banner
asks again.

Expect GA to under-count against GoatCounter once it is on. That gap is the
consent rate, not a bug — GoatCounter is the number to trust for "how many
visits", GA is for behaviour within the consenting subset.

If you enable GA, `privacy.html` already describes it; check the wording still
matches what you have switched on.

## Still to fill

    OPERATOR_NAME            footers now read "Operated by AskMaria.app,
                             London, United Kingdom". That is a domain, not a
                             legal person. UK GDPR wants a named controller
                             and the E-commerce Regs want a trading name, so
                             this still needs a real name or company before
                             you charge anyone or field a data-subject
                             request.

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
