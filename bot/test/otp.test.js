import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../src/db.js";
import { createOtp, RESEND_COOLDOWN_MS } from "../src/otp.js";

function setup() {
  let clock = 1_000_000;
  const db = openDb(":memory:");
  const otp = createOtp(db, { ttlMin: 15, now: () => clock });
  return { db, otp, tick: (ms) => { clock += ms; } };
}

test("issues a 6-digit code that verifies once", () => {
  const { otp } = setup();
  const { code } = otp.issue(42);
  assert.match(code, /^\d{6}$/);
  assert.equal(otp.verify(code), 42);
  assert.equal(otp.verify(code), null, "a code works only once");
});

test("accepts codes typed with spaces or dashes", () => {
  const { otp } = setup();
  const { code } = otp.issue(7);
  assert.equal(otp.verify(`${code.slice(0, 3)} ${code.slice(3)}`), 7);
});

test("expires after the TTL", () => {
  const { otp, tick } = setup();
  const { code } = otp.issue(42);
  tick(15 * 60_000 + 1);
  assert.equal(otp.verify(code), null);
});

test("a new code retires the previous one", () => {
  const { otp, tick } = setup();
  const first = otp.issue(42).code;
  tick(RESEND_COOLDOWN_MS);
  const second = otp.issue(42).code;
  assert.equal(otp.verify(first), null);
  assert.equal(otp.verify(second), 42);
});

test("enforces the resend cooldown", () => {
  const { otp, tick } = setup();
  otp.issue(42);
  tick(10_000);
  const again = otp.issue(42);
  assert.equal(again.code, undefined);
  assert.equal(again.waitSec, 20);
  tick(20_000);
  assert.ok(otp.issue(42).code);
});

test("rejects malformed input", () => {
  const { otp } = setup();
  for (const bad of [undefined, null, "", "12345", "1234567", "abcdef"]) assert.equal(otp.verify(bad), null);
});
