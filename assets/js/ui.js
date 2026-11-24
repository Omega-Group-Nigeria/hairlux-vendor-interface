/**
 * Hairlux Vendor site: shared page helpers and the signed-in app shell
 * (top bar on desktop, bottom bar on phones).
 */
var UI = (function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ngn(n) {
    if (n === null || n === undefined || n === '') return '-';
    var d = Number(n) % 1 ? 2 : 0; // ₦812.50, not ₦812.5
    return '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: d, maximumFractionDigits: 2 });
  }
  function date(v) { return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
  function dateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }

  function toast(msg, kind) {
    var wrap = $('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); document.body.appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === 'bad' ? 7000 : 4000);
  }

  /** Disable a button and show a spinner while fn runs. */
  async function busy(btn, fn) {
    var html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>' + esc(btn.dataset.busy || 'Please wait');
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
  }

  var STATUS = {
    DRAFT: { label: 'Application not sent', cls: '' },
    PENDING_REVIEW: { label: 'Under review', cls: 'warn' },
    CHANGES_REQUESTED: { label: 'Changes needed', cls: 'warn' },
    APPROVED: { label: 'Approved', cls: 'ok' },
    REJECTED: { label: 'Not approved', cls: 'bad' },
    SUSPENDED: { label: 'Suspended', cls: 'bad' },
  };
  var PRODUCT_STATUS = {
    DRAFT: { label: 'Draft', cls: '' },
    PENDING_REVIEW: { label: 'Under review', cls: 'warn' },
    CHANGES_REQUESTED: { label: 'Changes needed', cls: 'warn' },
    APPROVED: { label: 'Approved', cls: 'ok' },
    REJECTED: { label: 'Not approved', cls: 'bad' },
  };
  function badge(map, key) {
    var m = map[key] || { label: key, cls: '' };
    return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
  }

  var NAV = [
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'orders.html', label: 'Sales' },
    { href: 'stock.html', label: 'Stock' },
    { href: 'earnings.html', label: 'Earnings' },
    { href: 'products.html', label: 'Products' },
    { href: 'application.html', label: 'Business' },
    { href: 'account.html', label: 'Account' },
  ];

  /** Signed-in pages: redirect to sign in if needed, then draw the top and bottom bars. */
  function shell() {
    if (!VendorApi.signedIn()) {
      var here = location.pathname.split('/').pop() || 'dashboard.html';
      location.replace('log-in.html?next=' + encodeURIComponent(here + location.search));
      return false;
    }
    var page = location.pathname.split('/').pop() || 'dashboard.html';
    var active = page === 'product.html' ? 'products.html' : page;
    var u = VendorApi.user() || {};
    var links = NAV.map(function (n) { return '<a href="' + n.href + '"' + (n.href === active ? ' class="active" aria-current="page"' : '') + '>' + esc(n.label) + '</a>'; }).join('');
    var top = document.createElement('header');
    top.className = 'topbar';
    top.innerHTML = '<div class="inner"><a class="brand" href="dashboard.html"><img src="assets/img/logo-side-white.webp" alt="Hairlux"><span>Vendor</span></a>' +
      '<nav class="topnav" aria-label="Main">' + links + '</nav>' +
      '<div class="who"><span class="name">' + esc([u.firstName, u.lastName].filter(Boolean).join(' ')) + '</span><button class="btn btn-outline btn-sm" id="btn-signout">Sign out</button></div></div>';
    document.body.prepend(top);
    var bottom = document.createElement('nav');
    bottom.className = 'bottomnav';
    bottom.setAttribute('aria-label', 'Main');
    bottom.innerHTML = links;
    document.body.appendChild(bottom);
    $('#btn-signout').addEventListener('click', VendorApi.signOut);
    return true;
  }

  function params() { return new URLSearchParams(location.search); }

  /** Only same-site relative pages are followed after sign-in. */
  function safeNext(fallback) {
    var n = params().get('next') || '';
    return /^[a-z0-9\-]+\.html(\?[^#]*)?$/i.test(n) ? n : fallback;
  }

  var EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>';

  /** Adds a show / hide button to every password box on the page. */
  function passwordToggles(root) {
    $all('input[type="password"]', root).forEach(function (input) {
      if (input.dataset.toggle) return;
      input.dataset.toggle = '1';
      var wrap = document.createElement('div');
      wrap.className = 'password-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'password-toggle';
      btn.setAttribute('aria-label', 'Show password');
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = EYE;
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show ? EYE_OFF : EYE;
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-pressed', String(show));
        input.focus();
      });
      wrap.appendChild(btn);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { passwordToggles(); });
  else passwordToggles();

  return { $: $, $all: $all, esc: esc, ngn: ngn, date: date, dateTime: dateTime, toast: toast, busy: busy, badge: badge, STATUS: STATUS, PRODUCT_STATUS: PRODUCT_STATUS, shell: shell, params: params, safeNext: safeNext, passwordToggles: passwordToggles };
})();

// Installable app: register the service worker (pages still work without it).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ }); });
}
