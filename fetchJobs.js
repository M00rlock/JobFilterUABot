export async function fetchJobs() {
  const res = await fetch('https://remoteok.com/api');
  const data = await res.json();

  return data.slice(1).map(j => ({
    title: j.position,
    description: j.description || '',
    url: j.url,
    company: j.company,
    location: j.location
  }));
}
