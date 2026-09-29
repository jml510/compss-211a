// Where anonymous activity goes, by the site the studio is opened on.
// GitHub Pages only serves files, so the Pages copy sends activity to the Cloudflare Worker (worker.mjs, wrangler.toml).
// Set PAGES_ACTIVITY_URL to the Worker's address after deploying it, for example
// 'https://compss-211a-practice.<your-subdomain>.workers.dev'. Until then, the Pages copy doesn't track.
export const PAGES_ACTIVITY_URL=null;

export function activityEndpoint(host=globalThis.location?.hostname||''){
  if(host.endsWith('github.io'))return PAGES_ACTIVITY_URL;
  // A local preview has no activity service.
  if(['localhost','127.0.0.1','[::1]',''].includes(host))return null;
  // The hosted Worker serves the page and the activity API from the same site.
  return '';
}
