import { roleKeywords, techKeywords, infraKeywords, domainKeywords, negativeKeywords } from './keywords.js';

function matchCount(text, keywords) {
  return keywords.filter(k => text.includes(k)).length;
}

export function scoreJob(job) {
  const text = (job.title + ' ' + job.description).toLowerCase();

  if (negativeKeywords.some(k => text.includes(k))) return -100;

  return (
    matchCount(text, roleKeywords) * 5 +
    matchCount(text, techKeywords) * 3 +
    matchCount(text, infraKeywords) * 3 +
    matchCount(text, domainKeywords) * 2
  );
}
