import { roleKeywords, techKeywords, domainKeywords, negativeKeywords } from './keywords.js';

const REQ_TITLE = [
  'javascript', 'node', 'nodejs', 'typescript',
  'react', 'reactjs', 'vue', 'vuejs', 'angular',
  'frontend', 'fullstack', 'full stack',
];

const DEV_TITLE_RE = /(developer|engineer|розробник|інженер|backend|frontend|fullstack|devops|architect|admin|specialist|designer|програміст)/i;

const REQ_SHORT = [/\bjs\b/i, /\bts\b/i];

// Tech keywords only — not including general role words
const JS_TECH = [
  'javascript', 'node', 'nodejs', 'typescript',
  'react', 'reactjs', 'vue', 'vuejs', 'angular',
  'nextjs', 'express', 'nest',
];

function matchCount(text, keywords) {
  return keywords.filter(k => text.includes(k)).length;
}

function hasRequired(titleText, fullText) {
  // Title directly mentions JS/TS/Node/React/frontend/fullstack
  if (REQ_TITLE.some(k => titleText.includes(k))) return true;
  if (REQ_SHORT.some(r => r.test(titleText))) return true;

  // Fallback: title looks like dev role AND full text mentions JS tech
  if (DEV_TITLE_RE.test(titleText)) {
    if (JS_TECH.some(k => fullText.includes(k))) return true;
    if (REQ_SHORT.some(r => r.test(fullText))) return true;
  }

  return false;
}

export function scoreJob(job) {
  const titleText = job.title.toLowerCase();
  const fullText = (job.title + ' ' + job.description).toLowerCase();

  if (!hasRequired(titleText, fullText)) return 0;

  // Negative: junior/intern/trainee
  if (negativeKeywords.some(k => fullText.includes(k))) return -100;

  // Penalty for other stacks (in full text)
  if (/\bjava\b(?!\s*script)/i.test(fullText)) return -100;
  if (fullText.includes('python')) return -100;
  if (fullText.includes('ruby')) return -100;
  if (fullText.includes('c++')) return -100;
  if (fullText.includes('rust')) return -100;
  if (fullText.includes('php')) return -100;
  if (fullText.includes('shopify')) return -100;
  if (fullText.includes('wordpress')) return -100;
  if (fullText.includes('.net')) return -100;
  if (/\bgo\b(?!\s*lang)/i.test(fullText) && !fullText.includes('golang')) return -100;

  return (
    matchCount(fullText, roleKeywords) * 5 +
    matchCount(fullText, techKeywords) * 3 +
    matchCount(fullText, domainKeywords) * 2
  );
}
