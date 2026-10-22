/* Visual novel player — the "novel" block of a project page (Emotions Club).
   Plays assets/novels/<id>/novel.json of the emotions-club repo (tools/build_novel.py there): one screen per line,
   as in the app — a phone screen with the background, the characters of the scene (the one who speaks is lit),
   the line in a bubble with the name, options as buttons; sound effects are synthesized (WebAudio, no files).
   Click / Space / Enter / → — next, ← — back, 1–3 — pick an option.
   It lives in a floating window (see "the floating window" below). app.js calls Novel.mount after every render;
   the state of the game survives re-renders (language switch).
   Styles: novel.css (nv-*). */
(() => {
  const UI = {
    ru: { play: "Играть", back: "Назад", restart: "Сначала", decides: "выбирает", end: "Конец", again: "Сыграть ещё",
      choice: "К последнему выбору", hint: "Клик, пробел или → — дальше · ← — назад", load: "Не удалось загрузить новеллу",
      sound: "Звук", fold: "Свернуть", cta: "PLAY", close: "Скрыть",
      card: "Новелла: на странице — окошко «Играть» в правом нижнем углу, открывается поверх страницы", openGame: "Открыть игру" },
    en: { play: "Play", back: "Back", restart: "Restart", decides: "decides", end: "The End", again: "Play again",
      choice: "Back to the last choice", hint: "Click, Space or → to continue · ← back", load: "Could not load the novel",
      sound: "Sound", fold: "Minimize", cta: "PLAY", close: "Hide",
      card: "Novel: a PLAY window in the bottom-right corner of the page, opens over it", openGame: "Open the game" },
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CPS = 60; // typewriter speed, characters per second
  const states = new Map(); // src → { id, hist, stage } — survives re-renders
  const novels = new Map(); // src → Promise<novel>
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EMPTY = { left: null, right: null, last: null };

  function load(src) {
    if (!novels.has(src)) {
      novels.set(src, fetch(src).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).catch((e) => {
        novels.delete(src);
        throw e;
      }));
    }
    return novels.get(src);
  }

  // who stands where after screen s: a new speaker takes their side (players) or replaces the one who spoke
  // earlier (NPC); a new background, a scene title or a cutscene clears the stage
  function nextStage(nv, prev, prevBg, s) {
    const st = s.bg !== prevBg || s.t === "cutscene" || s.t === "scene" ? { ...EMPTY } : { ...prev };
    if (s.t === "dialog" && nv.chars[s.who]) {
      if (st.left !== s.who && st.right !== s.who) {
        const side = nv.chars[s.who].side || (!st.right ? "right" : !st.left ? "left" : st.last === "left" ? "right" : "left");
        st[side] = s.who;
      }
      st.last = st.left === s.who ? "left" : "right";
    }
    return st;
  }

  // ---- sound effects: synthesized on the fly, nothing to download. The context starts on the first click
  // (browsers allow audio only after a gesture); on/off is remembered (localStorage nvSound) ----
  const Sfx = (() => {
    let ctx = null, out = null, noise = null, amb = null, wanted = false;
    let on = true;
    try { on = localStorage.getItem("nvSound") !== "0"; } catch (e) {}
    const wake = () => {
      if (ctx) return ctx.state === "suspended" && ctx.resume();
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = on ? 1 : 0;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    };
    // one note: wave, frequency (or [from, to]), length, volume, delay
    function tone(type, f, len, vol, at = 0) {
      if (!ctx || !on) return;
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      const [f0, f1] = Array.isArray(f) ? f : [f, f];
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    }
    // filtered noise sweeping from f0 to f1 — the air of a whoosh
    function hiss(f0, f1, len, vol, at = 0) {
      if (!ctx || !on) return;
      const t = ctx.currentTime + at, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise;
      bp.type = "bandpass";
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + len * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(bp).connect(g).connect(out);
      src.start(t);
      src.stop(t + len + 0.05);
    }
    // a low uneasy room tone for the thriller: two detuned saws under a slowly breathing low-pass
    function ambient(play) {
      wanted = play;
      if (!ctx) return;
      if (play && on && !amb) {
        const g = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        lp.type = "lowpass";
        lp.frequency.value = 160;
        lfo.frequency.value = 0.07;
        depth.gain.value = 70;
        lfo.connect(depth).connect(lp.frequency);
        const oscs = [55, 55.4, 82.6].map((f) => {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = f;
          o.connect(lp);
          o.start();
          return o;
        });
        lfo.start();
        lp.connect(g).connect(out);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 2.5);
        amb = { g, stop: () => [...oscs, lfo].forEach((o) => o.stop()) };
      } else if ((!play || !on) && amb) {
        const a = amb;
        amb = null;
        a.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
        setTimeout(a.stop, 1500);
      }
    }
    return {
      get on() { return on; },
      wake,
      ambient,
      toggle() {
        on = !on;
        try { localStorage.setItem("nvSound", on ? "1" : "0"); } catch (e) {}
        wake();
        if (out) out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
        ambient(wanted);
      },
      tap: () => tone("sine", [900, 620], 0.07, 0.05),
      blip: () => tone("triangle", 480 + Math.random() * 140, 0.035, 0.012),
      whoosh: () => hiss(250, 2600, 0.55, 0.22),
      scene: () => { tone("sine", [90, 38], 1.4, 0.35); hiss(120, 900, 1.1, 0.12); },
      chime: () => { tone("triangle", 659, 0.5, 0.06, 0.05); tone("triangle", 988, 0.7, 0.05, 0.16); },
      pick: () => { tone("sine", [520, 1040], 0.12, 0.08); tone("triangle", 1319, 0.5, 0.035, 0.08); },
      end: () => [220, 261.6, 329.6, 440].forEach((f, i) => tone("triangle", f, 2.6, 0.05, i * 0.12)),
    };
  })();

  // the player inside the floating window; ui = { open, fold, isOpen } of the window
  function build(host, nv, src, lang, ui) {
    const t = UI[lang] || UI.en;
    const base = src.replace(/[^/]*$/, "");
    const url = (f) => (f ? base + f : "");
    host.innerHTML = `
      <div class="nv-phone" tabindex="0" role="region" aria-label="${esc(nv.title)}">
        <div class="nv-bg"><img alt=""><img alt=""></div>
        <div class="nv-ch left"><img alt=""></div><div class="nv-ch right"><img alt=""></div>
        <div class="nv-shade"></div>
        <div class="nv-top"><div class="nv-bar"><i></i></div>
          <button data-act="back" aria-label="${t.back}" title="${t.back}">←</button>
          <span class="nv-title">${esc(nv.title)}</span>
          <button data-act="sound" aria-label="${t.sound}" title="${t.sound}" aria-pressed="${Sfx.on}">${Sfx.on ? "♪" : "×"}</button>
          <button data-act="restart" aria-label="${t.restart}" title="${t.restart}">↺</button>
          <button data-act="fold" aria-label="${t.fold}" title="${t.fold}">↘</button></div>
        <div class="nv-scene" hidden><span></span><b></b></div>
        <div class="nv-box" aria-live="polite"><b class="nv-name"></b><p class="nv-text"></p></div>
        <div class="nv-opts" hidden><p class="nv-q"></p><div></div></div>
        <div class="nv-start" style="--cover:url('${esc(url(nv.cover))}')">
          <div>${nv.genre ? `<span class="nv-genre">${esc(nv.genre)}</span>` : ""}<h3>${esc(nv.title)}</h3>
            <button class="nv-btn" data-act="play">${t.play}</button></div>
        </div>
        <div class="nv-end" hidden><h3>${t.end}</h3>
          <button class="nv-btn" data-act="restart">${t.again}</button><button class="nv-btn ghost" data-act="choice">${t.choice}</button></div>
      </div>`;
    const q = (s) => host.querySelector(s);
    const phone = q(".nv-phone");
    const bgs = [...host.querySelectorAll(".nv-bg img")];
    const box = q(".nv-box"), name = q(".nv-name"), text = q(".nv-text"), opts = q(".nv-opts");
    const st = states.get(src) || { id: null, hist: [], stage: { ...EMPTY } };
    states.set(src, st);
    let typing = null, front = 0;

    const setBg = (f) => {
      const u = url(f);
      if (!u || bgs[front].getAttribute("src") === u) return;
      front ^= 1;
      bgs[front].src = u;
      bgs[front].classList.add("on");
      bgs[front ^ 1].classList.remove("on");
    };
    const setChar = (side, id, s) => {
      const wrap = q(`.nv-ch.${side}`), img = wrap.firstElementChild, c = nv.chars[id];
      wrap.classList.toggle("on", !!c);
      if (!c) return;
      const f = (s.who === id && s.emo && c.emo?.[s.emo]) || c.img;
      if (img.getAttribute("src") !== url(f)) img.src = url(f);
      wrap.classList.toggle("talk", s.t === "dialog" && s.who === id);
    };
    // a stage direction "(mutters) Finally." → a small tag before the line
    const lineHTML = (s) => esc(s).replace(/^\(([^)]*)\)\s*/, (m, d) => `<i class="nv-dir">${d}</i>`);

    let blip = 0;
    function type(html) {
      text.innerHTML = html;
      blip = 0;
      const full = text.textContent.length;
      box.classList.remove("typing");
      if (reduce || !full) return;
      // reveal the letters by clipping the text nodes; the markup (the stage direction) stays intact
      const nodes = [];
      const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) nodes.push([walk.currentNode, walk.currentNode.data]);
      box.classList.add("typing");
      const t0 = performance.now();
      const tick = () => {
        let left = Math.round(((performance.now() - t0) / 1000) * CPS);
        const shown = left;
        for (const [n, d] of nodes) { n.data = d.slice(0, Math.max(0, left)); left -= d.length; }
        if (box.dataset.t === "dialog" && shown - blip >= 3) { blip = shown; Sfx.blip(); }
        if (left >= 0) finish();
      };
      tick();
      typing = setInterval(tick, 30);
    }
    function finish() {
      if (!typing) return false;
      clearInterval(typing);
      typing = null;
      box.classList.remove("typing");
      text.innerHTML = lineHTML(nv.screens[st.id].text);
      return true;
    }

    function show(sound) {
      const s = nv.screens[st.id];
      if (sound) {
        const prev = sound === true ? null : sound;
        if (s.t === "scene") Sfx.scene();
        else if (s.t === "cutscene" || (prev && prev.bg !== s.bg)) Sfx.whoosh();
        else Sfx.tap();
        if (s.t === "choice") Sfx.chime();
      }
      clearInterval(typing);
      typing = null;
      phone.classList.remove("start", "ended");
      q(".nv-start").hidden = true;
      q(".nv-end").hidden = true;
      setBg(s.bg);
      setChar("left", st.stage.left, s);
      setChar("right", st.stage.right, s);
      phone.classList.toggle("solo", !st.stage.left !== !st.stage.right);
      phone.dataset.t = s.t;
      q(".nv-bar i").style.width = `${Math.min(100, (100 * s.p) / (nv.length || 1))}%`;
      const scene = q(".nv-scene");
      scene.hidden = s.t !== "scene";
      scene.firstElementChild.textContent = s.title || "";
      scene.lastElementChild.textContent = s.t === "scene" ? s.text : "";
      opts.hidden = s.t !== "choice";
      box.hidden = s.t === "scene" || s.t === "cutscene" || s.t === "choice";
      box.dataset.t = s.t;
      name.textContent = s.t === "dialog" ? nv.chars[s.who]?.name || "" : "";
      name.hidden = !name.textContent;
      box.classList.toggle("right", s.t === "dialog" && st.stage.right === s.who && !!st.stage.left);
      if (s.t === "choice") {
        const by = nv.chars[s.by]?.name;
        opts.querySelector(".nv-q").innerHTML = esc(s.text) + (by ? `<small>${esc(by)} ${t.decides}</small>` : "");
        opts.lastElementChild.innerHTML = s.opts.map((o, i) =>
          `<button data-to="${esc(o.to)}"><span>${i + 1}</span>${esc(o.text)}</button>`).join("");
      } else if (!box.hidden) type(lineHTML(s.text));
    }

    function go(id) {
      const s = nv.screens[id];
      if (!s) return;
      if (st.id) st.hist.push({ id: st.id, stage: st.stage });
      const prev = nv.screens[st.id];
      st.stage = nextStage(nv, st.stage, prev?.bg, s);
      st.id = id;
      show(prev || true);
    }
    function restore(h) {
      st.id = h.id;
      st.stage = h.stage;
      show();
    }
    function next() {
      if (finish()) return;
      const s = nv.screens[st.id];
      if (s.t === "choice") return;
      if (s.next) return go(s.next);
      phone.classList.add("ended"); // after the final screen
      Sfx.end();
      q(".nv-end").hidden = false;
    }
    function back() {
      if (phone.classList.contains("ended")) {
        phone.classList.remove("ended");
        q(".nv-end").hidden = true;
      } else if (st.hist.length) restore(st.hist.pop());
    }
    function restart() {
      st.hist = [];
      st.id = null;
      st.stage = { ...EMPTY };
      go(nv.start);
    }
    function lastChoice() {
      let i = st.hist.length;
      while (i-- > 0 && nv.screens[st.hist[i].id].t !== "choice");
      if (i < 0) return restart();
      const h = st.hist[i];
      st.hist.length = i;
      restore(h);
    }
    const started = () => !!st.id;
    const play = () => {
      if (!ui.isOpen()) ui.open();
      Sfx.ambient(true);
      st.id ? show() : go(nv.start);
    };
    const idle = () => phone.classList.contains("start") || phone.classList.contains("ended");

    phone.addEventListener("click", (e) => {
      if (!ui.isOpen()) return; // folded: the window itself opens on a click
      const b = e.target.closest("button");
      Sfx.wake();
      if (b?.dataset.to) return Sfx.pick(), go(b.dataset.to);
      const act = b?.dataset.act;
      if (act === "sound") {
        Sfx.toggle();
        b.textContent = Sfx.on ? "♪" : "×";
        return b.setAttribute("aria-pressed", Sfx.on);
      }
      if (act === "fold") return e.stopPropagation(), ui.fold(); // or the window reopens on the same click
      if (act === "play") return play();
      if (act === "back") return back();
      if (act === "restart") return restart();
      if (act === "choice") return lastChoice();
      if (!b && !idle()) next();
    });
    phone.addEventListener("keydown", (e) => {
      if (e.target.closest("button") && (e.key === " " || e.key === "Enter")) return; // a focused button clicks itself
      if (e.altKey || e.ctrlKey || e.metaKey || !ui.isOpen()) return;
      const k = e.key;
      Sfx.wake();
      if (k === " " || k === "Enter" || k === "ArrowRight") {
        if (phone.classList.contains("start")) play();
        else if (!idle()) next();
      } else if (k === "ArrowLeft") back();
      else if (/^[1-9]$/.test(k) && nv.screens[st.id]?.t === "choice") nv.screens[st.id].opts[+k - 1] && (Sfx.pick(), go(nv.screens[st.id].opts[+k - 1].to));
      else return;
      e.preventDefault();
    });

    if (st.id) show();
    else {
      phone.classList.add("start");
      setBg(nv.screens[nv.start]?.bg);
    }
    return { play, started, phone };
  }

  // ---- the floating window: a teaser square in the bottom-right corner → opens over the page → folds back
  // there and keeps showing the screen of the game. One window per page (the first "novel" block); the block
  // itself is invisible on the site — in the admin it is a card that sets which novel plays ----
  let dock = null; // { src, lang, el, back, player, nv }
  const MINI = () => (innerWidth < 600 ? 112 : 168);
  const GAP = () => (innerWidth < 600 ? 14 : 20);
  let hidden = false;
  try { hidden = sessionStorage.getItem("nvHidden") === "1"; } catch (e) {}

  // the open window is laid out in the middle; folded, the same element is moved and scaled into the corner
  function place() {
    if (!dock) return;
    const vw = document.documentElement.clientWidth, vh = innerHeight, g = GAP(), m = MINI();
    const B = Math.round(Math.min(720, vw - 24, vh * 0.88)), L = (vw - B) / 2, T = (vh - B) / 2, k = m / B;
    const s = dock.el.style;
    s.width = s.height = `${B}px`;
    s.left = `${L}px`;
    s.top = `${T}px`;
    s.setProperty("--k", k);
    s.setProperty("--fold", `translate(${vw - g - m - L}px, ${vh - g - m - T}px) scale(${k})`);
  }
  const isOpen = () => dock?.el.classList.contains("open");
  function open() {
    if (!dock || isOpen()) return;
    Sfx.wake();
    dock.el.classList.remove("away");
    dock.el.classList.add("open");
    dock.back.classList.add("on");
    document.documentElement.classList.add("nv-lock");
    warm();
    if (dock.player.started()) Sfx.ambient(true);
    setTimeout(() => dock?.player.phone.focus({ preventScroll: true }), 50);
  }
  function fold() {
    if (!isOpen()) return;
    dock.el.classList.remove("open");
    dock.back.classList.remove("on");
    document.documentElement.classList.remove("nv-lock");
    Sfx.ambient(false);
  }
  function dismiss() {
    fold();
    dock.el.classList.add("away");
    try { sessionStorage.setItem("nvHidden", "1"); } catch (e) {}
  }
  // the backgrounds and the cast are ≈1 MB — loaded once the window is touched or opened
  function warm() {
    if (!dock || dock.warm) return;
    dock.warm = true;
    const { nv, src } = dock, base = src.replace(/[^/]*$/, "");
    [...new Set([...Object.values(nv.screens).map((s) => s.bg), ...Object.values(nv.chars).map((c) => c.img)])]
      .filter(Boolean).forEach((f) => { new Image().src = base + f; });
  }

  function makeDock(nv, src, lang) {
    const t = UI[lang] || UI.en;
    const el = document.createElement("div");
    el.className = "nv-dock away";
    el.innerHTML = `<div class="nv-host"></div>
      <button class="nv-cta" type="button" aria-label="${t.cta}"><i class="play">▶ ${t.cta}</i><i class="more">⤢</i></button>
      <button class="nv-x" type="button" aria-label="${t.close}" title="${t.close}">×</button>`;
    const back = document.createElement("div");
    back.className = "nv-backdrop";
    document.body.append(back, el);
    dock = { src, lang, el, back, nv };
    dock.player = build(el.firstElementChild, nv, src, lang, { open, fold, isOpen });
    el.classList.toggle("playing", dock.player.started());
    // folded: a click anywhere on the square opens the game (PLAY starts it right away)
    el.addEventListener("click", (e) => {
      if (isOpen()) return el.classList.toggle("playing", dock.player.started());
      if (e.target.closest(".nv-x")) return dismiss();
      if (dock.player.started()) open();
      else dock.player.play();
      el.classList.add("playing");
    });
    el.addEventListener("pointerenter", warm, { once: true });
    back.addEventListener("click", fold);
    place();
    if (!hidden) setTimeout(() => el.classList.remove("away"), 1200);
  }

  addEventListener("resize", place);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) fold(); });
  // links to #play (the button in the head of the case) open the game
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href="#play"]');
    if (!a || !dock) return;
    e.preventDefault();
    dock.player.play();
    dock.el.classList.add("playing");
  });

  function mount(root = document, { lang = "en", editor = false } = {}) {
    const el = root.querySelector(".nv[data-src]");
    if (!el) { // the block is gone (deleted in the editor, another page)
      if (dock) { fold(); dock.el.remove(); dock.back.remove(); dock = null; }
      return;
    }
    const src = el.dataset.src;
    if (editor) {
      el.innerHTML = `<div class="nv-card"><b>${esc((UI.ru).card)}</b><span>${esc(src)}</span>
        <button class="btn" type="button">${UI.ru.openGame}</button></div>`;
      el.querySelector("button").onclick = () => dock && (dock.el.classList.remove("away"), dock.player.play());
    }
    if (dock && dock.src === src && dock.lang === lang) return;
    load(src).then((nv) => {
      if (dock && dock.src === src && dock.lang === lang) return;
      const wasOpen = isOpen(), away = dock?.el.classList.contains("away");
      if (dock) { dock.el.remove(); dock.back.remove(); document.documentElement.classList.remove("nv-lock"); dock = null; }
      makeDock(nv, src, lang);
      if (wasOpen) open();
      else if (away === false) dock.el.classList.remove("away");
    }, () => console.warn("novel: could not load", src));
  }

  window.Novel = { mount, open: () => dock?.player.play() };
})();
