// Customer-facing copy in English and Russian, the two languages the landing serves.
// Facts here must match index.html and terms.html; update all three together.

export const FAQ_KEYS = ["platforms", "pricing", "topup", "replace", "rules", "referral"];

const en = {
  welcome: (name) => `👋 Hi ${name}! This is FunAgency: Meta, TikTok and Google ad accounts at a 4–7% fee.`,
  code: (code, ttl) =>
    `Your verification code: <code>${code}</code>\n\nThe code is valid for ${ttl} minutes. Enter it on the sign-up page.\nTo get a new code, send /code`,
  codeWait: (s) => `A code was sent just now. You can ask for a new one in ${s} s.`,
  menuIntro: "Pick a topic, or write your question and a manager will answer here.",
  privacy:
    "ℹ️ Messages in this chat go to the FunAgency support team. Never send passwords, 2FA codes or seed phrases.",
  linked: (acc) => `✅ Telegram is linked to your FunAgency account${acc ? ` (${acc})` : ""}. Top-up alerts and support will come here.`,
  managerAsk: "✍️ Write your question in this chat. A manager will reply here, usually within a few minutes during working hours.",
  received: "Got it. A manager will reply in this chat.",
  closed: "This conversation was closed. Write again any time to reopen it.",
  buttons: {
    platforms: "📱 Platforms", pricing: "💼 Fees", topup: "💳 Top-up", replace: "🔁 Replacement",
    rules: "⛔ Allowed niches", referral: "🎁 Referral", manager: "💬 Talk to a manager", back: "← Menu",
  },
  faq: {
    platforms:
      "<b>Meta</b>: agency accounts with no caps, BM5 / BM250 with high limits, aged and pre-warmed accounts.\n" +
      "<b>TikTok</b>: Spark Ads, verified pixel.\n" +
      "<b>Google</b>: MCC accounts with a high threshold; Search, Display and YouTube; verified invoice billing.\n\n" +
      "Geo: US / EU / APAC / Tier 2-3.",
    pricing:
      "The service fee is <b>4–7%</b>, depending on your monthly spend. Accounts, fan pages and pixels are included. " +
      "Tell a manager your spend and platforms to get your exact rate.",
    topup: "Top-ups are flexible and multi-geo. A manager confirms the payment method and minimum for your account before the first top-up.",
    replace: "If an account goes down, we replace it in about <b>60 seconds</b>. Send the account ID to a manager in this chat.",
    rules: "We don't work with phishing, drainers or billing fraud. Ask a manager before launching any grey niche.",
    referral:
      "Bring other teams and earn a lifetime commission on their ad spend: <b>1.0%</b> if their fee is 5% or more, <b>0.5%</b> below that. " +
      "A client counts after $10K of spend and 2 active months. Payouts in USDT TRC-20 from $20 after a 14-day hold. " +
      "Apply via @fun_referrer_bot.",
  },
};

const ru = {
  welcome: (name) => `👋 Привет, ${name}! Это FunAgency: рекламные аккаунты Meta, TikTok и Google с комиссией 4–7%.`,
  code: (code, ttl) =>
    `Ваш код подтверждения: <code>${code}</code>\n\nКод действует ${ttl} минут. Введите его на странице регистрации.\nНовый код: /code`,
  codeWait: (s) => `Код только что отправлен. Новый можно запросить через ${s} с.`,
  menuIntro: "Выберите тему или напишите вопрос — менеджер ответит здесь.",
  privacy:
    "ℹ️ Сообщения в этом чате видит команда поддержки FunAgency. Никогда не отправляйте пароли, коды 2FA и сид-фразы.",
  linked: (acc) => `✅ Telegram привязан к аккаунту FunAgency${acc ? ` (${acc})` : ""}. Уведомления о пополнениях и поддержка будут здесь.`,
  managerAsk: "✍️ Напишите вопрос в этот чат. Менеджер ответит здесь, обычно за несколько минут в рабочее время.",
  received: "Принято. Менеджер ответит в этом чате.",
  closed: "Диалог закрыт. Напишите в любое время, чтобы продолжить.",
  buttons: {
    platforms: "📱 Платформы", pricing: "💼 Комиссия", topup: "💳 Пополнение", replace: "🔁 Замена",
    rules: "⛔ Разрешённые ниши", referral: "🎁 Рефералка", manager: "💬 Связаться с менеджером", back: "← Меню",
  },
  faq: {
    platforms:
      "<b>Meta</b>: агентские аккаунты без лимитов, BM5 / BM250 с высокими лимитами, отлежавшиеся прогретые аккаунты.\n" +
      "<b>TikTok</b>: Spark Ads, верифицированный пиксель.\n" +
      "<b>Google</b>: MCC-аккаунты с высоким трешхолдом; Search, Display и YouTube; верифицированный инвойсинг.\n\n" +
      "Гео: US / EU / APAC / Tier 2-3.",
    pricing:
      "Комиссия сервиса <b>4–7%</b> в зависимости от месячного спенда. Аккаунты, фан-пейджи и пиксели включены. " +
      "Напишите менеджеру спенд и платформы, чтобы узнать точную ставку.",
    topup: "Пополнение гибкое, мульти-гео. Перед первым пополнением менеджер подтвердит способ оплаты и минимум для вашего аккаунта.",
    replace: "Если аккаунт упал, заменим примерно за <b>60 секунд</b>. Отправьте ID аккаунта менеджеру в этом чате.",
    rules: "Не работаем с фишингом, дрейнерами и биллинг-фродом. Перед запуском серой ниши уточните у менеджера.",
    referral:
      "Приводите команды и получайте пожизненную комиссию от их спенда: <b>1,0%</b> при комиссии клиента от 5%, <b>0,5%</b> ниже 5%. " +
      "Клиент засчитывается после $10K спенда и 2 активных месяцев. Выплаты в USDT TRC-20 от $20 после 14 дней холда. " +
      "Заявка через @fun_referrer_bot.",
  },
};

export function t(lang) {
  return String(lang || "").toLowerCase().startsWith("ru") ? ru : en;
}

export const LOCALES = { en, ru };
