import { scoreJob } from './scoreJob.js';

const MIN_SCORE = Number(process.env.MIN_SCORE) || 4;

function normTitle(job) {
  return job.title.toLowerCase().replace(/[^a-zа-яіїєґ'0-9\s]/g, '').trim();
}

export function filterJobs(jobs) {
  const seenUrl = new Set();
  const seenTitle = new Set();

  const result = jobs
    .filter(j => {
      const titleKey = normTitle(j);
      if (seenTitle.has(titleKey)) return false;
      seenTitle.add(titleKey);
      if (j.url) {
        if (seenUrl.has(j.url)) return false;
        seenUrl.add(j.url);
      }
      return true;
    })
    .map(j => ({ ...j, score: scoreJob(j) }))
    .filter(j => j.score >= MIN_SCORE)
    .sort((a,b) => b.score - a.score);

  return result;
}
