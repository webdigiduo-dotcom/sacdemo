/* ==========================================================================
   Tripadvisor reviews proxy — deploy as a Cloudflare Worker (free tier is enough)
   ------------------------------------------------------------------------
   The Tripadvisor Content API key must stay on a server, so the website asks
   this tiny worker instead. It returns the shape home.js expects:
     { rating, count, url, reviews: [{ rating, title, text, author, time, url }] }

   Setup
   1. Request a Content API key: https://www.tripadvisor.com/developers
      (restrict it to the worker's IP / domain as Tripadvisor requires).
   2. Create a Worker, paste this file, and add two variables:
        TA_KEY       = your Content API key
        ALLOW_ORIGIN = https://sachikahotels.com
   3. Put the worker URL in assets/js/config.js → reviews.tripadvisorEndpoint.

   Responses are cached for 6 hours to stay well inside the API quota.
   Display rules: show Tripadvisor attribution and link back to every review
   (home.js does both). Check the current Content API terms before launch.
   ========================================================================== */
const LOCATION_ID = '26394884'; // from the Tripadvisor URL: ...-d26394884-Reviews-Sachika_Hotels...

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=21600',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const cache = caches.default;
    const cacheKey = new Request(new URL('/sachika-tripadvisor', request.url).toString());
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const base = `https://api.content.tripadvisor.com/api/v1/location/${LOCATION_ID}`;
    const q = `key=${encodeURIComponent(env.TA_KEY)}&language=en`;
    const [details, reviews] = await Promise.all([
      fetch(`${base}/details?${q}`, { headers: { accept: 'application/json' } }).then((r) => r.json()),
      fetch(`${base}/reviews?${q}`, { headers: { accept: 'application/json' } }).then((r) => r.json()),
    ]);

    const body = JSON.stringify({
      rating: details.rating ? Number(details.rating) : null,
      count: details.num_reviews ? Number(details.num_reviews) : null,
      url: details.web_url || null,
      reviews: (reviews.data || []).map((r) => ({
        rating: Number(r.rating),
        title: r.title || '',
        text: r.text || '',
        author: (r.user && r.user.username) || 'Tripadvisor traveller',
        time: r.published_date || null,
        url: r.url || details.web_url || null,
      })),
    });

    const response = new Response(body, { headers: cors });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
