/* ==========================================================================
   Klub malých kolejí – skript webu
   1  Menu (mobilní tlačítko, rozbalovací fotogalerie)
   2  Složky v galeriích (alba se otevírají po kliknutí)
   3  Prohlížeč fotografií (šipky, klávesnice, přejetí prstem)
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
    lb.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function render() {
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
})();
