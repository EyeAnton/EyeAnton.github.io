// Mini chat (bottom-left): a scripted assistant with four paths — feedback, question, CV, contacts.
// Feedback and questions go to the Worker (worker/, profile.chat.endpoint in site.json) → Telegram bot → Anton.
// No endpoint yet — the message opens a prefilled email instead. CV paths and channels come from site.json.
// Uses `lang`, `PROFILE`, `EDITOR` from app.js; app.js calls startChat() after the first render.
const CHAT_UI = {
  ru: {
    open: "Написать Антону", close: "Свернуть", title: "Антон Егоров", sub: "ответ — обычно в течение дня",
    hello: "Привет! Я мини-ассистент Антона. Чем помочь?",
    menu: { feedback: "Оставить отзыв", question: "Задать вопрос", cv: "Скачать CV", contact: "Связаться" },
    askFeedback: "Что понравилось, что нет? Пишите как есть — Антон прочитает в Telegram.",
    askQuestion: "Какой вопрос? Про проект, сотрудничество, стек — что угодно.",
    askContact: "Как с вами связаться для ответа? Telegram, почта — или пропустите.",
    skip: "Без ответа", send: "Отправить", ph: "Сообщение…", phContact: "@ник или почта",
    sending: "Отправляю…", sent: "Готово, Антон уже получил сообщение.", sentMail: "Открыл письмо — осталось нажать «Отправить».",
    fail: "Не получилось отправить. Попробуйте ещё раз или напишите напрямую:", retry: "Ещё раз",
    cv: "Резюме в PDF:", cvRu: "CV на русском", cvEn: "CV in English",
    contact: "Пишите куда удобно:", more: "Что-то ещё?",
  },
  en: {
    open: "Message Anton", close: "Minimize", title: "Anton Egorov", sub: "usually replies within a day",
    hello: "Hi! I'm Anton's mini assistant. How can I help?",
    menu: { feedback: "Leave feedback", question: "Ask a question", cv: "Download CV", contact: "Get in touch" },
    askFeedback: "What worked, what didn't? Be honest — Anton reads it in Telegram.",
    askQuestion: "What would you like to ask? A project, collaboration, the stack — anything.",
    askContact: "How can Anton reach you back? Telegram, email — or skip.",
    skip: "No reply needed", send: "Send", ph: "Message…", phContact: "@handle or email",
    sending: "Sending…", sent: "Done — Anton already has your message.", sentMail: "Your email is ready — just hit Send.",
    fail: "Couldn't send it. Try again or write directly:", retry: "Try again",
    cv: "Resume as PDF:", cvRu: "CV in Russian", cvEn: "CV in English",
    contact: "Reach out wherever suits you:", more: "Anything else?",
  },
};

