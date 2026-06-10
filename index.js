import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import readline from 'readline';
import { fetchJobs } from './fetchJobs.js';
import { filterJobs } from './filterJobs.js';
import { createClient, isLoggedIn, login, connectWithSession, joinChannels, onMessage } from './tgListener.js';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHAT_ID = process.env.CHAT_ID;
const USE_REMOTE_OK = process.env.REMOTE_OK !== 'false';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

async function sendJob(job) {
  const msg = `
🔥 ${job.title}

📊 Score: ${job.score}

📍 ${job.location || 'Remote/Unknown'}

🔗 ${job.url}
`;
  await bot.sendMessage(CHAT_ID, msg);
}

async function initTG() {
  console.log('initializing telegram client...');
  await createClient();

  if (isLoggedIn()) {
    await connectWithSession();
  } else {
    const phone = await ask('phone (e.g. +380...): ');
    await login(
      phone,
      async () => await ask('code from telegram: '),
      async () => await ask('2FA password: ')
    );
  }

  await joinChannels();
  console.log('watching:', process.env.TG_CHANNELS);

  onMessage(async (job) => {
    const filtered = filterJobs([job]);
    if (filtered.length) {
      try {
        await sendJob(filtered[0]);
        console.log('sent from tg:', filtered[0].title);
      } catch (e) {
        console.error('send failed from tg:', filtered[0].title, e.message);
      }
    }
  });
}

async function main() {
  try {
    await initTG();
  } catch (e) {
    console.error('tg init failed (channels will be skipped):', e.message);
  }

  if (USE_REMOTE_OK) {
    async function runRemoteOK() {
      try {
        const jobs = await fetchJobs();
        const filtered = filterJobs(jobs);
        console.log(`remoteok: ${jobs.length} jobs, filtered ${filtered.length}`);
        for (const job of filtered) {
          try {
            await sendJob(job);
            console.log('sent:', job.title);
          } catch (e) {
            console.error('send failed', job.title, e.message);
          }
        }
      } catch (e) {
        console.error('run failed', e.message);
      }
    }
    setInterval(runRemoteOK, 1000 * 60 * 10);
    runRemoteOK();
  }

  rl.close();
  console.log('bot started');
}

main();
