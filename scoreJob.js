import { roleKeywords, techKeywords, domainKeywords } from './keywords.js';

const JS_BONUS_RE = /\b(javascript|node|typescript|react|vue|angular)\b/i;
const LEARNING_TITLE_RE = /\b(course|webinar|workshop|bootcamp|tutorial|lesson|lessons)\b|курс|вебінар|воркшоп|лекці[яї]|навчан|вчит[ьи]|початківц|помилок|речей/i;
const TARGET_TITLE_RE = /\b(javascript|js|node(?:\.js)?|typescript|ts|react|vue|angular|frontend|front[-\s]?end|backend|back[-\s]?end|full[-\s]?stack|developer)\b|розробник[а-яіїєґ']*/iu;
const GENERIC_ENGINEER_RE = /\bsoftware\s+engineer\b|\bengineer\b|інженер[а-яіїєґ']*/iu;
const NEGATIVE_RE = /\b(junior|júnior|jãºnior|intern|internship|trainee)\b|стаж|стажування/i;
const RESUME_RE = /^(?:резюме|resume|cv)\b|от\s*@|ищу\s+работ[уы]|в\s+поиске|\$\d+\s*[-–—]\s*\d+\s*\/\s*ч/i;
const RUSSIA_RE = /москв|рос(?:і[яї]|си(?:я|йськ))|russia|moscow|рф\b|rf\b|proglib/i;
const STACK_PENALTIES = [
  ['java', /\bjava\b(?!\s*script)/i],
  ['kotlin', /\bkotlin\b/i],
  ['python', /python/i],
  ['ruby', /ruby/i],
  ['c++', /c\+\+/i],
  ['rust', /rust/i],
  ['php', /php/i],
  ['shopify', /shopify/i],
  ['wordpress', /wordpress/i],
  ['.net', /\.net/i],
  ['embedded/hardware', /embed(?:ded)?|hardware/i],
  ['devops', /devops/i],
  ['web3/blockchain', /\b(?:web3|blockchain|solidity)\b/i],
  ['react native', /\breact\s+native\b/i],
  ['reactjs', /\breactjs\b/i],
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asciiKeywordMatches(text, keyword) {
  const pattern = keyword
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+');
  return new RegExp(`(^|[^a-z0-9_])${pattern}($|[^a-z0-9_])`, 'i').test(text);
}

function keywordMatches(text, keyword) {
  if (/^[a-z0-9.+#/-]+(?:\s+[a-z0-9.+#/-]+)*$/i.test(keyword)) {
    return asciiKeywordMatches(text, keyword);
  }
  return text.includes(keyword);
}

function matchCount(text, keywords) {
  return keywords.filter(k => keywordMatches(text, k)).length;
}

function matchedKeywords(text, keywords) {
  return keywords.filter(k => keywordMatches(text, k));
}

function hasTargetTitle(titleText, fullText) {
  if (TARGET_TITLE_RE.test(titleText)) return true;
  return GENERIC_ENGINEER_RE.test(titleText) && JS_BONUS_RE.test(fullText);
}

export function explainScoreJob(job) {
  const titleText = job.title.toLowerCase();
  const fullText = (job.title + ' ' + job.description).toLowerCase();

  // Negative: junior/intern/trainee
  const negative = fullText.match(NEGATIVE_RE)?.[0];
  if (negative) return { score: -100, reason: `negative keyword: ${negative}` };
  if (RUSSIA_RE.test(fullText)) return { score: -100, reason: 'russia/moscow' };
  if (RESUME_RE.test(titleText) || RESUME_RE.test(fullText)) return { score: -100, reason: 'resume' };
  if (LEARNING_TITLE_RE.test(titleText)) return { score: -100, reason: 'learning content title' };

  // Penalty for other stacks / non-JS roles
  for (const [label, pattern] of STACK_PENALTIES) {
    if (pattern.test(fullText)) return { score: -100, reason: `other stack: ${label}` };
  }
  if (/\bgo\b(?!\s*lang)/i.test(fullText) && !fullText.includes('golang')) {
    return { score: -100, reason: 'other stack: go' };
  }
  if (/\breact\b(?!\s*native)/i.test(titleText)) {
    return { score: -100, reason: 'react' };
  }

  // Block LinkedIn links
  if (/linkedin\.com\//i.test(job.url || '') || /linkedin\.com\//i.test(fullText)) {
    return { score: -100, reason: 'linkedin link' };
  }

  // Block non-dev roles by title
  const nonDevTitle = /\b(smm|marketing|graphic designer|project manager|account manager|analyst|hr)\b/i;
  if (nonDevTitle.test(titleText) && !/(developer|engineer|розробник|інженер|architect|full.?stack|backend|frontend|devops)/i.test(titleText)) {
    return { score: -100, reason: 'non-dev title' };
  }

  let score =
    matchCount(fullText, roleKeywords) * 5 +
    matchCount(fullText, techKeywords) * 3 +
    matchCount(fullText, domainKeywords) * 2;

  // Must have a target role/stack in title to be a valid job.
  const titleRoles = matchedKeywords(titleText, roleKeywords);
  if (!hasTargetTitle(titleText, fullText)) {
    return { score: 0, reason: 'no target JS/backend/frontend role in title' };
  }

  // Bonus for JS/Node/TS/React in the title
  if (JS_BONUS_RE.test(titleText)) score += 15;

  const techMatches = matchedKeywords(fullText, techKeywords);
  const reason = [
    `title roles: ${titleRoles.slice(0, 4).join(', ')}`,
    techMatches.length ? `tech: ${techMatches.slice(0, 4).join(', ')}` : '',
  ].filter(Boolean).join('; ');

  return { score, reason };
}

export function scoreJob(job) {
  const { score } = explainScoreJob(job);
  return score;
}
