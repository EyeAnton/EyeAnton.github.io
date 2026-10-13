// "Guest cursor": once per visit (sessionStorage — a new tab / browser session shows it again),
// a Figma-style collaborator cursor ("Anton Egorov") drags a CV file (Finder-style thumbnail,
// assets/cv-<lang>.png from tools/cv_thumbs.py) next to the visitor's pointer.
// When: project pages — after 3 s on the last screens (the case is read, nothing important gets covered);
// other pages — after profile.guestDelay seconds (site.json, 0 = off).
// Uses `lang`, `PROFILE`, `PAGE` from app.js; app.js calls startGuest() after the first render.
function startGuest() {
  if (startGuest.on) return;
  startGuest.on = true;
  const delay = Number(PROFILE.guestDelay ?? 20);
  if (!delay || !PROFILE.cv?.[lang]) return;
  if (!matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches) return;
  try { if (sessionStorage.getItem("guestShown")) return; } catch {}

  let mx = innerWidth * 0.6, my = innerHeight * 0.5;
  addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const go = () => {
    if (document.hidden) { // wait until the tab is visible again
      document.addEventListener("visibilitychange", function once() {
        if (!document.hidden) { document.removeEventListener("visibilitychange", once); setTimeout(run, 1500); }
      });
    } else run();
  };

  if (PAGE === "project") {
    // within one screen of the bottom for 3 s straight
    let timer = null;
    const check = () => {
      const atBottom = document.documentElement.scrollHeight - (scrollY + innerHeight) < innerHeight;
      if (atBottom && !timer) timer = setTimeout(() => { removeEventListener("scroll", check); go(); }, 3000);
      else if (!atBottom && timer) { clearTimeout(timer); timer = null; }
    };
    addEventListener("scroll", check, { passive: true });
    check();
  } else setTimeout(go, delay * 1000);

  function run() {
    try { sessionStorage.setItem("guestShown", "1"); } catch {}
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const file = document.createElement("a");
    file.className = "guest-file";
    file.innerHTML = `<i class="guest-thumb"><b class="guest-page"><img alt=""></b><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v7m-3-3 3 3 3-3M4.5 12.5h7"/></svg></i>
      <span></span><button class="guest-x" type="button" aria-label="Close">×</button>`;
    const setHref = () => {
      file.href = PROFILE.cv[lang];
      file.querySelector("img").src = PROFILE.cv[lang].replace(/\.pdf$/, ".png");
      file.querySelector("span").textContent = lang === "ru" ? "Скачать CV" : "Download CV";
      file.title = lang === "ru" ? "Открыть резюме" : "Open CV";
    };
    setHref();
    document.getElementById("lang")?.addEventListener("click", () => setTimeout(setHref));

    const cur = document.createElement("div");
    cur.className = "guest-cursor";
    cur.innerHTML = `<svg viewBox="0 0 20 22" aria-hidden="true"><path d="M2 2l15 7.5-6.5 1.8L7.6 18z"/></svg><b>Anton Egorov</b>`;

    const remove = () => { file.classList.add("gone"); setTimeout(() => file.remove(), 300); removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector(".cv-modal")) remove(); };
    file.querySelector(".guest-x").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); remove(); });
    let moved = false; // set by a drag, so the click that ends it does not open the preview
    file.addEventListener("click", (e) => {
      e.preventDefault();
      if (moved) return;
      if (!file.classList.contains("held")) openCvPreview(file);
    });

    // the file stays where it was dropped (position: fixed); scrolling away dims it down to 35%
    // (in step with the distance, back to full when scrolled back), hover shows it fully again
    const y0 = scrollY;
    const onScroll = () => {
      if (!file.isConnected) return removeEventListener("scroll", onScroll);
      file.style.setProperty("--o", Math.max(0.35, 1 - Math.abs(scrollY - y0) / 240));
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("keydown", onKey);

    // drop spot: ~80px from the visitor's pointer, toward the screen centre, kept on screen
    const W = innerWidth, H = innerHeight;
    const tx = Math.min(Math.max(mx + (mx > W / 2 ? -110 : 60), 16), W - 80);
    const ty = Math.min(Math.max(my + (my > H / 2 ? -110 : 50), 16), H - 90);
    const place = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };

    // drag the file around like a layer in Figma; a press without movement stays a click
    let drag = null;
    file.addEventListener("dragstart", (e) => e.preventDefault()); // no native link/image drag
    file.addEventListener("pointerdown", (e) => {
      if (e.button || file.classList.contains("held") || e.target.closest(".guest-x")) return;
      const r = file.getBoundingClientRect();
      drag = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY };
      moved = false;
    });
    addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
        moved = true;
        file.classList.add("dragging");
      }
      place(file, Math.min(Math.max(e.clientX - drag.ox, 0), innerWidth - file.offsetWidth),
        Math.min(Math.max(e.clientY - drag.oy, 0), innerHeight - file.offsetHeight));
    });
    const drop = () => {
      if (!drag) return;
      drag = null;
      file.classList.remove("dragging");
      setTimeout(() => { moved = false; }); // after the click that may follow this pointerup
    };
    addEventListener("pointerup", drop);
    addEventListener("pointercancel", drop);

    if (reduce) { place(file, tx, ty); document.body.append(file); return; }

    // enter from the nearest side edge, on a curve with a little hand wobble
    const fromRight = tx > W / 2;
    const sx = fromRight ? W + 40 : -60, sy = Math.min(Math.max(ty + (Math.random() - 0.5) * H * 0.6, 0), H);
    const cx = (sx + tx) / 2 + (fromRight ? -1 : 1) * 60, cy = Math.min(sy, ty) - 120;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    document.body.append(file, cur);
    file.classList.add("held");

    const T1 = 2200, T2 = 1400; // fly in, then leave
    let t0 = null;
    const fly = (now) => {
      t0 ??= now;
      const t = Math.min((now - t0) / T1, 1), e = ease(t);
      const w = Math.sin(t * Math.PI * 3) * 6 * (1 - t);
      const x = bez(sx, cx, tx, e) + w, y = bez(sy, cy, ty, e) - w / 2;
      place(cur, x + 26, y + 30);
      place(file, x, y);
      if (t < 1) return requestAnimationFrame(fly);
      setTimeout(() => { file.classList.remove("held"); setTimeout(leave, 500); }, 250);
    };
    const leave = () => {
      const lx = fromRight ? W + 60 : -80, ly = ty - 140;
      let l0 = null;
      const step = (now) => {
        l0 ??= now;
        const t = Math.min((now - l0) / T2, 1), e = t * t;
        place(cur, tx + 26 + (lx - tx) * e, ty + 30 + (ly - ty) * e);
        if (t < 1) requestAnimationFrame(step); else cur.remove();
      };
      requestAnimationFrame(step);
    };
    requestAnimationFrame(fly);
  }
}

