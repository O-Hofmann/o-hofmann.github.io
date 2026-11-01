/* ==========================================================================
   Klub malých kolejí – skript webu
   1  Menu (mobilní tlačítko, rozbalovací fotogalerie)
   2  Složky v galeriích (alba se otevírají po kliknutí)
   3  Prohlížeč fotografií (šipky, klávesnice, přejetí prstem)
   4  Aktuality (nejnovější 3 naplno, starší sbalené) a odkaz na úvodní stránce
   5  Přepínač tmavého a světlého režimu
   7  Spořič dat (tlačítko v hlavičce)
   8  Nadcházející akce (schová se po datu), kopírování kontaktů, tlačítko Nahoru
   6  Kolážová fotka na úvodu: dlaždice se po jedné pomalu vymění za další fotku 
   ========================================================================== */
(function () {
  'use strict';

  /* 1  Menu ---------------------------------------------------------------- */
  var nav = document.getElementById('site-nav');
  var menuBtn = document.getElementById('menu-btn');
  var gallery = document.getElementById('gallery-menu');

  function setGallery(open) {
    if (!gallery) return;
    var btn = gallery.querySelector('button');
    gallery.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  if (gallery) {
    gallery.querySelector('button').addEventListener('click', function (e) {
      e.stopPropagation();
      setGallery(!gallery.classList.contains('is-open'));
    });
    document.addEventListener('click', function (e) {
      if (!gallery.contains(e.target)) setGallery(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || lbOpen()) return;
    setGallery(false);
    if (nav && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.focus();
    }
  });


  /* 2  Složky v galeriích -------------------------------------------------- */
  function czPhotos(n) {
    if (n === 1) return '1 fotografie';
    if (n >= 2 && n <= 4) return n + ' fotografie';
    return n + ' fotografií';
  }

  function initAlbums(box) {
    var albums = Array.prototype.slice.call(box.querySelectorAll('.album'));
    if (!albums.length) return;

    var grid = document.createElement('div');
    grid.className = 'folders';
    albums.forEach(function (album) {
      var first = album.querySelector('img');
      var count = album.querySelectorAll('.photo').length;
      var a = document.createElement('a');
      a.className = 'folder';
      a.href = '#' + album.id;
      a.innerHTML = '<span class="folder-cover"><img loading="lazy" decoding="async" alt=""></span>' +
                    '<span class="folder-title"></span><span class="folder-count"></span>';
      a.querySelector('img').src = first ? first.getAttribute('src') : '';
      a.querySelector('.folder-title').textContent = album.getAttribute('data-title');
      a.querySelector('.folder-count').textContent = czPhotos(count);
      grid.appendChild(a);

      var back = document.createElement('a');
      back.className = 'btn album-back';
      back.href = location.pathname;
      back.textContent = '← Všechna alba';
      back.addEventListener('click', function (e) {
        e.preventDefault();
        history.pushState(null, '', location.pathname);
        show();
        box.scrollIntoView({ block: 'start' });
      });
      album.insertBefore(back, album.firstChild);
    });
    box.insertBefore(grid, box.firstChild);
    box.classList.add('is-enhanced');

    function show() {
      var id = decodeURIComponent(location.hash.replace('#', ''));
      var found = false;
      albums.forEach(function (album) {
        var open = album.id === id;
        album.classList.toggle('is-open', open);
        if (open) found = true;
      });
      box.classList.toggle('has-open', found);
    }
    window.addEventListener('hashchange', function () {
      show();
      box.scrollIntoView({ block: 'start' });
    });
    show();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.albums'), initAlbums);


  /* 3  Prohlížeč fotografií ------------------------------------------------ */
  var lb, lbImg, lbCap, lbCount, lbFig, lbClose, lbPrev, lbNext;
  var items = [], index = 0, lastFocus = null, touchX = null;

  function lbOpen() { return lb && !lb.hidden; }

  function build() {
    lb = document.createElement('div');
    lb.className = 'lb';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Prohlížeč fotografií');
    lb.innerHTML =
      '<button class="lb-btn lb-close" type="button" aria-label="Zavřít">×</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Předchozí fotografie">‹</button>' +
      '<figure class="lb-fig"><img alt=""><figcaption><span class="lb-cap"></span><span class="lb-count"></span></figcaption></figure>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Další fotografie">›</button>';
    document.body.appendChild(lb);

    lbFig = lb.querySelector('.lb-fig');
    lbImg = lb.querySelector('img');
    lbCap = lb.querySelector('.lb-cap');
    lbCount = lb.querySelector('.lb-count');
    lbClose = lb.querySelector('.lb-close');
    lbPrev = lb.querySelector('.lb-prev');
    lbNext = lb.querySelector('.lb-next');

    lbClose.addEventListener('click', close);
    lbPrev.addEventListener('click', function () { go(-1); });
    lbNext.addEventListener('click', function () { go(1); });
    lb.addEventListener('click', function (e) {
      if (e.target === lb) close();
    });
    lbImg.addEventListener('load', function () { lbFig.classList.remove('is-loading'); });
    initZoom();
    lb.addEventListener('touchstart', function (e) { touchX = e.touches.length === 1 ? e.changedTouches[0].clientX : null; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null || zoom.scale > 1.02 || zoom.gesture) { touchX = null; return; }
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }


  /* přiblížení fotky: dvojklik / dvojité klepnutí, kolečko myši, dva prsty; posun tažením */
  var zoom = { scale: 1, x: 0, y: 0, gesture: false };
  var pinch = null, lastTap = 0, lastToggle = 0;

  function applyZoom() {
    lbImg.style.transform = zoom.scale > 1.001
      ? 'translate(' + zoom.x + 'px,' + zoom.y + 'px) scale(' + zoom.scale + ')' : '';
    lbImg.classList.toggle('is-zoomed', zoom.scale > 1.001);
  }
  function resetZoom() { zoom.scale = 1; zoom.x = 0; zoom.y = 0; zoom.gesture = false; pinch = null; if (lbImg) applyZoom(); }
  function clampPan() {
    var mx = Math.max(0, (zoom.scale - 1) * lbImg.clientWidth / 2);
    var my = Math.max(0, (zoom.scale - 1) * lbImg.clientHeight / 2);
    zoom.x = Math.max(-mx, Math.min(mx, zoom.x));
    zoom.y = Math.max(-my, Math.min(my, zoom.y));
  }
  function setScale(s) {
    zoom.scale = Math.max(1, Math.min(5, s));
    if (zoom.scale <= 1.001) { zoom.scale = 1; zoom.x = 0; zoom.y = 0; } else { clampPan(); }
    applyZoom();
  }
  function tdist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function initZoom() {
    lbImg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (Date.now() - lastToggle < 600) return;          /* dvojité klepnutí už vyřídil dotykový kód */
      setScale(zoom.scale > 1 ? 1 : 2.5);
    });
    lb.addEventListener('wheel', function (e) {
      e.preventDefault();
      setScale(zoom.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
    }, { passive: false });

    /* myš: tažení přiblížené fotky */
    var drag = null;
    lb.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || zoom.scale <= 1 || e.target.closest('.lb-btn')) return;
      drag = { x: e.clientX, y: e.clientY };
    });
    lb.addEventListener('pointermove', function (e) {
      if (!drag) return;
      zoom.x += e.clientX - drag.x; zoom.y += e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      clampPan(); applyZoom();
    });
    var endDrag = function () { drag = null; };
    lb.addEventListener('pointerup', endDrag);
    lb.addEventListener('pointercancel', endDrag);

    /* dotyk: dva prsty = přiblížení, jeden prst na přiblížené fotce = posun, dvojité klepnutí = přiblížit / zpět.
       Používá se jen dotykové API (bez touch-action: none), jinak by prohlížeč zahazoval první klepnutí po přejetí prstem. */
    var pan = null;
    lb.addEventListener('touchstart', function (e) {
      if (e.target.closest('.lb-btn')) return;
      if (e.touches.length === 2) { pinch = { d: tdist(e.touches), s: zoom.scale }; zoom.gesture = true; pan = null; }
      else if (e.touches.length === 1) {
        pan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.target === lbImg) {
          var now = Date.now();
          if (now - lastTap < 300) { setScale(zoom.scale > 1 ? 1 : 2.5); lastTap = 0; lastToggle = now; zoom.gesture = true; } else { lastTap = now; }
        }
      }
    }, { passive: true });
    lb.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        setScale(pinch.s * tdist(e.touches) / pinch.d);
      } else if (e.touches.length === 1 && zoom.scale > 1 && pan) {
        e.preventDefault();
        zoom.x += e.touches[0].clientX - pan.x; zoom.y += e.touches[0].clientY - pan.y;
        pan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        clampPan(); applyZoom();
      }
    }, { passive: false });
    var tEnd = function (e) {
      if (e.touches.length < 2) pinch = null;
      if (e.touches.length === 1) pan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (e.touches.length === 0) { pan = null; setTimeout(function () { zoom.gesture = false; }, 0); }
    };
    lb.addEventListener('touchend', tEnd, { passive: true });
    lb.addEventListener('touchcancel', tEnd, { passive: true });
    /* Safari na iPhonu: zabránit přibližování celé stránky gestem */
    lb.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  }

  function render() {
    resetZoom();
    var it = items[index];
    lbFig.classList.add('is-loading');
    lbImg.src = it.href;
    lbImg.alt = it.caption;
    lbCap.textContent = it.caption;
    lbCount.textContent = (index + 1) + ' / ' + items.length;
    [index - 1, index + 1].forEach(function (i) {
      if (items[i]) { var pre = new Image(); pre.src = items[i].href; }
    });
  }

  function go(step) {
    if (items.length < 2) return;
    index = (index + step + items.length) % items.length;
    render();
  }

  function open(group, link) {
    if (!lb) build();
    var links = Array.prototype.slice.call(group.querySelectorAll('.photo a'));
    items = links.map(function (a) {
      var fig = a.closest('.photo');
      var cap = fig && fig.querySelector('figcaption');
      var img = a.querySelector('img');
      return {
        href: a.getAttribute('href'),
        caption: cap ? cap.textContent.trim() : (img ? img.alt : '')
      };
    });
    index = Math.max(0, links.indexOf(link));
    lastFocus = link;
    lb.classList.toggle('lb--single', items.length < 2);
    lb.hidden = false;
    document.documentElement.classList.add('lb-open');
    render();
    lbClose.focus();
  }

  function close() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.documentElement.classList.remove('lb-open');
    if (lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('[data-lightbox] .photo a');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open(link.closest('[data-lightbox]'), link);
  });

  document.addEventListener('keydown', function (e) {
    if (!lbOpen()) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowLeft') { go(-1); }
    else if (e.key === 'ArrowRight') { go(1); }
    else if (e.key === 'Home') { index = 0; render(); }
    else if (e.key === 'End') { index = items.length - 1; render(); }
    else if (e.key === 'Tab') {                       /* focus zůstane v prohlížeči */
      var btns = items.length < 2 ? [lbClose] : [lbClose, lbPrev, lbNext];
      var i = btns.indexOf(document.activeElement);
      e.preventDefault();
      btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    }
  });


  /* Popisek fotky se píše jen pod fotku, alt a název odkazu si skript vezme z něj.
     Při kopírování starých příspěvků tak nezůstane starý, nesprávný alt. */
  Array.prototype.forEach.call(document.querySelectorAll('.photo'), function (fig) {
    var cap = fig.querySelector('figcaption');
    var img = fig.querySelector('img');
    if (cap && img && cap.textContent.trim()) img.alt = cap.textContent.trim();
  });

  /* 4  Aktuality ------------------------------------------------------------ */
  var FULL_POSTS = 3;   /* kolik nejnovějších příspěvků zůstane rozbalených */

  function collapsePost(post, n) {
    var title = post.querySelector('.post-title');
    var date = post.querySelector('.post-date');
    var label;
    if (title) {
      label = title.textContent.trim();
    } else {                                   /* příspěvek bez nadpisu */
      label = 'Aktualita z ' + (date ? date.textContent.replace(/^Publikov\S*\s*/, '') : '');
      title = document.createElement('h2');
      title.className = 'post-title';
      post.insertBefore(title, post.firstChild);
    }
    var body = document.createElement('div');
    body.className = 'post-body';
    body.id = 'post-body-' + n;
    body.hidden = true;
    Array.prototype.slice.call(post.children).forEach(function (el) {
      if (el !== title && el !== date) body.appendChild(el);
    });
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'post-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', body.id);
    btn.textContent = label;
    title.textContent = '';
    title.appendChild(btn);
    post.appendChild(body);
    post.classList.add('is-collapsed');
    btn.addEventListener('click', function () {
      var open = body.hidden;
      body.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      post.classList.toggle('is-collapsed', !open);
    });
  }

  var posts = document.querySelectorAll('.posts > .post');
  Array.prototype.forEach.call(posts, function (post, i) {
    if (i >= FULL_POSTS) collapsePost(post, i);
  });

  /* úvodní stránka: odkaz na nejnovější aktualitu se vždy načte ze stránky Aktuality */
  var strip = document.getElementById('news-strip');
  if (strip && window.fetch && window.DOMParser) {
    fetch('Aktuality.html').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      if (!t) return;
      var first = new DOMParser().parseFromString(t, 'text/html').querySelector('.post');
      if (!first) return;
      var title = first.querySelector('.post-title');
      var date = first.querySelector('.post-date');
      if (title) strip.querySelector('.news-title').textContent = title.textContent.trim();
      if (date) strip.querySelector('.news-date').textContent = date.textContent.trim();
    }).catch(function () { /* zůstane text vytvořený při sestavení stránky */ });
  }

  /* 5  Přepínač tmavého a světlého režimu --------------------------------- */
  var themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var current = function () {
      var t = document.documentElement.getAttribute('data-theme');
      return t || (mq && mq.matches ? 'dark' : 'light');
    };
    var paint = function () {
      var dark = current() === 'dark';
      themeBtn.innerHTML = dark ? SUN : MOON;      /* ikona ukazuje, na co se přepne */
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    };
    themeBtn.hidden = false;
    paint();
    themeBtn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('kmk-theme', next); } catch (e) {}
      paint();
    });
  }

  /* 6  Kolážová fotka na úvodu ---------------------------------------------- */
  var collage = document.querySelector('.collage');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (collage && !reduce && document.documentElement.getAttribute('data-save') !== 'on') {
    var srcs = Array.prototype.map.call(collage.querySelectorAll(':scope > img'), function (i) { return i.getAttribute('src'); });
    var SLOTS = 4, INTERVAL = 6000;
    if (srcs.length > SLOTS) {
      var live = document.createElement('div');
      live.className = 'collage-live';
      var tiles = [], ptr = Math.floor(Math.random() * srcs.length), timer = null;   /* začne na náhodném místě, návštěvník pokaždé uvidí jiné fotky */
      for (var t = 0; t < SLOTS; t++) {
        var tile = document.createElement('div'); tile.className = 'collage-tile';
        var im = document.createElement('img'); im.alt = ''; im.src = srcs[t]; im.className = 'on';
        tile.appendChild(im); live.appendChild(tile); tiles.push(tile);
      }
      collage.appendChild(live);
      collage.classList.add('is-live');
      /* přednačtí se jen další sada, ne všechny fotky najednou */
      var preload = function () { for (var q = 0; q < SLOTS; q++) { var pi = new Image(); pi.src = srcs[(ptr + q) % srcs.length]; } };

      /* celý pás najednou: další sada fotek podle pořadí, po posledním se začíná znovu */
      var tick = function () {
        var shown = tiles.filter(function (el) { return el.offsetParent !== null; }).length || 1;   /* kolik jich je při této šířce vidět */
        tiles.forEach(function (tileEl, k) {
          if (tileEl.offsetParent === null) return;      /* skrytá dlaždice se nenačítá */
          var front = tileEl.querySelector('img.on');
          var back = document.createElement('img'); back.alt = ''; back.src = srcs[(ptr + k) % srcs.length];
          tileEl.appendChild(back);
          void back.offsetWidth;
          back.className = 'on'; front.className = '';
          setTimeout(function () { if (front.parentNode) front.parentNode.removeChild(front); }, 1900);
        });
        ptr = (ptr + shown) % srcs.length;
        preload();
      };
      preload();
      var start = function () { if (!timer && !document.hidden) timer = setInterval(tick, INTERVAL); };
      var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
      start();
    }
  }

  /* 7  Spořič dat ---------------------------------------------------------- */
  /* tlačítko v hlavičce (znak mobilních dat), odkaz v patičce a položka v menu na telefonu */
  var saveBtns = document.querySelectorAll('[data-save-toggle]');
  if (saveBtns.length) {
    var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20v-3M7 20v-6M11 20v-9"/><path d="M16 12V4M13.8 6.2L16 4l2.2 2.2"/><path d="M20.5 4v8M18.3 9.8l2.2 2.2 2.2-2.2"/></svg>';
    var saveOn = function () { return document.documentElement.getAttribute('data-save') === 'on'; };
    var onClick = function () {
      try { localStorage.setItem('kmk-save', saveOn() ? '0' : '1'); } catch (e) {}
      location.reload();        /* nejjistější: stránka se načte rovnou v úsporném režimu */
    };
    Array.prototype.forEach.call(saveBtns, function (btn) {
      btn.hidden = false;
      if (btn.id === 'save-btn') {
        btn.innerHTML = ICON;
        btn.setAttribute('aria-pressed', saveOn() ? 'true' : 'false');
      } else {
        btn.textContent = saveOn() ? 'Spořič dat je zapnutý – vypnout' : 'Spořič dat: méně fotek, méně dat – zapnout';
      }
      btn.addEventListener('click', onClick);
    });
  }

  /* 8  Akce, kopírování kontaktů, tlačítko Nahoru ----------------------------- */
  /* pruh s nadcházející akcí: ukáže se jen do data data-event-until (včetně) */
  Array.prototype.forEach.call(document.querySelectorAll('[data-event-until]'), function (el) {
    var until = new Date(el.getAttribute('data-event-until') + 'T23:59:59');
    if (!isNaN(until) && until >= new Date()) el.hidden = false;
  });

  /* e-maily a telefony: tlačítko Kopírovat */
  var COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { if (document.execCommand('copy')) done(); } catch (e) {}
    document.body.removeChild(ta);
  }
  Array.prototype.forEach.call(document.querySelectorAll('main a[href^="mailto:"], main a[href^="tel:"]'), function (a) {
    var text = a.textContent.trim();
    var wrap = document.createElement('span');
    wrap.className = 'copy-wrap';
    a.parentNode.insertBefore(wrap, a);
    wrap.appendChild(a);                       /* odkaz a tlačítko drží pohromadě, tlačítko neskočí na další řádek */
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy-btn'; b.innerHTML = COPY_ICON;
    b.setAttribute('aria-label', 'Kopírovat: ' + text); b.title = 'Kopírovat';
    var note = document.createElement('span');
    note.className = 'copy-note'; note.setAttribute('role', 'status');
    b.addEventListener('click', function () {
      copyText(text, function () {
        b.classList.add('is-done'); note.textContent = 'Zkopírováno'; note.classList.add('is-on');
        setTimeout(function () { b.classList.remove('is-done'); note.classList.remove('is-on'); }, 1800);
      });
    });
    wrap.appendChild(b);
    wrap.appendChild(note);
  });

  /* tlačítko Nahoru */
  var toTop = document.createElement('button');
  toTop.type = 'button'; toTop.className = 'to-top'; toTop.setAttribute('aria-label', 'Nahoru'); toTop.title = 'Nahoru';
  toTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>';
  document.body.appendChild(toTop);
  var noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: noMotion ? 'auto' : 'smooth' }); });
  var tick2 = false;
  window.addEventListener('scroll', function () {
    if (tick2) return;
    tick2 = true;
    requestAnimationFrame(function () {
      toTop.classList.toggle('is-shown', window.scrollY > 900);
      tick2 = false;
    });
  }, { passive: true });
})();
