import { scoreJob } from './scoreJob.js';

export function filterJobs(jobs) {
  const seen = new Set();

  return jobs
    .filter(j => {
      const key = j.url || j.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(j => ({ ...j, score: scoreJob(j) }))
    .filter(j => j.score >= 6)
    .sort((a,b) => b.score - a.score);
}
