/** Hairlux Vendor: dashboard (status, next steps, Go live, product counts). */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;

  var SECTION = {
    email: 'application.html#verify', phone: 'application.html#verify', business: 'application.html#business',
    owner_nin: 'application.html#owner', doc_owner_id: 'application.html#documents', doc_cac: 'application.html#documents',
    doc_shop_photo: 'application.html#documents', bank: 'application.html#bank', agreement: 'application.html#agreement',
  };

  function hero(d) {
    var s = d.seller;
    var done = d.checklist.filter(function (c) { return c.done; }).length;
    var pct = Math.round((done / d.checklist.length) * 100);
    var sla = d.settings.reviewSlaHours;
    switch (s.status) {
      case 'DRAFT':
        return '<div class="card hero-status"><div><span class="badge">Step ' + (done + 1 > d.checklist.length ? d.checklist.length : done + 1) + ' of ' + d.checklist.length + '</span>' +
          '<div class="state">Finish your application</div><p class="muted">Complete the steps below, then send your application to Hairlux. We reply within ' + sla + ' hours.</p>' +
          '<div class="progress" aria-label="' + pct + '% complete"><div style="width:' + pct + '%"></div></div><div class="small muted mt-2">' + done + ' of ' + d.checklist.length + ' done</div></div>' +
          '<div><a class="btn btn-gold" href="application.html' + (d.canSubmit ? '#submit' : '') + '">' + (d.canSubmit ? 'Review and submit' : 'Continue application') + '</a></div></div>';
      case 'PENDING_REVIEW':
        return '<div class="card hero-status"><div><span class="badge warn">Under review</span><div class="state">We are reviewing your application</div>' +
          '<p class="muted mb-0">Sent on ' + UI.date(s.submittedAt) + '. We reply within ' + sla + ' hours and will email you the outcome.</p></div>' +
          '<div><a class="btn btn-outline" href="application.html">View application</a></div></div>';
      case 'CHANGES_REQUESTED':
        return '<div class="alert warn"><strong>Hairlux needs a few changes</strong>' + esc(s.statusReason || 'Check your application and send it again.') + '</div>' +
          '<div class="card hero-status"><div><div class="state">Update and resend your application</div><p class="muted mb-0">Make the changes, then submit again from the last step.</p></div>' +
          '<div><a class="btn btn-gold" href="application.html">Update application</a></div></div>';
      case 'REJECTED':
        return '<div class="alert bad"><strong>Your application was not approved</strong>' + esc(s.statusReason || '') + '</div>' +
          '<p class="muted">If you have questions, contact <a href="mailto:' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '">' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '</a>.</p>';
      case 'SUSPENDED':
        return '<div class="alert bad"><strong>Your vendor account is suspended</strong>' + esc(s.statusReason || '') + '</div>' +
          '<p class="muted">Your products are not on sale. Contact <a href="mailto:' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '">' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '</a>.</p>';
      case 'APPROVED':
        return '<div class="card hero-status"><div><span class="badge ok">Approved ' + UI.date(s.approvedAt) + '</span>' +
          '<div class="state">' + (s.isLive ? 'You are live' : 'Your listings are paused') + '</div>' +
          '<p class="muted mb-0">' + (s.isLive ? 'Approved products can be sold. Pause any time, for example when you are out of stock or on holiday.' : 'Turn on Go live when you are ready to sell your approved products.') + '</p></div>' +
          '<div><label class="switch"><input type="checkbox" id="live"' + (s.isLive ? ' checked' : '') + '><span class="track"></span><span id="live-label">' + (s.isLive ? 'Live' : 'Paused') + '</span></label></div></div>';
    }
    return '';
  }

  /** Sales in progress (Hairlux fulfils them) and stock at the Receiving Center. */
  async function loadOrders() {
    var box = $('#orders-card');
    try {
      var both = await Promise.all([
        VendorApi.request('/vendor/orders?limit=1'),
        VendorApi.request('/vendor/stock?limit=1&low=true'),
        VendorApi.request('/vendor/intakes?limit=1&status=SUBMITTED'),
      ]);
      var c = both[0].counts || {};
      var low = both[1].meta.total;
      var incoming = both[2].meta.total;
      var inProgress = (c.NEW || 0) + (c.PREPARING || 0) + (c.QUALITY_CHECK || 0) + (c.READY_FOR_DISPATCH || 0);
      box.innerHTML = '<div class="card"><div class="card-head"><h2>Sales and stock</h2><div class="row"><a class="btn btn-outline btn-sm" href="orders.html">All sales</a><a class="btn btn-gold btn-sm" href="stock.html?send=1">Send stock</a></div></div>' +
        (low ? '<div class="alert warn"><strong>' + low + ' product' + (low > 1 ? 's' : '') + ' running low</strong>Send more stock to the Receiving Center to keep ' + (low > 1 ? 'them' : 'it') + ' on sale. <a href="stock.html?low=1">See which</a></div>' : '') +
        '<div class="stats">' +
        '<a class="stat" href="orders.html"><div class="n">' + inProgress + '</div><div class="l">Being prepared</div></a>' +
        '<a class="stat" href="orders.html?status=OUT_FOR_DELIVERY"><div class="n">' + (c.OUT_FOR_DELIVERY || 0) + '</div><div class="l">Out for delivery</div></a>' +
        '<a class="stat" href="orders.html?status=DELIVERED"><div class="n">' + (c.DELIVERED || 0) + '</div><div class="l">Delivered</div></a>' +
        '<a class="stat" href="stock.html?tab=deliveries"><div class="n">' + incoming + '</div><div class="l">Stock deliveries on their way</div></a>' +
        '</div><p class="small muted mt-3 mb-0">Hairlux picks your orders from the Receiving Center and delivers them. Nothing is waiting on you.</p></div>';
    } catch (e) { box.innerHTML = ''; }
  }

  /** Balance at a glance (Phase 3). */
  async function loadEarnings() {
    var box = $('#earnings-card');
    try {
      var d = await VendorApi.request('/vendor/earnings');
      var open = d.openPayout;
      box.innerHTML = '<div class="card"><div class="card-head"><h2>Earnings</h2><a class="btn btn-outline btn-sm" href="earnings.html">' + (d.canRequest ? 'Request payout' : 'View earnings') + '</a></div>' +
        (open ? '<div class="alert info"><strong>Payout ' + (open.status === 'PENDING' ? 'waiting for approval' : 'on its way') + ': ' + UI.ngn(open.amount) + '</strong></div>' : '') +
        '<div class="stats">' +
        '<a class="stat" href="earnings.html"><div class="n">' + (d.available < 0 ? '-' : '') + UI.ngn(Math.abs(d.available)) + '</div><div class="l">Available to pay</div></a>' +
        '<a class="stat" href="earnings.html"><div class="n">' + UI.ngn(d.pending) + '</div><div class="l">Pending (' + d.holdDays + '-day hold)</div></a>' +
        '<a class="stat" href="earnings.html"><div class="n">' + UI.ngn(d.paidOut) + '</div><div class="l">Paid to you</div></a>' +
        '<a class="stat" href="earnings.html"><div class="n">' + UI.ngn(d.earned) + '</div><div class="l">Earned in total</div></a>' +
        '</div></div>';
    } catch (e) { box.innerHTML = ''; }
  }

  function render(d) {
    var s = d.seller;
    $('#biz-name').textContent = s.tradingName || s.legalName;
    $('#head-badge').innerHTML = UI.badge(UI.STATUS, s.status);
    var parts = [hero(d)];

    if (s.status === 'APPROVED') {
      var p = d.products || {};
      parts.push('<div id="orders-card"></div>');
      parts.push('<div id="earnings-card"></div>');
      parts.push('<div class="card"><div class="card-head"><h2>Products</h2><a class="btn btn-gold btn-sm" href="product.html">Add product</a></div>' +
        '<div class="stats">' +
        '<a class="stat" href="products.html?status=APPROVED"><div class="n">' + (p.APPROVED || 0) + '</div><div class="l">Approved</div></a>' +
        '<a class="stat" href="products.html?status=PENDING_REVIEW"><div class="n">' + (p.PENDING_REVIEW || 0) + '</div><div class="l">Under review</div></a>' +
        '<a class="stat" href="products.html?status=CHANGES_REQUESTED"><div class="n">' + (p.CHANGES_REQUESTED || 0) + '</div><div class="l">Changes needed</div></a>' +
        '<a class="stat" href="products.html?status=DRAFT"><div class="n">' + (p.DRAFT || 0) + '</div><div class="l">Drafts</div></a>' +
        '</div></div>');
      parts.push('<div class="card"><h3>How selling works</h3><ul class="muted mb-0">' +
        '<li>Every product, and every change to its name, photos or description, is checked by Hairlux before it goes on sale.</li>' +
        '<li>Customers buy from Hairlux. Your business name and contacts are never shown to them.</li>' +
        '<li>' + (s.hasOwnCommission ? 'Hairlux commission is ' + s.commissionPercent + '% of each sale' : 'Hairlux commission depends on the product category (' + s.commissionPercent + '% unless the category has its own rate); each order shows it') + '. Your share goes on your balance when the order is delivered and is paid to your payout account after ' + ((d.settings && d.settings.payoutHoldDays) || 0) + ' days.</li>' +
        '<li>You do not ship to customers. Bring stock to the Hairlux Receiving Center (<a href="stock.html">Stock</a>); it is counted and checked, and only items that pass go on sale.</li>' +
        '<li>Hairlux picks each order from your stock at the Receiving Center and delivers it. Damaged or wrong items are handed back to you.</li></ul></div>');
    } else if (s.status === 'DRAFT' || s.status === 'CHANGES_REQUESTED') {
      parts.push('<div class="card"><h2>Your steps</h2><ul class="checklist">' + d.checklist.map(function (c) {
        return '<li class="' + (c.done ? 'done' : '') + '"><span class="tick">&#10003;</span><span class="what">' + esc(c.label) +
          (c.hint && !c.done ? '<div class="small muted">' + esc(c.hint) + '</div>' : '') + '</span>' +
          (c.done ? '<span class="small muted">Done</span>' : '<a class="btn btn-outline btn-sm" href="' + (SECTION[c.key] || 'application.html') + '">Start</a>') + '</li>';
      }).join('') + '</ul></div>');
    }
    $('#content').innerHTML = parts.join('');
    if (s.status === 'APPROVED') { loadOrders(); loadEarnings(); }

    var live = $('#live');
    if (live) {
      live.addEventListener('change', async function () {
        var want = live.checked;
        try {
          await VendorApi.request('/vendor/listings', { method: 'PATCH', json: { isLive: want } });
          UI.toast(want ? 'You are live.' : 'Listings paused.', 'ok');
          load();
        } catch (e) {
          live.checked = !want;
          UI.toast(e.message, 'bad');
        }
      });
    }
  }

  async function load() {
    try {
      render(await VendorApi.request('/vendor/me'));
    } catch (e) {
      $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    }
  }
  load();
})();
