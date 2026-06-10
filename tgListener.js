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

export async function scanHistory(daysBack = 14, limit = 500) {
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
          if (job) {
            console.log(`  parsed [${ch}]: ${job.title}`);
            allJobs.push(job);
            matched++;
          }
        }
      }
      console.log(`  scanned ${ch}: ${msgs.length} msgs, ${matched} parsed`);
    } catch (e) {
      console.error(`failed to scan ${ch}:`, e.errorMessage || e.message);
    }
  }

  return allJobs;
}

// ── job parsing ──

const JOB_INDICATORS = [
  /(?:looking for|шукаємо|потрібен|потрібна|потрібно|вакансі[яї]|відкрит[ао]|позиці[яї]|приєднуйся|we are hiring|we need|we are looking)/i,
  /#(?:vacancy|вакансія|remote|office|job|робота|роботу|вакансію)/i,
  /(?:відгукнутися|apply|надіслати|резюме)/i,
];

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B50}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{200D}\u{FE0F}]/gu;
const JS_TECH_RE = /\b(javascript|js|node(?:\.js)?|typescript|ts|react|vue|angular)\b/i;
const ROLE_WORD_RE = /(?:\b(developers?|engineers?|architects?|backends?|frontends?|front[-\s]?ends?|full[-\s]?stacks?|devops|managers?|seniors?|leads?|designers?|specialists?|admins?|software|data|qa|testers?|analysts?|products?|heads?|directors?|technical|systems?|teams?|engineering|middles?|trainees?|interns?|juniors?|graphic|smm|digital)\b|розробник[а-яіїєґ']*|інженер[а-яіїєґ']*|архітектор[а-яіїєґ']*)/iu;

function isJobPost(text) {
  const hasContact = /@[a-zA-Z0-9_.-]{3,}/.test(text) || /https?:\/\/[^\s]+/.test(text);
  const hasIndicator = JOB_INDICATORS.some(r => r.test(text));
  const firstLine = text.split('\n')[0];
  const cleanFirst = firstLine.replace(EMOJI_RE, '').replace(/[*#⃣▪️▫️☑️🔹🔸🔺🔥💼📌📍💻⚡✅🟢🔵🟣🔘👉]/g, '').trim();
  const looksLikeDev = ROLE_WORD_RE.test(cleanFirst) || ROLE_WORD_RE.test(firstLine);
  const hasJS = JS_TECH_RE.test(text);

  // Any of the strict paths
  if (hasIndicator && looksLikeDev) return true;
  if (hasIndicator && hasContact) return true;
  if (hasContact && (looksLikeDev || hasJS)) return true;

  // Permissive: first line has a dev role + message is long enough to be a real post
  if (looksLikeDev && text.length > 80) return true;

  return false;
}

function stripEmoji(s) {
  return s.replace(EMOJI_RE, '').replace(/[*#⃣▪️▫️☑️🔹🔸🔺🔥💼📌📍💻⚡✅🟢🔵🟣🔘👉]/g, '').trim();
}

// Titles that start with these are not real job titles
const NON_TITLE_RE = /^(мінімум|до|від|для|про|та|але|це|хто|що|як|my|this|we|our|the|a\b|an\b)/i;
const NEWS_VERBS = /(створив|створила|випустив|запустив|представив|анонсував|повідомив|розповів|опублікував|вийшло|вийшла)/i;
const TITLE_FIRST_WORD = /^(senior|middle|lead|junior|head|chief|full|frontend|front-end|backend|devops|software|data|tech|technical|javascript|node(?:\.js)?|typescript|react|vue|angular|розробник|інженер|архітектор|specialist|manager|engineer|developer|architect|director|systems|system|embedded|hardware|python|java|go|rust|c\+\+|ruby|qa|tester|analyst|product|project|team|engineering|strong|middle\+|trainee|intern|graphic|smm|digital)/i;

function extractTitle(text) {
  const firstLine = text.split('\n')[0];
  if (!firstLine) return null;

  // Method 1: indicator prefix
  const indicator = firstLine.match(/(?:looking for|we are looking(?:\s+for)?|we need|we are hiring|шукаємо|потрібен|потрібна|потрібно|вакансі[яї]|відкрит[ао](?:\s+позиці[яї])?|позиці[яї])[:\s─–—]*/i);
  if (indicator) {
    const after = firstLine.slice(indicator.index + indicator[0].length);
    const title = stripEmoji(after).split(/\s+/).slice(0, 12).join(' ');
    if (title && title.length >= 3 && title.length <= 80 && !NON_TITLE_RE.test(title) && !NEWS_VERBS.test(title)) {
      if (ROLE_WORD_RE.test(title)) return title;
    }
  }

  // Method 2: first line looks like a dev/tech role
  const clean = stripEmoji(firstLine);
  if (!clean || clean.length < 3 || clean.length > 80) return null;
  if (NON_TITLE_RE.test(clean) || NEWS_VERBS.test(clean)) return null;

  const firstWord = clean.split(/\s+/)[0];
  if (TITLE_FIRST_WORD.test(firstWord)) {
    return clean;
  }

  // Method 3: explicit JS keyword (word boundary) in full text — accept first line
  if (JS_TECH_RE.test(text)) {
    if (!NON_TITLE_RE.test(clean) && !NEWS_VERBS.test(clean) && ROLE_WORD_RE.test(clean)) return clean;
  }

  return null;
}

function extractLink(text, ch, msgId) {
  const url = text.match(/https?:\/\/[^\s\n]+/);
  if (url) return url[0];

  if (ch && msgId) return `https://t.me/${ch}/${msgId}`;

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.+-]+/);
  if (email) return `mailto:${email[0]}`;

  const tg = text.match(/@[a-zA-Z0-9_.-]{3,}/);
  if (tg) return `https://t.me/${tg[0].slice(1)}`;

  return '';
}

export function parseJob(msg, ch) {
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
    channel: ch,
  };
}

export function getClient() { return client; }
export function getChannels() { return CHANNELS; }
