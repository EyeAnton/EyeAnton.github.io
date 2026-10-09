# portfolio

Сайт-портфолио со всеми проектами: https://eyeanton.github.io/

Статичный HTML/CSS/JS без сборки, RU/EN, фильтр по категориям. Хостинг — GitHub Pages (ветка `main`, корень).

## Управление проектами — админка

https://eyeanton.github.io/admin.html — показывать/скрывать проекты, порядок, тексты RU/EN, ссылки, обложки (загрузка картинок), превью карточки.
Кнопка «Опубликовать» коммитит `projects.json` (и картинки в `assets/shots/`) в этот репозиторий; GitHub Pages обновляет сайт примерно за минуту.

Вход — fine-grained токен GitHub: Only select repositories → `EyeAnton.github.io`, Permissions → Contents: Read and write.
Токен хранится только в браузере. Без токена страница бесполезна, но `projects.json` в публичном репо открыт —
«скрытый» проект не показывается на сайте, но не секретен.

Данные — `projects.json`: `categories` и `projects` (порядок массива = порядок на сайте). Поля проекта:
- `visible` — показывать ли на сайте; `featured` — большая карточка на всю ширину;
- `cat` — id из `categories`; `cover` — `{ shot, pos }` (картинка), `{ gifts: [...] }` или `{ glyph, tint, sub }`;
- `links.page` — раздел этого сайта (например `/gift-catalog/`), `links.live` — живой сайт, `links.code` / `code2` — публичные репозитории; `private: true` — бейдж «Приватный».

Можно править и руками (или в веб-редакторе GitHub) — админка просто удобнее.

## Локально

```sh
python3 -m http.server 8000   # http://localhost:8000
```
