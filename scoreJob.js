import { roleKeywords, techKeywords, domainKeywords, negativeKeywords } from './keywords.js';

const JS_BONUS_RE = /\b(javascript|node|typescript|react|vue|angular)\b/i;

function matchCount(text, keywords) {
  return keywords.filter(k => text.includes(k)).length;
}

export function scoreJob(job) {
  const titleText = job.title.toLowerCase();
  const fullText = (job.title + ' ' + job.description).toLowerCase();

  // Negative: junior/intern/trainee
  if (negativeKeywords.some(k => fullText.includes(k))) return -100;

  // Penalty for other stacks / non-JS roles
  const penalties = [
    /\bjava\b(?!\s*script)/i, /python/i, /ruby/i, /c\+\+/i, /rust/i,
    /php/i, /shopify/i, /wordpress/i, /\.net/i,
    /embed(?:ded)?/i, /hardware/i, /devops/i,
  ];
  for (const p of penalties) {
    if (p.test(fullText)) return -100;
  }
  if (/\bgo\b(?!\s*lang)/i.test(fullText) && !fullText.includes('golang')) return -100;

  let score =
    matchCount(fullText, roleKeywords) * 5 +
    matchCount(fullText, techKeywords) * 3 +
    matchCount(fullText, domainKeywords) * 2;

  // Bonus for JS/Node/TS/React in the title
  if (JS_BONUS_RE.test(titleText)) score += 15;

  return score;
}
