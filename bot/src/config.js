// Reads settings from the environment. Fails fast on anything required.

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} (see bot/.env.example)`);
  return v;
}

function list(name) {
  return (process.env[name] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

export function loadConfig() {
  return {
    botToken: required("BOT_TOKEN"),
    // Forum-enabled supergroup where staff answer customers, one topic per customer.
    staffChatId: Number(required("STAFF_CHAT_ID")),
    // Staff accounts whose messages in client groups are not relayed back to the staff group.
    staffIds: list("STAFF_IDS"),
    dbPath: process.env.DB_PATH || "./data/bot.db",
    apiPort: Number(process.env.API_PORT || 8080),
    apiSecret: required("API_SECRET"),
    otpTtlMin: Number(process.env.OTP_TTL_MIN || 15),
    supportName: process.env.SUPPORT_NAME || "FunAgency Support",
  };
}
