import { randomInt } from "node:crypto";

// Minimum gap between two codes for the same user, so /code can't be spammed.
export const RESEND_COOLDOWN_MS = 30_000;

export function createOtp(db, { ttlMin = 15, now = Date.now } = {}) {
  const ttl = ttlMin * 60_000;

  return {
    ttlMin,

    // Issues a fresh 6-digit code and retires any older live code for this user.
    // Returns { code } or { waitSec } when called again inside the cooldown.
    issue(tgId) {
      const t = now();
      const lastExpiry = db.lastCodeAt(tgId);
      if (lastExpiry && lastExpiry - ttl + RESEND_COOLDOWN_MS > t) {
        return { waitSec: Math.ceil((lastExpiry - ttl + RESEND_COOLDOWN_MS - t) / 1000) };
      }
      db.expireCodesFor(tgId, t);
      let code;
      do code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      while (db.codeTaken(code, t));
      db.insertCode(code, tgId, t + ttl);
      return { code };
    },

    // Consumes a code. Returns the Telegram user id it belongs to, or null.
    verify(code) {
      const clean = String(code ?? "").replace(/\D/g, "");
      if (clean.length !== 6) return null;
      const t = now();
      const row = db.findLiveCode(clean, t);
      if (!row || !db.useCode(clean, t)) return null;
      return row.tg_id;
    },
  };
}
