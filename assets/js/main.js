/* ==========================================================================
   SACHIKA HOTELS — main.js
   Vanilla JavaScript, no dependencies. Loaded with `defer` on every page.

   01  Helpers & environment
   02  Analytics (GA4 / Meta Pixel loaders, event tracking, scroll depth)
   03  Smooth scroll (inertial wheel scrolling on desktop pointers)
   04  Scroll loop (header state, parallax, horizontal rooms, booking bar)
   05  Text splitting & reveal-on-scroll
   06  Preloader & hero entrance
   07  Full-screen menu
   08  Magnetic buttons
   09  Dining image sequence
   10  Amenity index cursor image
   11  Guest voices
   12  Location map
   13  Gallery filters & lightbox
   14  Forms (booking widget, enquiry)
   15  Boot
   ========================================================================== */
(function () {
  'use strict';

  /* 01 — Helpers & environment ------------------------------------------- */
  var CFG = window.SACHIKA_CONFIG || {};
  var doc = document.documentElement;
  var motion = doc.classList.contains('motion');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function imgReady(img) {
    return new Promise(function (res) {
      if (!img || (img.complete && img.naturalWidth)) return res();
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
  }
  /* Decorative images written with data-defer only download when needed */
  function hydrate(root) {
    $$('img[data-src]', root).forEach(function (img) {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    });
  }
  function isoDate(d) {
    var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }

  /* 02 — Analytics -------------------------------------------------------- */
  function loadAnalytics() {
    if (CFG.ga4Id) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga4Id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', CFG.ga4Id, { anonymize_ip: true });
    }
    if (CFG.metaPixelId) {
      /* Standard Meta Pixel bootstrap */
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CFG.metaPixelId);
      window.fbq('track', 'PageView');
    }
  }

  function track(name, params) {
    params = params || {};
    params.page = page;
    try {
      if (window.gtag) window.gtag('event', name, params);
      if (window.fbq) {
        if (name === 'generate_lead') window.fbq('track', 'Lead', params);
        else if (name === 'booking_engine_open') window.fbq('track', 'InitiateCheckout', params);
        else if (name === 'contact_click') window.fbq('track', 'Contact', params);
        else window.fbq('trackCustom', name, params);
      }
    } catch (e) { /* never let analytics break the page */ }
    if (CFG.debug && window.console) console.info('[track]', name, params);
  }
  window.sachikaTrack = track;

  function initTracking() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('a, button');
      if (!el) return;
      var href = el.getAttribute('href') || '';
      var section = (el.closest('[data-section]') || {}).dataset;
      var where = section ? section.section : 'page';
      var label = el.dataset.trackLabel || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (el.hasAttribute('data-booking-engine')) track('booking_engine_open', { label: label, location: where });
      else if (href.indexOf('tel:') === 0) track('contact_click', { method: 'phone', location: where });
      else if (href.indexOf('mailto:') === 0) track('contact_click', { method: 'email', location: where });
      else if (/wa\.me|whatsapp/.test(href)) track('contact_click', { method: 'whatsapp', location: where });
      if (el.dataset.track) track(el.dataset.track, { label: label, location: where });
    });

    var marks = [25, 50, 75, 90];
    var sent = {};
    window.addEventListener('scroll', function () {
      var max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      var pct = (window.scrollY / max) * 100;
      marks.forEach(function (m) { if (pct >= m && !sent[m]) { sent[m] = true; track('scroll_depth', { percent: m }); } });
    }, { passive: true });
  }

  /* 03 — Smooth scroll ---------------------------------------------------- */
  var Smooth = (function () {
    var enabled = false, stopped = false, animating = false;
    var target = 0, current = 0, last = 0;
    function max() { return doc.scrollHeight - window.innerHeight; }
    function tick(now) {
      var dt = Math.min(64, now - (last || now)); last = now;
      var k = 1 - Math.pow(1 - 0.11, dt / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.4) { current = target; animating = false; }
      window.scrollTo(0, current);
      if (animating) requestAnimationFrame(tick); else last = 0;
    }
    function run() { if (!animating) { animating = true; last = 0; requestAnimationFrame(tick); } }
    function onWheel(e) {
      if (!enabled || stopped || e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.target.closest && e.target.closest('[data-scroll-native], dialog[open]')) return;
      e.preventDefault();
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 36; else if (e.deltaMode === 2) dy *= window.innerHeight;
      if (!animating) { current = window.scrollY; target = current; }
      target = clamp(target + dy, 0, max());
      run();
    }
    function init() {
      enabled = motion && finePointer;
      if (!enabled) return;
      target = current = window.scrollY;
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('scroll', function () { if (!animating) target = current = window.scrollY; }, { passive: true });
      window.addEventListener('resize', function () { target = clamp(target, 0, max()); });
    }
    function to(y, immediate) {
      y = clamp(y, 0, max());
      if (!enabled || immediate) { window.scrollTo({ top: y, behavior: motion && !immediate ? 'smooth' : 'auto' }); target = current = y; return; }
      if (!animating) current = window.scrollY;
      target = y; run();
    }
    return {
      init: init, to: to,
      stop: function () { stopped = true; animating = false; },
      start: function () { stopped = false; target = current = window.scrollY; }
    };
  })();

  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      var y = el.getBoundingClientRect().top + window.scrollY - (id === 'main' ? 0 : 0);
      Smooth.to(y);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  }

  /* 04 — Scroll loop ------------------------------------------------------ */
  var header = $('.site-header');
  var mbar = $('.mbar');
  if (mbar && page === 'reserve') { mbar.remove(); mbar = null; }
  var heroEl = $('.hero, .page-hero');
  var hideMbarEls = $$('[data-hide-mbar]');
  var parallaxEls = [];
  var hs = null;
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    if (header && !doc.classList.contains('menu-open')) {
      header.classList.toggle('is-scrolled', y > 24);
      var heroH = heroEl ? heroEl.offsetHeight : vh;
      if (y > heroH * 0.6 && y > lastY + 4) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y < heroH * 0.6) header.classList.remove('is-hidden');
    }
    if (mbar) {
      var trigger = heroEl ? heroEl.offsetHeight * 0.7 : vh * 0.5;
      var desktop = window.innerWidth >= 1024;
      var headerHidden = header && header.classList.contains('is-hidden');
      /* One primary Reserve on screen: phones always, desktop only when the header has slid away,
         and never while a section with its own booking form ([data-hide-mbar]) is in view */
      var ownForm = false;
      for (var k = 0; k < hideMbarEls.length; k++) {
        var rb = hideMbarEls[k].getBoundingClientRect();
        if (rb.top < vh && rb.bottom > 0) { ownForm = true; break; }
      }
      mbar.classList.toggle('is-visible', y > trigger && !ownForm && (!desktop || headerHidden));
    }
    if (motion) {
      for (var i = 0; i < parallaxEls.length; i++) {
        var el = parallaxEls[i];
        var box = el.parentElement.getBoundingClientRect();
        if (box.bottom < -vh * 0.2 || box.top > vh * 1.2) continue;
        var p = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2); // -1 … 1
        var speed = parseFloat(el.dataset.parallax) || 0.08;
        el.style.transform = 'translate3d(0,' + (p * speed * box.height).toFixed(2) + 'px,0)';
      }
    }
    if (hs && hs.active) {
      var r = hs.el.getBoundingClientRect();
      var span = hs.el.offsetHeight - vh;
      var prog = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
      hs.track.style.transform = 'translate3d(' + (-prog * hs.dist).toFixed(2) + 'px,0,0)';
      if (hs.bar) hs.bar.style.setProperty('--p', prog.toFixed(4));
    }
    lastY = y;
  }

  function initParallax() {
    parallaxEls = $$('[data-parallax]');
  }

  function initHScroll() {
    var el = $('.hscroll');
    if (!el) return;
    var track = $('.hscroll-track', el);
    var mq = window.matchMedia('(min-width: 64rem)');
    hs = { el: el, track: track, bar: $('.hscroll-progress i', el), dist: 0, active: false };
    function setup() {
      var on = mq.matches && motion;
      doc.classList.toggle('hs-pinned', on);
      hs.active = on;
      if (!on) { el.style.height = ''; track.style.transform = ''; return; }
      track.style.transform = 'translate3d(0,0,0)';
      hs.dist = Math.max(0, track.scrollWidth - window.innerWidth);
      el.style.height = (window.innerHeight + hs.dist) + 'px';
      update();
    }
    /* Keyboard: bring a focused panel into view by scrolling to its point on the vertical path */
    var sticky = $('.hscroll-sticky', el);
    sticky.addEventListener('scroll', function () { if (hs.active && sticky.scrollLeft) sticky.scrollLeft = 0; });
    el.addEventListener('focusin', function (e) {
      if (!hs.active) return;
      sticky.scrollLeft = 0;
      var panel = e.target.closest('.hpanel');
      if (!panel || !hs.dist) return;
      var x = clamp(panel.offsetLeft - (window.innerWidth - panel.offsetWidth) / 2, 0, hs.dist);
      var span = el.offsetHeight - window.innerHeight;
      var y = el.getBoundingClientRect().top + window.scrollY + (x / hs.dist) * span;
      /* The browser scrolls the focused element "into view" after focus events fire — go after it */
      setTimeout(function () { Smooth.to(y, true); update(); }, 0);
    });

    /* Swipe carousel (tablet / phone): visible previous / next buttons */
    var prevBtn = $('[data-hs-prev]'), nextBtn = $('[data-hs-next]');
    function step(dir) {
      var first = $('.hpanel-room', track);
      var w = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * w, behavior: motion ? 'smooth' : 'auto' });
    }
    function syncButtons() {
      if (!prevBtn || !nextBtn) return;
      prevBtn.disabled = track.scrollLeft <= 4;
      nextBtn.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
    track.addEventListener('scroll', debounce(syncButtons, 60), { passive: true });
    syncButtons();

    setup();
    window.addEventListener('resize', debounce(setup, 150));
    if (mq.addEventListener) mq.addEventListener('change', setup);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup);
    window.addEventListener('load', setup);
  }

  /* 05 — Text splitting & reveals ---------------------------------------- */
  function splitWords(el) {
    if (el.dataset.split === 'done') return;
    var byChar = el.dataset.reveal === 'chars'; /* clock times roll in digit by digit */
    var walker = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = byChar ? Array.from(child.textContent.trim()) : child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var mask = document.createElement('span');
            mask.className = 'split-mask';
            var inner = document.createElement('span');
            inner.className = 'split-inner';
            inner.textContent = part;
            mask.appendChild(inner);
            frag.appendChild(mask);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walker(child);
        }
      });
    };
    walker(el);
    el.dataset.split = 'done';
    indexSplit(el);
    el.classList.add('is-split');
  }
  function indexSplit(el) {
    var inners = $$('.split-inner', el);
    if (el.dataset.reveal === 'words' || el.dataset.reveal === 'chars') {
      inners.forEach(function (s, i) { s.style.setProperty('--n', i); });
      return;
    }
    var line = -1, top = null;
    inners.forEach(function (s) {
      var t = s.parentNode.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { line++; top = t; }
      s.style.setProperty('--n', line);
    });
  }

  var revealIO = null;
  function reveal(el) { el.classList.add('is-in'); }
  function initReveals() {
    var els = $$('[data-reveal]');
    if (!motion) { els.forEach(reveal); return; }
    $$('[data-reveal="lines"], [data-reveal="words"], [data-reveal="chars"]').forEach(splitWords);
    $$('[data-reveal="stagger"]').forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i); });
    });
    $$('[data-reveal="draw"]').forEach(prepareMap);
    window.addEventListener('resize', debounce(function () {
      $$('[data-reveal="lines"]').forEach(indexSplit);
    }, 200));

    /* A fully clip-pathed element never "intersects", so image wipes are observed
       through their parent and revealed via this lookup. */
    var owners = new Map();
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        (owners.get(en.target) || []).forEach(reveal);
        revealIO.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    els.forEach(function (el) {
      if (el.dataset.revealOn === 'load') return;
      var target = el.dataset.reveal === 'image' ? el.parentElement : el;
      if (!owners.has(target)) owners.set(target, []);
      owners.get(target).push(el);
      revealIO.observe(target);
    });

    /* Safety net: never leave a blank block. Anything that has reached the screen
       (or been scrolled past) is revealed, even if the observer above missed it. */
    var sweepTimer = null;
    function sweep() {
      sweepTimer = null;
      var limit = window.innerHeight * 0.95;
      owners.forEach(function (list, target) {
        if (target.getBoundingClientRect().top < limit) {
          list.forEach(reveal);
          revealIO.unobserve(target);
          owners.delete(target);
        }
      });
    }
    function queueSweep() { if (!sweepTimer) sweepTimer = setTimeout(sweep, 120); }
    window.addEventListener('scroll', queueSweep, { passive: true });
    window.addEventListener('resize', queueSweep);
    window.addEventListener('load', queueSweep);
    setTimeout(sweep, 600);
  }

  /* 06 — Preloader & hero entrance --------------------------------------- */
  function revealOnLoad() {
    doc.classList.add('is-loaded');
    $$('[data-reveal-on="load"]').forEach(function (el) { reveal(el); });
  }
  function initPreloader() {
    var pl = $('.preloader');
    if (!doc.classList.contains('preload') || !pl) {
      setTimeout(revealOnLoad, 80);
      return;
    }
    var bar = $('.preloader-bar i', pl);
    var t0 = performance.now();
    var MIN = 1100, done = false, p = 0;
    var fake = setInterval(function () { p = Math.min(0.9, p + (0.9 - p) * 0.12); if (bar) bar.style.setProperty('--p', p); }, 120);
    var ready = Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      imgReady($('.hero-media img'))
    ]);
    function finish(skip) {
      if (done) return; done = true;
      clearInterval(fake);
      skipEvents.forEach(function (t) { window.removeEventListener(t, onSkip, true); });
      if (bar) bar.style.setProperty('--p', 1);
      var wait = skip === true ? -250 : Math.max(0, MIN - (performance.now() - t0));
      setTimeout(function () {
        pl.classList.add('is-done');
        try { sessionStorage.setItem('sachika:visited', '1'); } catch (e) {}
        setTimeout(revealOnLoad, 350);
        setTimeout(function () { doc.classList.remove('preload'); pl.setAttribute('hidden', ''); }, 1500);
      }, wait + 250);
    }
    /* Never hold the guest hostage: a click, key, tap or scroll lifts the curtain at once */
    var skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    function onSkip() { finish(true); }
    skipEvents.forEach(function (t) { window.addEventListener(t, onSkip, { capture: true, passive: true }); });
    ready.then(finish);
    setTimeout(finish, 3500);
  }

  /* 07 — Menu ------------------------------------------------------------- */
  function initMenu() {
    var toggle = $('.menu-toggle');
    var menu = $('#site-menu');
    if (!toggle || !menu) return;
    var outside = $$('main, .site-footer, .mbar, .skip-link');
    var visual = $$('.menu-visual img', menu);
    function setOpen(open) {
      doc.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      menu.toggleAttribute('inert', !open);
      menu.setAttribute('aria-hidden', String(!open));
      outside.forEach(function (el) { el.toggleAttribute('inert', open); });
      if (open) {
        Smooth.stop();
        header.classList.remove('is-hidden');
        setTimeout(function () { var first = $('.menu-links a', menu); if (first) first.focus({ preventScroll: true }); }, 450);
        track('menu_open', {});
      } else {
        Smooth.start();
      }
    }
    menu.setAttribute('inert', '');
    var visualBox = $('.menu-visual', menu);
    function loadVisuals() { if (visualBox && window.matchMedia('(min-width: 80rem) and (hover: hover)').matches) hydrate(visualBox); }
    toggle.addEventListener('pointerenter', loadVisuals, { once: true });
    toggle.addEventListener('focus', loadVisuals, { once: true });
    toggle.addEventListener('click', function () { loadVisuals(); setOpen(!doc.classList.contains('menu-open')); });
    document.addEventListener('keydown', function (e) {
      if (!doc.classList.contains('menu-open')) return;
      if (e.key === 'Escape') { setOpen(false); toggle.focus(); return; }
      if (e.key === 'Tab') {
        var f = [toggle].concat($$('a, button', menu)).concat($$('.site-header a'));
        f = f.filter(function (el) { return el.offsetParent !== null; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { if (a.getAttribute('href').charAt(0) === '#') setOpen(false); });
    });
    if (visual.length) {
      $$('.menu-links a', menu).forEach(function (a, i) {
        a.addEventListener('mouseenter', function () {
          visual.forEach(function (img, j) { img.classList.toggle('is-active', j === (i % visual.length)); });
        });
      });
    }
  }

  /* 08 — Magnetic buttons ------------------------------------------------- */
  function initMagnetic() {
    if (!motion || !finePointer) return;
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
        var y = (e.clientY - (r.top + r.height / 2)) * 0.3;
        el.style.setProperty('--mx', clamp(x, -10, 10).toFixed(1) + 'px');
        el.style.setProperty('--my', clamp(y, -7, 7).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
  }

  /* 09 — Dining image sequence ------------------------------------------- */
  function initSequences() {
    $$('.sequence').forEach(function (seq) {
      var imgs = $$('img', seq);
      var count = $('.sequence-count', seq);
      if (imgs.length < 2) return;
      var i = 0, timer = null;
      function show(n) {
        i = (n + imgs.length) % imgs.length;
        imgs.forEach(function (img, j) { img.classList.toggle('is-active', j === i); });
        if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(imgs.length).padStart(2, '0');
      }
      show(0);
      if (!motion) return;
      var toggle = $('.sequence-toggle', seq);
      var userPaused = false, inView = false;
      function run() {
        clearInterval(timer); timer = null;
        if (inView && !userPaused) timer = setInterval(function () { show(i + 1); }, 4800);
      }
      if (toggle) toggle.addEventListener('click', function () {
        userPaused = !userPaused;
        toggle.classList.toggle('is-paused', userPaused);
        toggle.setAttribute('aria-label', userPaused ? 'Play dish slideshow' : 'Pause dish slideshow');
        run();
      });
      var io = new IntersectionObserver(function (en) { inView = en[0].isIntersecting; run(); }, { threshold: 0.2 });
      io.observe(seq);
    });
  }

  /* 10 — Amenity index cursor image -------------------------------------- */
  function initCursorImage() {
    var list = $('[data-cursor-list]');
    var box = $('.cursor-image');
    if (!list || !box || !motion || !finePointer) return;
    var imgs = $$('img', box);
    var x = 0, y = 0, tx = 0, ty = 0, raf = null;
    function loop() {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      box.style.setProperty('--x', x.toFixed(1) + 'px');
      box.style.setProperty('--y', y.toFixed(1) + 'px');
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : null;
    }
    list.addEventListener('pointermove', function (e) {
      tx = e.clientX + 40; ty = e.clientY;
      if (!box.classList.contains('is-visible')) { x = tx; y = ty; }
      if (!raf) raf = requestAnimationFrame(loop);
    });
    list.addEventListener('pointerenter', function () { hydrate(box); }, { once: true });
    $$('[data-img]', list).forEach(function (row) {
      row.addEventListener('pointerenter', function () {
        var n = parseInt(row.dataset.img, 10);
        imgs.forEach(function (img, j) { img.classList.toggle('is-active', j === n); });
        box.classList.add('is-visible');
      });
    });
    list.addEventListener('pointerleave', function () { box.classList.remove('is-visible'); });
  }

  /* 11 — Guest voices ----------------------------------------------------- */
  function initVoices() {
    $$('[data-voices]').forEach(function (root) {
      var stage = $('.voice-stage', root);
      var items = $$('.voice', root);
      var count = $('.voice-count', root);
      if (!items.length) return;
      var i = 0, timer = null, paused = false, userPaused = false;
      var toggle = $('[data-toggle]', root);
      items.forEach(function (v, j) {
        v.setAttribute('role', 'group');
        v.setAttribute('aria-roledescription', 'review');
        v.setAttribute('aria-label', (j + 1) + ' of ' + items.length);
      });
      function show(n, user) {
        i = (n + items.length) % items.length;
        items.forEach(function (v, j) {
          v.classList.toggle('is-active', j === i);
          v.setAttribute('aria-hidden', String(j !== i));
        });
        if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0');
        if (user) stage.setAttribute('aria-live', 'polite');
      }
      show(0);
      var prev = $('[data-prev]', root), next = $('[data-next]', root);
      if (prev) prev.addEventListener('click', function () { show(i - 1, true); });
      if (next) next.addEventListener('click', function () { show(i + 1, true); });
      if (items.length < 2) { $$('.voice-controls', root).forEach(function (c) { c.hidden = true; }); return; }
      if (!motion) return;
      if (toggle) toggle.addEventListener('click', function () {
        userPaused = !userPaused;
        toggle.classList.toggle('is-paused', userPaused);
        toggle.setAttribute('aria-label', userPaused ? 'Play reviews' : 'Pause reviews');
      });
      root.addEventListener('pointerenter', function () { paused = true; });
      root.addEventListener('pointerleave', function () { paused = false; });
      root.addEventListener('focusin', function () { paused = true; });
      root.addEventListener('focusout', function () { paused = false; });
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { if (!timer) timer = setInterval(function () { if (!paused && !userPaused) show(i + 1); }, 8000); }
        else { clearInterval(timer); timer = null; }
      }, { threshold: 0.3 });
      io.observe(root);
    });
  }

  /* 12 — Location map ----------------------------------------------------- */
  function prepareMap(svgWrap) {
    $$('.route', svgWrap).forEach(function (path, i) {
      var len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 1000;
      path.style.setProperty('--len', len);
      path.style.setProperty('--i', i);
    });
    $$('[data-i]', svgWrap).forEach(function (g) { g.style.setProperty('--i', g.getAttribute('data-i')); });
  }

  /* 13 — Gallery filters & lightbox -------------------------------------- */
  function initFilters() {
    var bar = $('[data-filters]');
    if (!bar) return;
    var items = $$('[data-cat]');
    var status = $('[data-filter-status]');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-filter]');
      if (!b) return;
      var f = b.dataset.filter;
      $$('button', bar).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var shown = 0;
      items.forEach(function (it) {
        var on = f === 'all' || it.dataset.cat === f;
        it.classList.toggle('is-hidden', !on);
        if (on) shown++;
      });
      if (status) status.textContent = 'Showing ' + shown + ' image' + (shown === 1 ? '' : 's');
      track('gallery_filter', { filter: f });
    });
  }

  function initLightbox() {
    var triggers = $$('[data-lightbox]');
    if (!triggers.length) return;
    var dlg = $('#lightbox');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'lightbox';
      dlg.className = 'lightbox';
      dlg.setAttribute('aria-label', 'Image viewer');
      dlg.innerHTML =
        '<button class="lightbox-close" type="button" data-close>Close <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2 2 14" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></button>' +
        '<div class="lightbox-stage"><img alt=""></div>' +
        '<div class="lightbox-bar"><p class="lightbox-caption" aria-live="polite"></p><div style="display:flex;align-items:center;gap:1.25rem"><span class="count"></span><div class="lightbox-nav">' +
        '<button type="button" data-prev aria-label="Previous image"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2 4 8l6 6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></button>' +
        '<button type="button" data-next aria-label="Next image"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 2 6 6-6 6" stroke="currentColor" stroke-width="1.2" fill="none"/></svg></button>' +
        '</div></div></div>';
      document.body.appendChild(dlg);
    }
    var img = $('.lightbox-stage img', dlg);
    var cap = $('.lightbox-caption', dlg);
    var cnt = $('.count', dlg);
    var group = [], idx = 0, opener = null;

    function visible(name) {
      return $$('[data-lightbox="' + name + '"]').filter(function (a) { return !a.closest('.is-hidden'); });
    }
    function load(n, fromEl) {
      idx = (n + group.length) % group.length;
      var a = group[idx];
      var thumb = $('img', a);
      img.style.opacity = '0';
      img.src = a.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = a.dataset.caption || (thumb ? thumb.alt : '');
      cnt.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(group.length).padStart(2, '0');
      imgReady(img).then(function () {
        img.style.opacity = '';
        if (!motion || !img.animate) return;
        var to = img.getBoundingClientRect();
        if (fromEl && to.width) {
          var from = fromEl.getBoundingClientRect();
          var sx = from.width / to.width, sy = from.height / to.height;
          var s = Math.max(sx, sy);
          img.animate([
            { transform: 'translate(' + (from.left + from.width / 2 - (to.left + to.width / 2)) + 'px,' + (from.top + from.height / 2 - (to.top + to.height / 2)) + 'px) scale(' + s + ')', opacity: 0.4 },
            { transform: 'none', opacity: 1 }
          ], { duration: 800, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        } else {
          img.animate([{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        }
      });
    }
    function open(a) {
      opener = a;
      group = visible(a.dataset.lightbox);
      dlg.showModal();
      Smooth.stop();
      load(group.indexOf(a), $('img', a));
      track('gallery_open', { group: a.dataset.lightbox });
    }
    function close() {
      if (!dlg.open) return;
      dlg.close();
    }
    dlg.addEventListener('close', function () { Smooth.start(); if (opener) opener.focus({ preventScroll: true }); });
    triggers.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        open(a);
      });
    });
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-prev]')) return load(idx - 1);
      if (e.target.closest('[data-next]')) return load(idx + 1);
      if (e.target === dlg || e.target.classList.contains('lightbox-stage')) close();
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); load(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); load(idx + 1); }
    });
    var sx = null;
    dlg.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) load(idx + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  /* 14 — Forms ------------------------------------------------------------ */
  var MSG = {
    required: 'Please fill in this field.',
    email: 'Please enter a valid email address.',
    phone: 'Please enter a valid phone number, including country code if outside India.',
    past: 'Please choose today or a later date.',
    order: 'Check-out must be after check-in.',
    consent: 'Please tick this box so we can reply to you.'
  };
  function setError(field, msg) {
    var wrap = field.closest('.field');
    var err = wrap ? $('.error', wrap) : null;
    if (msg) {
      field.setAttribute('aria-invalid', 'true');
      if (err) err.textContent = msg;
    } else {
      field.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    }
  }
  function validate(form) {
    var ok = true, firstBad = null;
    var today = isoDate(new Date());
    $$('input, select, textarea', form).forEach(function (f) {
      if (f.type === 'hidden' || f.closest('.hp')) return;
      var v = (f.value || '').trim(), msg = '';
      if (f.required && !v) msg = MSG.required;
      else if (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = MSG.email;
      else if (v && f.type === 'tel' && !/^\+?[\d\s()-]{8,18}$/.test(v)) msg = MSG.phone;
      else if (v && f.type === 'date' && f.name === 'checkin' && v < today) msg = MSG.past;
      else if (v && f.type === 'date' && f.name === 'checkout') {
        var ci = form.elements.checkin && form.elements.checkin.value;
        if (ci && v <= ci) msg = MSG.order;
      }
      if (f.type === 'checkbox' && f.required && !f.checked) msg = MSG.consent;
      setError(f, msg);
      if (msg) { ok = false; if (!firstBad) firstBad = f; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }
  function linkDates(form) {
    var ci = form.elements.checkin, co = form.elements.checkout;
    if (!ci || !co) return;
    var today = new Date();
    ci.min = isoDate(today);
    function sync() {
      if (!ci.value) { co.min = isoDate(new Date(today.getTime() + 864e5)); return; }
      var next = new Date(ci.value + 'T00:00:00'); next.setDate(next.getDate() + 1);
      co.min = isoDate(next);
      if (!co.value || co.value <= ci.value) co.value = isoDate(next);
    }
    ci.addEventListener('change', sync);
    sync();
  }
  function prefill(form) {
    var q = new URLSearchParams(location.search);
    ['checkin', 'checkout', 'guests', 'room', 'topic'].forEach(function (k) {
      var v = q.get(k);
      var f = form.elements[k];
      if (!v || !f) return;
      if (f.tagName === 'SELECT') {
        var opt = $$('option', f).filter(function (o) { return o.value === v; })[0];
        if (opt) f.value = v;
      } else if (/^[\w\s-]{1,40}$/.test(v)) {
        f.value = v;
      }
    });
  }
  function summary(data) {
    var lines = [
      'Enquiry from sachikahotels.com',
      '',
      'Name: ' + (data.name || ''),
      'Email: ' + (data.email || ''),
      'Phone: ' + (data.phone || '')
    ];
    if (data.topic) lines.push('Regarding: ' + data.topic);
    if (data.room) lines.push('Room: ' + data.room);
    if (data.checkin) lines.push('Check-in: ' + data.checkin);
    if (data.checkout) lines.push('Check-out: ' + data.checkout);
    if (data.guests) lines.push('Guests: ' + data.guests);
    if (data.message) { lines.push(''); lines.push(data.message); }
    return lines.join('\n');
  }
  function initForms() {
    $$('form[data-booking]').forEach(function (form) {
      linkDates(form);
      form.addEventListener('submit', function (e) {
        if (!validate(form)) { e.preventDefault(); return; }
        track('booking_search', {
          room: form.elements.room ? form.elements.room.value : '',
          guests: form.elements.guests ? form.elements.guests.value : ''
        });
      });
    });

    $$('form[data-enquiry]').forEach(function (form) {
      linkDates(form);
      prefill(form);
      var status = $('.form-status', form);
      var success = document.getElementById(form.dataset.success);
      form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid')) setError(e.target, ''); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (form.elements.company && form.elements.company.value) return; // honeypot
        if (!validate(form)) {
          if (status) { status.dataset.state = 'error'; status.textContent = 'Please check the highlighted fields.'; }
          return;
        }
        var data = {};
        new FormData(form).forEach(function (v, k) { if (k !== 'company') data[k] = String(v).trim(); });
        data.page = location.pathname;
        var text = summary(data);
        var mailto = 'mailto:' + (CFG.enquiryEmail || 'help@sachikahotels.com') +
          '?subject=' + encodeURIComponent('Stay enquiry — ' + (data.name || 'Guest')) +
          '&body=' + encodeURIComponent(text);
        var wa = 'https://wa.me/' + (CFG.whatsappNumber || '917099004522') + '?text=' + encodeURIComponent(text);

        function showSuccess(sent) {
          if (!success) return;
          $$('[data-sent]', success).forEach(function (n) { n.hidden = !sent; });
          $$('[data-unsent]', success).forEach(function (n) { n.hidden = sent; });
          var m = $('[data-mailto]', success); if (m) m.href = mailto;
          var w = $('[data-wa]', success); if (w) w.href = wa;
          form.hidden = true;
          success.hidden = false;
          success.setAttribute('tabindex', '-1');
          success.focus();
          var y = success.getBoundingClientRect().top + window.scrollY - 140;
          Smooth.to(y);
        }

        if (!CFG.enquiryEndpoint) {
          track('enquiry_prepared', { method: 'fallback' });
          showSuccess(false);
          return;
        }
        var btn = $('button[type="submit"]', form);
        if (btn) btn.disabled = true;
        if (status) { status.dataset.state = ''; status.textContent = 'Sending your enquiry…'; }
        fetch(CFG.enquiryEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          track('generate_lead', { form: form.dataset.enquiry || 'enquiry', room: data.room || '' });
          showSuccess(true);
        }).catch(function () {
          if (btn) btn.disabled = false;
          if (status) {
            status.dataset.state = 'error';
            status.innerHTML = 'We couldn’t send that just now. Please <a class="link-plain" href="' + mailto + '">email us</a> or <a class="link-plain" href="' + wa + '" rel="noopener" target="_blank">message us on WhatsApp</a>.';
          }
        });
      });
    });

    /* Booking-engine links take their URL from config so it lives in one place */
    if (CFG.bookingEngineUrl) {
      $$('[data-booking-engine]').forEach(function (a) { a.href = CFG.bookingEngineUrl; });
    }
  }

  /* 15 — Boot ------------------------------------------------------------- */
  function boot() {
    $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
    loadAnalytics();
    initTracking();
    Smooth.init();
    initAnchors();
    initParallax();
    initHScroll();
    initReveals();
    initPreloader();
    initMenu();
    initMagnetic();
    initSequences();
    initCursorImage();
    initVoices();
    initFilters();
    initLightbox();
    initForms();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', debounce(update, 120));
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
