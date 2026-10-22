// Records Bot API calls instead of sending them to Telegram.
export function fakeApi({ failOn = {} } = {}) {
  let nextMsg = 1000;
  let nextTopic = 50;
  const calls = [];
  const handler = {
    get(_, method) {
      if (method === "calls") return calls;
      if (method === "failOn") return failOn;
      return async (...args) => {
        calls.push({ method, args });
        const fail = failOn[method];
        if (fail) {
          const err = typeof fail === "function" ? fail(...args) : fail;
          if (err) { if (typeof fail !== "function") delete failOn[method]; throw err; }
        }
        if (method === "createForumTopic") return { message_thread_id: nextTopic++, name: args[1] };
        return { message_id: nextMsg++ };
      };
    },
  };
  return new Proxy({}, handler);
}

export const STAFF = -1001234567890;

export function privateMsg(id, from, extra = {}) {
  return { message_id: id, chat: { id: from.id, type: "private", first_name: from.first_name }, from, date: 0, ...extra };
}

export function staffMsg(id, topicId, from, extra = {}) {
  return { message_id: id, message_thread_id: topicId, is_topic_message: true, chat: { id: STAFF, type: "supergroup" }, from, date: 0, ...extra };
}
