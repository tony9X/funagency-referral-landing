# FunAgency Referral — Landing Page

Landing page for the FunAgency referral program. Live at **https://funref.com**.

## Structure

```
.
├── index.html      # Single-file landing (~1.3k lines)
├── terms.html      # Referral program terms (EN + RU)
├── privacy.html    # Privacy policy — GDPR + 152-FZ (EN + RU)
├── og-cover.png    # 1200×630 social share image
├── robots.txt
├── sitemap.xml
└── vercel.json     # cleanUrls + security headers
```

No build step. Tailwind is pre-generated and inlined in `index.html`; only Google Fonts is
loaded from a CDN.

```bash
python3 -m http.server 8000   # → http://localhost:8000
```

Note that `/terms` and `/privacy` only resolve without the `.html` suffix once deployed —
`cleanUrls` in `vercel.json` does that, the local static server does not.

## Languages

English and Russian. Vietnamese was removed in `77b002d`.

The switcher toggles `.lang-content` blocks and stores the choice under `funagency_lang`.
A `?lang=en|ru` query parameter overrides the stored value, which is what the `hreflang`
alternates point at. Unsupported codes fall back to English — without that guard, a stale
`vi` left in a returning visitor's storage would match no block and render a blank page.

## Referral rules encoded in the page

The commission rate follows the **referred client's** service fee tier, not the referrer's
volume: 1.0% when that client pays a fee of 5% or more, 0.5% below that. Status tiers
(Starter 0–4, Growth 5–14, VIP 15+) carry no rate. Commissions hold for 14 days; payouts go
out in USDT TRC20 from $20 with a $1 network fee.

Keep `terms.html` in step with `getRate()` and `getTier()` in `index.html` — the terms page
states these numbers as binding.

## Editing the styles

`index.html` carries generated Tailwind CSS. After adding classes that are not already in
the file, regenerate it:

```bash
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > in.css
npx tailwindcss@3 -i in.css -o out.css --content index.html --minify
```

Then replace the contents of the generated `<style>` block near the top of `index.html`.

`privacy.html` was derived from `terms.html` and shares its CSS and language switcher —
a change to one page's chrome needs the same change in the other.

## Deploy

Vercel, project `funagency-landing`. Pushing to `main` does **not** deploy; there is no git
integration. Deploy from this directory:

```bash
vercel --prod
```

Take care: `~/Public/funagency-landing` is a different repository linked to the *same*
Vercel project. Running the command there overwrites this site.

## Known gaps

- No analytics. The page has no measurement of visits or clicks through to the bot.
- `terms.html` and `privacy.html` name no legal entity, registration number, or governing
  law, and have not been reviewed by a lawyer.
- 152-FZ expects personal data of Russian citizens to be stored on servers located in
  Russia. This site runs on Vercel's edge network.

## License

Private — © FunAgency 2026.
