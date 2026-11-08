(function () {
  'use strict';
  var G = window.GAC, h = G.h;
  var state = { method: 'sea', drop: 'pickup' };

  document.addEventListener('DOMContentLoaded', function () {
    G.config().then(function (cfg) { render(cfg); });
  });

  function render(cfg) {
    var mount = document.getElementById('cart');
    mount.textContent = '';
    var items = G.cart.read();
    if (!items.length) {
      mount.appendChild(h('div', { class: 'panel stack' }, h('p', { style: 'margin:0', text: 'Your cart is empty.' }), h('a', { class: 'btn', href: '/', style: 'align-self:flex-start', text: 'Start shopping' })));
      return;
    }

    var list = h('section', { class: 'panel stack', 'aria-label': 'Items' });
    items.forEach(function (it, idx) {
      var opts = Object.keys(it.options || {}).map(function (k) { return k + ': ' + it.options[k]; }).join(' · ');
      list.appendChild(h('div', { class: 'line' },
        h('div', { class: 'thumb' }, it.image ? h('img', { src: it.image, alt: '', referrerpolicy: 'no-referrer' }) : null),
        h('div', { style: 'flex:1;min-width:0' }, h('a', { href: '/product.html?id=' + encodeURIComponent(it.productId), style: 'color:#101828;text-decoration:none;font-weight:500', text: it.title }),
          h('div', { class: 'small muted', text: [opts, G.money(it.unitUsd) + ' each'].filter(Boolean).join(' · ') })),
        h('div', { class: 'qty' },
          h('button', { type: 'button', 'aria-label': 'Decrease', text: '−', onclick: function () { change(idx, -1); } }),
          h('span', { text: String(it.qty) }),
          h('button', { type: 'button', 'aria-label': 'Increase', text: '+', onclick: function () { change(idx, 1); } })),
        h('button', { type: 'button', class: 'opt', 'aria-label': 'Remove ' + it.title, text: 'Remove', onclick: function () { change(idx, -999); } })));
    });

    function change(idx, d) {
      var all = G.cart.read();
      all[idx].qty += d;
      if (all[idx].qty <= 0) all.splice(idx, 1);
      G.cart.write(all);
      render(cfg);
    }

    var seaBtn = h('button', { type: 'button', class: 'opt', onclick: function () { state.method = 'sea'; refresh(); } });
    var airBtn = h('button', { type: 'button', class: 'opt', onclick: function () { state.method = 'air'; refresh(); } });
    var pickBtn = h('button', { type: 'button', class: 'opt', onclick: function () { state.drop = 'pickup'; refresh(); } },
      h('strong', null, 'Pickup point, Accra'), h('div', { class: 'small muted', text: 'Free' + (cfg.pickupAddress ? ' · ' + cfg.pickupAddress : '') }));
    var homeBtn = h('button', { type: 'button', class: 'opt', disabled: true }, h('strong', null, 'Home delivery'), h('div', { class: 'small muted', text: 'Coming soon' }));

    var name = h('input', { class: 'f', id: 'name', autocomplete: 'name', required: true });
    var email = h('input', { class: 'f', id: 'email', type: 'email', autocomplete: 'email', required: true });
    var phone = h('input', { class: 'f', id: 'phone', type: 'tel', autocomplete: 'tel', placeholder: '+233', required: true });
    var summary = h('div', { class: 'stack', style: 'gap:10px' });
    var msg = h('div', { 'aria-live': 'polite' });
    var payBtn = h('button', { class: 'btn', type: 'submit', style: 'width:100%' }, 'Pay securely');

    var form = h('form', { class: 'two', novalidate: true },
      h('div', { class: 'main stack', style: 'gap:20px' }, list,
        h('section', { class: 'panel stack' }, h('h2', { style: 'font-size:20px', text: 'Shipping to Ghana' }), h('div', { class: 'optgrid' }, seaBtn, airBtn),
          h('strong', { style: 'font-size:15px', text: 'Collect or deliver' }), h('div', { class: 'optgrid' }, pickBtn, homeBtn)),
        h('section', { class: 'panel stack' }, h('h2', { style: 'font-size:20px', text: 'Your details' }),
          h('div', { class: 'optgrid' },
            h('div', { class: 'field' }, h('label', { for: 'name', text: 'Full name' }), name),
            h('div', { class: 'field' }, h('label', { for: 'email', text: 'Email (for your receipt and updates)' }), email),
            h('div', { class: 'field' }, h('label', { for: 'phone', text: 'Phone number' }), phone)),
          h('p', { class: 'small muted', style: 'margin:0', text: 'You choose mobile money (MTN, Telecel, AirtelTigo) or card on the secure Paystack page.' }))),
      h('aside', { class: 'side panel stack' }, h('h2', { style: 'font-size:20px', text: 'Order summary' }), summary, payBtn, msg));

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      msg.textContent = '';
      payBtn.disabled = true;
      payBtn.textContent = 'Starting payment…';
      G.api('/orders', { method: 'POST', body: {
        name: name.value, email: email.value, phone: phone.value, shipMethod: state.method, drop: state.drop,
        items: G.cart.read().map(function (i) { return { productId: i.productId, skuId: i.skuId, qty: i.qty }; })
      } }).then(function (r) {
        try { sessionStorage.setItem('gac_last_order', JSON.stringify({ ref: r.ref, email: email.value })); } catch (e) {}
        G.cart.clear();
        location.href = r.authorizationUrl;
      }).catch(function (e) {
        G.showError(msg, e);
        payBtn.disabled = !cfg.checkoutEnabled;
        payBtn.textContent = 'Pay securely';
      });
    });

    mount.appendChild(form);

    function refresh() {
      seaBtn.setAttribute('aria-pressed', String(state.method === 'sea'));
      airBtn.setAttribute('aria-pressed', String(state.method === 'air'));
      pickBtn.setAttribute('aria-pressed', String(state.drop === 'pickup'));
      summary.textContent = 'Working out your total…';
      G.api('/catalog/quote', { method: 'POST', body: { method: state.method, items: G.cart.read().map(function (i) { return { productId: i.productId, skuId: i.skuId, qty: i.qty }; }) } })
        .then(function (q) {
          seaBtn.textContent = ''; airBtn.textContent = '';
          seaBtn.appendChild(h('span', { style: 'display:flex;justify-content:space-between;font-weight:600' }, h('span', { text: 'By sea' }), h('span', { text: G.money(q.alternatives.sea) })));
          seaBtn.appendChild(h('div', { class: 'small muted', text: 'about 5–7 weeks' }));
          airBtn.appendChild(h('span', { style: 'display:flex;justify-content:space-between;font-weight:600' }, h('span', { text: 'By air' }), h('span', { text: G.money(q.alternatives.air) })));
          airBtn.appendChild(h('div', { class: 'small muted', text: 'about 1–2 weeks · ' + q.chargeableKg + ' kg' }));
          summary.textContent = '';
          [['Items', q.items], ['Delivery from sellers to our warehouse', q.domestic], [state.method === 'air' ? 'Air shipping' : 'Sea shipping', q.shipping], ['Service fee (checking, photos, packing)', q.serviceFee], ['Pickup point', 0]]
            .forEach(function (r) { summary.appendChild(h('div', { class: 'rowline' }, h('span', { text: r[0] }), h('span', { text: r[1] === 0 ? 'Free' : G.money(r[1]) }))); });
          summary.appendChild(h('div', { class: 'rowline total' }, h('span', { text: 'Total' }), h('span', { text: G.money(q.total) })));
          if (cfg.ghsPerUsd) summary.appendChild(h('div', { class: 'small muted', text: 'Charged in Ghana cedis: about GH₵' + (q.total * cfg.ghsPerUsd).toFixed(2) + ' at today’s rate.' }));
          summary.appendChild(h('p', { class: 'small muted', style: 'margin:0', text: 'Shipping is confirmed when your parcel is weighed at our warehouse. Any difference is refunded, or asked for, before it ships.' }));
          if (!cfg.checkoutEnabled) {
            payBtn.disabled = true;
            msg.textContent = '';
            msg.appendChild(h('div', { class: 'ok small', text: 'Checkout opens when live Taobao products are connected. This preview uses sample products.' }));
          }
        })
        .catch(function (e) { G.showError(summary, e); });
    }
    refresh();
  }
})();
