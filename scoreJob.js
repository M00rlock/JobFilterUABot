import { roleKeywords, techKeywords, domainKeywords, negativeKeywords } from './keywords.js';

const REQUIRED = [
  'javascript', 'js', 'node', 'nodejs', 'typescript', 'ts',
  'react', 'reactjs', 'vue', 'vuejs', 'angular',
];

function matchCount(text, keywords) {
  return keywords.filter(k => text.includes(k)).length;
}

export function scoreJob(job) {
  const text = (job.title + ' ' + job.description).toLowerCase();

  // Must mention JS/Node/TS
  if (!REQUIRED.some(k => text.includes(k))) return 0;

  // Negative: junior/intern/trainee
  if (negativeKeywords.some(k => text.includes(k))) return -100;

  // Penalty for other stacks
  if (/\bjava\b(?!\s*script)/i.test(text)) return -100;
  if (text.includes('python')) return -100;
  if (text.includes('ruby')) return -100;
  if (text.includes('c++')) return -100;
  if (text.includes('rust')) return -100;
  if (text.includes('php')) return -100;
  if (text.includes('shopify')) return -100;
  if (text.includes('wordpress')) return -100;
  if (text.includes('.net')) return -100;
  if (/\bgo\b(?!\s*lang)/i.test(text) && !text.includes('golang')) return -100;

  return (
    matchCount(text, roleKeywords) * 5 +
    matchCount(text, techKeywords) * 3 +
    matchCount(text, domainKeywords) * 2
  );
}
