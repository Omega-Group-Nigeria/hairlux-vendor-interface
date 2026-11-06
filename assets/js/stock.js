/**
 * Hairlux Vendor: stock at the Hairlux Receiving Center. You do not ship to
 * customers: you bring stock to the Receiving Center, which counts and checks
 * it, and only what passes goes on sale. Hairlux picks each order from it.
 *  - On the shelf: what is there, what is on its way, what is running low.
 *  - Deliveries: tell Hairlux what you are bringing, and see what was accepted.
 *  - Take back: ask to collect unsold stock.
 *  - History: every change to your stock.
 */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var params = UI.params();
  var tab = params.get('tab') || (params.get('intake') ? 'deliveries' : 'shelf');
  var rc = null;
  var products = null; // approved products, for the pickers

  var INTAKE = {
    SUBMITTED: { label: 'On its way', cls: 'warn' },
    RECEIVED: { label: 'Received', cls: 'ok' },
    CANCELLED: { label: 'Cancelled', cls: '' },
  };
  var WITHDRAWAL = {
    REQUESTED: { label: 'Waiting for approval', cls: 'warn' },
    APPROVED: { label: 'Ready to collect', cls: 'gold' },
    COLLECTED: { label: 'Collected', cls: 'ok' },
    REJECTED: { label: 'Not approved', cls: 'bad' },
    CANCELLED: { label: 'Cancelled', cls: '' },
  };
  var MOVE = {
    INTAKE: { label: 'Received', cls: 'ok' },
    SALE: { label: 'Sold', cls: 'gold' },
    SALE_CANCELLED: { label: 'Order cancelled', cls: '' },
    RETURN_RESTOCK: { label: 'Returned', cls: '' },
    WITHDRAWAL: { label: 'Taken back', cls: 'warn' },
    WITHDRAWAL_REVERSED: { label: 'Take-back cancelled', cls: '' },
    ADJUSTMENT: { label: 'Correction', cls: 'bad' },
  };

  function loading() { $('#view').innerHTML = '<div class="loading"><span class="spinner"></span></div>'; }
  function fail(e) { $('#view').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  function qs(o) { var p = new URLSearchParams(); Object.keys(o).forEach(function (k) { if (o[k] !== '' && o[k] != null) p.set(k, o[k]); }); return p.toString(); }

  function setTab(t, extra) {
    tab = t;
    UI.$all('#tabs .chip').forEach(function (c) { c.classList.toggle('active', c.dataset.tab === t); });
    history.replaceState(null, '', 'stock.html?' + qs(Object.assign({ tab: t === 'shelf' ? '' : t }, extra || {})));
    ({ shelf: shelf, deliveries: deliveries, takeback: takeback, history: historyTab })[t](extra || {});
  }

  function productCell(p) {
    return '<div class="pname">' + (p.imageUrl ? '<img class="pthumb" src="' + esc(p.imageUrl) + '" alt="">' : '<span class="pthumb"></span>') +
      '<div><div>' + esc(p.name) + '</div>' + (p.sellerSku ? '<div class="small muted">SKU ' + esc(p.sellerSku) + '</div>' : '') + '</div></div>';
  }

  // ------------------------------------------------------------- Receiving Center

  async function loadRc() {
    try {
      rc = await VendorApi.request('/vendor/receiving-center');
      $('#rc').innerHTML = '<div><h3 class="mt-0">' + esc(rc.name) + '</h3><div class="kv">' +
        '<div><span class="label">Address</span>' + (rc.address ? esc(rc.address) : '<span class="muted">Hairlux will send it to you</span>') + '</div>' +
        '<div><span class="label">Phone</span>' + (rc.phone ? '<a href="tel:' + esc(rc.phone) + '">' + esc(rc.phone) + '</a>' : '-') + '</div>' +
        '<div><span class="label">Opening hours</span>' + (rc.hours ? esc(rc.hours) : '-') + '</div></div></div>' +
        '<p class="small muted mb-0">Bring stock with its delivery code. Only items that pass inspection go on sale.</p>';
    } catch (e) { $('#rc').innerHTML = '<div class="alert bad mb-0">' + esc(e.message) + '</div>'; }
  }

  async function loadProducts() {
    if (products) return products;
    var res = await VendorApi.request('/vendor/stock?limit=100');
    products = res.data;
    return products;
  }

  // ------------------------------------------------------------- on the shelf

  async function shelf(opts) {
    loading();
    try {
      var res = await VendorApi.request('/vendor/stock?' + qs({ limit: 100, low: opts.low ? 'true' : '' }));
      products = null;
      var threshold = rc ? rc.lowStockThreshold : 5;
      var head = '<div class="row between mb-3"><label class="row small"><input type="checkbox" id="only-low"' + (opts.low ? ' checked' : '') + '> Only running low (' + threshold + ' or fewer)</label></div>';
      if (!res.data.length) {
        $('#view').innerHTML = head + '<div class="card empty"><h3>' + (opts.low ? 'Nothing running low' : 'No approved products yet') + '</h3><p>' +
          (opts.low ? 'All your products have enough stock.' : 'Once Hairlux approves a product, send stock to the Receiving Center so it can go on sale.') + '</p>' +
          (opts.low ? '' : '<a class="btn btn-outline" href="products.html">Your products</a>') + '</div>';
      } else {
        $('#view').innerHTML = head + '<div class="card"><div class="table-wrap"><table class="otable"><thead><tr><th>Product</th><th class="num">On the shelf</th><th class="num">On its way</th></tr></thead><tbody>' +
          res.data.map(function (p) {
            var flag = p.stock === 0 ? '<span class="badge bad">Out of stock</span>' : p.lowStock ? '<span class="badge warn">Running low</span>' : '';
            if (p.approvalStatus === 'PENDING_REVIEW') flag += ' <span class="badge warn">Under review</span>';
            return '<tr class="clickable" data-product="' + esc(p.id) + '"><td>' + productCell(p) + (flag ? '<div class="mt-2">' + flag + '</div>' : '') + '</td>' +
              '<td class="num"><strong>' + p.stock + '</strong></td><td class="num">' + (p.incoming || '-') + '</td></tr>';
          }).join('') +
          '</tbody></table></div><p class="small muted mb-0">Tap a product to see its history. Stock only changes when the Receiving Center checks in a delivery, a customer order is placed or cancelled, or you take stock back.</p></div>';
      }
      $('#only-low').addEventListener('change', function (e) { setTab('shelf', e.target.checked ? { low: '1' } : {}); });
      UI.$all('[data-product]').forEach(function (r) { r.addEventListener('click', function () { setTab('history', { product: r.dataset.product }); }); });
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------- picker rows

  function lineRow(list, max) {
    return '<div class="line-row"><select class="input" data-line-product aria-label="Product"><option value="">Choose a product</option>' +
      list.map(function (p) { return '<option value="' + esc(p.id) + '" data-max="' + (max ? p.stock : '') + '">' + esc(p.name) + (max ? ' (' + p.stock + ' on the shelf)' : '') + '</option>'; }).join('') +
      '</select><input class="input" type="number" min="1" step="1" inputmode="numeric" placeholder="Qty" data-line-qty aria-label="Quantity">' +
      '<button type="button" class="btn btn-outline" data-line-remove aria-label="Remove">&times;</button></div>';
  }

  function wireLines(root, list, max) {
    var lines = $('.lines', root);
    function add() { lines.insertAdjacentHTML('beforeend', lineRow(list, max)); }
    add();
    $('[data-line-add]', root).addEventListener('click', add);
    lines.addEventListener('click', function (e) {
      if (e.target.matches('[data-line-remove]') && lines.children.length > 1) e.target.closest('.line-row').remove();
    });
    return function read() {
      var out = [], seen = {};
      UI.$all('.line-row', lines).forEach(function (r) {
        var id = $('[data-line-product]', r).value;
        var q = parseInt($('[data-line-qty]', r).value, 10);
        if (!id && !q) return;
        if (!id) throw new Error('Choose a product on every line.');
        if (!(q >= 1)) throw new Error('Enter a quantity of at least 1 on every line.');
        if (seen[id]) throw new Error('Each product can only be listed once.');
        if (max) {
          var p = list.find(function (x) { return x.id === id; });
          if (q > p.stock) throw new Error('Only ' + p.stock + ' of "' + p.name + '" is at the Receiving Center.');
        }
        seen[id] = true;
        out.push({ productId: id, quantity: q });
      });
      if (!out.length) throw new Error('Add at least one product.');
      return out;
    };
  }

  // ------------------------------------------------------------- deliveries

  async function sendForm() {
    UI.$all('#tabs .chip').forEach(function (c) { c.classList.toggle('active', c.dataset.tab === 'deliveries'); });
    loading();
    try {
      var list = (await loadProducts()).filter(function (p) { return p.approvalStatus === 'APPROVED'; });
      if (!list.length) {
        $('#view').innerHTML = '<div class="card empty"><h3>No approved products yet</h3><p>You can send stock once Hairlux has approved a product.</p><a class="btn btn-outline" href="products.html">Your products</a></div>';
        return;
      }
      $('#view').innerHTML = '<div class="row mb-3"><button class="btn-link" id="back">&larr; Deliveries</button></div>' +
        '<form class="card" id="send-form"><h2 class="mt-0">Send stock</h2>' +
        '<p class="muted">Tell Hairlux what you are bringing. You get a delivery code to bring with the stock. The Receiving Center counts and checks every item; anything damaged or wrong is handed back to you.</p>' +
        '<div class="lines"></div><button type="button" class="btn btn-outline btn-sm mb-3" data-line-add>Add another product</button>' +
        '<div class="grid-2"><div class="field"><label for="expected">When will you bring it? (optional)</label><input id="expected" class="input" type="date"></div>' +
        '<div class="field"><label for="note">Note for the Receiving Center (optional)</label><input id="note" class="input" maxlength="500" placeholder="e.g. Two cartons, our rider drops off"></div></div>' +
        '<div class="row end"><button class="btn btn-gold" type="submit" data-busy="Sending">Create delivery</button></div></form>';
      $('#expected').min = new Date().toISOString().slice(0, 10);
      var read = wireLines($('#send-form'), list, false);
      $('#back').addEventListener('click', function () { setTab('deliveries'); });
      $('#send-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = $('#send-form [type=submit]');
        try {
          var body = { lines: read() };
          if ($('#expected').value) body.expectedOn = $('#expected').value;
          if ($('#note').value.trim()) body.note = $('#note').value.trim();
          var d = await UI.busy(btn, function () { return VendorApi.request('/vendor/intakes', { method: 'POST', json: body }); });
          UI.toast('Delivery created. Bring code ' + d.code + ' with the stock.', 'ok');
          setTab('deliveries', { intake: d.id });
          countOpen();
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    } catch (e) { fail(e); }
  }

  async function deliveries(opts) {
    if (opts.intake) return intakeDetail(opts.intake);
    loading();
    try {
      var res = await VendorApi.request('/vendor/intakes?limit=50');
      if (!res.data.length) {
        $('#view').innerHTML = '<div class="card empty"><h3>No deliveries yet</h3><p>Create a delivery to tell Hairlux what stock you are bringing to the Receiving Center.</p><button class="btn btn-gold" id="empty-send">Send stock</button></div>';
        $('#empty-send').addEventListener('click', sendForm);
        return;
      }
      $('#view').innerHTML = '<div class="card"><div class="table-wrap"><table class="otable"><thead><tr><th>Code</th><th>Status</th><th class="num">Units</th><th>Date</th></tr></thead><tbody>' +
        res.data.map(function (d) {
          var units = d.status === 'RECEIVED' ? d.totals.accepted + ' accepted' + (d.totals.rejected ? ', ' + d.totals.rejected + ' rejected' : '') : d.totals.expected + ' expected';
          var when = d.status === 'RECEIVED' ? 'Received ' + UI.date(d.receivedAt) : d.expectedOn ? 'Expected ' + UI.date(d.expectedOn) : 'Created ' + UI.date(d.createdAt);
          return '<tr class="clickable" data-intake="' + esc(d.id) + '"><td><strong>' + esc(d.code) + '</strong></td><td>' + UI.badge(INTAKE, d.status) + '</td><td class="num">' + esc(units) + '</td><td class="small">' + esc(when) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      UI.$all('[data-intake]').forEach(function (r) { r.addEventListener('click', function () { setTab('deliveries', { intake: r.dataset.intake }); }); });
    } catch (e) { fail(e); }
  }

  async function intakeDetail(id) {
    loading();
    try {
      var d = await VendorApi.request('/vendor/intakes/' + encodeURIComponent(id));
      var received = d.status === 'RECEIVED';
      var rows = d.lines.map(function (l) {
        return '<tr><td>' + productCell(l.product) + (l.rejectReason ? '<div class="reject">Rejected: ' + esc(l.rejectReason) + '</div>' : '') + '</td>' +
          '<td class="num">' + l.expectedQuantity + '</td>' +
          (received ? '<td class="num">' + l.receivedQuantity + '</td><td class="num"><strong>' + l.acceptedQuantity + '</strong></td><td class="num">' + (l.rejectedQuantity || '-') + '</td>' : '') + '</tr>';
      }).join('');
      $('#view').innerHTML = '<div class="row mb-3"><button class="btn-link" id="back">&larr; Deliveries</button></div>' +
        '<div class="card"><div class="card-head"><div><div class="eyebrow">Stock delivery</div><div class="code-big">' + esc(d.code) + '</div>' +
        '<div class="small muted">Created ' + UI.dateTime(d.createdAt) + (d.expectedOn ? ' &middot; expected ' + UI.date(d.expectedOn) : '') + '</div></div>' + UI.badge(INTAKE, d.status) + '</div>' +
        (d.status === 'SUBMITTED' ? '<div class="alert info"><strong>Bring this stock to ' + esc(rc ? rc.name : 'the Receiving Center') + '</strong>' +
          (rc && rc.address ? esc(rc.address) + '. ' : '') + 'Give them the code ' + esc(d.code) + '. Items go on sale once they pass inspection.</div>' : '') +
        (received ? '<div class="alert ' + (d.totals.rejected || d.totals.received < d.totals.expected ? 'warn' : 'ok') + '"><strong>Checked in ' + UI.dateTime(d.receivedAt) + '</strong>' +
          d.totals.accepted + ' unit' + (d.totals.accepted === 1 ? '' : 's') + ' went on sale.' +
          (d.totals.rejected ? ' ' + d.totals.rejected + ' rejected: collect them from the Receiving Center.' : '') +
          (d.totals.received < d.totals.expected ? ' ' + (d.totals.expected - d.totals.received) + ' fewer arrived than you said.' : '') + '</div>' : '') +
        (d.status === 'CANCELLED' ? '<div class="alert bad"><strong>Cancelled ' + UI.dateTime(d.cancelledAt) + (d.cancelledBy === 'ADMIN' ? ' by Hairlux' : '') + '</strong>' + esc(d.cancelReason || '') + '</div>' : '') +
        (d.receivedNote ? '<p><span class="label">Receiving Center note</span>' + esc(d.receivedNote) + '</p>' : '') +
        (d.vendorNote ? '<p><span class="label">Your note</span>' + esc(d.vendorNote) + '</p>' : '') +
        '<div class="table-wrap"><table class="otable"><thead><tr><th>Product</th><th class="num">You said</th>' + (received ? '<th class="num">Arrived</th><th class="num">Accepted</th><th class="num">Rejected</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (d.status === 'SUBMITTED' ? '<div class="row end"><button class="btn btn-danger-outline btn-sm" id="cancel-intake" data-busy="Cancelling">Cancel this delivery</button></div>' : '') +
        '</div>';
      $('#back').addEventListener('click', function () { setTab('deliveries'); });
      var c = $('#cancel-intake');
      if (c) c.addEventListener('click', async function () {
        if (!confirm('Cancel delivery ' + d.code + '? Do not bring this stock.')) return;
        try {
          await UI.busy(c, function () { return VendorApi.request('/vendor/intakes/' + d.id + '/cancel', { method: 'POST', json: {} }); });
          UI.toast('Delivery cancelled', 'ok');
          intakeDetail(d.id);
          countOpen();
        } catch (e) { UI.toast(e.message, 'bad'); }
      });
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------- take back

  async function takeback() {
    loading();
    try {
      var res = await VendorApi.request('/vendor/withdrawals?limit=50');
      var open = res.data.filter(function (w) { return w.status === 'REQUESTED' || w.status === 'APPROVED'; });
      $('#view').innerHTML = '<div class="card"><div class="card-head"><div><h2>Take stock back</h2><p class="muted mb-0">Ask to collect unsold stock from the Receiving Center. Once Hairlux approves, it comes off sale and is set aside for you to collect.</p></div>' +
        '<button class="btn btn-outline" id="new-wd">Ask to take stock back</button></div>' +
        '<div id="wd-form"></div>' +
        (res.data.length
          ? '<div class="table-wrap"><table class="otable"><thead><tr><th>Request</th><th>Items</th><th>Status</th><th></th></tr></thead><tbody>' +
            res.data.map(function (w) {
              return '<tr><td><strong>' + esc(w.code) + '</strong><div class="small muted">' + UI.date(w.createdAt) + '</div></td>' +
                '<td>' + w.items.map(function (i) { return esc(i.quantity + ' x ' + i.name); }).join('<br>') +
                (w.adminNote ? '<div class="small muted">Hairlux: ' + esc(w.adminNote) + '</div>' : '') +
                (w.collectedBy ? '<div class="small muted">Collected by ' + esc(w.collectedBy) + ' on ' + UI.date(w.collectedAt) + '</div>' : '') + '</td>' +
                '<td>' + UI.badge(WITHDRAWAL, w.status) + '</td>' +
                '<td class="num">' + (w.status === 'REQUESTED' || w.status === 'APPROVED' ? '<button class="btn btn-outline btn-sm" data-wd-cancel="' + esc(w.id) + '" data-busy="Cancelling">Cancel</button>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<p class="muted mb-0">No requests yet.</p>') +
        (open.some(function (w) { return w.status === 'APPROVED'; }) && rc
          ? '<div class="alert info mt-3 mb-0"><strong>Ready to collect</strong>Collect from ' + esc(rc.name) + (rc.address ? ', ' + esc(rc.address) : '') + (rc.hours ? ' (' + esc(rc.hours) + ')' : '') + '. Bring the request code.</div>'
          : '') +
        '</div>';
      $('#new-wd').addEventListener('click', withdrawalForm);
      UI.$all('[data-wd-cancel]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('Cancel this request? Any stock set aside goes back on sale.')) return;
          try {
            await UI.busy(b, function () { return VendorApi.request('/vendor/withdrawals/' + b.dataset.wdCancel + '/cancel', { method: 'POST', json: {} }); });
            UI.toast('Request cancelled', 'ok');
            takeback();
          } catch (e) { UI.toast(e.message, 'bad'); }
        });
      });
    } catch (e) { fail(e); }
  }

  async function withdrawalForm() {
    var box = $('#wd-form');
    $('#new-wd').classList.add('hidden');
    try {
      var list = (await loadProducts()).filter(function (p) { return p.stock > 0; });
      if (!list.length) { box.innerHTML = '<div class="alert info">You have no stock at the Receiving Center to take back.</div>'; return; }
      box.innerHTML = '<form class="mb-3" id="wd"><div class="lines"></div><button type="button" class="btn btn-outline btn-sm mb-3" data-line-add>Add another product</button>' +
        '<div class="field"><label for="wd-reason">Why? (optional)</label><input id="wd-reason" class="input" maxlength="500"></div>' +
        '<div class="row end"><button type="button" class="btn btn-outline" id="wd-close">Close</button><button class="btn btn-gold" type="submit" data-busy="Sending">Send request</button></div></form>';
      var read = wireLines($('#wd'), list, true);
      $('#wd-close').addEventListener('click', function () { box.innerHTML = ''; $('#new-wd').classList.remove('hidden'); });
      $('#wd').addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = $('#wd [type=submit]');
        try {
          var body = { lines: read() };
          if ($('#wd-reason').value.trim()) body.reason = $('#wd-reason').value.trim();
          await UI.busy(btn, function () { return VendorApi.request('/vendor/withdrawals', { method: 'POST', json: body }); });
          UI.toast('Request sent. We will email you when it is ready to collect.', 'ok');
          takeback();
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    } catch (e) { box.innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  }

  // ------------------------------------------------------------- history

  var histPage = 1, histRows = [];

  async function historyTab(opts, more) {
    if (!more) { histPage = 1; histRows = []; loading(); }
    try {
      var list = await loadProducts();
      var res = await VendorApi.request('/vendor/stock/movements?' + qs({ page: histPage, limit: 30, productId: opts.product || '', type: opts.type || '' }));
      histRows = histRows.concat(res.data);
      var filters = '<div class="grid-2 mb-3"><select class="input" id="h-product" aria-label="Product"><option value="">All products</option>' +
        list.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === opts.product ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>' +
        '<select class="input" id="h-type" aria-label="Type"><option value="">Every change</option>' +
        Object.keys(MOVE).map(function (k) { return '<option value="' + k + '"' + (k === opts.type ? ' selected' : '') + '>' + esc(MOVE[k].label) + '</option>'; }).join('') + '</select></div>';
      var body = !histRows.length
        ? '<p class="muted mb-0">No stock changes yet.</p>'
        : '<div class="table-wrap"><table class="otable"><thead><tr><th>When</th><th>Product</th><th>What</th><th class="num">Change</th><th class="num">Left</th></tr></thead><tbody>' +
          histRows.map(function (m) {
            var ref = m.intakeCode || m.withdrawalCode || '';
            return '<tr><td class="small">' + UI.dateTime(m.createdAt) + '</td><td>' + esc(m.product.name) + '</td>' +
              '<td>' + UI.badge(MOVE, m.type) + (ref ? ' <span class="small muted">' + esc(ref) + '</span>' : '') + (m.note && m.type === 'ADJUSTMENT' ? '<div class="small muted">' + esc(m.note) + '</div>' : '') + '</td>' +
              '<td class="num"><strong>' + (m.quantity > 0 ? '+' : '') + m.quantity + '</strong></td><td class="num">' + m.balanceAfter + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      $('#view').innerHTML = '<div class="card">' + filters + body +
        (res.meta.page < res.meta.totalPages ? '<div class="row end mt-3"><button class="btn btn-outline btn-sm" id="h-more">Show more</button></div>' : '') + '</div>';
      function refilter() { setTab('history', { product: $('#h-product').value, type: $('#h-type').value }); }
      $('#h-product').addEventListener('change', refilter);
      $('#h-type').addEventListener('change', refilter);
      var m = $('#h-more');
      if (m) m.addEventListener('click', function () { histPage++; historyTab(opts, true); });
    } catch (e) { fail(e); }
  }

  // ------------------------------------------------------------- start

  async function countOpen() {
    try {
      var res = await VendorApi.request('/vendor/intakes?status=SUBMITTED&limit=1');
      $('#count-deliveries').textContent = res.meta.total || '';
    } catch (e) { /* the badge is optional */ }
  }

  UI.$all('#tabs .chip').forEach(function (c) { c.addEventListener('click', function () { setTab(c.dataset.tab); }); });
  $('#btn-send').addEventListener('click', sendForm);

  loadRc().then(function () {
    var extra = {};
    if (params.get('intake')) extra.intake = params.get('intake');
    if (params.get('product')) extra.product = params.get('product');
    if (params.get('type')) extra.type = params.get('type');
    if (params.get('low')) extra.low = params.get('low');
    if (params.get('send')) return sendForm();
    setTab(tab, extra);
  });
  countOpen();
})();
