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
    { connectionRetries: 5 },
  );
  return client;
}

export async function login(phoneNumber, onCode, onPassword) {
  await client.start({
    phoneNumber,
    phoneCode: onCode,
    password: onPassword,
    onError: (err) => console.error('login error:', err),
  });
  writeFileSync(SESSION_FILE, client.session.save());
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

export async function scanHistory(daysBack = 7) {
  const allJobs = [];
  const since = Math.floor(Date.now() / 1000) - daysBack * 24 * 3600;

  for (const ch of CHANNELS) {
    try {
      const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username: ch }));
      const channel = resolved.chats?.find(c => c.className === 'Channel');
      if (!channel) { console.error(`cannot resolve ${ch}: no channel`); continue; }

      const peer = new Api.InputPeerChannel({
        channelId: channel.id,
        accessHash: channel.accessHash,
      });

      const result = await client.invoke(new Api.messages.GetHistory({ peer, limit: 100 }));
      const msgs = result.messages || [];
      let matched = 0;

      for (const msg of msgs) {
        if (msg._ === 'message' && msg.message && msg.date >= since) {
          const job = parseJob(msg);
          if (job) { allJobs.push(job); matched++; }
        }
      }
      console.log(`scanned ${ch}: ${msgs.length} msgs, ${matched} parsed`);
    } catch (e) {
      console.error(`failed to scan ${ch}:`, e.errorMessage || e.message);
    }
  }

  return allJobs;
}

// ── job parsing ──

const JOB_INDICATORS = [
  /(?:looking for|шукаємо|потрібен|потрібна|потрібно|вакансі[яї]|відкрит[ао]|позиці[яї]|приєднуйся)/i,
  /#(?:vacancy|вакансія|remote|office|job|робота|роботу|вакансію)/i,
  /(?:відгукнутися|apply|надіслати|резюме)/i,
];

function isJobPost(text) {
  const hasContact = /@[a-zA-Z0-9_.-]{3,}/.test(text) || /https?:\/\/[^\s]+/.test(text);
  const hasIndicator = JOB_INDICATORS.some(r => r.test(text));
  return hasContact && hasIndicator;
}

function extractTitle(text) {
  const firstLine = text.split('\n')[0];
  if (!firstLine) return null;

  let clean = firstLine
    .replace(/[*#⃣▪️▫️☑️🔹🔸🔺🔥💼📌📍💻⚡✅🟢🔵🟣🔘]/g, '')
    .replace(/^(?:\s*#\w+\s*)+/, '')
    .trim();

  if (!clean || clean.length < 3 || clean.length > 120) return null;

  const structured = [
    /(?:looking for|шукаємо|потрібен|потрібна|потрібно|вакансі[яї])[:\s─]*([A-Za-zА-Яа-яіїєґІЇЄҐ][^▪📌🔥\n]{3,80})/i,
  ];

  for (const p of structured) {
    const m = clean.match(p);
    if (m && m[1]) {
      const t = m[1].replace(/\s+/g, ' ').trim();
      if (t.length >= 3 && t.length <= 80) return t;
    }
  }

  if (/develop|engineer|розробник|інженер|architect|manager|lead|senior|specialist|designer|analyst|devops|admin/i.test(clean) && clean.length < 60) {
    return clean.replace(/^[^a-zA-Zа-яА-ЯіїєґІЇЄҐ]+/, '').trim();
  }

  return null;
}

function extractLink(text) {
  const urlMatch = text.match(/https?:\/\/[^\s\n]+/);
  if (urlMatch) return urlMatch[0];

  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.+-]+/);
  if (emailMatch) return `mailto:${emailMatch[0]}`;

  const tgMatch = text.match(/@[a-zA-Z0-9_.-]{3,}/);
  if (tgMatch) return `https://t.me/${tgMatch[0].slice(1)}`;

  return '';
}

function parseJob(msg) {
  const text = msg.message;
  if (!isJobPost(text)) return null;

  const title = extractTitle(text);
  if (!title) return null;

  return {
    title,
    description: text,
    url: extractLink(text),
    company: '',
    location: 'Ukraine',
  };
}

export function getChannels() { return CHANNELS; }
