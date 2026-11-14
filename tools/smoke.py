#!/usr/bin/env python3
"""Дым-проверка страниц в headless Chrome: рендерятся ли главная, проекты и кейсы.

Запуск из корня репо: python3 tools/smoke.py
Поднимает python http.server на 127.0.0.1:8765, рендерит страницы (JS выполняется),
печатает число блоков и признаки ошибки. Дамп HTML кладёт в $TMPDIR/portfolio-smoke/.
Скрытые проекты (visible:false) дают «Проект не найден» на публичном адресе — это ожидаемо.
"""
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 8765
PAGES = [
    "index.html",
    "projects.html",
    "contact.html",
    "project.html?id=emotions-club",
    "project.html?id=virtual-gifts",
]


def main():
    if not Path(CHROME).exists():
        print("нет Chrome по пути", CHROME)
        return 1
    out = Path(tempfile.gettempdir()) / "portfolio-smoke"
    out.mkdir(exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                           cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        bad = 0
        for url in PAGES:
            r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
                                "--virtual-time-budget=8000", "--dump-dom",
                                f"http://127.0.0.1:{PORT}/{url}"],
                               capture_output=True, text=True, timeout=120)
            html = r.stdout
            name = re.sub(r"[^\w-]+", "_", url)
            (out / f"{name}.html").write_text(html, encoding="utf-8")
            blocks = len(re.findall(r"data-block=", html))
            notfound = len(re.findall(r"not found|не найден|Could not load", html))
            flag = "OK" if html and notfound == 0 else "CHECK"
            bad += flag != "OK"
            print(f"{flag:5} {url:32} size={len(html):7} blocks={blocks:3} notfound={notfound}")
        print(f"дампы: {out}")
        return 1 if bad else 0
    finally:
        srv.terminate()


if __name__ == "__main__":
    sys.exit(main())
