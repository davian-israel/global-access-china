(function () {
  'use strict';
  var G = window.GAC, h = G.h;
  var auth = null, labels = {};

  document.addEventListener('DOMContentLoaded', function () {
    try { auth = sessionStorage.getItem('gac_admin') || null; } catch (e) {}
    document.getElementById('login').addEventListener('submit', function (ev) {
      ev.preventDefault();
      auth = 'Basic ' + btoa(document.getElementById('u').value + ':' + document.getElementById('p').value);
      start();
    });
    if (auth) start();
  });

  function start() {
    var out = document.getElementById('admin');
    G.api('/admin/statuses', { auth: auth }).then(function (l) {
      labels = l;
      try { sessionStorage.setItem('gac_admin', auth); } catch (e) {}
      document.getElementById('login').hidden = true;
      list(out, '');
    }).catch(function (e) {
      try { sessionStorage.removeItem('gac_admin'); } catch (x) {}
      G.showError(out, e.status === 401 ? { message: 'Wrong username or password.' } : e);
    });
  }

  function list(out, status) {
    out.textContent = 'Loading…';
    G.api('/admin/orders' + (status ? '?status=' + status : ''), { auth: auth }).then(function (rows) {
      out.textContent = '';
      var filter = h('select', { class: 'f', style: 'max-width:280px', 'aria-label': 'Filter by status', onchange: function () { list(out, filter.value); } },
        h('option', { value: '', text: 'All orders' }), Object.keys(labels).map(function (k) { return h('option', { value: k, text: labels[k], selected: k === status }); }));
      var tb = h('tbody');
      rows.forEach(function (o) {
        tb.appendChild(h('tr', null,
          h('td', null, h('button', { type: 'button', class: 'opt', text: o.ref, onclick: function () { detail(out, o.ref); } })),
          h('td', { text: new Date(o.created_at).toLocaleString() }),
          h('td', { text: o.name + ' · ' + o.phone }),
          h('td', { text: labels[o.status] || o.status }),
          h('td', { text: o.ship_method }),
          h('td', { text: G.money(o.total_usd) })));
      });
      out.appendChild(h('div', { class: 'stack' }, filter,
        h('div', { class: 'panel scroll' }, h('table', { class: 'admin' }, h('thead', null, h('tr', null, ['Order', 'Created', 'Customer', 'Status', 'Ship', 'Total'].map(function (t) { return h('th', { text: t }); }))), tb)),
        rows.length ? null : h('p', { class: 'muted', text: 'No orders yet.' })));
    }).catch(function (e) { G.showError(out, e); });
  }

  function detail(out, ref) {
    out.textContent = 'Loading…';
    G.api('/admin/orders/' + encodeURIComponent(ref), { auth: auth }).then(function (o) {
      out.textContent = '';
      var items = h('div', { class: 'stack', style: 'gap:8px' });
      o.items.forEach(function (i) {
        var opts = Object.keys(i.options || {}).map(function (k) { return k + ': ' + i.options[k]; }).join(' · ');
        items.appendChild(h('div', { class: 'line' }, h('div', { style: 'flex:1' },
          h('div', { style: 'font-weight:600', text: i.qty + ' × ' + i.title }),
          h('div', { class: 'small muted', lang: 'zh-Hans', text: i.titleZh }),
          h('div', { class: 'small', text: [opts, '¥' + i.priceCny + ' each', i.weightKg + ' kg'].filter(Boolean).join(' · ') }),
          i.sourceUrl ? h('a', { class: 'small', href: i.sourceUrl, target: '_blank', rel: 'noopener', text: 'Open on Taobao to buy' }) : null)));
      });
      var sel = h('select', { class: 'f' }, Object.keys(labels).map(function (k) { return h('option', { value: k, text: labels[k], selected: k === o.status }); }));
      var note = h('input', { class: 'f', placeholder: 'Note shown to the customer, e.g. tracking number' });
      var kg = h('input', { class: 'f', type: 'number', step: '0.01', min: '0', placeholder: 'Weighed kg', value: o.weighed_kg || '' });
      var msg = h('div');
      var ev = h('ol', { class: 'timeline' });
      o.events.forEach(function (e) { ev.appendChild(h('li', null, h('strong', { text: labels[e.status] || e.status }), h('div', { class: 'small muted', text: new Date(e.created_at).toLocaleString() + (e.note ? ' · ' + e.note : '') }))); });
      out.appendChild(h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'opt', style: 'align-self:flex-start', text: '← All orders', onclick: function () { list(out, ''); } }),
        h('div', { class: 'panel stack', style: 'gap:6px' }, h('h2', { style: 'font-size:22px', text: o.ref + ' · ' + (labels[o.status] || o.status) }),
          h('div', { text: o.name + ' · ' + o.email + ' · ' + o.phone }),
          h('div', { class: 'small muted', text: (o.ship_method === 'air' ? 'Air' : 'Sea') + ' · ' + (o.drop_type === 'home' ? 'Home: ' + o.address : 'Pickup point') + ' · Total ' + G.money(o.total_usd) + ' · charged ' + (o.charge_minor / 100).toFixed(2) + ' ' + o.charge_currency + (o.paid_at ? ' · paid ' + new Date(o.paid_at).toLocaleString() : ' · not paid') })),
        h('div', { class: 'panel stack' }, h('h3', { style: 'font-size:18px', text: 'Items to buy' }), items),
        h('form', { class: 'panel optgrid', style: 'align-items:end', onsubmit: function (e) {
          e.preventDefault();
          G.api('/admin/orders/' + encodeURIComponent(ref), { method: 'PATCH', auth: auth, body: { status: sel.value, note: note.value || undefined, weighedKg: kg.value ? Number(kg.value) : undefined } })
            .then(function () { detail(out, ref); }).catch(function (e2) { G.showError(msg, e2); });
        } }, h('div', { class: 'field' }, h('label', { text: 'Status' }), sel), h('div', { class: 'field' }, h('label', { text: 'Note' }), note), h('div', { class: 'field' }, h('label', { text: 'Weighed kg' }), kg), h('button', { class: 'btn', type: 'submit', text: 'Update' }), msg),
        h('div', { class: 'panel stack' }, h('h3', { style: 'font-size:18px', text: 'History' }), ev)));
    }).catch(function (e) { G.showError(out, e); });
  }
})();
