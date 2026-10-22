import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";

// Small HTTP API for the web cabinet.
//   POST /verify  { code, account_id }  ->  { ok, tg_id, username, first_name, ref_code }
//   GET  /health
// Every request except /health needs "Authorization: Bearer <API_SECRET>".
// Run it behind HTTPS and only reachable from the cabinet backend.

function authorized(req, secret) {
  const got = Buffer.from(req.headers.authorization || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

function readJson(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > limit) { reject(new Error("too large")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}

export function createApi({ db, otp, secret, onLinked = async () => {} }) {
  return createServer(async (req, res) => {
    const send = (status, obj) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    try {
      if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
      if (!authorized(req, secret)) return send(401, { ok: false, error: "unauthorized" });
      if (req.method === "POST" && req.url === "/verify") {
        const body = await readJson(req);
        const tgId = otp.verify(body.code);
        if (!tgId) return send(400, { ok: false, error: "invalid_or_expired_code" });
        const accountId = body.account_id ? String(body.account_id).slice(0, 64) : null;
        if (accountId) db.setAccount(tgId, accountId);
        const u = db.getUser(tgId);
        onLinked(tgId, accountId).catch(() => {});
        return send(200, { ok: true, tg_id: tgId, username: u?.username ?? null, first_name: u?.first_name ?? null, ref_code: u?.ref_code ?? null });
      }
      return send(404, { ok: false, error: "not_found" });
    } catch (err) {
      return send(400, { ok: false, error: err.message });
    }
  });
}
