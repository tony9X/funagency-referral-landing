# FunAgency client bot

Telegram bot for FunAgency clients (`@funagency_bot`). It does three things:

1. **Sign-up codes.** `/start` (and `/start ref_XXXX` from a referral link) replies with a
   6-digit code valid for 15 minutes. `/code` sends a new one, at most every 30 seconds.
   The web cabinet checks the code through a small HTTP API and the bot confirms the link
   to the client.
2. **Self-serve answers.** A button menu answers the common questions: platforms, fees,
   top-up, replacement, allowed niches and the referral program, in English or Russian
   based on the client's Telegram language.
3. **Anonymous support.** Anything a client writes to the bot, or in a client group the
   bot is in, lands in a private staff group, one forum topic per client. Staff reply in
   that topic and the bot sends the reply to the client as itself. The client never sees
   which staff account answered.

```
client ──DM / client group──▶ bot ──forward──▶ staff group, topic "Alex @alex · 111"
client ◀──────── copy ──────── bot ◀── reply ── any staff member
```

## How staff use it

| In a client topic | Effect |
|---|---|
| Any message (text, photo, file, voice…) | Sent to the client from the bot |
| Reply to a client's message | Sent as a reply to that message on the client's side |
| Message starting with `//` | Internal note, never sent |
| `/close` | Closes the topic and tells the client; their next message reopens it |
| `/info` | Shows the client's username, language, referral code and cabinet account |
| `/faq pricing` | Sends that FAQ answer to the client (`platforms`, `pricing`, `topup`, `replace`, `rules`, `referral`) |
| `/alias Mia` | Signs your text replies "— Mia". `/alias off` removes it |

The topic also shows when the client pressed `/start` (with the referral code), opened an
FAQ, asked for a manager, or linked a cabinet account, so staff have context before
replying. If a delivery fails, for example because the client blocked the bot, the topic
gets a warning.

Clients are told on first contact that their messages go to the support team and that they
must never send passwords or 2FA codes.

## Setup

1. Create the bot with @BotFather. Turn **Group Privacy off** (`/setprivacy` → Disable) if
   the bot should relay messages from client groups.
2. Create a staff supergroup, enable **Topics**, add the bot as admin with
   *Manage topics*. Get the group id (starts with `-100`) by adding @RawDataBot once.
3. Copy `.env.example` to `.env` and fill it in.
4. Run it. Node.js 22.13 or newer is required; storage is the built-in `node:sqlite`.

```bash
cd bot
npm ci
npm test
npm start
```

Keep one instance running (long polling, so no public URL is needed). Back up
`data/bot.db`: it holds the referral attribution and the topic for every client.

## Cabinet API

```
POST /verify
Authorization: Bearer <API_SECRET>
{"code": "482913", "account_id": "acc_1024"}

200 {"ok": true, "tg_id": 111, "username": "alex_arb", "first_name": "Alex", "ref_code": "7KX2"}
400 {"ok": false, "error": "invalid_or_expired_code"}
```

A code works once. `GET /health` needs no token. Expose the API only to the cabinet
backend, behind HTTPS.

## Keeping facts in sync

The FAQ copy in `src/texts.js` repeats numbers from the landing page and `terms.html`
(4–7% fee, 60-second replacement, 1.0% / 0.5% referral rate, $10K and 2 months to
qualify, $20 minimum payout, 14-day hold). Change them together. `npm test` checks the
referral numbers against the terms.

## Not done yet

- Group creation per client (the Cabinet Partners style "Client x Team (#id)" group).
  The Bot API cannot create groups; it needs a separate user account over MTProto.
  Client groups created by hand already work: add the bot and messages are relayed.
- Edited messages are not re-sent; the client sees the first version.
- Top-up alerts and account status messages need the cabinet backend.