// CV preview popup: the page (assets/cv-<lang>-full.jpg from tools/cv_thumbs.py) sized to fit the
// window height, no frame, a download button under it. `from` (the guest file) is where it grows
// out of and folds back into — a macOS-minimize-like move: scale + a pinch toward the icon.
function openCvPreview(from) {
  if (document.querySelector(".cv-modal")) return;
  const ru = lang === "ru";
  const m = document.createElement("div");
  m.className = "cv-modal";
  m.setAttribute("role", "dialog");
  m.setAttribute("aria-modal", "true");
  m.setAttribute("aria-label", "CV");
  m.innerHTML = `<div class="cv-page">
      <img src="${PROFILE.cv[lang].replace(/\.pdf$/, "-full.jpg")}" alt="CV">
      <button class="cv-modal-x" type="button" aria-label="${ru ? "Закрыть" : "Close"}">×</button>
    </div>
    <a class="btn" href="${PROFILE.cv[lang]}" download="Anton-Egorov-CV-${lang.toUpperCase()}.pdf">${ru ? "Скачать" : "Download"}</a>`;
  document.body.append(m);
  const page = m.querySelector(".cv-page");
  const thumb = from?.querySelector(".guest-thumb");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // keyframes from the icon to the page's own place; the edge facing the icon is pinched
  const genie = () => {
    const a = thumb.getBoundingClientRect(), b = page.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const k = Math.max(-25, Math.min(25, (dx / b.width) * 50)); // pinch shifts toward the icon (in %)
    const pinch = (w) => dy > 0
      ? `polygon(0% 0%, 100% 0%, ${50 + k + w}% 100%, ${50 + k - w}% 100%)`
      : `polygon(${50 + k - w}% 0%, ${50 + k + w}% 0%, 100% 100%, 0% 100%)`;
    const full = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
    return [
      { transform: `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height})`, clipPath: pinch(20), opacity: 0.6 },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(0.6, 0.8)`, clipPath: pinch(32), opacity: 1, offset: 0.45 },
      { transform: "none", clipPath: full, opacity: 1 },
    ];
  };
  const anim = (dir) => thumb && !reduce
    ? page.animate(genie(), { duration: 600, easing: "cubic-bezier(.4,0,.2,1)", direction: dir, fill: "both" }).finished
    : Promise.resolve();

  if (from) from.style.visibility = "hidden"; // the file "becomes" the page
  requestAnimationFrame(() => m.classList.add("on"));
  anim("normal").then(() => m.classList.add("ready"));
  m.querySelector(".cv-modal-x").focus({ preventScroll: true });

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    removeEventListener("keydown", onKey);
    m.classList.remove("ready", "on");
    anim("reverse").then(() => { m.remove(); if (from) from.style.visibility = ""; });
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  m.addEventListener("click", (e) => { if (e.target === m || e.target.closest(".cv-modal-x")) close(); });
  addEventListener("keydown", onKey);
}
