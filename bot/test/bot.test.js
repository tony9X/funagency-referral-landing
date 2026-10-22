import assert from "node:assert/strict";
import { test } from "node:test";
import { createBot } from "../src/bot.js";
import { openDb } from "../src/db.js";
import { createOtp } from "../src/otp.js";
import { STAFF } from "./helpers.js";

// Runs real grammY handlers against fake updates; Bot API calls are recorded, not sent.
function setup() {
  const db = openDb(":memory:");
  const otp = createOtp(db);
  const config = { botToken: "1:test", staffChatId: STAFF, staffIds: [900], supportName: "FunAgency Support" };
  const botInfo = { id: 1, is_bot: true, first_name: "FunAgency", username: "funagency_bot", can_join_groups: true,
    can_read_all_group_messages: true, supports_inline_queries: false };
  const { bot, notifyLinked } = createBot({ config, db, otp, botInfo });
  const calls = [];
  let nextMsg = 5000, nextTopic = 70;
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    if (method === "createForumTopic") return { ok: true, result: { message_thread_id: nextTopic++, name: payload.name } };
    if (method === "answerCallbackQuery") return { ok: true, result: true };
    return { ok: true, result: { message_id: nextMsg++, date: 0, chat: { id: payload.chat_id, type: "private" } } };
  });
  let uid = 1;
  const send = (message) => bot.handleUpdate({ update_id: uid++, message: { date: 0, ...message } });
  const click = (from, data) => bot.handleUpdate({ update_id: uid++, callback_query: {
    id: String(uid), from, chat_instance: "x", data,
    message: { message_id: 1, date: 0, chat: { id: from.id, type: "private" } } } });
  return { db, otp, calls, send, click, notifyLinked };
}

const alex = { id: 111, is_bot: false, first_name: "Alex", username: "alex_arb", language_code: "en" };
const ivan = { id: 222, is_bot: false, first_name: "Иван", language_code: "ru" };
const mia = { id: 900, is_bot: false, first_name: "Mia" };
const dm = (from) => ({ id: from.id, type: "private", first_name: from.first_name });
const cmd = (text) => ({ text, entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] });
const toUser = (calls, id) => calls.filter((c) => c.payload.chat_id === id);

test("/start with a ref code: welcome, sign-up code, privacy note, menu, lead in staff group", async () => {
  const { db, calls, send } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start ref_7KX2") });

  const texts = toUser(calls, alex.id).map((c) => c.payload.text);
  assert.match(texts[0], /Hi Alex/);
  assert.match(texts[1], /verification code: <code>\d{6}<\/code>/);
  assert.match(texts[2], /Never send passwords/);
  assert.ok(toUser(calls, alex.id)[3].payload.reply_markup.inline_keyboard.flat().some((b) => b.callback_data === "manager"));
  assert.equal(db.getUser(alex.id).ref_code, "7KX2");

  const topic = calls.find((c) => c.method === "createForumTopic");
  assert.equal(topic.payload.chat_id, STAFF);
  assert.ok(calls.some((c) => c.payload.chat_id === STAFF && /\/start · ref <code>7KX2<\/code>/.test(c.payload.text)));
});

test("first-touch referral is kept when /start is sent again with another code", async () => {
  const { db, send } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start ref_FIRST") });
  await send({ message_id: 2, chat: dm(alex), from: alex, ...cmd("/start ref_SECOND") });
  assert.equal(db.getUser(alex.id).ref_code, "FIRST");
});

test("a second /start inside the cooldown says when to retry instead of staying silent", async () => {
  const { calls, send } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start") });
  const before = toUser(calls, alex.id).length;
  await send({ message_id: 2, chat: dm(alex), from: alex, ...cmd("/start") });
  assert.ok(toUser(calls, alex.id).slice(before).some((c) => /new one in \d+ s/.test(c.payload.text)));
});

test("Russian users get Russian texts", async () => {
  const { calls, send } = setup();
  await send({ message_id: 1, chat: dm(ivan), from: ivan, ...cmd("/start") });
  assert.match(toUser(calls, ivan.id)[0].payload.text, /Привет/);
});

test("/code respects the cooldown", async () => {
  const { calls, send } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start") });
  await send({ message_id: 2, chat: dm(alex), from: alex, ...cmd("/code") });
  assert.match(toUser(calls, alex.id).at(-1).payload.text, /new one in \d+ s/);
});

test("FAQ button answers in the bot and logs to the topic", async () => {
  const { calls, send, click } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start") });
  await click(alex, "faq:pricing");
  assert.match(toUser(calls, alex.id).at(-1).payload.text, /4–7%/);
  assert.ok(calls.some((c) => c.payload.chat_id === STAFF && c.payload.text === "👀 Opened FAQ: pricing"));
});

test("full support round-trip: customer asks, staff answers anonymously, internal note stays private", async () => {
  const { calls, send } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start") });
  await send({ message_id: 2, chat: dm(alex), from: alex, text: "Need 5 Meta accounts, $30K/mo" });

  const fwd = calls.find((c) => c.method === "forwardMessage");
  assert.deepEqual([fwd.payload.chat_id, fwd.payload.from_chat_id, fwd.payload.message_id, fwd.payload.message_thread_id], [STAFF, alex.id, 2, 70]);
  assert.match(toUser(calls, alex.id).at(-1).payload.text, /manager will reply/);

  const staffChat = { id: STAFF, type: "supergroup", title: "Support", is_forum: true };
  await send({ message_id: 300, message_thread_id: 70, is_topic_message: true, chat: staffChat, from: mia, text: "// big lead" });
  await send({ message_id: 301, message_thread_id: 70, is_topic_message: true, chat: staffChat, from: mia, text: "Hi! At $30K you get 5%." });

  const copies = calls.filter((c) => c.method === "copyMessage");
  assert.equal(copies.length, 1);
  assert.deepEqual([copies[0].payload.chat_id, copies[0].payload.from_chat_id, copies[0].payload.message_id], [alex.id, STAFF, 301]);
});

test("/close in a topic tells the customer and closes the topic", async () => {
  const { calls, send } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, text: "hello" });
  const staffChat = { id: STAFF, type: "supergroup", title: "Support", is_forum: true };
  await send({ message_id: 302, message_thread_id: 70, is_topic_message: true, chat: staffChat, from: mia, ...cmd("/close") });
  assert.ok(calls.some((c) => c.method === "closeForumTopic" && c.payload.message_thread_id === 70));
  assert.match(toUser(calls, alex.id).at(-1).payload.text, /conversation was closed/);
});

test("verified code notifies the customer and the topic", async () => {
  const { calls, send, notifyLinked } = setup();
  await send({ message_id: 1, chat: dm(alex), from: alex, ...cmd("/start") });
  await notifyLinked(alex.id, "acc_1024");
  assert.match(toUser(calls, alex.id).at(-1).payload.text, /linked to your FunAgency account \(acc_1024\)/);
  assert.ok(calls.some((c) => c.payload.chat_id === STAFF && /acc_1024/.test(c.payload.text || "")));
});
