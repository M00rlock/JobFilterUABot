import { roleKeywords, techKeywords, domainKeywords, negativeKeywords } from './keywords.js';

const REQUIRED = [
  'javascript', 'js', 'node', 'nodejs', 'typescript', 'ts',
  'react', 'reactjs', 'vue', 'vuejs', 'angular',
];

function matchCount(text, keywords) {
  return keywords.filter(k => text.includes(k)).length;
}

export function scoreJob(job) {
  const titleText = job.title.toLowerCase();
  const fullText = (job.title + ' ' + job.description).toLowerCase();

  // Required: title must mention JS/Node/TS/React/Vue/Angular
  if (!REQUIRED.some(k => titleText.includes(k))) return 0;

  // Negative: junior/intern/trainee
  if (negativeKeywords.some(k => fullText.includes(k))) return -100;

  // Penalty for other stacks
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
