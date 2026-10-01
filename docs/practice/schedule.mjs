// Course weeks follow the bCourses calendar. Week 1 spans two calendar weeks.
// Dates are inclusive, at midnight in Berkeley, regardless of the student’s time zone.
export const courseTimeZone = 'America/Los_Angeles';
export const weekReleases = [
  '2026-08-31', '2026-09-14', '2026-09-21', '2026-09-28',
  '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26',
  '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'
];
const calendar = new Intl.DateTimeFormat('en-US', {
  timeZone: courseTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'
});
export function getCourseWeek(now = new Date()) {
  const parts = Object.fromEntries(calendar.formatToParts(now).map(p => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return weekReleases.filter(date => date <= today).length;
}
// Instructor preview: ?preview in the address shows every week early, and ?preview=5 shows the course as of Week 5.
// Display only, like the homepage's ?preview. The page doesn't record activity while previewing.
export function previewWeek(search = globalThis.location?.search || '') {
  const match = /[?&]preview(?:=(\d+))?(?:&|$)/.exec(search);
  if (!match) return null;
  return match[1] ? Math.min(Math.max(Number(match[1]), 1), weekReleases.length) : weekReleases.length;
}
export function nextWeekRelease(now = new Date()) {
  const current = getCourseWeek(now);
  if (current === weekReleases.length) return null;
  return {week: current + 1, date: weekReleases[current]};
}
export function formatReleaseDate(date) {
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'})
    .format(new Date(`${date}T12:00:00Z`));
}
