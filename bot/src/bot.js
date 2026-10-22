import { Bot, InlineKeyboard } from "grammy";
import { createRelay, escapeHtml } from "./relay.js";
import { FAQ_KEYS, t } from "./texts.js";

export function menu(lang) {
  const b = t(lang).buttons;
  const kb = new InlineKeyboard();
  FAQ_KEYS.forEach((k, i) => { kb.text(b[k], `faq:${k}`); if (i % 2) kb.row(); });
  return kb.row().text(b.manager, "manager");
}

function parseRef(payload) {
  const m = /^ref_([A-Za-z0-9_-]{2,32})$/.exec(payload || "");
  return m ? m[1] : null;
}

export function createBot({ config, db, otp, botInfo }) {
  const bot = new Bot(config.botToken, botInfo ? { botInfo } : undefined);
  const relay = createRelay({
    db, api: bot.api, staffChatId: config.staffChatId, staffIds: config.staffIds, supportName: config.supportName,
  });

  const priv = bot.chatType("private");
  const staffChat = bot.filter((ctx) => ctx.chat?.id === config.staffChatId);
  const clientGroups = bot.chatType(["group", "supergroup"]).filter((ctx) => ctx.chat.id !== config.staffChatId);

  // ---- customer, private chat ----

  priv.command("start", async (ctx) => {
    const u = ctx.from;
    db.upsertUser(u);
    const ref = parseRef(ctx.match);
    if (ref) db.setRefIfEmpty(u.id, ref);
    const L = t(u.language_code);
    const isNew = !db.getConversation(ctx.chat.id);

    await ctx.reply(L.welcome(escapeHtml(u.first_name)), { parse_mode: "HTML" });
    const issued = otp.issue(u.id);
    await ctx.reply(issued.code ? L.code(issued.code, otp.ttlMin) : L.codeWait(issued.waitSec), { parse_mode: "HTML" });
    if (isNew) await ctx.reply(L.privacy);
    await ctx.reply(L.menuIntro, { reply_markup: menu(u.language_code) });

    await relay.note(ctx.chat, u, `▶️ /start${ref ? ` · ref <code>${escapeHtml(ref)}</code>` : ""}`, { create: true });
  });

  priv.command("code", async (ctx) => {
    db.upsertUser(ctx.from);
    const L = t(ctx.from.language_code);
    const issued = otp.issue(ctx.from.id);
    await ctx.reply(issued.code ? L.code(issued.code, otp.ttlMin) : L.codeWait(issued.waitSec), { parse_mode: "HTML" });
  });

  priv.command(["menu", "help"], (ctx) => ctx.reply(t(ctx.from.language_code).menuIntro, { reply_markup: menu(ctx.from.language_code) }));

  bot.callbackQuery(/^faq:(\w+)$/, async (ctx) => {
    const key = ctx.match[1];
    const L = t(ctx.from.language_code);
    await ctx.answerCallbackQuery();
    if (!L.faq[key]) return;
    await ctx.reply(L.faq[key], {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(L.buttons.manager, "manager").text(L.buttons.back, "menu"),
    });
    if (ctx.chat) await relay.note(ctx.chat, ctx.from, `👀 Opened FAQ: ${key}`);
  });

  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.from.language_code).menuIntro, { reply_markup: menu(ctx.from.language_code) });
  });

  bot.callbackQuery("manager", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.from.language_code).managerAsk);
    if (ctx.chat) await relay.note(ctx.chat, ctx.from, "🙋 <b>Asked for a manager</b>", { create: true });
  });

  priv.on("message", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return; // unknown command
    db.upsertUser(ctx.from);
    const isFirst = !db.getConversation(ctx.chat.id)?.last_customer_at;
    await relay.fromCustomer(ctx.message);
    if (isFirst) await ctx.reply(t(ctx.from.language_code).received);
  });

  // ---- customer, client group (bot must be a member with privacy mode off) ----

  clientGroups.on("message", async (ctx) => {
    if (ctx.message.text?.startsWith("/") || ctx.message.new_chat_members || ctx.message.left_chat_member) return;
    await relay.fromCustomer(ctx.message);
  });

  // ---- staff group ----

  staffChat.command("close", async (ctx) => {
    const topicId = ctx.message.message_thread_id;
    const conv = topicId && await relay.close(topicId);
    if (!conv) return ctx.reply("Run /close inside a customer topic.");
    const user = db.getUser(conv.chat_id);
    await bot.api.sendMessage(conv.chat_id, t(user?.lang).closed).catch(() => {});
  });

  staffChat.command("info", async (ctx) => {
    const info = ctx.message.message_thread_id && relay.infoFor(ctx.message.message_thread_id);
    await ctx.reply(info || "Run /info inside a customer topic.", { parse_mode: "HTML" });
  });

  staffChat.command("alias", async (ctx) => {
    const alias = ctx.match.trim();
    db.setAlias(ctx.from.id, alias && alias !== "off" ? alias.slice(0, 40) : null);
    await ctx.reply(alias && alias !== "off"
      ? `Your replies will be signed “— ${escapeHtml(alias.slice(0, 40))}”.`
      : `Signature removed. Customers see only ${escapeHtml(config.supportName)}.`, { parse_mode: "HTML" });
  });

  staffChat.command("faq", async (ctx) => {
    const key = ctx.match.trim();
    const conv = db.getConversationByTopic(ctx.message.message_thread_id);
    if (!conv || !FAQ_KEYS.includes(key)) return ctx.reply(`Usage inside a topic: /faq ${FAQ_KEYS.join("|")}`);
    const user = db.getUser(conv.chat_id);
    await bot.api.sendMessage(conv.chat_id, t(user?.lang).faq[key], { parse_mode: "HTML" });
  });

  staffChat.on("message", async (ctx) => {
    if (ctx.message.text?.startsWith("/")) return;
    await relay.fromStaff(ctx.message);
  });

  bot.catch((err) => console.error("[bot]", err.error?.description || err.error || err));

  // Tells the customer once the web cabinet has verified their code.
  async function notifyLinked(tgId, accountId) {
    const user = db.getUser(tgId);
    await bot.api.sendMessage(tgId, t(user?.lang).linked(accountId)).catch(() => {});
    await relay.note({ id: tgId, type: "private", first_name: user?.first_name }, user,
      `🔗 Linked to cabinet account <code>${escapeHtml(accountId || "?")}</code>`, { create: true }).catch(() => {});
  }

  return { bot, relay, notifyLinked };
}
