(function () {
  'use strict';
  var G = window.GAC, h = G.h;

  document.addEventListener('DOMContentLoaded', function () {
    G.config().then(function (c) {
      if (c.seaFlatUsd !== undefined) document.getElementById('sea-rate').textContent = G.money(c.seaFlatUsd).replace('.00', '');
      if (c.airUsdPerKg !== undefined) document.getElementById('air-rate').textContent = G.money(c.airUsdPerKg).replace('.00', '') + '/kg';
      if (c.airMinKg !== undefined) document.getElementById('air-min').textContent = c.airMinKg + ' kg minimum · about 1–2 weeks';
    });

    var q = G.qs('q');
    if (q) runSearch(q, 1);

    var grid = document.getElementById('featured-grid');
    G.api('/catalog/featured').then(function (items) {
      grid.textContent = '';
      if (!items.length) { grid.appendChild(h('p', { class: 'muted', text: 'Search above or paste a Taobao link to get started.' })); return; }
      items.forEach(function (p) { grid.appendChild(G.productCard(p)); });
    }).catch(function (e) { G.showError(grid, e); });

    document.getElementById('paste-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('paste-msg');
      msg.textContent = 'Looking up the product…';
      G.api('/catalog/from-link', { method: 'POST', body: { url: document.getElementById('link').value } })
        .then(function (p) { location.href = '/product.html?id=' + encodeURIComponent(p.id); })
        .catch(function (e) { G.showError(msg, e); });
    });
  });

  function runSearch(q, page) {
    var sec = document.getElementById('results-section');
    var out = document.getElementById('results');
    var more = document.getElementById('results-more');
    sec.hidden = false;
    document.getElementById('hero').hidden = true;
    document.getElementById('results-title').textContent = 'Results for “' + q + '”';
    if (page === 1) out.textContent = 'Searching…';
    G.api('/catalog/search?q=' + encodeURIComponent(q) + '&page=' + page).then(function (r) {
      if (page === 1) out.textContent = '';
      if (!r.items.length && page === 1) out.appendChild(h('p', { class: 'muted', text: 'Nothing found. Try other words, or paste a Taobao link below.' }));
      r.items.forEach(function (p) { out.appendChild(G.productCard(p)); });
      more.textContent = '';
      if (!r.sample && r.items.length && (!r.total || page * r.items.length < r.total)) {
        more.appendChild(h('button', { class: 'btn ghost', type: 'button', text: 'Show more', onclick: function () { runSearch(q, page + 1); } }));
      }
    }).catch(function (e) { G.showError(out, e); });
  }
})();
