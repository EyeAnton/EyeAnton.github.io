# Virtual Gifts: зелёные видео и промпт (подставить на ASUS)

Кейс ждёт материалы для шагов 2 и 3. Пока их нет, в редакторе видны пустые рамки, на сайте этих звеньев нет.
История собрана на подарке `sep__sakura` (сакура: фаза 1 расцветает, фаза 2 лепестки опадают).

## Что найти

1. Кадр, с которого шла генерация (сейчас в шаге 2 стоит `k1.webp` из раскадровки: заменить, если исходный кадр другой).
2. Промпт.
3. Видео на зелёном фоне, кусок 1.
4. Видео на зелёном фоне, кусок 2.

На Mac их нет: в `~/Downloads/Portfolio` у подарков только готовый пакет (`movie-hevc.mp4`, `movie-webm.webm`, `sound.mp3`, `index.html`, png), 237 видео на Mac и Яндекс.Диске проверены на зелёный фон.

Где искать:
- рабочий файл Figma `Anton Egorov.fig` (из него взяты кадры, см. `gift-catalog/tools/figma/README.md`): на Mac его нет, в нём есть строки SOURCE, IDEA, DRAFTS, SELECTED, PREVIEW и могут быть видео;
- рабочие папки из `.sources.json`: `Dev_files/Tasks 2026/...` и `Project_files/2026/...`.

Поиск на Windows (PowerShell):

    Get-ChildItem $HOME, C:\AI, E:\ -Recurse -Include *sakura*.mp4, *sakura*.mov -ErrorAction SilentlyContinue | Select FullName, Length

Если у сакуры нет зелёных кусков, подойдёт другой подарок из `process.json`, у которого есть и кадры: тогда в шагах 1–4 заменить `sep__sakura` на его ключ.

## Как подставить

1. Сжать видео до 640 px и положить в репо **gift-catalog**: `assets/process/sep__sakura/green1.mp4`, `green2.mp4` (и закоммитить, это репо раздаёт медиа).
2. Админка → Страницы → Virtual Gifts → блок «Шаг 2» и «Шаг 3» → «Звенья»:
   - «Промпт»: вписать текст в поле «Текст»;
   - «Видео на зелёном фоне»: `/gift-catalog/assets/process/sep__sakura/green1.mp4`;
   - «Кусок 1» и «Кусок 2»: `green1.mp4` и `green2.mp4`, тот же путь.
3. «Опубликовать».
