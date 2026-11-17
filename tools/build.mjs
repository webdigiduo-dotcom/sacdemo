/* ==========================================================================
   OPTIONAL helper — keeps shared markup in sync across the plain HTML pages.
   The site itself needs no build step: every .html file is complete as-is.

   Run after editing anything in /partials or adding images:
     node tools/build.mjs

   What it does (in place, idempotent):
   1. Copies partials into each page between include markers:
        <!-- include:header --> … <!-- /include:header -->
        <!-- include:footer --> … <!-- /include:footer -->
        <!-- include:preloader --> … <!-- /include:preloader -->
      and marks the current page's nav links with aria-current="page".
   2. Expands responsive image shorthand. Any <img data-u="photo-…"> (an Unsplash
      photo id) gets src, srcset, width and height written for it:
        data-w   display width used for src + width attr (default 1600)
        data-ar  aspect ratio (width / height), e.g. 1.5 for 3:2 (optional)
        data-max largest srcset candidate (default 2400)
        data-defer  decorative image: written as data-src/data-srcset and only
                    downloaded when main.js needs it (menu visuals, hover images)
      Replace with local files later by writing a normal <img src srcset>.
   3. Regenerates sitemap.xml from the public pages.
   ========================================================================== */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://sachikahotels.com';
const partial = (n) => readFileSync(join(root, 'partials', `${n}.html`), 'utf8').trim();
const partials = { header: partial('header'), footer: partial('footer'), preloader: partial('preloader') };

// Pages whose nav item should also light up a parent section
const parentOf = { 'premium-room.html': 'rooms.html', 'business-room.html': 'rooms.html' };
// Pages left out of the sitemap
const noIndex = new Set(['404.html', 'styleguide.html']);

const WIDTHS = [400, 640, 960, 1280, 1600, 2000, 2400];
const unsplash = (id, w, ar) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}${ar ? `&h=${Math.round(w / ar)}` : ''}&q=72`;

function setAttr(tag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`);
  const attr = ` ${name}="${value}"`;
  return re.test(tag) ? tag.replace(re, attr) : tag.replace(/\s*\/?>$/, `${attr}>`);
}
function getAttr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
}
// Sachika's own photography, pending a move into assets/img before launch:
//   data-g  = photo id from the hotel's Google Business Profile (owner uploads), resizable
//   data-wp = path under sachikahotels.com/wp-content/uploads/ (current site), fixed size
const google = (id, w, ar) => `https://lh3.googleusercontent.com/gps-cs-s/${id}=w${w}${ar ? `-h${Math.round(w / ar)}-p` : ''}-k-no`;
const wordpress = (path) => `https://sachikahotels.com/wp-content/uploads/${path}`;

function expandImages(html) {
  return html.replace(/<(?:img|source)\b[^>]*\sdata-(?:u|g|wp)="[^"]+"[^>]*>/g, (tag) => {
    const isSource = tag.startsWith('<source');
    const kind = getAttr(tag, 'data-g') ? 'g' : getAttr(tag, 'data-wp') ? 'wp' : 'u';
    const id = getAttr(tag, `data-${kind}`);
    const w = parseInt(getAttr(tag, 'data-w') || '1600', 10);
    const ar = parseFloat(getAttr(tag, 'data-ar') || '0') || 0;
    const max = parseInt(getAttr(tag, 'data-max') || '2400', 10);
    if (kind === 'wp') {
      let out = tag;
      if (/\sdata-defer[\s=>]/.test(tag) && !isSource) {
        out = setAttr(out, 'src', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
        out = setAttr(out, 'data-src', wordpress(id));
      } else if (!isSource) out = setAttr(out, 'src', wordpress(id));
      else out = setAttr(out, 'srcset', wordpress(id));
      out = setAttr(out, 'width', String(w));
      if (ar) out = setAttr(out, 'height', String(Math.round(w / ar)));
      out = setAttr(out, 'referrerpolicy', 'no-referrer');
      if (!isSource && !/\sdecoding=/.test(out)) out = setAttr(out, 'decoding', 'async');
      return out;
    }
    const build = kind === 'g' ? (x) => google(id, x, ar) : (x) => unsplash(id, x, ar).replace(/&/g, '&amp;');
    const set = WIDTHS.filter((x) => x <= max).map((x) => `${build(x)} ${x}w`).join(', ');
    let out = tag;
    if (kind === 'g') out = setAttr(out, 'referrerpolicy', 'no-referrer');
    if (/\sdata-defer[\s=>]/.test(tag) && !isSource) {
      // Decorative image loaded on demand by main.js (hydrate): keep a 1px placeholder until then.
      out = setAttr(out, 'src', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
      out = setAttr(out, 'data-src', build(w));
      out = setAttr(out, 'data-srcset', set);
      out = out.replace(/\ssrcset="[^"]*"/, '');
      out = setAttr(out, 'width', String(w));
      if (ar) out = setAttr(out, 'height', String(Math.round(w / ar)));
      return out;
    }
    if (!isSource) out = setAttr(out, 'src', build(w));
    out = setAttr(out, 'srcset', set);
    out = setAttr(out, 'width', String(w));
    if (ar) out = setAttr(out, 'height', String(Math.round(w / ar)));
    if (!isSource && !/\sdecoding=/.test(out)) out = setAttr(out, 'decoding', 'async');
    return out;
  });
}
function markCurrent(markup, file) {
  const targets = [file, parentOf[file]].filter(Boolean);
  let out = markup.replace(/\saria-current="page"/g, '');
  for (const t of targets) {
    out = out.replace(new RegExp(`href="${t.replace('.', '\\.')}"`, 'g'), `href="${t}" aria-current="page"`);
  }
  return out;
}

const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
for (const file of pages) {
  const path = join(root, file);
  let html = readFileSync(path, 'utf8');
  for (const [name, body] of Object.entries(partials)) {
    const re = new RegExp(`<!-- include:${name} -->[\\s\\S]*?<!-- /include:${name} -->`, 'g');
    html = html.replace(re, `<!-- include:${name} -->\n${markCurrent(body, file)}\n<!-- /include:${name} -->`);
  }
  html = expandImages(html);
  writeFileSync(path, html);
}

const today = new Date().toISOString().slice(0, 10);
const urls = pages
  .filter((f) => !noIndex.has(f))
  .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))
  .map((f) => {
    const loc = f === 'index.html' ? `${SITE}/` : `${SITE}/${f}`;
    const priority = f === 'index.html' ? '1.0' : ['rooms.html', 'reserve.html', 'dining.html'].includes(f) ? '0.9' : '0.7';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

console.log(`Synced ${pages.length} pages and wrote sitemap.xml`);
