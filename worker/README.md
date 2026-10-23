# portfolio-bot — сообщения из чата сайта в Telegram

Чат на сайте (`chat.js`) шлёт отзывы и вопросы сюда → бот пишет их Антону в Telegram.

## Запуск (один раз)
1. В Telegram: @BotFather → `/newbot` → получить токен. Написать новому боту `/start`.
2. Узнать свой chat id: открыть `https://api.telegram.org/bot<ТОКЕН>/getUpdates` → `"chat":{"id": …}`.
3. Здесь, в `worker/`:
   ```
   npx wrangler secret put TG_TOKEN
   npx wrangler secret put TG_CHAT_ID
   npx wrangler deploy
   ```
4. Адрес из вывода (`https://portfolio-bot.<аккаунт>.workers.dev`) вписать в `site.json` → `profile.chat.endpoint`.

Пока `endpoint` пустой, чат открывает письмо на почту с готовым текстом.

## Защита от спама
Только с `ALLOWED_ORIGINS`, скрытое поле-ловушка, отказ если ответили быстрее 3 с, лимит длины.
Лимит по IP: создать KV `RL` (см. wrangler.toml), `PER_IP_HOUR` — сообщений в час.
