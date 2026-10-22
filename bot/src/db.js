import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  tg_id        INTEGER PRIMARY KEY,
  username     TEXT,
  first_name   TEXT,
  lang         TEXT,
  ref_code     TEXT,              -- first-touch attribution from /start ref_XXX
  account_id   TEXT,              -- web cabinet account, set when a code is verified
  created_at   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codes (
  code         TEXT PRIMARY KEY,
  tg_id        INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  used_at      INTEGER
);
CREATE INDEX IF NOT EXISTS codes_by_user ON codes (tg_id);
-- One row per customer chat (a private chat with the bot, or a client group the bot is in).
CREATE TABLE IF NOT EXISTS conversations (
  chat_id      INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL,     -- 'private' | 'group'
  title        TEXT NOT NULL,
  topic_id     INTEGER UNIQUE,    -- forum topic in the staff group
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   INTEGER NOT NULL,
  last_customer_at INTEGER
);
-- Links a message on the customer side to its copy in the staff topic, both ways,
-- so replies keep pointing at the right message.
CREATE TABLE IF NOT EXISTS msg_links (
  chat_id      INTEGER NOT NULL,
  customer_msg INTEGER NOT NULL,
  staff_msg    INTEGER NOT NULL,
  PRIMARY KEY (chat_id, customer_msg)
);
CREATE INDEX IF NOT EXISTS msg_links_staff ON msg_links (staff_msg);
CREATE TABLE IF NOT EXISTS staff_aliases (
  tg_id        INTEGER PRIMARY KEY,
  alias        TEXT NOT NULL
);
`;

export function openDb(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return wrap(db);
}

function wrap(db) {
  const q = (sql) => db.prepare(sql);
  const now = () => Date.now();
  return {
    raw: db,

    upsertUser(u) {
      q(`INSERT INTO users (tg_id, username, first_name, lang, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tg_id) DO UPDATE SET username = excluded.username,
           first_name = excluded.first_name, lang = excluded.lang`)
        .run(u.id, u.username ?? null, u.first_name ?? "", u.language_code ?? null, now());
    },
    setRefIfEmpty(tgId, ref) {
      q("UPDATE users SET ref_code = ? WHERE tg_id = ? AND ref_code IS NULL").run(ref, tgId);
    },
    setAccount(tgId, accountId) {
      q("UPDATE users SET account_id = ? WHERE tg_id = ?").run(accountId, tgId);
    },
    getUser(tgId) {
      return q("SELECT * FROM users WHERE tg_id = ?").get(tgId);
    },

    insertCode(code, tgId, expiresAt) {
      q("INSERT INTO codes (code, tg_id, expires_at) VALUES (?, ?, ?)").run(code, tgId, expiresAt);
    },
    expireCodesFor(tgId, at) {
      q("UPDATE codes SET expires_at = ? WHERE tg_id = ? AND used_at IS NULL AND expires_at > ?").run(at, tgId, at);
    },
    findLiveCode(code, at) {
      return q("SELECT * FROM codes WHERE code = ? AND used_at IS NULL AND expires_at > ?").get(code, at);
    },
    codeTaken(code, at) {
      return !!q("SELECT 1 FROM codes WHERE code = ? AND used_at IS NULL AND expires_at > ?").get(code, at);
    },
    useCode(code, at) {
      return q("UPDATE codes SET used_at = ? WHERE code = ? AND used_at IS NULL").run(at, code).changes === 1;
    },
    lastCodeAt(tgId) {
      const r = q("SELECT MAX(expires_at) AS e FROM codes WHERE tg_id = ?").get(tgId);
      return r?.e ?? null;
    },

    getConversation(chatId) {
      return q("SELECT * FROM conversations WHERE chat_id = ?").get(chatId);
    },
    getConversationByTopic(topicId) {
      return q("SELECT * FROM conversations WHERE topic_id = ?").get(topicId);
    },
    createConversation(chatId, kind, title) {
      q("INSERT OR IGNORE INTO conversations (chat_id, kind, title, created_at) VALUES (?, ?, ?, ?)")
        .run(chatId, kind, title, now());
      return this.getConversation(chatId);
    },
    setTopic(chatId, topicId) {
      q("UPDATE conversations SET topic_id = ? WHERE chat_id = ?").run(topicId, chatId);
    },
    setStatus(chatId, status) {
      q("UPDATE conversations SET status = ? WHERE chat_id = ?").run(status, chatId);
    },
    touchCustomer(chatId) {
      q("UPDATE conversations SET last_customer_at = ? WHERE chat_id = ?").run(now(), chatId);
    },

    link(chatId, customerMsg, staffMsg) {
      q("INSERT OR REPLACE INTO msg_links (chat_id, customer_msg, staff_msg) VALUES (?, ?, ?)")
        .run(chatId, customerMsg, staffMsg);
    },
    staffMsgFor(chatId, customerMsg) {
      return q("SELECT staff_msg FROM msg_links WHERE chat_id = ? AND customer_msg = ?").get(chatId, customerMsg)?.staff_msg;
    },
    customerMsgFor(chatId, staffMsg) {
      return q("SELECT customer_msg FROM msg_links WHERE chat_id = ? AND staff_msg = ?").get(chatId, staffMsg)?.customer_msg;
    },

    setAlias(tgId, alias) {
      if (alias) q("INSERT OR REPLACE INTO staff_aliases (tg_id, alias) VALUES (?, ?)").run(tgId, alias);
      else q("DELETE FROM staff_aliases WHERE tg_id = ?").run(tgId);
    },
    getAlias(tgId) {
      return q("SELECT alias FROM staff_aliases WHERE tg_id = ?").get(tgId)?.alias ?? null;
    },
  };
}
