import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions/index.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const SESSION_FILE = 'tg_session.txt';
const CHANNELS = (process.env.TG_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);

let client = null;

export function isLoggedIn() {
  return existsSync(SESSION_FILE);
}

export async function createClient() {
  const sessionStr = isLoggedIn() ? readFileSync(SESSION_FILE, 'utf-8').trim() : '';
  client = new TelegramClient(
    new StringSession(sessionStr),
    Number(process.env.TG_API_ID),
    process.env.TG_API_HASH,
    { connectionRetries: 5 }
  );
  return client;
}

export async function login(phoneNumber, onCode) {
  await client.start({
    phoneNumber,
    phoneCode: onCode,
    onError: (err) => console.error('login error:', err),
  });
  writeFileSync(SESSION_FILE, client.session.save());
  console.log('session saved');
}

export async function connectWithSession() {
  await client.start();
}

export async function joinChannels() {
  for (const ch of CHANNELS) {
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: ch }));
      console.log('joined', ch);
    } catch (e) {
      if (e.errorMessage !== 'CHANNELS_TOO_MUCH') {
        console.error('failed to join', ch, e.errorMessage || e.message);
      }
    }
  }
}

export function onMessage(handler) {
  client.addEventHandler((update) => {
    if (update._ !== 'updateNewMessage' && update._ !== 'updateNewChannelMessage') return;
    const msg = update.message;
    if (!msg || !msg.message) return;

    const job = parseJob(msg);
    if (job) handler(job);
  });
}

function parseJob(msg) {
  const text = msg.message;
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return null;

  let title = lines[0].replace(/[*#⃣🔹🔸🔺🔥💼📌📍💻⚡✅🟢🔵🟣]/g, '').trim();
  if (!title || title.length > 200) return null;

  return {
    title,
    description: text,
    url: extractUrl(text),
    company: '',
    location: 'Ukraine',
  };
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s\n]+/);
  return match ? match[0] : '';
}

export function getChannels() {
  return CHANNELS;
}
