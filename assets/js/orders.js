/**
 * Hairlux Vendor: sales. Each order is the part of a customer's Hairlux
 * order made of your products. Hairlux picks it from your stock at the
 * Receiving Center and delivers it, so there is nothing for you to do here:
 * follow its progress and see what you earn.
 */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var status = UI.params().get('status') || '';
  var page = 1;
  var items = [];

  var ORDER_STATUS = {
    NEW: { label: 'New', cls: 'warn' },
    PREPARING: { label: 'Being picked', cls: 'gold' },
    QUALITY_CHECK: { label: 'Quality check', cls: 'gold' },
    READY_FOR_DISPATCH: { label: 'Ready for dispatch', cls: 'gold' },
    OUT_FOR_DELIVERY: { label: 'Out for delivery', cls: 'gold' },
    DELIVERED: { label: 'Delivered', cls: 'ok' },
    CANCELLED: { label: 'Cancelled', cls: 'bad' },
  };
  var STEPS = [
    { key: 'NEW', label: 'Ordered' },
    { key: 'PREPARING', label: 'Picked at the Receiving Center' },
    { key: 'QUALITY_CHECK', label: 'Quality check' },
    { key: 'READY_FOR_DISPATCH', label: 'Ready for dispatch' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  function itemsLine(o) {
    return o.items.map(function (i) { return i.quantity + ' x ' + i.name; }).join(', ');
  }

  function card(o) {
    return '<a class="ocard" href="orders.html?id=' + esc(o.id) + '">' +
      '<div class="row between"><span class="code">' + esc(o.code) + '</span>' + UI.badge(ORDER_STATUS, o.status) + '</div>' +
      '<div class="what">' + esc(itemsLine(o)) + '</div>' +
      '<div class="row between small"><span class="muted">' + UI.dateTime(o.createdAt) + '</span>' +
        (o.status === 'CANCELLED' ? '<span class="muted">No earnings</span>' : '<span>You earn <strong>' + UI.ngn(o.vendorAmount) + '</strong></span>') + '</div>' +
      '</a>';
  }

  async function loadList(more) {
    if (!more) { page = 1; items = []; $('#list').innerHTML = '<div class="loading"><span class="spinner"></span></div>'; }
    try {
      var res = await VendorApi.request('/vendor/orders?' + new URLSearchParams(Object.assign({ page: page, limit: 20 }, status ? { status: status } : {})));
      items = items.concat(res.data);
      UI.$all('[data-count]').forEach(function (el) {
        var n = (res.counts || {})[el.dataset.count] || 0;
        el.textContent = n ? n : '';
      });
      $('#btn-more').classList.toggle('hidden', res.meta.page >= res.meta.totalPages);
      if (!items.length) {
        $('#list').innerHTML = '<div class="card empty"><h3>' + (status ? 'Nothing here' : 'No sales yet') + '</h3><p>' +
          (status ? 'No orders with this status.' : 'When a customer buys one of your products, the sale appears here and we email you. Keep stock at the Receiving Center so your products stay on sale.') + '</p></div>';
        return;
      }
      $('#list').innerHTML = '<div class="orders">' + items.map(card).join('') + '</div>';
    } catch (e) {
      $('#list').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    }
  }

  // ------------------------------------------------------------- detail

  function stepsHtml(o) {
    if (o.status === 'CANCELLED') {
      return '<div class="alert bad"><strong>Cancelled ' + UI.dateTime(o.cancelledAt) + '</strong>' + esc(o.cancelReason || '') + '</div>';
    }
    var at = STEPS.findIndex(function (s) { return s.key === o.status; });
    return '<ol class="osteps">' + STEPS.map(function (s, i) {
      var when = i === 0 ? o.createdAt : s.key === 'DELIVERED' ? o.deliveredAt : null;
      return '<li class="' + (i <= at ? 'done' : '') + '"><span class="dot"></span><span>' + esc(s.label) + '</span>' +
        (i <= at && when ? '<span class="small muted">' + UI.dateTime(when) + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  function renderDetail(o) {
    var lines = o.items.map(function (i) {
      return '<tr><td>' + esc(i.name) + (i.sellerSku ? '<div class="small muted">SKU ' + esc(i.sellerSku) + '</div>' : '') +
        (i.returnedQuantity ? '<div class="small" style="color:var(--bad)">' + i.returnedQuantity + ' returned</div>' : '') + '</td>' +
        '<td class="num">' + i.quantity + '</td><td class="num">' + UI.ngn(i.lineTotal) + '</td><td class="num">' + UI.ngn(i.vendorAmount) + '</td></tr>';
    }).join('');
    $('#detail-view').innerHTML =
      '<div class="row between mb-3"><a class="btn-link" href="orders.html">&larr; All sales</a></div>' +
      '<div class="card"><div class="card-head"><div><div class="eyebrow">Order</div><h2>' + esc(o.code) + '</h2><div class="small muted">Placed ' + UI.dateTime(o.createdAt) + '</div></div>' + UI.badge(ORDER_STATUS, o.status) + '</div>' +
      (o.status !== 'CANCELLED' && o.status !== 'DELIVERED'
        ? '<p class="muted">Hairlux picks this order from your stock at the Receiving Center and delivers it. You do not need to do anything.</p>'
        : '') +
      stepsHtml(o) + '</div>' +
      '<div class="card"><h3>Items</h3><div class="table-wrap"><table class="otable"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Sale</th><th class="num">You earn</th></tr></thead><tbody>' + lines + '</tbody>' +
      '<tfoot><tr><td colspan="2">Total</td><td class="num">' + UI.ngn(o.subtotal) + '</td><td class="num"><strong>' + UI.ngn(o.vendorAmount) + '</strong></td></tr></tfoot></table></div>' +
      '<p class="small muted mb-0">Hairlux commission: ' + UI.ngn(o.commissionAmount) + '. ' +
      (o.returnedAmount ? 'Items worth ' + UI.ngn(o.returnedAmount) + ' were returned; your share of them came off your balance. ' : '') +
      'Your earnings go on your balance once the order is delivered. <a href="earnings.html">Earnings</a></p></div>';
  }

  async function openDetail(id) {
    $('#list-view').classList.add('hidden');
    $('#detail-view').classList.remove('hidden');
    $('#detail-view').innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    try { renderDetail(await VendorApi.request('/vendor/orders/' + encodeURIComponent(id))); }
    catch (e) { $('#detail-view').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div><a class="btn btn-outline" href="orders.html">All sales</a>'; }
  }

  UI.$all('#filters .chip').forEach(function (c) {
    c.classList.toggle('active', c.dataset.status === status);
    c.addEventListener('click', function () {
      status = c.dataset.status;
      UI.$all('#filters .chip').forEach(function (x) { x.classList.toggle('active', x === c); });
      history.replaceState(null, '', status ? '?status=' + status : 'orders.html');
      loadList();
    });
  });
  $('#btn-more').addEventListener('click', function () { page++; loadList(true); });

  var id = UI.params().get('id');
  if (id) openDetail(id); else loadList();
})();
