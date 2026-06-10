import { scoreJob } from './scoreJob.js';

const MIN_SCORE = Number(process.env.MIN_SCORE) || 4;

function dedupKey(job) {
  const norm = job.title.toLowerCase().replace(/[^a-zа-яіїєґ'0-9\s]/g, '').trim();
  return job.url || norm;
}

export function filterJobs(jobs) {
  const seen = new Set();

  const result = jobs
    .filter(j => {
      const key = dedupKey(j);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(j => ({ ...j, score: scoreJob(j) }))
    .filter(j => j.score >= MIN_SCORE)
    .sort((a,b) => b.score - a.score);

  return result;
}
