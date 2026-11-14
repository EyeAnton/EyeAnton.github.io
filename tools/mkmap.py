#!/usr/bin/env python3
"""Генерирует MAP.md — компактный индекс репо: где что объявлено (файл:строка).

Запуск из корня репо: python3 tools/mkmap.py
Читать MAP.md вместо целых файлов: grep по нему даёт место правки за один вызов.
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JS = ["app.js", "admin.js", "guest.js", "novel.js", "gifts.js"]
CSS = ["style.css", "case.css", "design-system.css", "gifts.css", "novel.css"]
HTML = ["index.html", "project.html", "projects.html", "contact.html", "admin.html"]

# top level only (col 0); admin.js is wrapped in an IIFE, so there it is 2 spaces
DECL = re.compile(r"^(?:async\s+)?function\s+(\w+)|^(?:const|let|var)\s+(\w+)\s*=")
DECL_ADMIN = re.compile(r"^ {0,2}(?:async\s+)?function\s+(\w+)|^ {0,2}(?:const|let|var)\s+(\w+)\s*=")
SECTION_JS = re.compile(r"^\s*//\s*-{2,}\s*(.+?)\s*-*\s*$")
SECTION_CSS = re.compile(r"^/\*\s*-{2,}\s*(.+?)\s*-*\s*\*/")
ID_HTML = re.compile(r'\sid="([\w-]+)"')
BLOCK_TYPE_ADMIN = re.compile(r'^    "?([\w-]+)"?: \{ name:')


def read(name):
    p = ROOT / name
    return p.read_text(encoding="utf-8").splitlines() if p.exists() else []


def js_section(name):
    out = [f"## {name}"]
    lines = read(name)
    cur = []
    for i, line in enumerate(lines, 1):
        m = SECTION_JS.match(line)
        if m:
            cur.append(f"- L{i} {m.group(1)}")
            continue
        m = (DECL_ADMIN if name == "admin.js" else DECL).match(line)
        if m:
            sym = m.group(1) or m.group(2)
            cur.append(f"  L{i} {sym}")
    out.extend(cur)
    if name == "admin.js":
        types = [f"{m.group(1)}" for ln in lines for m in [BLOCK_TYPE_ADMIN.match(ln)] if m]
        out.append(f"- типы блоков (TYPES): {', '.join(types)}")
    return "\n".join(out)


def css_section(name):
    out = [f"## {name}"]
    for i, line in enumerate(read(name), 1):
        m = SECTION_CSS.match(line)
        if m:
            out.append(f"- L{i} {m.group(1)}")
    return "\n".join(out)


def html_section(name):
    ids = []
    for i, line in enumerate(read(name), 1):
        for m in ID_HTML.finditer(line):
            ids.append(f"{m.group(1)}@{i}")
    return f"## {name}\n- id: " + (", ".join(ids) if ids else "—")


def main():
    parts = [
        "# MAP — где что лежит (генерируется tools/mkmap.py, не править руками)",
        "",
        "Формат: `L<номер> имя` — объявление верхнего уровня; `- L<n> название` — раздел.",
        "Перегенерировать после правок структуры: `python3 tools/mkmap.py`.",
        "",
    ]
    parts += [js_section(f) for f in JS if (ROOT / f).exists()]
    parts += [css_section(f) for f in CSS if (ROOT / f).exists()]
    parts += [html_section(f) for f in HTML if (ROOT / f).exists()]
    (ROOT / "MAP.md").write_text("\n\n".join(parts) + "\n", encoding="utf-8")
    print("MAP.md:", sum(1 for _ in open(ROOT / "MAP.md", encoding="utf-8")), "строк")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
