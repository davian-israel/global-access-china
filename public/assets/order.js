(function () {
  'use strict';
  var G = window.GAC, h = G.h;

  document.addEventListener('DOMContentLoaded', function () {
    var ref = document.getElementById('ref');
    var em = document.getElementById('em');
    var out = document.getElementById('order');
    var last = null;
    try { last = JSON.parse(sessionStorage.getItem('gac_last_order') || 'null'); } catch (e) {}
    ref.value = G.qs('ref') || (last && last.ref) || '';
    em.value = G.qs('email') || (last && last.email) || '';
    if (G.qs('error') === 'payment') out.appendChild(h('div', { class: 'err', text: 'We couldn’t confirm your payment yet. If you were charged, it will update shortly. Contact us with your order reference if it doesn’t.' }));

    function load() {
      G.api('/orders/' + encodeURIComponent(ref.value.trim()) + '?email=' + encodeURIComponent(em.value.trim())).then(function (o) {
        out.textContent = '';
        var tl = h('ol', { class: 'timeline' });
        o.events.forEach(function (e) {
          tl.appendChild(h('li', null, h('strong', { text: e.label }), h('div', { class: 'small muted', text: new Date(e.at).toLocaleString() + (e.note ? ' · ' + e.note : '') })));
        });
        var lines = h('div', { class: 'stack', style: 'gap:6px' });
        o.items.forEach(function (i) {
          var opts = Object.keys(i.options || {}).map(function (k) { return i.options[k]; }).join(' · ');
          lines.appendChild(h('div', { class: 'rowline' }, h('span', { text: i.qty + ' × ' + i.title + (opts ? ' (' + opts + ')' : '') }), h('span', { text: G.money(i.unitUsd * i.qty) })));
        });
        lines.appendChild(h('div', { class: 'rowline total' }, h('span', { text: 'Total paid' }), h('span', { text: G.money(o.quote.total) })));
        out.appendChild(h('div', { class: 'stack' },
          h('div', { class: 'panel stack', style: 'gap:6px' }, h('div', { class: 'small muted', text: 'Order ' + o.ref + ' · ' + (o.shipMethod === 'air' ? 'by air' : 'by sea') }), h('h2', { style: 'font-size:24px', text: o.statusLabel })),
          h('div', { class: 'panel stack' }, h('h2', { style: 'font-size:18px', text: 'Progress' }), tl),
          h('div', { class: 'panel stack' }, h('h2', { style: 'font-size:18px', text: 'Items' }), lines)));
      }).catch(function (e) { G.showError(out, e); });
    }

    document.getElementById('lookup').addEventListener('submit', function (ev) { ev.preventDefault(); load(); });
    if (ref.value && em.value) load();
  });
})();
