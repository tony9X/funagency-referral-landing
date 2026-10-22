import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../src/db.js";
import { createRelay } from "../src/relay.js";
import { fakeApi, privateMsg, STAFF, staffMsg } from "./helpers.js";

const alex = { id: 111, is_bot: false, first_name: "Alex", username: "alex_arb", language_code: "en" };
const mia = { id: 900, is_bot: false, first_name: "Mia" };

function setup(apiOpts) {
  const db = openDb(":memory:");
  const api = fakeApi(apiOpts);
  const relay = createRelay({ db, api, staffChatId: STAFF, staffIds: [mia.id], supportName: "FunAgency Support" });
  db.upsertUser(alex);
  return { db, api, relay };
}
const only = (api, method) => api.calls.filter((c) => c.method === method);

test("first customer message opens one topic with an info card, then forwards", async () => {
  const { api, relay, db } = setup();
  db.setRefIfEmpty(alex.id, "7KX2");
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  await relay.fromCustomer(privateMsg(2, alex, { text: "need meta accounts" }));

  assert.equal(only(api, "createForumTopic").length, 1);
  assert.equal(only(api, "createForumTopic")[0].args[1], "Alex @alex_arb · 111");
  const card = only(api, "sendMessage")[0];
  assert.match(card.args[1], /Referral: <code>7KX2<\/code>/);
  const fwd = only(api, "forwardMessage");
  assert.equal(fwd.length, 2);
  assert.deepEqual(fwd[0].args.slice(0, 3), [STAFF, alex.id, 1]);
  assert.equal(fwd[0].args[3].message_thread_id, 50);
});

test("staff reply goes to the customer as a copy, so the staff account stays hidden", async () => {
  const { api, relay } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  const status = await relay.fromStaff(staffMsg(77, 50, mia, { text: "Hello! What spend?" }));

  assert.equal(status, "sent");
  const copy = only(api, "copyMessage");
  assert.equal(copy.length, 1);
  assert.deepEqual(copy[0].args.slice(0, 3), [alex.id, STAFF, 77]);
  assert.equal(only(api, "forwardMessage").length, 1, "nothing is forwarded to the customer");
});

test("internal notes and service messages stay in the topic", async () => {
  const { api, relay } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  assert.equal(await relay.fromStaff(staffMsg(78, 50, mia, { text: "// VIP lead, call tomorrow" })), "note");
  assert.equal(await relay.fromStaff(staffMsg(79, 50, mia, { forum_topic_edited: { name: "x" } })), "service");
  assert.equal(only(api, "copyMessage").length, 0);
});

test("messages outside a customer topic are ignored", async () => {
  const { relay } = setup();
  assert.equal(await relay.fromStaff(staffMsg(80, undefined, mia, { text: "general chat" })), "ignored");
  assert.equal(await relay.fromStaff(staffMsg(81, 999, mia, { text: "unknown topic" })), "no-conversation");
  assert.equal(await relay.fromStaff(staffMsg(82, 50, { id: 5, is_bot: true }, { text: "other bot" })), "ignored");
});

test("anonymous admins can reply", async () => {
  const { relay } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  const anon = { id: 1087968824, is_bot: true, first_name: "Group" };
  assert.equal(await relay.fromStaff(staffMsg(83, 50, anon, { text: "hello" })), "sent");
});

test("an alias signs text replies without breaking formatting offsets", async () => {
  const { api, relay, db } = setup();
  db.setAlias(mia.id, "Mia");
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  const entities = [{ type: "bold", offset: 0, length: 5 }];
  await relay.fromStaff(staffMsg(84, 50, mia, { text: "Hello there", entities }));
  const sent = only(api, "sendMessage").at(-1);
  assert.equal(sent.args[0], alex.id);
  assert.equal(sent.args[1], "Hello there\n\n— Mia");
  assert.deepEqual(sent.args[2].entities, entities);
});

test("replies keep pointing at the right message in both directions", async () => {
  const { api, relay } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "price?" }));      // forwarded as staff msg 1001
  await relay.fromStaff(staffMsg(85, 50, mia, { text: "5%", reply_to_message: { message_id: 1001 } }));
  const copy = only(api, "copyMessage")[0];
  assert.equal(copy.args[3].reply_parameters.message_id, 1);

  const botMsgOnCustomerSide = 1002;                                       // what copyMessage returned
  await relay.fromCustomer(privateMsg(2, alex, { text: "ok", reply_to_message: { message_id: botMsgOnCustomerSide } }));
  const marker = only(api, "sendMessage").at(-1);
  assert.equal(marker.args[2].reply_parameters.message_id, 85);
});

test("a deleted topic is recreated and the message still arrives", async () => {
  const { api, relay } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  api.failOn.forwardMessage = Object.assign(new Error("x"), { description: "Bad Request: message thread not found" });
  await relay.fromCustomer(privateMsg(2, alex, { text: "still there?" }));
  assert.equal(only(api, "createForumTopic").length, 2);
  assert.equal(only(api, "forwardMessage").at(-1).args[3].message_thread_id, 51);
});

test("staff see a warning when the customer blocked the bot", async () => {
  const { api, relay } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  api.failOn.copyMessage = Object.assign(new Error("x"), { description: "Forbidden: bot was blocked by the user" });
  assert.equal(await relay.fromStaff(staffMsg(86, 50, mia, { photo: [{}] })), "failed");
  assert.match(only(api, "sendMessage").at(-1).args[1], /blocked the bot/);
});

test("closing and reopening a conversation", async () => {
  const { api, relay, db } = setup();
  await relay.fromCustomer(privateMsg(1, alex, { text: "hi" }));
  await relay.close(50);
  assert.equal(db.getConversation(alex.id).status, "closed");
  await relay.fromCustomer(privateMsg(2, alex, { text: "back again" }));
  assert.equal(db.getConversation(alex.id).status, "open");
  assert.equal(only(api, "reopenForumTopic").length, 1);
});

test("staff messages inside a client group are not echoed back", async () => {
  const { api, relay } = setup();
  const group = { id: -100777, type: "supergroup", title: "FunAgency x ARB Team" };
  assert.equal(await relay.fromCustomer({ message_id: 3, chat: group, from: mia, text: "hi team" }), false);
  assert.equal(await relay.fromCustomer({ message_id: 4, chat: group, from: alex, text: "need 3 accounts" }), true);
  assert.equal(only(api, "createForumTopic")[0].args[1], "FunAgency x ARB Team · -100777");
});

test("notes only open a topic when asked to", async () => {
  const { api, relay } = setup();
  const chat = { id: alex.id, type: "private", first_name: "Alex" };
  await relay.note(chat, alex, "👀 Opened FAQ: pricing");
  assert.equal(only(api, "createForumTopic").length, 0);
  await relay.note(chat, alex, "🙋 Asked for a manager", { create: true });
  assert.equal(only(api, "createForumTopic").length, 1);
});
