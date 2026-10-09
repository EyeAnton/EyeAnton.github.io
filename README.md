# portfolio

Сайт-портфолио со всеми проектами: https://eyeanton.github.io/

Статичный HTML/CSS/JS без сборки, RU/EN, фильтр по категориям. Хостинг — GitHub Pages (ветка `main`, корень).

## Управление проектами — админка

https://eyeanton.github.io/admin.html — показывать/скрывать проекты, порядок, тексты RU/EN, ссылки, обложки (загрузка картинок), превью карточки.
Кнопка «Опубликовать» коммитит `projects.json` (и картинки в `assets/shots/`) в этот репозиторий; GitHub Pages обновляет сайт примерно за минуту.

Вход — только через Google-аккаунт владельца (leritosha@gmail.com), Firebase Authentication.
GitHub fine-grained токен (Only select repositories → `EyeAnton.github.io`, Contents: Read and write)
хранится в Firebase Realtime Database по пути `portfolioAdmin/githubToken`; правила (`firebase-rules.json`)
дают читать его только владельцу. Токен вводится один раз при первом входе (и заново, когда истечёт срок).

Настройка Firebase (один раз): проект → Authentication → Google включён, Authorized domains + `eyeanton.github.io`;
Realtime Database создана, правила из `firebase-rules.json`; конфиг веб-приложения вписан в `FIREBASE` в `admin.js`.

`projects.json` в публичном репо открыт — «скрытый» проект не показывается на сайте, но не секретен.

Данные — `projects.json`: `categories` и `projects` (порядок массива = порядок на сайте). Поля проекта:
- `visible` — показывать ли на сайте; `featured` — большая карточка на всю ширину;
- `cat` — id из `categories`; `cover` — `{ shot, pos }` (картинка), `{ gifts: [...] }` или `{ glyph, tint, sub }`;
- `links.page` — раздел этого сайта (например `/gift-catalog/`), `links.live` — живой сайт, `links.code` / `code2` — публичные репозитории; `private: true` — бейдж «Приватный».

Можно править и руками (или в веб-редакторе GitHub) — админка просто удобнее.

## Локально

```sh
python3 -m http.server 8000   # http://localhost:8000
```
