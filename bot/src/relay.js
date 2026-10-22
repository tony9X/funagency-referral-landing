// Anonymous support relay.
//
// Customer side: a private chat with the bot, or a client group the bot is in.
// Staff side: one forum supergroup; every customer chat gets its own topic.
//
// Customer -> staff uses forwardMessage, so staff see who wrote.
// Staff -> customer uses copyMessage, so the customer only ever sees the bot,
// never the staff member's own account. That is what makes the support anonymous.

const NOTE_PREFIX = "//"; // staff messages starting with this stay inside the topic
const GROUP_ANONYMOUS_BOT = 1087968824;
const CONTENT_KEYS = ["text", "photo", "video", "document", "voice", "audio", "sticker", "animation", "video_note", "location", "contact", "poll"];

export function createRelay({ db, api, staffChatId, staffIds = [], supportName = "Support" }) {
  const staff = new Set(staffIds);

  function topicName(conv, user) {
    const who = conv.kind === "private"
      ? [user?.first_name, user?.username && `@${user.username}`].filter(Boolean).join(" ")
      : conv.title;
    return `${who || "Customer"} · ${conv.chat_id}`.slice(0, 128);
  }

  function infoCard(conv) {
    const u = conv.kind === "private" ? db.getUser(conv.chat_id) : null;
    const lines = [
      `<b>${conv.kind === "private" ? "Private chat" : "Client group"}</b>: ${escapeHtml(conv.title)}`,
      `Chat ID: <code>${conv.chat_id}</code>`,
    ];
    if (u) {
      if (u.username) lines.push(`Username: @${escapeHtml(u.username)}`);
      lines.push(`Language: ${u.lang || "?"}`);
      lines.push(`Referral: ${u.ref_code ? `<code>${escapeHtml(u.ref_code)}</code>` : "none"}`);
      lines.push(`Cabinet account: ${u.account_id ? `<code>${escapeHtml(u.account_id)}</code>` : "not linked"}`);
    }
    lines.push("", `Reply in this topic to answer as <b>${escapeHtml(supportName)}</b>.`,
      `Start a message with <code>${NOTE_PREFIX}</code> to keep it internal. /close ends the conversation, /alias sets a signature.`);
    return lines.join("\n");
  }

  async function ensureTopic(conv, user) {
    if (conv.topic_id) return conv.topic_id;
    const topic = await api.createForumTopic(staffChatId, topicName(conv, user));
    db.setTopic(conv.chat_id, topic.message_thread_id);
    conv.topic_id = topic.message_thread_id;
    await api.sendMessage(staffChatId, infoCard(conv), { message_thread_id: conv.topic_id, parse_mode: "HTML" });
    return conv.topic_id;
  }

  // Runs fn(topicId); if the topic was deleted by staff, opens a new one and retries once.
  async function inTopic(conv, user, fn) {
    const topicId = await ensureTopic(conv, user);
    try {
      return await fn(topicId);
    } catch (err) {
      if (!/thread not found|TOPIC_DELETED|TOPIC_ID_INVALID/i.test(err?.description || err?.message || "")) throw err;
      db.setTopic(conv.chat_id, null);
      conv.topic_id = null;
      return fn(await ensureTopic(conv, user));
    }
  }

  async function reopenIfClosed(conv) {
    if (conv.status !== "closed") return;
    db.setStatus(conv.chat_id, "open");
    conv.status = "open";
    if (conv.topic_id) await api.reopenForumTopic(staffChatId, conv.topic_id).catch(() => {});
  }

  function conversationFor(chat) {
    const kind = chat.type === "private" ? "private" : "group";
    const title = kind === "private"
      ? [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id)
      : chat.title || String(chat.id);
    return db.getConversation(chat.id) || db.createConversation(chat.id, kind, title);
  }

  return {
    isStaffChat: (chatId) => chatId === staffChatId,

    // A customer wrote something. Returns true when it was relayed.
    async fromCustomer(msg) {
      if (msg.from && staff.has(msg.from.id)) return false;
      const conv = conversationFor(msg.chat);
      await reopenIfClosed(conv);
      const replyTo = msg.reply_to_message && db.staffMsgFor(msg.chat.id, msg.reply_to_message.message_id);
      const sent = await inTopic(conv, msg.from, (topicId) =>
        api.forwardMessage(staffChatId, msg.chat.id, msg.message_id, { message_thread_id: topicId }));
      db.link(msg.chat.id, msg.message_id, sent.message_id);
      db.touchCustomer(msg.chat.id);
      if (replyTo) {
        await api.sendMessage(staffChatId, "↪️ The customer replied to this message", {
          message_thread_id: conv.topic_id, reply_parameters: { message_id: replyTo, allow_sending_without_reply: true },
        }).catch(() => {});
      }
      return true;
    },

    // Leaves a line in the customer's topic (e.g. which FAQ they opened) without telling the customer.
    async note(chat, user, text, { create = false } = {}) {
      const existing = db.getConversation(chat.id);
      if (!existing && !create) return;
      const conv = existing || conversationFor(chat);
      await reopenIfClosed(conv);
      await inTopic(conv, user, (topicId) =>
        api.sendMessage(staffChatId, text, { message_thread_id: topicId, parse_mode: "HTML" }));
    },

    // A staff member posted in a topic. Returns a short status string for logging.
    async fromStaff(msg) {
      // Anonymous admins post as GroupAnonymousBot; every other bot is ignored.
      if (msg.chat.id !== staffChatId || !msg.message_thread_id) return "ignored";
      if (msg.from?.is_bot && msg.from.id !== GROUP_ANONYMOUS_BOT) return "ignored";
      const conv = db.getConversationByTopic(msg.message_thread_id);
      if (!conv) return "no-conversation";
      if (msg.text?.startsWith(NOTE_PREFIX)) return "note";
      if (!CONTENT_KEYS.some((k) => k in msg)) return "service"; // topic edits, pins and other service messages

      const replyTo = msg.reply_to_message && msg.reply_to_message.message_id !== msg.message_thread_id
        ? db.customerMsgFor(conv.chat_id, msg.reply_to_message.message_id) : undefined;
      const opts = replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {};
      const alias = msg.from && db.getAlias(msg.from.id);

      try {
        let sent;
        if (alias && msg.text) {
          // Signature is appended at the end, so the original entity offsets stay valid.
          sent = await api.sendMessage(conv.chat_id, `${msg.text}\n\n— ${alias}`, { ...opts, entities: msg.entities });
        } else {
          sent = await api.copyMessage(conv.chat_id, staffChatId, msg.message_id, opts);
        }
        db.link(conv.chat_id, sent.message_id, msg.message_id);
        if (conv.status === "closed") { db.setStatus(conv.chat_id, "open"); }
        return "sent";
      } catch (err) {
        const why = /blocked|deactivated|kicked|not a member|chat not found/i.test(err?.description || err?.message || "")
          ? "the customer blocked the bot or removed it from the group"
          : (err?.description || err?.message || "unknown error");
        await api.sendMessage(staffChatId, `⚠️ Not delivered: ${escapeHtml(why)}`, {
          message_thread_id: msg.message_thread_id, reply_parameters: { message_id: msg.message_id }, parse_mode: "HTML",
        }).catch(() => {});
        return "failed";
      }
    },

    async close(topicId) {
      const conv = db.getConversationByTopic(topicId);
      if (!conv) return null;
      db.setStatus(conv.chat_id, "closed");
      await api.closeForumTopic(staffChatId, topicId).catch(() => {});
      return conv;
    },

    infoFor(topicId) {
      const conv = db.getConversationByTopic(topicId);
      return conv ? infoCard(conv) : null;
    },
  };
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
