import { TelegramClient, Api } from 'teleproto';
import { StringSession } from 'teleproto/sessions/index.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const SESSION_FILE = 'tg_session.txt';
const CHANNELS = (process.env.TG_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);

let client = null;

export function isLoggedIn() { return existsSync(SESSION_FILE); }

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
    phoneNumber, phoneCode: onCode, password: onPassword,
    onError: (err) => console.error('login error:', err),
  });
  writeFileSync(SESSION_FILE, client.session.save());
}

export async function connectWithSession() { await client.start(); }

export async function joinChannels() {
  for (const ch of CHANNELS) {
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: ch }));
    } catch (e) {
      if (e.errorMessage !== 'CHANNELS_TOO_MUCH') console.error('failed to join', ch, e.errorMessage || e.message);
    }
  }
}

export function onMessage(handler) {
  client.addEventHandler((update) => {
    if (update.className !== 'UpdateNewMessage' && update.className !== 'UpdateNewChannelMessage') return;
    const msg = update.message;
    if (!msg || !msg.message) return;
    const job = parseJob(msg);
    if (job) handler(job);
  });
}

export async function resolveChannel(username) {
  try {
    const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
    const channel = resolved.chats?.find(c => c.className === 'Channel');
    if (!channel) return null;
    return new Api.InputPeerChannel({ channelId: channel.id, accessHash: channel.accessHash });
  } catch { return null; }
}

export async function scanHistory(daysBack = 7, limit = 200) {
  const allJobs = [];
  const since = Math.floor(Date.now() / 1000) - daysBack * 24 * 3600;

  for (const ch of CHANNELS) {
    try {
      const peer = await resolveChannel(ch);
      if (!peer) { console.error(`cannot resolve ${ch}`); continue; }

      const result = await client.invoke(new Api.messages.GetHistory({ peer, limit }));
      const msgs = result.messages || [];
      let matched = 0;

      for (const msg of msgs) {
        if (msg.message && msg.date && typeof msg.message === 'string' && msg.date >= since) {
          const job = parseJob(msg, ch);
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

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B50}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{200D}\u{FE0F}]/gu;

function isJobPost(text) {
  const hasContact = /@[a-zA-Z0-9_.-]{3,}/.test(text) || /https?:\/\/[^\s]+/.test(text);
  const hasIndicator = JOB_INDICATORS.some(r => r.test(text));
  if (hasIndicator && hasContact) return true;
  if (hasIndicator && /(?:senior|lead|developer|engineer|розробник|architect|manager|devops|backend|frontend|fullstack|data)/i.test(text)) return true;
  return false;
}

function stripEmoji(s) {
  return s.replace(EMOJI_RE, '').replace(/[*#⃣▪️▫️☑️🔹🔸🔺🔥💼📌📍💻⚡✅🟢🔵🟣🔘👉]/g, '').trim();
}

function extractTitle(text) {
  const firstLine = text.split('\n')[0];
  if (!firstLine) return null;

  const indicator = firstLine.match(/(?:looking for|шукаємо|потрібен|потрібна|потрібно|вакансі[яї])[:\s─–—]*/i);
  if (indicator) {
    const after = firstLine.slice(indicator.index + indicator[0].length);
    const title = stripEmoji(after).split(/\s+/).slice(0, 12).join(' ');
    if (title && title.length >= 3 && title.length <= 80) return title;
  }

  const clean = stripEmoji(firstLine);
  if (!clean || clean.length < 3 || clean.length > 80) return null;

  if (/(?:developer|engineer|розробник|інженер|architect|manager|analyst|devops|admin|backend|frontend|fullstack|specialist|designer|lead|senior)/i.test(clean)) {
    return clean;
  }

  return null;
}

function extractLink(text, ch, msgId) {
  const url = text.match(/https?:\/\/[^\s\n]+/);
  if (url) return url[0];

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.+-]+/);
  if (email) return `mailto:${email[0]}`;

  const tg = text.match(/@[a-zA-Z0-9_.-]{3,}/);
  if (tg) return `https://t.me/${tg[0].slice(1)}`;

  if (ch && msgId) return `https://t.me/${ch}/${msgId}`;

  return '';
}

function parseJob(msg, ch) {
  const text = msg.message;
  if (!isJobPost(text)) return null;

  const title = extractTitle(text);
  if (!title) return null;

  return {
    title,
    description: text,
    url: extractLink(text, ch || '', msg.id),
    company: '',
    location: 'Ukraine',
  };
}

export function getClient() { return client; }
export function getChannels() { return CHANNELS; }
