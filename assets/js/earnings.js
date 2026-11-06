/**
 * Hairlux Vendor: earnings. Your share of each delivered order goes on your
 * balance and can be paid after the hold period (the return window).
 * Returns come off it; payouts go to your payout account.
 */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var type = '';
  var page = 1;
  var rows = [];

  var ENTRY = {
    EARNING: { label: 'Earning', cls: 'ok' },
    RETURN: { label: 'Return', cls: 'bad' },
    PAYOUT: { label: 'Payout', cls: 'gold' },
    PAYOUT_REVERSAL: { label: 'Payout failed', cls: 'warn' },
    ADJUSTMENT: { label: 'Adjustment', cls: '' },
  };
  var PAYOUT = {
    PENDING: { label: 'Waiting for approval', cls: 'warn' },
    PROCESSING: { label: 'On its way', cls: 'gold' },
    PAID: { label: 'Paid', cls: 'ok' },
    FAILED: { label: 'Failed', cls: 'bad' },
    CANCELLED: { label: 'Cancelled', cls: '' },
  };

  function money(n) {
    return (n < 0 ? '-' : '') + UI.ngn(Math.abs(n));
  }

  function rules(d) {
    var hold = d.holdDays > 0 ? 'Earnings from an order can be paid ' + d.holdDays + ' day' + (d.holdDays === 1 ? '' : 's') + ' after delivery, once the return window has passed.' : 'Earnings can be paid as soon as an order is delivered.';
    var how = d.payoutMode === 'VENDOR_REQUEST'
      ? 'Request a payout when your available balance is at least ' + UI.ngn(d.minPayout) + '. Hairlux approves it and sends it to your payout account.'
      : 'Hairlux pays everyone with at least ' + UI.ngn(d.minPayout) + ' available in each payout run. You do not need to ask.';
    return '<ul class="small muted mb-0"><li>' + esc(hold) + '</li><li>' + esc(how) + '</li>' +
      '<li>If a customer returns items, your share of them comes off your balance. If it was already paid, it comes off your next payout.</li></ul>';
  }

  function summary(d) {
    var open = d.openPayout;
    var parts = [];
    if (d.available < 0) {
      parts.push('<div class="alert warn"><strong>Your balance is below zero</strong>Returns took off more than was available. ' + UI.ngn(Math.abs(d.available)) + ' will come off your next earnings.</div>');
    }
    parts.push('<div class="stats">' +
      '<div class="stat"><div class="n">' + money(d.available) + '</div><div class="l">Available to pay</div></div>' +
      '<div class="stat"><div class="n">' + UI.ngn(d.pending) + '</div><div class="l">Pending' + (d.nextAvailableAt ? ', next on ' + UI.date(d.nextAvailableAt) : '') + '</div></div>' +
      '<div class="stat"><div class="n">' + UI.ngn(d.paidOut) + '</div><div class="l">Paid to you</div></div>' +
      '<div class="stat"><div class="n">' + UI.ngn(d.earned) + '</div><div class="l">Earned in total</div></div>' +
      '</div>');

    var action = '';
    if (open) {
      action = '<div class="alert info mb-0"><strong>' + esc(PAYOUT[open.status].label) + ': ' + UI.ngn(open.amount) + '</strong>' +
        (open.status === 'PENDING' ? 'Requested ' + UI.dateTime(open.createdAt) + '.' : 'Sent to ' + esc(open.bankName || 'your bank') + ' ' + esc(open.accountNumber || '') + '.') +
        (open.status === 'PENDING' && open.source === 'REQUEST' ? ' <button class="btn-link" id="btn-cancel-req" data-id="' + esc(open.id) + '">Cancel request</button>' : '') + '</div>';
    } else if (d.payoutMode === 'VENDOR_REQUEST') {
      action = d.canRequest
        ? '<div class="row"><div class="input-group" style="max-width:260px"><input id="amount" class="input" type="number" min="' + d.minPayout + '" max="' + d.available + '" step="0.01" value="' + d.available + '" aria-label="Amount"><span class="addon">NGN</span></div>' +
          '<button class="btn btn-gold" id="btn-request" data-busy="Requesting">Request payout</button></div>'
        : '<p class="small muted mb-0">' + esc(d.reasons.join('. ')) + '.</p>';
    } else if (d.reasons.length && d.available > 0) {
      action = '<p class="small muted mb-0">Not in the next payout yet: ' + esc(d.reasons.join('. ')) + '.</p>';
    }

    var acct = d.payoutAccount
      ? '<div class="small">Paid to <strong>' + esc(d.payoutAccount.bankName) + '</strong> ' + esc(d.payoutAccount.accountNumber) + ' (' + esc(d.payoutAccount.accountName) + ')</div>'
      : '<div class="alert warn mb-0"><strong>No payout account</strong>Add one in <a href="application.html#bank">Business</a> so Hairlux can pay you.</div>';

    $('#summary').innerHTML = '<div class="card"><div class="card-head"><h2>Your balance</h2><a class="btn btn-outline btn-sm" href="application.html#bank">Payout account</a></div>' +
      parts.join('') + '<div class="mt-3">' + acct + '</div>' + (action ? '<div class="mt-3">' + action + '</div>' : '') + '</div>' +
      '<div class="card"><h3>How payouts work</h3>' + rules(d) + '</div>';

    var req = $('#btn-request');
    if (req) {
      req.addEventListener('click', async function () {
        var amount = Number($('#amount').value);
        if (!(amount > 0)) { UI.toast('Enter an amount.', 'bad'); return; }
        try {
          await UI.busy(req, function () { return VendorApi.request('/vendor/payouts/request', { method: 'POST', json: { amount: amount } }); });
          UI.toast('Payout requested. Hairlux will review it.', 'ok');
          loadAll();
        } catch (e) { UI.toast(e.message, 'bad'); }
      });
    }
    var cancel = $('#btn-cancel-req');
    if (cancel) {
      cancel.addEventListener('click', async function () {
        try {
          await VendorApi.request('/vendor/payouts/' + encodeURIComponent(cancel.dataset.id) + '/cancel', { method: 'POST' });
          UI.toast('Request cancelled.', 'ok');
          loadAll();
        } catch (e) { UI.toast(e.message, 'bad'); }
      });
    }
  }

  async function loadSummary() {
    try {
      summary(await VendorApi.request('/vendor/earnings'));
    } catch (e) {
      $('#summary').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    }
  }

  async function loadPayouts() {
    try {
      var res = await VendorApi.request('/vendor/payouts?limit=10');
      if (!res.data.length) { $('#payouts').innerHTML = '<p class="muted mb-0">No payouts yet.</p>'; return; }
      $('#payouts').innerHTML = '<div class="table-wrap"><table class="otable"><thead><tr><th>Date</th><th>Status</th><th>To</th><th class="num">Amount</th></tr></thead><tbody>' +
        res.data.map(function (p) {
          return '<tr><td>' + UI.date(p.paidAt || p.approvedAt || p.createdAt) + '</td><td>' + UI.badge(PAYOUT, p.status) +
            (p.status === 'FAILED' ? '<div class="small muted">Back on your balance</div>' : '') + '</td>' +
            '<td class="small">' + esc([p.bankName, p.accountNumber].filter(Boolean).join(' ') || '-') + '</td><td class="num">' + UI.ngn(p.amount) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } catch (e) {
      $('#payouts').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    }
  }

  async function loadLedger(more) {
    if (!more) { page = 1; rows = []; $('#ledger').innerHTML = '<div class="loading"><span class="spinner"></span></div>'; }
    try {
      var q = new URLSearchParams(Object.assign({ page: page, limit: 20 }, type ? { type: type } : {}));
      var res = await VendorApi.request('/vendor/earnings/ledger?' + q);
      rows = rows.concat(res.data);
      $('#btn-more').classList.toggle('hidden', res.meta.page >= res.meta.totalPages);
      if (!rows.length) { $('#ledger').innerHTML = '<p class="muted mb-0">Nothing here yet. Earnings appear when an order is delivered.</p>'; return; }
      $('#ledger').innerHTML = '<div class="table-wrap"><table class="otable"><thead><tr><th>Date</th><th>What</th><th class="num">Amount</th></tr></thead><tbody>' +
        rows.map(function (e) {
          var when = e.amount > 0 && !e.isAvailable ? '<div class="small muted">Available ' + UI.date(e.availableAt) + '</div>' : '';
          var link = e.sellerOrderId ? ' <a class="small" href="orders.html?id=' + esc(e.sellerOrderId) + '">View order</a>' : '';
          return '<tr><td>' + UI.date(e.createdAt) + '</td><td>' + UI.badge(ENTRY, e.type) + '<div class="small">' + esc(e.note || '') + link + '</div>' + when + '</td>' +
            '<td class="num">' + money(e.amount) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } catch (e) {
      $('#ledger').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    }
  }

  function loadAll() { loadSummary(); loadPayouts(); loadLedger(); }

  $('#filters').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    type = b.dataset.type;
    UI.$all('#filters .chip').forEach(function (x) { x.classList.toggle('active', x === b); });
    loadLedger();
  });
  $('#btn-more').addEventListener('click', function () { page++; loadLedger(true); });
  loadAll();
})();
