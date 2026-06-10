# Job Telegram Bot

## Install
npm install

## Run
node index.js

## Setup
Copy .env.example → .env and fill values.

### Як знайти значення для .env

| Змінна | Де взяти |
|--------|----------|
| `BOT_TOKEN` | Створи бота у [@BotFather](https://t.me/BotFather) → `/newbot` → скопіюй токен |
| `CHAT_ID` | Напиши боту [@userinfobot](https://t.me/userinfobot) → він пришле твій `Id` |
| `TG_API_ID` | Зайди на https://my.telegram.org/apps → створи додаток → скопіюй `App api_id` |
| `TG_API_HASH` | Там же, `App api_hash` |
| `TG_CHANNELS` | Список каналів через кому (без @), наприклад: `JOBITT_Ukraine,itexpert_vacancies` |
| `REMOTE_OK` | `true` — додатково парсити RemoteOK, `false` — тільки Telegram канали |

### Перший запуск
```bash
node index.js
```
Бот попросить:
1. Номер телефону (з кодом країни, наприклад `+380XXXXXXXXX`)
2. Код, який прийде в Telegram
3. Пароль 2FA (якщо увімкнено)

Після цього сесія збережеться, і бот буде запускатись автоматично.
