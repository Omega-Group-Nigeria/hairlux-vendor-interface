/** Hairlux Vendor: product list with status filters. */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var status = UI.params().get('status') || '';
  var page = 1;
  var items = [];
  var seller = null;

  function card(p) {
    var img = p.images[0] ? 'style="background-image:url(\'' + esc(p.images[0].url) + '\')"' : '';
    return '<a class="pcard" href="product.html?id=' + esc(p.id) + '"><div class="ph" ' + img + '>' + (p.images[0] ? '' : 'No photo') + '</div>' +
      '<div class="body"><div class="row between">' + UI.badge(UI.PRODUCT_STATUS, p.approvalStatus) + (p.status === 'INACTIVE' ? '<span class="badge">Hidden</span>' : '') + '</div>' +
      '<div class="name">' + esc(p.name) + '</div><div class="row between"><span class="price">' + UI.ngn(p.price) + '</span><span class="small muted">' + (p.approvalStatus === 'APPROVED' ? p.stock + ' at the Receiving Center' : '') + '</span></div>' +
      (p.approvalStatus === 'CHANGES_REQUESTED' && p.reviewNotes ? '<div class="small" style="color:var(--warn)">' + esc(p.reviewNotes) + '</div>' : '') + '</div></a>';
  }

  async function load(more) {
    if (!more) { page = 1; items = []; $('#list').innerHTML = '<div class="loading"><span class="spinner"></span></div>'; }
    try {
      var res = await VendorApi.request('/vendor/products?' + new URLSearchParams(Object.assign({ page: page, limit: 24 }, status ? { approvalStatus: status } : {})));
      items = items.concat(res.data);
      $('#btn-more').classList.toggle('hidden', res.meta.page >= res.meta.totalPages);
      if (!items.length) {
        var canAdd = seller && seller.status === 'APPROVED';
        $('#list').innerHTML = '<div class="card empty"><h3>' + (status ? 'Nothing here' : 'No products yet') + '</h3><p>' +
          (canAdd ? 'Add your first product. Hairlux checks each one before it goes on sale.' : 'You can add products once Hairlux approves your business.') + '</p>' +
          (canAdd && !status ? '<a class="btn btn-gold" href="product.html">Add product</a>' : '') + '</div>';
        return;
      }
      $('#list').innerHTML = '<div class="products">' + items.map(card).join('') + '</div>';
    } catch (e) {
      $('#list').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
    }
  }

  UI.$all('#filters .chip').forEach(function (c) {
    c.classList.toggle('active', c.dataset.status === status);
    c.addEventListener('click', function () {
      status = c.dataset.status;
      UI.$all('#filters .chip').forEach(function (x) { x.classList.toggle('active', x === c); });
      history.replaceState(null, '', status ? '?status=' + status : 'products.html');
      load();
    });
  });
  $('#btn-more').addEventListener('click', function () { page++; load(true); });

  VendorApi.request('/vendor/me').then(function (me) {
    seller = me.seller;
    if (seller.status === 'APPROVED') $('#btn-add').classList.remove('hidden');
    else if (seller.status === 'SUSPENDED') $('#notice').innerHTML = '<div class="alert bad"><strong>Account suspended</strong>Your products are not on sale and cannot be edited.</div>';
    else $('#notice').innerHTML = '<div class="alert info"><strong>Products come after approval</strong>Finish and submit your <a href="application.html">application</a>. Once Hairlux approves your business you can add products here.</div>';
    load();
  }).catch(function (e) { $('#list').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; });
})();
