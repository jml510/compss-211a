// Cloudflare Worker for the GitHub Pages copy of the studio: activity API and private report only.
// The pages themselves are served by GitHub Pages. Deploy with wrangler.toml (see README).
import {api} from './server.mjs';
export default {fetch(request,env){
  if(new URL(request.url).pathname.startsWith('/api/'))return api(request,env);
  return new Response('Not found',{status:404,headers:{'X-Content-Type-Options':'nosniff'}});
}};
