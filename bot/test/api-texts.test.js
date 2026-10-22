import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApi } from "../src/api.js";
import { openDb } from "../src/db.js";
import { createOtp } from "../src/otp.js";
import { FAQ_KEYS, LOCALES } from "../src/texts.js";

const db = openDb(":memory:");
const otp = createOtp(db);
const linked = [];
const server = createApi({ db, otp, secret: "s3cret", onLinked: async (...a) => { linked.push(a); } });
let base;

before(() => new Promise((r) => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => server.close());

const post = (body, auth = "Bearer s3cret") =>
  fetch(`${base}/verify`, { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) });

test("health needs no auth", async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

test("rejects a wrong secret", async () => {
  assert.equal((await post({ code: "000000" }, "Bearer nope")).status, 401);
});

test("verifies a code once and links the cabinet account", async () => {
  db.upsertUser({ id: 55, first_name: "Alex", username: "alex_arb" });
  db.setRefIfEmpty(55, "7KX2");
  const { code } = otp.issue(55);

  const ok = await post({ code, account_id: "acc_1024" });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, tg_id: 55, username: "alex_arb", first_name: "Alex", ref_code: "7KX2" });
  assert.equal(db.getUser(55).account_id, "acc_1024");
  assert.deepEqual(linked.at(-1), [55, "acc_1024"]);

  const again = await post({ code });
  assert.equal(again.status, 400);
});

test("every FAQ topic and button exists in both languages", () => {
  for (const L of Object.values(LOCALES)) {
    for (const k of FAQ_KEYS) {
      assert.ok(L.faq[k], `faq.${k}`);
      assert.ok(L.buttons[k], `buttons.${k}`);
    }
    assert.ok(L.buttons.manager && L.buttons.back);
  }
});

test("referral rates match terms.html", () => {
  assert.match(LOCALES.en.faq.referral, /1\.0%.*5% or more.*0\.5%/);
  assert.match(LOCALES.en.faq.referral, /\$10K.*2 active months/);
});
