# portfolio

Сайт-портфолио со всеми проектами: https://eyeanton.github.io/

Статичный HTML/CSS/JS без сборки, RU/EN, фильтр по категориям. Хостинг — GitHub Pages (ветка `main`, корень).

## Вкладки

Три страницы, переключатель в шапке (+ красная «CV ↓» — скачивает резюме на языке сайта); общий скрипт `app.js`
выбирает отрисовку по `<body data-page>`:
- **Главная** `index.html` — лендинг-резюме, блоки `data-block`: первый экран → цифры → «Что я делаю» (навыки) →
  избранные проекты (флаг `home: true`, порядок как в `projects.json`) → стек → опыт → «Давайте поговорим».
- **Проекты** `projects.html` — весь каталог с фильтрами; ссылка `projects.html#cat=web` открывает сразу нужную категорию.
- **Контакты** `contact.html` — резюме и каналы связи. Кнопки «Скачать CV» появляются сами, когда в репо лежат
  `assets/cv-ru.pdf` / `assets/cv-en.pdf`.

Контент (всё, кроме проектов) — `site.json`: `text.ru` / `text.en` (все надписи, включая логотип `brand`),
`blocks` (порядок и видимость блоков главной), `profile` (навыки, soft skills, стек, опыт, контакты, `since`, `showCode`).

## Визуальный редактор главной

Админка → вкладка **«Главная страница»** (как в Тильде): слева блоки (показать/скрыть, порядок), в центре живая
главная — кликните на текст и пишите прямо на странице; кнопка «… · настроить» на блоке или клик в списке открывает
справа панель: тексты RU/EN, навыки, опыт, стек, контакты. RU/EN и «Компьютер/Телефон» — над страницей.
«Опубликовать» коммитит `site.json` (и `projects.json`, если менялись проекты).

Устройство: страница открывается в iframe как `index.html?edit=1`, `app.js` в этом режиме берёт черновик
у `window.parent.siteEditor` (admin.js) и шлёт туда правки текстов; цвета и вёрстка — по-прежнему в CSS.

## Превью ссылки

`assets/og.jpg` (1200×630) — то, что видно при отправке ссылки в мессенджерах. Исходник — `tools/og.html`
(на токенах дизайн-системы). Перегенерировать после правки текста или смены домена:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --window-size=1200,630 `
  --virtual-time-budget=6000 --screenshot="$PWD\og.png" "file:///$PWD/tools/og.html"
```
затем сохранить `og.png` как JPEG в `assets/og.jpg`. В `<head>` страниц `og:image` и `og:url` — абсолютные
адреса (мессенджеры не понимают относительные); при смене домена поменять и их.

## Дизайн-система «Lighthouse»

Ночной синий холст `#050A18`, кобальтовый свет `#2563E0` и один контрастный акцент — Signal Red `#EC2F1F`;
бирюза `#2FC4A0` — редко (статус «Онлайн»). Палитра взята из моей серии афиш (ночное небо, вода, красный маяк).
- `design-system.css` — токены (шкалы `--ink-*`, `--red-*`, `--blue-*`, `--teal-*`, градиенты, свечения, типографика)
  и компоненты: `.btn` / `.btn.ghost` / `.btn.quiet`, `.chip`, `.badge`, `.tag`, `.surface`, `.surface-glow`,
  эффекты `.aurora` (свечение горизонта), `.beams` (лучи маяка), `.wordmark`. Подключается первым, перед `style.css`.
- Цвета свечений — через `rgba(var(--glow-rgb), …)` / `--accent-rgb`, чтобы палитру можно было сменить в одном месте.
- `style.css` — только раскладка страниц, на токенах.
- https://eyeanton.github.io/design-system.html — живая витрина: образцы цветов читаются прямо из CSS-переменных.
- Шрифт Montserrat. Старые имена `--gold`, `--serif` оставлены алиасами для админки.

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
- `visible` — показывать ли на сайте; `home` — в «Избранном» на главной; `featured` — большая карточка на всю ширину в каталоге;
- `cat` — id из `categories`; `cover` — `{ shot, pos }` (картинка), `{ gifts: [...] }` или `{ glyph, tint, sub }`;
- `links.page` — раздел этого сайта (например `/gift-catalog/`), `links.live` — живой сайт, `links.code` / `code2` — публичные репозитории; `private: true` — бейдж «Приватный».

Можно править и руками (или в веб-редакторе GitHub) — админка просто удобнее.

## Локально

```sh
python3 -m http.server 8000   # http://localhost:8000
```

Админка без входа для проверки правок: http://localhost:8000/admin.html?local — читает файлы с диска,
публикация отключена (работает только на localhost).

## Проверки (тесты)

Из корня репо, перед каждым PR:

```sh
python3 tools/check.py   # синтаксис JS (node --check), JSON, типы блоков app.js ↔ admin.js, повторные id, отсутствующие assets/…
python3 tools/smoke.py   # главная, проекты, контакты и кейсы рендерятся в headless Chrome (поднимает сервер на :8765)
```

Код выхода 0 — всё чисто. После правки js/css/текстов — `python3 tools/bake.py` (версии `?v=` к файлам,
тексты в HTML, `llms.txt`), после правки структуры — `python3 tools/mkmap.py` (`MAP.md`).

Зависимости: только `python3` (стандартная библиотека), `node` (для `--check`) и Google Chrome (smoke).
`tools/cv_thumbs.py` — ещё `pymupdf`; `tools/og.ps1`, `tools/shot.ps1` — Windows/PowerShell.

## Структура и потоки данных

- Карта «что где лежит» и решения — `CLAUDE.md`; объявления по строкам — `MAP.md` (генерирует `tools/mkmap.py`).
- Данные: `projects.json` (проекты и блоки страниц кейсов) + `site.json` (тексты, блоки главной, профиль) →
  `app.js` рендерит страницу по `<body data-page>`. Медиа кейсов берутся из соседних Pages-репо
  (`/gift-catalog/…`, `/emotions-club/…`, `/stasik-page/`), чат — из `/feedback-chat/`.
- Запись: `admin.html` → вход Google (Firebase) → GitHub-токен → Contents API → коммит в `main` → GitHub Pages.

## Статус

Работает в проде, развивается через админку (контент) и PR (вёрстка, новые типы блоков).
