import { createApi } from "./api.js";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { createOtp } from "./otp.js";

const config = loadConfig();
const db = openDb(config.dbPath);
const otp = createOtp(db, { ttlMin: config.otpTtlMin });
const { bot, notifyLinked } = createBot({ config, db, otp });

const api = createApi({ db, otp, secret: config.apiSecret, onLinked: notifyLinked });
api.listen(config.apiPort, () => console.log(`[api] listening on :${config.apiPort}`));

await bot.api.setMyCommands([
  { command: "start", description: "Get a sign-up code and the menu" },
  { command: "code", description: "Get a new sign-up code" },
  { command: "menu", description: "Show topics" },
], { scope: { type: "all_private_chats" } });

const stop = () => { bot.stop(); api.close(); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

bot.start({
  allowed_updates: ["message", "callback_query"],
  onStart: (me) => console.log(`[bot] @${me.username} running, staff group ${config.staffChatId}`),
});
