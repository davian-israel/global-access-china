(function () {
  'use strict';
  var G = window.GAC, h = G.h;

  document.addEventListener('DOMContentLoaded', function () {
    var mount = document.getElementById('product');
    var id = G.qs('id');
    if (!id) { G.showError(mount, { message: 'No product selected.' }); return; }
    Promise.all([G.api('/catalog/products/' + encodeURIComponent(id)), G.config()])
      .then(function (r) { render(mount, r[0], r[1]); })
      .catch(function (e) { G.showError(mount, e); });
  });

  function render(mount, p, cfg) {
    document.title = p.title + ' · Global-AccessChina';
    var state = { sku: p.skus.length ? (p.skus.find(function (s) { return s.inStock; }) || p.skus[0]).skuId : null, qty: 1, method: 'sea', img: 0 };
    mount.textContent = '';

    // Gallery
    var mainImg = h('div', { class: 'mainimg' });
    var thumbs = h('div', { class: 'thumbs' });
    function drawGallery() {
      mainImg.textContent = '';
      if (p.images.length) mainImg.appendChild(h('img', { src: p.images[state.img], alt: p.title, referrerpolicy: 'no-referrer' }));
      else mainImg.appendChild(document.createTextNode('Photo coming soon'));
      thumbs.textContent = '';
      p.images.slice(0, 10).forEach(function (src, i) {
        thumbs.appendChild(h('button', { type: 'button', 'aria-label': 'Photo ' + (i + 1), 'aria-pressed': String(i === state.img), onclick: function () { state.img = i; drawGallery(); } },
          h('img', { src: src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })));
      });
    }
    drawGallery();

    // Buy box
    var priceEl = h('div', { class: 'price', style: 'font-size:38px' });
    var skuBox = h('div', { class: 'opts' });
    var qtyEl = h('span');
    var seaBtn = h('button', { type: 'button', class: 'opt', onclick: function () { state.method = 'sea'; update(); } }, h('strong', null, 'By sea'), h('div', { class: 'small muted', text: 'about 5–7 weeks' }));
    var airBtn = h('button', { type: 'button', class: 'opt', onclick: function () { state.method = 'air'; update(); } }, h('strong', null, 'By air'), h('div', { class: 'small muted', text: 'about 1–2 weeks' }));
    var est = h('div', { class: 'stack', style: 'gap:6px' });
    var addMsg = h('div', { 'aria-live': 'polite' });

    function unitPrice() {
      var s = p.skus.find(function (x) { return x.skuId === state.sku; });
      return s ? s.priceUsd : p.priceUsd;
    }

    function update() {
      priceEl.textContent = G.money(unitPrice());
      qtyEl.textContent = String(state.qty);
      skuBox.textContent = '';
      p.skus.forEach(function (s) {
        var label = Object.keys(s.options).map(function (k) { return s.options[k]; }).join(' · ') || s.skuId;
        skuBox.appendChild(h('button', { type: 'button', class: 'opt', 'aria-pressed': String(s.skuId === state.sku), disabled: !s.inStock,
          onclick: function () { state.sku = s.skuId; update(); } }, label + (s.inStock ? '' : ' (sold out)')));
      });
      seaBtn.setAttribute('aria-pressed', String(state.method === 'sea'));
      airBtn.setAttribute('aria-pressed', String(state.method === 'air'));
      var items = unitPrice() * state.qty;
      var kg = p.weightKg * state.qty;
      var ship = state.method === 'air' ? Math.max(kg, cfg.airMinKg || 0.5) * (cfg.airUsdPerKg || 15) : (cfg.seaFlatUsd || 10);
      est.textContent = '';
      est.appendChild(h('div', { class: 'rowline' }, h('span', { text: 'Items (' + state.qty + ')' }), h('span', { text: G.money(items) })));
      est.appendChild(h('div', { class: 'rowline' }, h('span', { text: state.method === 'air' ? 'Air shipping (' + Math.max(kg, cfg.airMinKg || 0.5).toFixed(2) + ' kg)' : 'Sea shipping (flat per order)' }), h('span', { text: G.money(ship) })));
      est.appendChild(h('div', { class: 'rowline total' }, h('span', { text: 'Estimated delivered price' }), h('span', { text: G.money(items + ship) })));
      est.appendChild(h('p', { class: 'small muted', style: 'margin:0', text: 'Estimate for this item alone. Your cart combines items, so shipping is shared. Exact shipping is confirmed when your order is weighed.' }));
    }

    var add = h('button', { class: 'btn', type: 'button', style: 'flex:1 1 200px', onclick: function () {
      G.cart.add({ productId: p.id, skuId: state.sku, qty: state.qty, title: p.title, image: p.images[0] || null, unitUsd: unitPrice(),
        options: (p.skus.find(function (s) { return s.skuId === state.sku; }) || {}).options || {} });
      addMsg.textContent = '';
      addMsg.appendChild(h('div', { class: 'ok' }, 'Added to your cart. ', h('a', { href: '/cart.html', text: 'Go to cart' })));
    } }, 'Add to cart');

    var details = h('div', { class: 'stack', style: 'gap:6px' },
      h('div', { class: 'small muted', text: p.sample ? 'Sample product for the preview.' : 'Translated from the seller’s Chinese listing.' }),
      h('div', { class: 'small muted' }, 'Original title: ', h('span', { lang: 'zh-Hans', style: 'color:#344054', text: p.titleZh })));

    mount.appendChild(h('div', { class: 'two' },
      h('div', { class: 'main gallery', style: 'flex:1 1 440px' }, mainImg, thumbs),
      h('div', { class: 'side stack', style: 'flex:1 1 440px;gap:20px' },
        h('h1', { style: 'font-size:32px', text: p.title }), details,
        h('div', { style: 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap' }, priceEl, h('span', { class: 'muted', text: p.weightKg.toFixed(2) + ' kg' + (p.weightEstimated ? ' (estimated)' : '') + ' · price includes our service' })),
        p.skus.length ? h('div', { class: 'stack', style: 'gap:8px' }, h('strong', { text: 'Options' }), skuBox) : null,
        h('div', { style: 'display:flex;align-items:center;gap:14px' }, h('strong', { text: 'Quantity' }),
          h('div', { class: 'qty' }, h('button', { type: 'button', 'aria-label': 'Decrease quantity', text: '−', onclick: function () { state.qty = Math.max(1, state.qty - 1); update(); } }), qtyEl,
            h('button', { type: 'button', 'aria-label': 'Increase quantity', text: '+', onclick: function () { state.qty = Math.min(99, state.qty + 1); update(); } }))),
        h('div', { class: 'panel stack', style: 'background:#F2F7F5;border-color:#DCE8E3;gap:12px' }, h('strong', { text: 'Delivered to Accra, Ghana' }), h('div', { class: 'optgrid' }, seaBtn, airBtn), est),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:12px' }, add, h('a', { class: 'btn ghost', href: '/cart.html', style: 'flex:1 1 160px', text: 'View cart' })),
        addMsg)));

    if (p.description) mount.appendChild(h('section', { class: 'panel stack', style: 'margin-top:24px' }, h('h2', { style: 'font-size:20px', text: 'Product details' }), h('p', { style: 'margin:0;white-space:pre-line', text: p.description })));
    update();
  }
})();
