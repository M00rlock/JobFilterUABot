import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { fetchJobs } from './fetchJobs.js';
import { filterJobs } from './filterJobs.js';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const CHAT_ID = process.env.CHAT_ID;

async function sendJob(job) {
  const msg = `
🔥 ${job.title}

📊 Score: ${job.score}

📍 ${job.location || 'Remote/Unknown'}

🔗 ${job.url}
`;
  await bot.sendMessage(CHAT_ID, msg);
}

async function run() {
  try {
    const jobs = await fetchJobs();
    const filtered = filterJobs(jobs);
    console.log(`found ${jobs.length} jobs, filtered ${filtered.length}`);
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

setInterval(run, 1000 * 60 * 10);
console.log('bot started, will check every 10 min');
run();
