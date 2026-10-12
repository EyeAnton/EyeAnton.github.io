# portfolio

Сайт-портфолио со всеми проектами: https://eyeanton.github.io/

Статичный HTML/CSS/JS без сборки, RU/EN, фильтр по категориям. Хостинг — GitHub Pages (ветка `main`, корень).

## Вкладки

Три страницы, переключатель в шапке; общий скрипт `app.js` выбирает отрисовку по `<body data-page>`:
- **Главная** `index.html` — лендинг-резюме: о себе → цифры → «Что я делаю» (направления и навыки из тегов проектов) →
  избранные проекты (флаг `home: true`, порядок как в `projects.json`) → стек бегущей строкой → путь по годам → CTA.
- **Проекты** `projects.html` — весь каталог с фильтрами; ссылка `projects.html#cat=web` открывает сразу нужную категорию.
- **Контакты** `contact.html` — резюме и каналы связи. Кнопки «Скачать CV» появляются сами, когда в репо лежат
  `assets/cv-ru.pdf` / `assets/cv-en.pdf`. Почта, Telegram и др. — в объекте `PROFILE` в начале `app.js`
  (пустой `href` = не показывать).

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
