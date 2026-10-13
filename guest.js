// "Guest cursor": once per visitor (never again), a Figma-style collaborator cursor ("Anton Egorov")
// drags a CV file (Finder-style thumbnail, assets/cv-<lang>.png from tools/cv_thumbs.py)
// next to the visitor's pointer. Delay — profile.guestDelay in site.json (0 = off).
// Uses `lang` and `PROFILE` from app.js; app.js calls startGuest() after the first render.
function startGuest() {
  if (startGuest.on) return;
  startGuest.on = true;
  const delay = Number(PROFILE.guestDelay ?? 20);
  if (!delay || !PROFILE.cv?.[lang]) return;
  if (!matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches) return;
  try { if (localStorage.getItem("guestShown")) return; } catch {}

  let mx = innerWidth * 0.6, my = innerHeight * 0.5;
  addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  setTimeout(() => {
    if (document.hidden) { // wait until the tab is visible again
      document.addEventListener("visibilitychange", function once() {
        if (!document.hidden) { document.removeEventListener("visibilitychange", once); setTimeout(run, 1500); }
      });
    } else run();
  }, delay * 1000);

  function run() {
    try { localStorage.setItem("guestShown", "1"); } catch {}
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
    file.addEventListener("click", (e) => { e.preventDefault(); if (!file.classList.contains("held")) openCvPreview(); });

    // scrolling away fades the file out (in step with the distance), then it is gone for good
    let y0 = null;
    const onScroll = () => {
      if (!file.isConnected) return removeEventListener("scroll", onScroll);
      y0 ??= scrollY;
      const o = Math.max(0, 1 - Math.abs(scrollY - y0) / 240);
      file.style.opacity = o;
      if (!o) { removeEventListener("scroll", onScroll); file.remove(); removeEventListener("keydown", onKey); }
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("keydown", onKey);

    // drop spot: ~80px from the visitor's pointer, toward the screen centre, kept on screen
    const W = innerWidth, H = innerHeight;
    const tx = Math.min(Math.max(mx + (mx > W / 2 ? -110 : 60), 16), W - 80);
    const ty = Math.min(Math.max(my + (my > H / 2 ? -110 : 50), 16), H - 90);
    const place = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };

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

// CV preview popup: all pages as one image (assets/cv-<lang>-full.jpg from tools/cv_thumbs.py) + a download button
function openCvPreview() {
  if (document.querySelector(".cv-modal")) return;
  const ru = lang === "ru";
  const m = document.createElement("div");
  m.className = "cv-modal";
  m.innerHTML = `<div class="cv-modal-box" role="dialog" aria-modal="true" aria-label="CV">
      <button class="cv-modal-x" type="button" aria-label="${ru ? "Закрыть" : "Close"}">×</button>
      <div class="cv-modal-scroll"><img src="${PROFILE.cv[lang].replace(/\.pdf$/, "-full.jpg")}" alt="CV"></div>
      <a class="btn" href="${PROFILE.cv[lang]}" download="Anton-Egorov-CV-${lang.toUpperCase()}.pdf">${ru ? "Скачать" : "Download"}</a>
    </div>`;
  const close = () => { m.classList.remove("on"); removeEventListener("keydown", onKey); setTimeout(() => m.remove(), 250); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  m.addEventListener("click", (e) => { if (e.target === m || e.target.closest(".cv-modal-x")) close(); });
  addEventListener("keydown", onKey);
  document.body.append(m);
  requestAnimationFrame(() => m.classList.add("on"));
  m.querySelector(".cv-modal-x").focus();
}
