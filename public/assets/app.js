/* Global-AccessChina storefront: shared helpers. All text from Taobao is inserted with
   textContent (never innerHTML) so seller content cannot inject scripts. */
(function () {
  'use strict';

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') el.textContent = v;
        else if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: { Accept: 'application/json' } };
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    if (opts.auth) init.headers.Authorization = opts.auth;
    return fetch('/api' + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) { var e = new Error(Array.isArray(b.message) ? b.message.join(' ') : b.message || ('Error ' + r.status)); e.status = r.status; throw e; }
        return b;
      });
    });
  }

  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }

  var CART_KEY = 'gac_cart_v1';
  var cart = {
    read: function () { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; } },
    write: function (items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {} updateCartCount(); },
    add: function (item) {
      var items = cart.read();
      var hit = items.find(function (x) { return x.productId === item.productId && (x.skuId || null) === (item.skuId || null); });
      if (hit) hit.qty = Math.min(99, hit.qty + item.qty); else items.push(item);
      cart.write(items);
    },
    count: function () { return cart.read().reduce(function (s, x) { return s + x.qty; }, 0); },
    clear: function () { cart.write([]); }
  };

  function updateCartCount() {
    var el = document.getElementById('cart-count');
    if (el) el.textContent = String(cart.count());
  }

  var configPromise = null;
  function config() { if (!configPromise) configPromise = api('/config').catch(function () { return { dataSource: 'sample', checkoutEnabled: false }; }); return configPromise; }

  function globeSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', '22'); s.setAttribute('height', '22'); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', '#fff'); s.setAttribute('stroke-width', '2'); s.setAttribute('aria-hidden', 'true');
    ['M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'].forEach(function (d) { var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.appendChild(p); });
    var c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '9'); s.appendChild(c);
    return s;
  }

  function header() {
    var mount = document.getElementById('site-header');
    if (!mount) return;
    var q = qs('q') || '';
    mount.appendChild(h('div', { class: 'topbar', text: 'Shipping now to Ghana · Nigeria, Kenya and the Caribbean coming soon' }));
    var preview = h('div', { class: 'preview', id: 'preview-banner', hidden: true }, 'Preview: these are sample products. Live Taobao products and checkout switch on soon.');
    mount.appendChild(preview);
    var input = h('input', { id: 'q', type: 'search', name: 'q', value: q, placeholder: 'Search in English, e.g. wireless earbuds', autocomplete: 'off' });
    mount.appendChild(h('header', { class: 'site' }, h('div', { class: 'wrap row' },
      h('a', { class: 'brand', href: '/' }, h('span', { class: 'mark' }, globeSvg()), h('span', null, 'Global-Access', h('span', { class: 'c', text: 'China' }))),
      h('form', { class: 'search', action: '/', method: 'get', role: 'search' }, h('label', { class: 'sr', for: 'q', text: 'Search products' }), input, h('button', { type: 'submit', text: 'Search' })),
      h('a', { class: 'btn ghost', href: '/order.html', style: 'min-height:44px;padding:0 14px;font-size:14px' }, 'Track order'),
      h('a', { class: 'cartlink', href: '/cart.html' }, 'Cart (', h('span', { id: 'cart-count', text: '0' }), ')')
    )));
    updateCartCount();
    config().then(function (c) { if (c.dataSource === 'sample') preview.hidden = false; });
  }

  function footer() {
    var mount = document.getElementById('site-footer');
    if (!mount) return;
    var help = h('div', { class: 'stack', style: 'gap:6px' }, h('strong', { style: 'color:#101828', text: 'Help' }),
      h('a', { href: '/#how', text: 'How it works' }), h('a', { href: '/order.html', text: 'Track an order' }));
    mount.appendChild(h('footer', { class: 'site' }, h('div', { class: 'wrap' },
      h('div', { class: 'stack', style: 'max-width:380px;gap:6px' }, h('strong', { style: 'color:#101828;font-size:17px', text: 'Global-AccessChina' }),
        h('span', { text: 'Shop like you’re in China, from anywhere. Products come from independent Taobao and Tmall sellers; Global-AccessChina is an independent buying service, not affiliated with Taobao.' })),
      help)));
    config().then(function (c) {
      if (c.whatsapp) help.appendChild(h('a', { href: 'https://wa.me/' + String(c.whatsapp).replace(/\D/g, ''), rel: 'noopener', target: '_blank', text: 'Chat on WhatsApp' }));
    });
  }

  function productCard(p) {
    var img = p.image || (p.images && p.images[0]);
    var hint = p.airHintUsd !== undefined ? 'Air shipping about ' + money(p.airHintUsd) : null;
    return h('a', { class: 'card', href: '/product.html?id=' + encodeURIComponent(p.id) },
      h('div', { class: 'img' }, img ? h('img', { src: img, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : 'Photo coming soon'),
      h('div', { class: 'body' }, h('div', { class: 't', text: p.title }), h('div', { class: 'price', text: money(p.priceUsd) }), hint ? h('div', { class: 'chip', text: hint }) : null));
  }

  function showError(mount, err) {
    mount.textContent = '';
    mount.appendChild(h('div', { class: 'err', role: 'alert', text: (err && err.message) || 'Something went wrong. Please try again.' }));
  }

  window.GAC = { h: h, api: api, money: money, qs: qs, cart: cart, config: config, productCard: productCard, showError: showError };
  document.addEventListener('DOMContentLoaded', function () { header(); footer(); });
})();
