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
      const peer = await resolveChannel(ch);
      if (!peer) { console.error(`cannot resolve ${ch}`); continue; }

      const result = await client.invoke(new Api.messages.GetHistory({ peer, limit: 100 }));
      const msgs = result.messages || [];
      let matched = 0;

      for (const msg of msgs) {
        if (msg._ === 'message' && msg.message && msg.date >= since) {
          if (!matched && allJobs.length === 0) {
            const firstText = msg.message.slice(0, 200);
            const j = isJobPost(firstText);
            const t = extractTitle(firstText);
            console.log(`[debug ${ch}] isJob=${j} title=${t}`);
            console.log(`[debug ${ch}] text="${firstText.replace(/\n/g, '\\n')}"`);
          }
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
  if (hasIndicator && hasContact) return true;
  if (hasIndicator && /(?:senior|lead|developer|engineer|розробник|architect|manager|devops|backend|frontend|fullstack|data)/i.test(text)) return true;
  return false;
}

function extractTitle(text) {
  const firstLine = text.split('\n')[0];
  if (!firstLine) return null;

  const indicator = firstLine.match(/(?:looking for|шукаємо|потрібен|потрібна|потрібно|вакансі[яї])[:\s─–—]*/i);
  if (indicator) {
    const after = firstLine.slice(indicator.index + indicator[0].length);
    const title = after.replace(/[@#▪📌🔥👉☑️🔘]/g, '').trim().split(/\s+/).slice(0, 12).join(' ');
    if (title && title.length >= 3 && title.length <= 80) return title;
  }

  const roleMatch = firstLine.match(/(senior|lead|middle)\s+[A-Za-zА-Яа-яіїєґІЇЄҐ][A-Za-zА-Яа-яіїєґІЇЄҐ\s().,-]{3,60}/i);
  if (roleMatch) return roleMatch[0].trim();

  const clean = firstLine
    .replace(/[@#*▪📌🔥👉☑️🔘]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean && /(?:developer|engineer|розробник|інженер|architect|manager|analyst|devops|admin|backend|frontend|fullstack|specialist|designer)/i.test(clean) && clean.length >= 3 && clean.length <= 80) {
    return clean.split(/[▪📌🔥👉]/)[0].trim();
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

export async function resolveChannel(username) {
  try {
    const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
    const channel = resolved.chats?.find(c => c.className === 'Channel');
    if (!channel) return null;
    return new Api.InputPeerChannel({ channelId: channel.id, accessHash: channel.accessHash });
  } catch { return null; }
}

export function getClient() { return client; }
export function getChannels() { return CHANNELS; }
