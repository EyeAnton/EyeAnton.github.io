# Портфолио eyeanton.github.io — карта проекта

Сверяйся с этой картой и правь точечно (Grep → Edit). Не перечитывай файлы целиком без нужды.
Статика без сборки, GitHub Pages с `main`. Работа: ветка → PR → слить самому (`gh pr merge --squash`) → проверить сайт curl'ом.

## Где что лежит
| Что | Файл |
|---|---|
| Тексты RU/EN, логотип `brand`, порядок/видимость блоков главной, навыки, soft skills, стек, опыт, контакты, `since`, `showCode`, пути CV | `site.json` (пользователь правит сам в админке → «Главная страница») |
| Проекты: тексты, обложки, ссылки, `home` (избранное), `visible`, порядок | `projects.json` (админка → «Проекты») |
| Отрисовка всех страниц, режим редактора `?edit` | `app.js` |
| Админка: вход Google→токен GitHub из Firebase, публикация, визуальный редактор главной (`window.siteEditor`) | `admin.js`, разметка/стили — `admin.html` |
| Токены цвета/типографики, кнопки, чипы, эффекты `.aurora` `.beams` `.wordmark` | `design-system.css` (система «Lighthouse»: ночной синий, кобальт, красный акцент) |
| Раскладка страниц (шапка, карточки, навыки `.area`, витрина `.show`, опыт `.exp`, контакты) | `style.css` |
| Витрина дизайн-системы | `design-system.html` |
| Страницы | `index.html` (блоки `data-block`), `projects.html`, `contact.html` |
| Резюме | `assets/cv-ru.pdf`, `assets/cv-en.pdf` |
| «Гость с CV»: курсор «Anton Egorov» раз за сеанс приносит иконку CV к курсору (только десктоп), задержка `profile.guestDelay` (сек, 0 — выкл; админка → Общие настройки) | `guest.js` (запуск из `app.js` после render), стили — конец `style.css` |
| Обложки проектов | `assets/shots/` |

## Ручные инструменты (вместо работы Claude)
- Превью ссылки: правка текста в `tools/og.html` → `powershell -File tools/og.ps1` → `assets/og.jpg`.
- Обложка проекта со скриншота сайта: `powershell -File tools/shot.ps1 -Url <адрес> -Name <id>` → `assets/shots/<id>.jpg`.
- Проверка без входа: `python -m http.server 8000` → http://localhost:8000/admin.html?local (публикация отключена).

## Решения пользователя
- Позиционирование: Anton Egorov, AI Creative Technologist; «в первую очередь дизайнер» — кнопки «Код» скрыты.
- Нельзя: звёздочки ✦ (выдают Claude), сетка на фоне, грязные размытые градиенты, анимация подарков на обложке.
- Переносы строк в текстах — `\n` в site.json (`white-space: pre-line`), в редакторе Shift+Enter.
