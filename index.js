import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import readline from 'readline';
import { fetchJobs } from './fetchJobs.js';
import { filterJobs } from './filterJobs.js';
import {
  createClient, isLoggedIn, login, connectWithSession,
  joinChannels, onMessage, scanHistory, getChannels, resolveChannel, getClient,
} from './tgListener.js';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHAT_ID = process.env.CHAT_ID;
const USE_REMOTE_OK = process.env.REMOTE_OK !== 'false';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(resolve => rl.question(q, resolve)); }

// ── helpers ──

async function sendJob(job) {
  const link = job.url || '';
  const msg = `${job.title}\n${link}`;
  await bot.sendMessage(CHAT_ID, msg, { disable_web_page_preview: true });
}

async function tell(msg) {
  try { await bot.sendMessage(CHAT_ID, msg); } catch {}
}

// ── commands ──

bot.setMyCommands([
  { command: 'start', description: 'Інфо про бота' },
  { command: 'now', description: 'Примусово перевірити вакансії зараз' },
  { command: 'channels', description: 'Список каналів' },
  { command: 'status', description: 'Статус бота' },
  { command: 'raw', description: 'Показати сирі повідомлення (діагностика)' },
]);

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `🤖 JobFilterUABot

Шукаю IT вакансії в Telegram-каналах і надсилаю тобі підходящі.

Команди:
/now — перевірити прямо зараз
/channels — список каналів
/status — стан бота`, { parse_mode: 'Markdown' });
});

bot.onText(/\/channels/, async (msg) => {
  const channels = getChannels();
  const list = channels.map(c => `• @${c}`).join('\n');
  await bot.sendMessage(msg.chat.id, `📡 Канали:\n${list}`);
});

bot.onText(/\/status/, async (msg) => {
  const s = isLoggedIn() ? '✅ Увійшов' : '❌ Не авторизований';
  await bot.sendMessage(msg.chat.id, `🤖 Статус: працюю\n${s}`);
});

bot.onText(/\/raw/, async (msg) => {
  const { Api } = await import('teleproto');
  const client = getClient();
  if (!client) { await bot.sendMessage(msg.chat.id, '❌ Клієнт не готовий'); return; }

  await bot.sendMessage(msg.chat.id, '👀 Беру перші повідомлення...');
  try {
    const ch = getChannels()[0];
    const peer = await resolveChannel(ch);
    if (!peer) { await bot.sendMessage(msg.chat.id, `❌ Не вдалось резолвнути ${ch}`); return; }

    const hist = await client.invoke(new Api.messages.GetHistory({ peer, limit: 3 }));
    const msgs = hist.messages || [];

    if (!msgs.length) { await bot.sendMessage(msg.chat.id, '❌ Немає повідомлень'); return; }

    for (const m of msgs) {
      if (m._ === 'message' && m.message) {
        await bot.sendMessage(msg.chat.id, `📄 ${ch}:\n\n${m.message.slice(0, 300)}`);
      }
    }
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `❌ Помилка: ${e.errorMessage || e.message || e}`);
  }
});

bot.onText(/\/now/, async (msg) => {
  await bot.sendMessage(msg.chat.id, '🔍 Сканую...');
  try {
    const jobs = await scanHistory(1);
    if (!jobs.length) {
      await bot.sendMessage(msg.chat.id, '😕 Нічого не знайдено (0 повідомлень розпарсено). Перевір логи в консолі.');
      return;
    }
    const filtered = filterJobs(jobs);
    if (!filtered.length) {
      await bot.sendMessage(msg.chat.id, `😕 Жодна вакансія не пройшла фільтр (розпарсено ${jobs.length} повідомлень).`);
      return;
    }
    for (const job of filtered) {
      try { await sendJob(job); } catch {}
    }
    await bot.sendMessage(msg.chat.id, `✅ Надіслав ${filtered.length} вакансій`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `❌ Помилка: ${e.message}`);
  }
});

// ── TG client ──

async function initTG() {
  console.log('init tg...');
  await createClient();

  if (isLoggedIn()) {
    await connectWithSession();
  } else {
    const phone = await ask('phone (+380...): ');
    await login(
      phone,
      async () => await ask('code: '),
      async () => await ask('2FA password: '),
    );
  }

  console.log('joining channels...');
  await joinChannels();
  await tell(`🤖 Бот запущено

Канали: ${getChannels().length}
Скануватиму за останній тиждень...`);

  const historyJobs = await scanHistory(7);
  const filtered = filterJobs(historyJobs);
  console.log(`history: ${historyJobs.length} parsed, ${filtered.length} matched`);
  await tell(`📊 Сканування: ${historyJobs.length} повідомлень, знайдено ${filtered.length} вакансій`);

  for (const job of filtered) {
    try { await sendJob(job); } catch (e) { console.error('send failed:', job.title, e.message); }
  }

  onMessage(async (job) => {
    const out = filterJobs([job]);
    if (out.length) {
      try { await sendJob(out[0]); } catch {}
    }
  });
}

async function runRemoteOK() {
  try {
    const jobs = await fetchJobs();
    const filtered = filterJobs(jobs);
    console.log(`remoteok: ${jobs.length} jobs, ${filtered.length} matched`);
    for (const job of filtered) {
      try { await sendJob(job); } catch {}
    }
  } catch (e) { console.error('remoteok failed:', e.message); }
}

// ── main ──

async function main() {
  try {
    await initTG();
  } catch (e) {
    console.error('tg init failed:', e.message);
    await tell(`❌ Помилка TG: ${e.message}`).catch(() => {});
  }

  if (USE_REMOTE_OK) {
    setInterval(runRemoteOK, 1000 * 60 * 10);
    runRemoteOK();
  }

  rl.close();
  console.log('bot started');
}

main();
