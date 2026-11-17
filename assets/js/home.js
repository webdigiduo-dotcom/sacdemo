/* ==========================================================================
   SACHIKA HOTELS — home.js (home page only, loaded after main.js)

   0  Scroll-driven sections, word-by-word statements, count-up numbers
   1  YouTube helpers (official embed, controlled by postMessage)
   2  Hero slider: four photos, cross-fading with a slow zoom
   3  Reel player: auto-sliding, muted, with prev / next / play / sound
   4  Reviews: live Google + Tripadvisor reviews, filtered to the best ones
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.SACHIKA_CONFIG || {};
  var motion = document.documentElement.classList.contains('motion');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var track = function (name, params) { if (window.sachikaTrack) window.sachikaTrack(name, params || {}); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* 0 — Scroll-driven sections ---------------------------------------------
     Writes a 0–1 progress value (--p) onto each [data-progress] element once
     per frame while scrolling. The CSS turns it into motion.
       (default) "through": 0 as the element enters at the bottom, 1 as it leaves at the top
       "exit":   0 at rest, 1 once the element has scrolled fully out above
       "sticky": 0 when a tall pinned section starts, 1 when it ends
       "stack":  progress through a list of stacking cards                   */
  function initProgress() {
    var els = $$('[data-progress]');
    if (!els.length || !motion) return;
    var queued = false;
    function measure() {
      queued = false;
      var vh = window.innerHeight;
      for (var i = 0; i < els.length; i++) {
        var node = els[i], r = node.getBoundingClientRect(), mode = node.getAttribute('data-progress'), p;
        if (r.bottom < -vh || r.top > vh * 2) continue; /* far off screen: skip */
        if (mode === 'exit') p = -r.top / Math.max(1, r.height);
        else if (mode === 'sticky') p = -r.top / Math.max(1, r.height - vh);
        else if (mode === 'stack') p = (vh * 0.2 - r.top) / Math.max(1, r.height - vh * 0.45);
        else p = (vh - r.top) / (vh + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        node.style.setProperty('--p', p.toFixed(4));
      }
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(measure); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    window.addEventListener('load', queue);
    measure();
  }

  /* Statements that light up word by word as they scroll through */
  function initWords() {
    $$('[data-words]').forEach(function (node) {
      if (!motion || node.dataset.wordsDone) return;
      var words = node.textContent.trim().split(/\s+/);
      node.setAttribute('aria-label', node.textContent.trim());
      node.textContent = '';
      words.forEach(function (w, i) {
        var span = el('span', 'w', w);
        span.style.setProperty('--i', i);
        span.setAttribute('aria-hidden', 'true');
        node.appendChild(span);
        if (i < words.length - 1) node.appendChild(document.createTextNode(' '));
      });
      node.style.setProperty('--n', words.length);
      node.dataset.wordsDone = '1';
    });
  }

  /* Numbers that count up the first time they come into view.
     The final value lives in data-count-to (live review data can update it). */
  function initCounters() {
    var nums = $$('[data-count-to]');
    if (!nums.length || !motion || !('IntersectionObserver' in window)) return;
    function run(node) {
      var dec = parseInt(node.getAttribute('data-decimals') || '0', 10);
      var start = performance.now(), dur = 1400;
      function frame(now) {
        var target = parseFloat(node.getAttribute('data-count-to')) || 0;
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        node.textContent = (target * eased).toFixed(dec);
        if (t < 1) requestAnimationFrame(frame);
        else node.textContent = target.toFixed(dec);
      }
      requestAnimationFrame(frame);
      /* Safety net: always land on the real number, even if frames are paused (background tab) */
      setTimeout(function () {
        node.textContent = (parseFloat(node.getAttribute('data-count-to')) || 0).toFixed(dec);
      }, dur + 250);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* 1 — YouTube helpers ------------------------------------------------------
     Uses YouTube's official embed (youtube-nocookie.com) and drives it with
     postMessage commands — no extra API script. Videos come from the hotel's
     own channel, so nothing is downloaded or re-hosted. */
  var YT_ORIGIN = /^https:\/\/www\.youtube(-nocookie)?\.com$/;
  var ytHandlers = new Map();
  window.addEventListener('message', function (e) {
    if (!YT_ORIGIN.test(e.origin)) return;
    var handler = ytHandlers.get(e.source);
    if (!handler) return;
    $$('iframe').forEach(function (f) { if (f.contentWindow === e.source) f.dataset.heard = '1'; });
    var d;
    try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (d) handler(d);
  });
  function ytState(d) {
    if (d.event === 'onStateChange' && typeof d.info === 'number') return d.info;
    if ((d.event === 'infoDelivery' || d.event === 'initialDelivery') && d.info && typeof d.info.playerState === 'number') return d.info.playerState;
    return null; /* -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering */
  }
  function ytFrame(id, opts) {
    var p = new URLSearchParams({
      autoplay: opts.autoplay ? 1 : 0, mute: 1, controls: 0, playsinline: 1, rel: 0,
      modestbranding: 1, iv_load_policy: 3, disablekb: 1, enablejsapi: 1, origin: location.origin
    });
    if (opts.loop) { p.set('loop', 1); p.set('playlist', id); }
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?' + p.toString();
    f.title = opts.title || 'Video';
    f.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    /* YouTube refuses embeds that arrive without the page's address (error 153) */
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.setAttribute('tabindex', '-1');
    f.addEventListener('load', function () {
      /* Ask the player to report its state back to this page. The player only
         answers once its own script is ready, so keep asking until it does. */
      var tries = 0;
      var ask = setInterval(function () {
        if (f.dataset.heard || !f.isConnected || ++tries > 40) { clearInterval(ask); return; }
        if (f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: id, channel: 'widget' }), '*');
      }, 250);
    });
    return f;
  }
  function ytCommand(frame, func) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*');
  }
  function setPlayButton(btn, isPlaying, noun) {
    if (!btn) return;
    btn.classList.toggle('is-paused', !isPlaying);
    btn.setAttribute('aria-label', (isPlaying ? 'Pause ' : 'Play ') + noun);
  }
  function setMuteButton(btn, isMuted) {
    if (!btn) return;
    btn.classList.toggle('is-muted', isMuted);
    btn.setAttribute('aria-label', isMuted ? 'Turn sound on' : 'Turn sound off');
  }

  /* 2 — Hero slider -----------------------------------------------------------
     Four photographs that cross-fade with a slow zoom. The timing lives in CSS:
     the bar under the active number fills over data-hero-ms, and when it ends the
     next photo comes in, so pausing the bar pauses the slider. It also pauses
     while the hero is off screen. Reduced motion: no autoplay, arrows still work. */
  function initHeroSlider() {
    var root = $('[data-hero-slider]');
    if (!root) return;
    var stage = $('.hero-stage', root);
    var slides = $$('.hero-slide', root), dots = $$('.hero-dot', root);
    var playBtn = $('[data-hero-play]', root);
    var n = slides.length, i = 0, wanted = 0;
    if (n < 2) return;
    root.style.setProperty('--hero-ms', (parseInt(root.getAttribute('data-hero-ms'), 10) || 6000) + 'ms');
    root.classList.add('is-enhanced');
    if (motion) root.classList.add('is-auto');

    /* Never fade to an empty frame: wait until the photo is loaded and decoded.
       A photo that fails to load is skipped. */
    function show(k) {
      k = (k + n) % n;
      wanted = k;
      if (k === i) return;
      var img = $('img', slides[k]);
      var go = function () { if (wanted === k && i !== k) swap(k); };
      var skip = function () { if (wanted === k) show(k + 1); };
      if (!img) { go(); return; }
      img.loading = 'eager';
      if (img.decode) img.decode().then(go, function () { if (img.naturalWidth > 0) go(); else skip(); });
      else if (img.complete && img.naturalWidth > 0) go();
      else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', skip, { once: true }); }
    }
    function swap(k) {
      slides[i].classList.remove('is-active'); slides[i].setAttribute('aria-hidden', 'true');
      dots[i].classList.remove('is-active'); dots[i].removeAttribute('aria-current');
      i = k;
      slides[i].classList.add('is-active'); slides[i].removeAttribute('aria-hidden');
      dots[i].classList.add('is-active'); dots[i].setAttribute('aria-current', 'true');
    }

    /* The active bar finished filling: move on */
    root.addEventListener('animationend', function (e) {
      if (e.animationName === 'hero-fill' && e.target.parentNode && e.target.parentNode.parentNode === dots[i]) show(i + 1);
    });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); }); });
    var prev = $('[data-hero-prev]', root), next = $('[data-hero-next]', root);
    if (prev) prev.addEventListener('click', function () { show(i - 1); });
    if (next) next.addEventListener('click', function () { show(i + 1); });
    if (playBtn) {
      setPlayButton(playBtn, motion, 'slideshow');
      playBtn.addEventListener('click', function () {
        var paused = root.classList.toggle('is-paused');
        setPlayButton(playBtn, !paused, 'slideshow');
      });
    }
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(i - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
    });

    /* Swipe on touch screens */
    var sx = null, sy = 0;
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointercancel', function () { sx = null; });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1));
    });

    /* Hold while scrolled away */
    new IntersectionObserver(function (entries) {
      root.classList.toggle('is-held', !entries[0].isIntersecting);
    }, { threshold: 0.05 }).observe(root);

    /* The first photo loads first; the rest follow once the page has settled */
    function warm() { slides.forEach(function (s) { var img = $('img', s); if (img) img.loading = 'eager'; }); }
    if (document.readyState === 'complete') setTimeout(warm, 400);
    else window.addEventListener('load', function () { setTimeout(warm, 400); });
  }

  /* 3 — Reel player ------------------------------------------------------------
     An auto-sliding carousel of vertical films. Only the active reel loads a
     player; it plays muted and the slider moves on after SLIDE_MS (or sooner
     when the film ends). Prev / next, play / pause and sound are always shown. */
  function initReelPlayer() {
    var root = $('[data-reelplayer]');
    if (!root) return;
    var rail = $('.rp-track', root);
    var slides = $$('.rp-slide', root), n = slides.length;
    if (!n) return;
    var prevBtn = $('[data-rp-prev]', root), nextBtn = $('[data-rp-next]', root);
    var playBtn = $('[data-rp-play]', root), muteBtn = $('[data-rp-mute]', root);
    var bar = $('.rp-progress i', root), count = $('.rp-count', root), status = $('[data-rp-status]', root);
    var SLIDE_MS = 6000; /* how long each reel shows before the slider moves on */
    var i = 0, playing = motion, muted = true, inView = false, frame = null, timer = null, startedAt = 0, left = SLIDE_MS;
    var pad = function (x) { return String(x).padStart(2, '0'); };
    var caption = function (s) { var c = $('.rp-caption', s); return c ? c.textContent.trim() : ''; };

    root.classList.add('is-enhanced');
    slides.forEach(function (s, k) {
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', 'slide');
      s.setAttribute('aria-label', (k + 1) + ' of ' + n + ': ' + caption(s));
      /* The active poster toggles play instead of leaving the page */
      $('.rp-poster', s).addEventListener('click', function (e) {
        if (k !== i) return;
        e.preventDefault();
        togglePlay();
      });
    });

    function center() {
      var s = slides[i];
      var x = s.offsetLeft + s.offsetWidth / 2 - root.clientWidth / 2;
      /* Keep the strip against its ends: no empty space before the first reel or after the last */
      var maxX = Math.max(0, rail.offsetWidth - root.clientWidth);
      x = Math.min(maxX, Math.max(0, x));
      rail.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0)';
    }
    function restartBar() {
      if (!bar) return;
      bar.style.animation = 'none';
      void bar.offsetWidth;
      bar.style.animation = 'rp-fill ' + SLIDE_MS + 'ms linear forwards';
      bar.style.animationPlayState = playing && inView ? 'running' : 'paused';
    }
    function stopTimer() {
      if (timer) { clearTimeout(timer); timer = null; left -= performance.now() - startedAt; }
      if (bar) bar.style.animationPlayState = 'paused';
    }
    function startTimer() {
      if (!playing || !inView || timer) return;
      startedAt = performance.now();
      timer = setTimeout(function () { timer = null; go(i + 1); }, Math.max(0, left));
      if (bar) bar.style.animationPlayState = 'running';
    }
    function unmount() {
      if (frame) { ytHandlers.delete(frame.contentWindow); frame.parentNode.remove(); frame = null; }
      slides.forEach(function (s) { s.classList.remove('is-playing'); });
    }
    function mount() {
      unmount();
      var s = slides[i], id = s.getAttribute('data-yt');
      if (!id) return;
      var box = el('div', 'rp-frame');
      box.setAttribute('aria-hidden', 'true');
      frame = ytFrame(id, { autoplay: playing, loop: false, title: caption(s) });
      box.appendChild(frame);
      s.appendChild(box);
      var mine = frame;
      ytHandlers.set(frame.contentWindow, function (d) {
        if (mine !== frame) return;
        var st = ytState(d);
        if (st === 1) {
          setTimeout(function () { if (mine === frame) s.classList.add('is-playing'); }, 700);
          if (!muted) ytCommand(frame, 'unMute');
          if (!playing || !inView) ytCommand(frame, 'pauseVideo');
        } else if (st === 0 && playing) {
          stopTimer(); go(i + 1);
        }
      });
    }
    function go(k, byUser) {
      i = (k + n) % n;
      slides.forEach(function (s, j) {
        var on = j === i;
        s.classList.toggle('is-active', on);
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      });
      center();
      if (count) count.textContent = pad(i + 1) + ' / ' + pad(n);
      if (byUser && status) status.textContent = slides[i].getAttribute('aria-label');
      if (timer) { clearTimeout(timer); timer = null; }
      left = SLIDE_MS;
      restartBar();
      startTimer();
      if (inView) mount(); else unmount();
    }
    function togglePlay() {
      playing = !playing;
      setPlayButton(playBtn, playing, 'films');
      if (playing) {
        if (!frame && inView) mount(); else ytCommand(frame, 'playVideo');
        startTimer();
        track('video_play', { source: 'reels', id: slides[i].getAttribute('data-yt') });
      } else {
        ytCommand(frame, 'pauseVideo');
        stopTimer();
      }
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { go(i - 1, true); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(i + 1, true); });
    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (muteBtn) muteBtn.addEventListener('click', function () {
      muted = !muted;
      setMuteButton(muteBtn, muted);
      ytCommand(frame, muted ? 'mute' : 'unMute');
      if (!muted && !playing) togglePlay();
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
    });
    /* Swipe */
    var sx = null;
    rail.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    rail.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), true);
    });
    window.addEventListener('resize', center);

    /* Only play while the player is on screen */
    function setInView(v) {
      inView = v;
      if (inView) { if (!frame) mount(); startTimer(); if (bar && playing) bar.style.animationPlayState = 'running'; }
      else { stopTimer(); unmount(); }
    }
    new IntersectionObserver(function (entries) { setInView(entries[0].isIntersecting); }, { threshold: 0.35 }).observe(root);

    setPlayButton(playBtn, playing, 'films');
    setMuteButton(muteBtn, true);
    go(0);
  }

  /* 4 — Reviews -------------------------------------------------------------
     Shows the real aggregate ratings, and — when API access is configured —
     a selection of recent 4- and 5-star reviews from Google and Tripadvisor.
     The section says it is a selection and links to every review. */
  var R = CFG.reviews || {};
  var nf = new Intl.NumberFormat('en-IN');

  function setSummary(source, data) {
    if (!data || data.rating == null) return;
    var rating = Number(data.rating);
    $$('[data-rating="' + source + '"]').forEach(function (n) {
      if (n.hasAttribute('data-count-to')) n.setAttribute('data-count-to', rating.toFixed(1));
      n.textContent = rating.toFixed(1);
    });
    $$('[data-count="' + source + '"]').forEach(function (n) { if (data.count != null) n.textContent = nf.format(data.count); });
    $$('[data-stars="' + source + '"]').forEach(function (n) {
      n.style.setProperty('--r', rating);
      n.setAttribute('aria-label', rating.toFixed(1) + ' out of 5 stars');
    });
    if (data.url) $$('[data-link="' + source + '"]').forEach(function (a) { a.href = data.url; });
  }

  function loadMaps(key) {
    if (window.google && window.google.maps && window.google.maps.importLibrary) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      window.__sachikaMapsReady = function () { resolve(); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly&loading=async&callback=__sachikaMapsReady';
      s.async = true;
      s.onerror = function () { reject(new Error('Google Maps script failed to load')); };
      document.head.appendChild(s);
    });
  }

  function loadGoogle() {
    return loadMaps(R.googleApiKey)
      .then(function () { return window.google.maps.importLibrary('places'); })
      .then(function (lib) {
        var Place = lib.Place;
        var found = R.googlePlaceId
          ? Promise.resolve(new Place({ id: R.googlePlaceId }))
          : Place.searchByText({ textQuery: R.googlePlaceQuery, fields: ['id'], maxResultCount: 1 }).then(function (res) {
              if (!res.places || !res.places.length) throw new Error('Hotel not found on Google');
              return res.places[0];
            });
        return found.then(function (place) {
          return place.fetchFields({ fields: ['rating', 'userRatingCount', 'reviews', 'googleMapsURI'] }).then(function () { return place; });
        });
      })
      .then(function (place) {
        var url = place.googleMapsURI || R.googleUrl;
        return {
          source: 'google', rating: place.rating, count: place.userRatingCount, url: url,
          reviews: (place.reviews || []).map(function (r) {
            var a = r.authorAttribution || {};
            return {
              source: 'google', rating: r.rating, text: r.text || '',
              author: a.displayName || 'Google user', authorUrl: a.uri || '',
              time: r.publishTime ? new Date(r.publishTime).getTime() : 0,
              when: r.relativePublishTimeDescription || '', url: url
            };
          })
        };
      });
  }

  function loadTripadvisor() {
    return fetch(R.tripadvisorEndpoint, { headers: { Accept: 'application/json' } })
      .then(function (res) { if (!res.ok) throw new Error('Tripadvisor proxy ' + res.status); return res.json(); })
      .then(function (d) {
        var url = d.url || R.tripadvisorUrl;
        return {
          source: 'tripadvisor', rating: d.rating, count: d.count, url: url,
          reviews: (d.reviews || []).map(function (r) {
            return {
              source: 'tripadvisor', rating: Number(r.rating), text: r.text || '', title: r.title || '',
              author: r.author || 'Tripadvisor traveller', authorUrl: '',
              time: r.time ? new Date(r.time).getTime() : 0, when: r.when || '', url: r.url || url
            };
          })
        };
      });
  }

  function relative(ts) {
    if (!ts) return '';
    var days = Math.round((Date.now() - ts) / 864e5);
    if (days < 1) return 'today';
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    if (days < 14) return 'a week ago';
    if (days < 60) return Math.round(days / 7) + ' weeks ago';
    if (days < 365) return Math.round(days / 30) + ' months ago';
    return Math.round(days / 365) + (days < 730 ? ' year ago' : ' years ago');
  }

  function card(r) {
    var li = el('li', 'review-card');
    var head = el('div', 'review-head');
    var src = el('span', 'review-source review-source--' + r.source, r.source === 'google' ? 'Google' : 'Tripadvisor');
    var stars = el('span', 'stars');
    stars.style.setProperty('--r', r.rating);
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', r.rating + ' out of 5 stars');
    head.appendChild(src);
    head.appendChild(stars);
    li.appendChild(head);
    if (r.title) li.appendChild(el('p', 'review-title', r.title));
    var quote = el('blockquote', 'review-text');
    quote.appendChild(el('p', null, r.text.trim()));
    li.appendChild(quote);
    var foot = el('p', 'review-meta');
    var who = r.authorUrl ? el('a', 'link-plain', r.author) : el('span', null, r.author);
    if (r.authorUrl) { who.href = r.authorUrl; who.target = '_blank'; who.rel = 'noopener'; }
    foot.appendChild(who);
    var when = r.when || relative(r.time);
    if (when) foot.appendChild(el('span', 'review-when', when));
    li.appendChild(foot);
    var link = el('a', 'text-link', r.source === 'google' ? 'Read on Google' : 'Read on Tripadvisor');
    link.href = r.url; link.target = '_blank'; link.rel = 'noopener';
    li.appendChild(link);
    return li;
  }

  function render(list) {
    var box = $('[data-reviews-list]');
    if (!box) return;
    box.innerHTML = '';
    list.forEach(function (r) { box.appendChild(card(r)); });
    var note = $('[data-reviews-note]');
    if (note) note.hidden = false;
    $$('[data-reviews-fallback]').forEach(function (n) { n.hidden = true; });
    syncScroller();
  }

  /* Previous / next for the review row */
  var prev = $('[data-rv-prev]'), next = $('[data-rv-next]'), row = $('[data-reviews-list]');
  function syncScroller() {
    if (!row || !prev || !next) return;
    prev.disabled = row.scrollLeft <= 4;
    next.disabled = row.scrollLeft >= row.scrollWidth - row.clientWidth - 4;
    var controls = prev.parentElement;
    if (controls) controls.hidden = row.scrollWidth <= row.clientWidth + 4;
  }
  function step(dir) {
    var first = row.firstElementChild;
    var w = first ? first.getBoundingClientRect().width + 24 : row.clientWidth * 0.8;
    row.scrollBy({ left: dir * w, behavior: motion ? 'smooth' : 'auto' });
  }

  function initReviews() {
    var fb = R.fallback || {};
    setSummary('google', { rating: fb.google && fb.google.rating, count: fb.google && fb.google.count, url: R.googleUrl });
    setSummary('tripadvisor', { rating: fb.tripadvisor && fb.tripadvisor.rating, count: fb.tripadvisor && fb.tripadvisor.count, url: R.tripadvisorUrl });

    if (row && prev && next) {
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      var t; row.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(syncScroller, 60); }, { passive: true });
      window.addEventListener('resize', syncScroller);
      syncScroller();
    }

    var jobs = [];
    if (R.googleApiKey) jobs.push(loadGoogle);
    if (R.tripadvisorEndpoint) jobs.push(loadTripadvisor);
    var section = $('[data-reviews]');
    if (!jobs.length || !section) return;

    /* Fetch once the page has settled (or sooner if the guest scrolls to the reviews),
       and cache the result for six hours so repeat views don't spend API calls. */
    /* The key includes the sources, so changing config.js never shows stale data */
    var CACHE_KEY = 'sachika:reviews:v1:' + (R.googleApiKey ? 'g:' + (R.googlePlaceId || R.googlePlaceQuery) : '') + '|' + (R.tripadvisorEndpoint || '');
    var TTL = 6 * 36e5;
    function readCache() {
      try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && Date.now() - c.t < TTL ? c.sets : null; } catch (e) { return null; }
    }
    function writeCache(sets) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), sets: sets })); } catch (e) { /* storage unavailable */ }
    }
    var started = false;
    function go() {
      if (started) return; started = true;
      var cached = readCache();
      (cached ? Promise.resolve(cached) : Promise.all(jobs.map(function (job) {
        return job().catch(function (err) { if (window.console) console.warn('[reviews]', err.message); return null; });
      })).then(function (sets) { if (sets.some(Boolean)) writeCache(sets); return sets; })).then(function (sets) {
        var all = [];
        sets.forEach(function (s) { if (!s) return; setSummary(s.source, s); all = all.concat(s.reviews); });
        var min = R.minRating || 4, minLen = R.minLength || 40;
        var best = all
          .filter(function (r) { return r.rating >= min && r.text && r.text.trim().length >= minLen; })
          .sort(function (a, b) { return (b.time || 0) - (a.time || 0); })
          .slice(0, R.max || 9);
        if (best.length) { render(best); track('reviews_loaded', { count: best.length }); }
      });
    }
    new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { go(); obs.disconnect(); }
    }, { rootMargin: '600px 0px' }).observe(section);
    setTimeout(go, 3500);
  }

  function boot() { initWords(); initProgress(); initCounters(); initHeroSlider(); initReelPlayer(); initReviews(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