function startChat() {
  if (startChat.on || EDITOR) return;
  startChat.on = true;
  const T = () => CHAT_UI[lang] || CHAT_UI.en;
  const endpoint = () => PROFILE.chat?.endpoint || "";
  const shown = Date.now();
  const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const btn = document.createElement("button");
  btn.className = "ch-launch";
  btn.type = "button";
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/></svg><span></span>`;
  const box = document.createElement("section");
  box.className = "ch-box";
  box.setAttribute("role", "dialog");
  box.innerHTML = `
    <header class="ch-head"><span class="ch-ava">AE</span><div><b></b><small></small></div>
      <button type="button" class="ch-x"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button></header>
    <div class="ch-log" aria-live="polite"></div>
    <div class="ch-foot"></div>`;
  document.body.append(btn, box);
  const log = box.querySelector(".ch-log"), foot = box.querySelector(".ch-foot");

  const label = () => {
    const t = T();
    btn.querySelector("span").textContent = t.open;
    btn.setAttribute("aria-label", t.open);
    box.setAttribute("aria-label", t.open);
    box.querySelector(".ch-head b").textContent = t.title;
    box.querySelector(".ch-head small").textContent = t.sub;
    box.querySelector(".ch-x").setAttribute("aria-label", t.close);
  };

  const scroll = () => log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  // the bot "types" a moment before each line, so the dialog reads like a chat, not a form
  const say = (html, wait = 420) => new Promise((res) => {
    const dots = document.createElement("p");
    dots.className = "ch-msg bot typing";
    dots.innerHTML = "<i></i><i></i><i></i>";
    log.append(dots); scroll();
    setTimeout(() => { dots.innerHTML = html; dots.classList.remove("typing"); scroll(); res(dots); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : wait);
  });
  const me = (text) => { const p = document.createElement("p"); p.className = "ch-msg me"; p.textContent = text; log.append(p); scroll(); };

  const chip = ({ text, href, download, go }) => {
    const el = document.createElement(href ? "a" : "button");
    el.className = "ch-chip";
    el.textContent = text;
    if (href) { el.href = href; if (download) el.setAttribute("download", ""); else { el.target = "_blank"; el.rel = "noopener"; } }
    else el.type = "button";
    if (go) el.addEventListener("click", go);
    return el;
  };
  // answer buttons under the dialog (replaced by the next step)
  const chips = (items) => { foot.innerHTML = `<div class="ch-chips"></div>`; foot.firstChild.append(...items.map(chip)); };
  // links that stay in the dialog (CV, channels)
  const links = (items) => { const p = document.createElement("div"); p.className = "ch-msg bot links"; p.append(...items.map(chip)); log.append(p); scroll(); };

  // one text field; resolves with the trimmed text, or "" when skipped
  const ask = (ph, skip) => new Promise((res) => {
    const t = T();
    foot.innerHTML = `<form class="ch-form">
      <textarea rows="1" maxlength="2000" placeholder="${escH(ph)}"></textarea>
      <input class="ch-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="ch-send" type="submit" aria-label="${escH(t.send)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
    </form>${skip ? `<button type="button" class="ch-skip">${escH(skip)}</button>` : ""}`;
    const form = foot.querySelector("form"), ta = form.querySelector("textarea");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; };
    ta.addEventListener("input", grow);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = ta.value.trim();
      if (!v) { ta.focus(); return; }
      ask.hp = form.querySelector(".ch-hp").value;
      res(v);
    });
    foot.querySelector(".ch-skip")?.addEventListener("click", () => res(""));
    if (matchMedia("(hover: hover)").matches) ta.focus();
  });

  const menu = async (first) => {
    const t = T();
    if (!first) await say(escH(t.more));
    chips(Object.entries(t.menu).map(([k, text]) => ({ text, go: () => { foot.innerHTML = ""; me(text); flows[k](); } })));
  };

  const channels = () => (PROFILE.channels || []).map((c) => ({ text: c.name, href: c.href }));

  const deliver = async (kind, text, contact) => {
    const t = T();
    foot.innerHTML = "";
    const note = await say(escH(t.sending), 200);
    if (!endpoint()) {
      const subj = { question: { ru: "Вопрос с сайта", en: "A question from the site" }, feedback: { ru: "Отзыв с сайта", en: "Feedback from the site" } }[kind][lang] || "";
      location.href = `mailto:${(PROFILE.channels || []).find((c) => c.href?.startsWith("mailto:"))?.href.slice(7) || ""}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(text + (contact ? `\n\n${contact}` : ""))}`;
      note.textContent = t.sentMail;
      return menu();
    }
    try {
      const r = await fetch(endpoint().replace(/\/$/, "") + "/msg", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, text, contact, lang, page: location.pathname + location.search, hp: ask.hp || "", ms: Date.now() - shown }),
      });
      if (!r.ok) throw new Error(r.status);
      note.textContent = t.sent;
      menu();
    } catch {
      note.textContent = t.fail;
      chips([{ text: t.retry, go: () => deliver(kind, text, contact) }, ...channels()]);
    }
  };

  const message = (kind) => async () => {
    const t = T();
    await say(escH(kind === "question" ? t.askQuestion : t.askFeedback));
    const text = await ask(t.ph);
    me(text);
    await say(escH(t.askContact));
    const contact = await ask(t.phContact, t.skip);
    me(contact || t.skip);
    deliver(kind, text, contact);
  };

  const flows = {
    feedback: message("feedback"),
    question: message("question"),
    cv: async () => {
      const t = T(), cv = PROFILE.cv || {}, other = lang === "ru" ? "en" : "ru";
      foot.innerHTML = "";
      await say(escH(t.cv));
      links([cv[lang] && { text: lang === "ru" ? t.cvRu : t.cvEn, href: cv[lang], download: true },
        cv[other] && { text: lang === "ru" ? t.cvEn : t.cvRu, href: cv[other], download: true }].filter(Boolean));
      menu();
    },
    contact: async () => {
      foot.innerHTML = "";
      await say(escH(T().contact));
      links(channels());
      menu();
    },
  };

  let started = false;
  const toggle = (on) => {
    box.classList.toggle("on", on);
    btn.classList.toggle("off", on);
    btn.setAttribute("aria-expanded", on);
    if (on && !started) { started = true; label(); say(escH(T().hello), 500).then(() => menu(true)); }
  };
  btn.addEventListener("click", () => toggle(true));
  box.querySelector(".ch-x").addEventListener("click", () => toggle(false));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("on")) toggle(false); });
  // the language switch re-renders the page: follow it (the running dialog stays as it was)
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  label();
  requestAnimationFrame(() => btn.classList.add("in"));
}
