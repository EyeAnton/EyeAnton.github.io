# portfolio

Сайт-портфолио со всеми проектами: https://eyeanton.github.io/

Статичный HTML/CSS/JS без сборки, RU/EN, фильтр по категориям. Хостинг — GitHub Pages (ветка `main`, корень).

## Как добавить проект

Дописать объект в массив `PROJECTS` в `app.js`:
- `cat` — одна из `CATEGORIES` (design / web / hardware / ai / tools);
- `cover` — `{ shot: "assets/shots/x.jpg" }` (скриншот), `{ gifts: [...] }` или `{ glyph: "Текст", tint: "#hex" }`;
- `links.page` — раздел этого сайта (например `/gift-catalog/`), `links.live` — живой сайт, `links.code` — публичный репозиторий (у приватных не указывать), `private: true` — бейдж «Приватный».

## Локально

```sh
python3 -m http.server 8000   # http://localhost:8000
```
