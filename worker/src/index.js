// portfolio-bot: messages from the site chat (chat.js) → Telegram.
// POST /msg {kind, text, contact, lang, page, hp, ms} → sendMessage to TG_CHAT_ID.
// Spam guards: allowed origins, honeypot field, "answered faster than a human", length limits, optional per-IP limit (KV RL).

const KINDS = { feedback: "💬 Отзыв", question: "❓ Вопрос" };

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
    const cors = allowed.includes(origin)
      ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" }
      : {};
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (url.pathname !== "/msg" || req.method !== "POST") return json({ error: "not found" }, 404);
    if (!cors["access-control-allow-origin"]) return json({ error: "origin" }, 403);

    let m;
    try { m = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const text = String(m.text || "").trim().slice(0, 2000);
    const contact = String(m.contact || "").trim().slice(0, 200);
    if (!KINDS[m.kind] || !text) return json({ error: "empty" }, 400);
    // bots fill the hidden field or finish in under 3 s: pretend it went through
    if (m.hp || Number(m.ms) < 3000) return json({ ok: true });

    const ip = req.headers.get("cf-connecting-ip") || "";
    if (env.RL && ip) {
      const key = `ip:${ip}:${new Date().toISOString().slice(0, 13)}`;
      const n = Number(await env.RL.get(key)) || 0;
      if (n >= Number(env.PER_IP_HOUR || 5)) return json({ error: "limit" }, 429);
      await env.RL.put(key, String(n + 1), { expirationTtl: 3700 });
    }

    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const where = [req.cf?.city, req.cf?.country].filter(Boolean).join(", ");
    const msg = [
      `<b>${KINDS[m.kind]}</b> с сайта`,
      "",
      esc(text),
      "",
      `👤 ${contact ? esc(contact) : "<i>без контакта</i>"}`,
      `📄 ${esc(String(m.page || "/").slice(0, 200))} · ${m.lang === "en" ? "EN" : "RU"}${where ? ` · ${esc(where)}` : ""}`,
    ].join("\n");

    const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!r.ok) { console.error("telegram", r.status, await r.text()); return json({ error: "telegram" }, 502); }
    return json({ ok: true });
  },
};
