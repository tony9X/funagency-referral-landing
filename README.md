# FunAgency Referral — Landing Page

Production-ready landing page cho chương trình giới thiệu FunAgency (1% lifetime, 3-tier 0.5/1.0/1.5%).

## 🌐 Demo

Mở `index.html` trong browser, hoặc deploy lên Cloudflare Pages / Vercel / Netlify.

```bash
# Local preview
python3 -m http.server 8000
# → http://localhost:8000
```

## 📁 Cấu trúc

```
.
├── index.html      # Single-file landing (1580 dòng / 85 KB)
└── README.md       # File này
```

Single-file HTML + Tailwind CDN + Inter/JetBrains Mono Google Fonts. Không build step.

## 🎨 Features

| Tính năng | Chi tiết |
|-----------|----------|
| 🌍 Multi-lang | VI / RU / EN switcher + localStorage persist |
| 🧮 Calculator | Interactive slider (1-20 refs × $5K-$100K spend) — auto-update tier |
| 📱 Mobile | Hamburger menu, 44px tap targets, iOS safe area, no auto-zoom |
| ♿ A11y | Skip link, focus-visible, reduced motion, ARIA labels |
| 🔍 SEO | hreflang vi/ru/en, JSON-LD Organization + FAQPage, lang-aware title/meta |
| 🍪 Legal | Cookie consent banner (GDPR + Russia FZ-152) |
| 🔒 Security | rel=noopener noreferrer, X-Content-Type-Options, referrer policy |
| 📊 Analytics ready | Cookie consent gate, GA/Plausible drop-in spot |

## 🚀 Deploy lên Cloudflare Pages

```bash
# 1. Connect repo to Cloudflare Pages dashboard
# 2. Build settings:
#    Build command: (leave empty - no build step)
#    Build output:  /
# 3. Custom domain: funagency.com
# 4. DNS auto-configured
```

## 📝 Cần fix sau khi deploy

| Item | Where |
|------|-------|
| Upload `og-cover.png` + `logo.png` | Cloudflare R2 or DO Spaces |
| Tạo `/terms` + `/privacy` pages | Cùng repo hoặc subdomain |
| Setup Telegram bot listener cho `?start=lead_*` | Backend (xem docs/03-api-contract.md section 9.5) |
| Build Tailwind local (replace CDN) | Sprint 1 / FE-1.1 |
| Setup Plausible/GA analytics | Drop script tag after cookie accept |

## 📄 Form submission

Form `id="leadForm"` submit → mở Telegram bot deeplink:
```
https://t.me/funagency_bot?start=lead_<personaCode>_<tgUsername>
```

Persona codes: `mb` Media buyer · `bk` Blogger/KOL · `co` Consultant · `ag` Agency · `ex` Ex-media buyer · `cm` Community manager · `ot` Other.

Bot phía backend cần decode start param và lưu lead vào DB (chi tiết trong `funagency-referral-docs` repo, file `docs/03-api-contract.md` section 9.5).

## 🔗 Related repos

- [funagency-referral-docs](.) — 7 docs cho dev senior + prototype MiniApp
- [funagency-referral-miniapp](.) — MiniApp UI mockup (full UX)
- [funagency-referral-bot](.) — Telegram bot mockup (6 scenarios)

## 📜 License

Private — © FunAgency 2026.
