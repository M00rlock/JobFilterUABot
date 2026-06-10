import { scoreJob } from './scoreJob.js';

const MIN_SCORE = Number(process.env.MIN_SCORE) || 4;

export function filterJobs(jobs) {
  const seen = new Set();

  const result = jobs
    .filter(j => {
      const key = j.url || j.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(j => ({ ...j, score: scoreJob(j) }))
    .filter(j => j.score >= MIN_SCORE)
    .sort((a,b) => b.score - a.score);

  return result;
}
