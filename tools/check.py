#!/usr/bin/env python3
"""Проверка репо перед PR: синтаксис, JSON, типы блоков, id, локальные файлы.

Запуск из корня репо: python3 tools/check.py
Код выхода 0 — всё чисто; 1 — есть ошибки (список выводится).
Предупреждения (WARN) не валят проверку.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors, warns = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warns.append(msg)


def check_js_syntax():
    for f in ["app.js", "admin.js", "guest.js", "novel.js", "gifts.js"]:
        p = ROOT / f
        if not p.exists():
            continue
        r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
        if r.returncode != 0:
            err(f"синтаксис {f}:\n{r.stderr.strip()[:600]}")


def load_json(name):
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        err(f"{name}: не читается как JSON — {e}")
        return None


def admin_types():
    txt = (ROOT / "admin.js").read_text(encoding="utf-8").splitlines()
    rx = re.compile(r'^    "?([\w-]+)"?: \{ name:')
    return {m.group(1) for ln in txt for m in [rx.match(ln)] if m}


def render_types():
    """Ключи BLOCK_HTML в app.js (блок от 'const BLOCK_HTML' до первой строки '};')."""
    lines = (ROOT / "app.js").read_text(encoding="utf-8").splitlines()
    try:
        start = next(i for i, ln in enumerate(lines) if ln.startswith("const BLOCK_HTML"))
    except StopIteration:
        err("app.js: не найден BLOCK_HTML")
        return set()
    end = next(i for i in range(start + 1, len(lines)) if lines[i].startswith("};"))
    keys = set()
    rx = re.compile(r'^  "?([\w-]+)"?:')
    for ln in lines[start + 1:end]:
        m = rx.match(ln)
        if m:
            keys.add(m.group(1))
    # типы, которые обрабатываются отдельно от BLOCK_HTML (blockHTML: b.type === "next")
    keys |= set(re.findall(r'b\.type === "([\w-]+)"', "\n".join(lines)))
    return keys


def walk_blocks(blocks, where):
    """Обходит блоки страницы: типы, id, локальные картинки."""
    ids = set()
    for b in blocks or []:
        bid = b.get("id")
        if bid in ids:
            err(f"{where}: повторный id блока «{bid}»")
        ids.add(bid)
        if "type" not in b:
            err(f"{where}: блок «{bid}» без type")
        yield b


def check_assets(obj, where):
    """Строки вида 'assets/...' должны существовать в репо (внешние и /other-repo/ не трогаем)."""
    if isinstance(obj, dict):
        for v in obj.values():
            check_assets(v, where)
    elif isinstance(obj, list):
        for v in obj:
            check_assets(v, where)
    elif isinstance(obj, str) and obj.startswith("assets/") and not (ROOT / obj).exists():
        warn(f"{where}: нет файла {obj}")


def check_projects(data, types_admin, types_render):
    if not data:
        return
    projects = data.get("projects", data if isinstance(data, list) else [])
    seen = set()
    for p in projects:
        pid = p.get("id")
        where = f"projects.json «{pid}»"
        if not pid:
            err("projects.json: проект без id")
            continue
        if pid in seen:
            err(f"projects.json: повторный id проекта «{pid}»")
        seen.add(pid)
        if not (p.get("title") or {}).get("ru"):
            warn(f"{where}: нет title.ru")
        for b in walk_blocks(p.get("page"), where):
            t = b.get("type")
            if t not in types_admin:
                err(f"{where}: блок «{b.get('id')}» тип «{t}» нет в admin.js TYPES")
            elif t not in types_render:
                err(f"{where}: блок «{b.get('id')}» тип «{t}» нет в app.js BLOCK_HTML")
        check_assets(p, where)


def check_site(site):
    # главная: блоки встроенные (типы не проверяем), только картинки
    if site:
        check_assets(site, "site.json")


def main():
    check_js_syntax()
    projects = load_json("projects.json")
    site = load_json("site.json")
    types_admin = admin_types()
    types_render = render_types()
    check_projects(projects, types_admin, types_render)
    check_site(site)

    for w in warns:
        print("WARN ", w)
    for e in errors:
        print("ERR  ", e)
    print(f"итог: ошибок {len(errors)}, предупреждений {len(warns)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
