(function () {
  /* ======================================================================
     Edit your projects here. They power the "Selected work" database on
     the home page (gallery + table views and the side peek).
     type   → one of TYPES below          status → Shipped | Ongoing | Archived
     hue    → cover color (0-360)         art    → cover shape (0, 1 or 2)
     ====================================================================== */
  var PROJECTS = [
    { name: 'Fieldnote', type: 'Product', year: 2026, role: 'Lead designer', stack: ['Figma', 'React Native', 'SQLite'], status: 'Ongoing', hue: 28, art: 0,
      blurb: 'Offline-first inspection app for site engineers.',
      summary: 'Inspectors lose signal in basements and stairwells. Fieldnote records photos, measurements and voice notes on the device and syncs when a connection returns.',
      did: ['Ran 14 ride-alongs on active construction sites.', 'Designed a one-handed capture flow with a three-tap path to a logged defect.', 'Prototyped sync-conflict states with the engineering team.'],
      result: 'Median report time fell from 42 to 26 minutes during the pilot.' },
    { name: 'Ledgerline', type: 'Web', year: 2025, role: 'Designer and developer', stack: ['TypeScript', 'React', 'D3'], status: 'Shipped', hue: 150, art: 2,
      blurb: 'Cash-flow dashboard for freelancers.',
      summary: 'Freelancers think in invoices, not accounts. Ledgerline projects the next 90 days of cash from unpaid invoices and recurring costs.',
      did: ['Built the forecast chart in D3 with a keyboard-accessible tooltip.', 'Wrote the CSV and PDF invoice import.', 'Designed the empty, late-payment and overdraft states.'],
      result: 'About 1,200 freelancers were using it weekly three months after launch.' },
    { name: 'Rental Atlas', type: 'Research', year: 2025, role: 'Researcher and designer', stack: ['Python', 'Observable', 'Figma'], status: 'Shipped', hue: 270, art: 1,
      blurb: 'Rent against local wages across 40 cities.',
      summary: 'A visual study of how rent moved against wages between 2015 and 2025, built from public housing and labor data.',
      did: ['Cleaned and joined five open datasets, with every transformation documented.', 'Designed small-multiple maps that stay legible on a phone.', 'Wrote the methodology note so others can reproduce the numbers.'],
      result: 'Cited in two municipal housing reports.' },
    { name: 'Tidepool UI', type: 'Open source', year: 2024, role: 'Maintainer', stack: ['TypeScript', 'Radix', 'Storybook'], status: 'Ongoing', hue: 200, art: 0,
      blurb: 'Accessible React components built on tokens.',
      summary: 'A component library where every color, space and radius comes from a token, and every component ships with keyboard and screen-reader behavior tested.',
      did: ['Defined the three-tier token model: raw, semantic, component.', 'Review every pull request for focus order and contrast.', 'Publish a short changelog note for each release.'],
      result: '2.4k GitHub stars and 31 contributors.' },
    { name: 'Studio Kiln', type: 'Web', year: 2024, role: 'Designer and developer', stack: ['Astro', 'Figma'], status: 'Shipped', hue: 340, art: 1,
      blurb: 'Site and class booking for a ceramics studio.',
      summary: 'A fast, photo-led site for a ceramics studio, with a booking flow that works for people reserving a class from a phone in the kiln room.',
      did: ['Photographed the studio and processed the images for a 90 KB page budget.', 'Designed a booking flow with three fields and no account.', 'Handed the owner a short guide for editing classes herself.'],
      result: 'Class bookings rose 35% in the first quarter.' },
    { name: 'Onboarding Rework', type: 'Product', year: 2023, role: 'Product designer', stack: ['Figma', 'Mixpanel'], status: 'Archived', hue: 95, art: 2,
      blurb: 'Cutting a nine-step signup down to four.',
      summary: 'The old signup asked for everything up front. We moved most questions to the moment they became useful and measured each step in Mixpanel.',
      did: ['Mapped drop-off for each of the nine original steps.', 'Tested three flows with 18 participants.', 'Shipped the winning flow behind a feature flag and rolled it out in stages.'],
      result: 'Activation rose from 31% to 49%.' }
  ];
  var TYPES = ['All', 'Product', 'Web', 'Research', 'Open source'];
  var TYPE_COLOR = { 'Product': 'blue', 'Web': 'green', 'Research': 'purple', 'Open source': 'orange' };
  var STATUS_COLOR = { 'Shipped': 'green', 'Ongoing': 'yellow', 'Archived': 'gray' };
  var SHAPES = [
    '<rect x="24" y="22" width="120" height="96" rx="8" class="s1"/><rect x="156" y="22" width="60" height="44" rx="8" class="s2"/><rect x="156" y="76" width="60" height="42" rx="8" class="s3"/>',
    '<circle cx="70" cy="70" r="44" class="s1"/><rect x="128" y="32" width="88" height="14" rx="7" class="s2"/><rect x="128" y="58" width="64" height="14" rx="7" class="s3"/><rect x="128" y="84" width="76" height="14" rx="7" class="s2"/>',
    '<rect x="28" y="70" width="28" height="52" rx="4" class="s2"/><rect x="68" y="44" width="28" height="78" rx="4" class="s1"/><rect x="108" y="28" width="28" height="94" rx="4" class="s3"/><rect x="148" y="56" width="28" height="66" rx="4" class="s1"/><rect x="188" y="36" width="28" height="86" rx="4" class="s2"/>'
  ];

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var hasPeek = !!$('peek');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tag(text, color) { return '<span class="tag t-' + color + '">' + esc(text) + '</span>'; }
  function art(p) {
    return '<svg viewBox="0 0 240 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + SHAPES[p.art] + '</svg>';
  }

  function syncScrim() {
    $('scrim').classList.toggle('on', hasPeek && $('peek').classList.contains('open'));
  }

  /* ---------- projects database + peek (home only) ---------- */
  var closePeek = function () {};
  if ($('dbView')) {
    var state = { type: 'All', q: '', view: 'gallery' };

    var visible = function () {
      var q = state.q.trim().toLowerCase();
      return PROJECTS.filter(function (p) {
        if (state.type !== 'All' && p.type !== state.type) return false;
        if (!q) return true;
        return (p.name + ' ' + p.blurb + ' ' + p.stack.join(' ') + ' ' + p.type).toLowerCase().indexOf(q) !== -1;
      });
    };
    var renderFilters = function () {
      $('filters').innerHTML = TYPES.map(function (t) {
        return '<button class="chip" type="button" data-type="' + esc(t) + '" aria-pressed="' + (state.type === t) + '">' + esc(t) + '</button>';
      }).join('');
    };
    var renderView = function () {
      var list = visible();
      var box = $('dbView');
      if (!list.length) {
        box.innerHTML = '<div class="empty">No projects match. Clear the search or pick another type.</div>';
        return;
      }
      if (state.view === 'gallery') {
        box.innerHTML = '<div class="gallery">' + list.map(function (p) {
          var i = PROJECTS.indexOf(p);
          return '<button class="card" type="button" data-i="' + i + '" style="--h:' + p.hue + '">' +
            '<div class="card-cover">' + art(p) + '</div>' +
            '<div class="card-body"><div class="card-title">' + esc(p.name) + '</div>' +
            '<div class="card-blurb">' + esc(p.blurb) + '</div>' +
            '<div class="card-meta">' + tag(p.type, TYPE_COLOR[p.type]) + tag(String(p.year), 'gray') + '</div></div></button>';
        }).join('') + '</div>';
      } else {
        box.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Year</th><th>Stack</th><th>Status</th></tr></thead><tbody>' +
          list.map(function (p) {
            var i = PROJECTS.indexOf(p);
            return '<tr class="row" data-i="' + i + '"><td><button class="linkbtn" type="button" data-i="' + i + '">' + esc(p.name) + '</button></td>' +
              '<td>' + tag(p.type, TYPE_COLOR[p.type]) + '</td><td>' + p.year + '</td>' +
              '<td><div class="cell-tags">' + p.stack.map(function (s) { return tag(s, 'gray'); }).join('') + '</div></td>' +
              '<td>' + tag(p.status, STATUS_COLOR[p.status]) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
    };

    $('filters').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state.type = b.getAttribute('data-type');
      renderFilters();
      renderView();
    });
    $('q').addEventListener('input', function (e) { state.q = e.target.value; renderView(); });
    document.querySelector('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.view = b.getAttribute('data-view');
      document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', String(t === b)); });
      $('dbView').setAttribute('aria-labelledby', b.id);
      renderView();
    });

    var lastFocus = null;
    var openPeek = function (i) {
      var p = PROJECTS[i];
      lastFocus = document.activeElement;
      $('peekBody').innerHTML =
        '<div class="peek-cover" style="--h:' + p.hue + '">' + art(p) + '</div>' +
        '<h3 id="peekTitle">' + esc(p.name) + '</h3>' +
        '<div class="props">' +
          '<div class="prop"><div class="prop-k">Type</div><div class="prop-v">' + tag(p.type, TYPE_COLOR[p.type]) + '</div></div>' +
          '<div class="prop"><div class="prop-k">Year</div><div class="prop-v">' + p.year + '</div></div>' +
          '<div class="prop"><div class="prop-k">Role</div><div class="prop-v">' + esc(p.role) + '</div></div>' +
          '<div class="prop"><div class="prop-k">Stack</div><div class="prop-v">' + p.stack.map(function (s) { return tag(s, 'gray'); }).join('') + '</div></div>' +
          '<div class="prop"><div class="prop-k">Status</div><div class="prop-v">' + tag(p.status, STATUS_COLOR[p.status]) + '</div></div>' +
        '</div>' +
        '<h4>Summary</h4><p>' + esc(p.summary) + '</p>' +
        '<h4>What I did</h4><ul>' + p.did.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<div class="callout result"><svg class="ic"><use href="#i-check"/></svg><p>' + esc(p.result) + '</p></div>';
      $('peek').classList.add('open');
      $('peek').setAttribute('aria-hidden', 'false');
      $('scrim').classList.add('on');
      $('peek').scrollTop = 0;
      $('peekClose').focus();
    };
    closePeek = function () {
      $('peek').classList.remove('open');
      $('peek').setAttribute('aria-hidden', 'true');
      syncScrim();
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    };
    $('dbView').addEventListener('click', function (e) {
      var el = e.target.closest('[data-i]');
      if (el) openPeek(Number(el.getAttribute('data-i')));
    });
    $('peekClose').addEventListener('click', closePeek);

    renderFilters();
    renderView();
  }

  if (hasPeek) {
    $('scrim').addEventListener('click', closePeek);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('peek').classList.contains('open')) closePeek();
    });
  }

  /* ---------- post ages ("3d", "4mo", "2y"), computed at view time ---------- */
  document.querySelectorAll('time.pl-age').forEach(function (t) {
    var then = new Date(t.getAttribute('datetime'));
    if (isNaN(then)) return;
    var days = Math.floor((Date.now() - then.getTime()) / 86400000);
    t.textContent = days < 1 ? 'today' : days < 31 ? days + 'd' : days < 365 ? Math.floor(days / 30) + 'mo' : Math.floor(days / 365) + 'y';
  });

  /* ---------- section rail (dots on the left, one per section) ---------- */
  (function () {
    var targets = [];
    var sections = document.querySelectorAll('main section[id]');
    if (sections.length) {
      sections.forEach(function (s) {
        var h = s.querySelector('h2');
        targets.push({ el: s, label: s.id === 'home' ? 'Intro' : (h ? h.textContent : s.id) });
      });
    } else {
      var title = document.querySelector('h1.title');
      if (title) targets.push({ el: title, label: 'Top' });
      // One dot per top-level topic: h2 if the post has any, otherwise h3
      var level = document.querySelector('.prose h2[id]') ? 'h2' : 'h3';
      document.querySelectorAll('.prose ' + level + '[id]').forEach(function (h) {
        targets.push({ el: h, label: h.textContent });
      });
    }
    if (targets.length < 2) return;

    var rail = document.createElement('nav');
    rail.className = 'rail';
    rail.setAttribute('aria-label', 'On this page');
    rail.innerHTML = targets.map(function (t, i) {
      return '<button class="rail-dot" type="button" data-i="' + i + '" aria-label="Go to ' + esc(t.label) + '">' +
        '<span class="rail-label">' + esc(t.label) + '</span></button>';
    }).join('');
    document.body.appendChild(rail);
    var dots = rail.querySelectorAll('.rail-dot');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    rail.addEventListener('click', function (e) {
      var b = e.target.closest('.rail-dot');
      if (!b) return;
      var el = targets[Number(b.getAttribute('data-i'))].el;
      var top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    });

    var current = -1;
    function update() {
      var line = window.innerHeight * 0.35;
      var active = 0;
      targets.forEach(function (t, i) { if (t.el.getBoundingClientRect().top <= line) active = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) active = targets.length - 1;
      if (active === current) return;
      current = active;
      dots.forEach(function (d, i) {
        d.classList.toggle('on', i === active);
        d.classList.toggle('past', i < active);
        if (i === active) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();

  /* ---------- theme (saved choice is applied early in <head>) ---------- */
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function paintThemeBtn() {
    var dark = isDark();
    $('themeBtn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    $('themeBtn').innerHTML = '<svg class="ic"><use href="#' + (dark ? 'i-sun' : 'i-moon') + '"/></svg>';
  }
  $('themeBtn').addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('portfolio-theme', next); } catch (e) {}
    paintThemeBtn();
  });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', paintThemeBtn);
  }
  paintThemeBtn();

  /* ---------- copy email ---------- */
  if ($('copyBtn')) {
    $('copyBtn').addEventListener('click', function () {
      var text = $('mailText').textContent;
      var label = $('copyLabel');
      function done() { label.textContent = 'Copied'; setTimeout(function () { label.textContent = 'Copy address'; }, 1600); }
      function fallback() {
        var r = document.createRange();
        r.selectNodeContents($('mailText'));
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        label.textContent = 'Press Ctrl+C';
      }
      try {
        navigator.clipboard.writeText(text).then(done, fallback);
      } catch (e) { fallback(); }
    });
  }
})();
