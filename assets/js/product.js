/**
 * Hairlux Vendor: add or edit a product. A new product can be saved as a
 * draft or sent for review. Changing the name, description, category, brand,
 * NAFDAC number or photos of an approved product sends it back for review;
 * price changes do not. Stock is what the Hairlux Receiving Center has
 * checked in (see Stock), so it is shown here but not edited.
 */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var MAX_PHOTOS = 5;
  var id = UI.params().get('id');
  var product = null;
  var categories = [];
  var newFiles = [];      // File objects to upload
  var removeIds = [];     // existing image ids to remove

  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function val(x) { var el = $('#' + x); return el ? el.value.trim() : ''; }

  function lockedContent() { return product && product.approvalStatus === 'PENDING_REVIEW'; }
  function readOnly() { return product && product.approvalStatus === 'REJECTED'; }

  function photos() {
    var existing = (product ? product.images : []).map(function (i) {
      var gone = removeIds.indexOf(i.id) >= 0;
      return '<div class="thumb' + (gone ? ' removed' : '') + '" style="background-image:url(\'' + esc(i.url) + '\')">' +
        (lockedContent() || readOnly() ? '' : '<button type="button" data-rm="' + i.id + '" aria-label="' + (gone ? 'Keep photo' : 'Remove photo') + '">' + (gone ? '&#8634;' : '&times;') + '</button>') +
        (gone ? '<span class="tag">Removed</span>' : '') + '</div>';
    }).join('');
    var fresh = newFiles.map(function (f, i) {
      return '<div class="thumb" style="background-image:url(\'' + URL.createObjectURL(f) + '\')"><button type="button" data-rm-new="' + i + '" aria-label="Remove photo">&times;</button><span class="tag">New</span></div>';
    }).join('');
    var count = (product ? product.images.length - removeIds.length : 0) + newFiles.length;
    var add = count < MAX_PHOTOS && !lockedContent() && !readOnly()
      ? '<label class="thumb add">+ Add photo<input type="file" class="hidden" id="pick" accept="image/*" multiple></label>' : '';
    return existing + fresh + add;
  }

  function render() {
    var p = product || {};
    $('#title').textContent = product ? product.name : 'Add a product';
    $('#head-badge').innerHTML = product ? UI.badge(UI.PRODUCT_STATUS, product.approvalStatus) : '';
    var lc = lockedContent() || readOnly();
    var ro = readOnly();
    var notes = '';
    if (product && product.approvalStatus === 'CHANGES_REQUESTED') notes = '<div class="alert warn"><strong>Changes needed</strong>' + esc(product.reviewNotes || '') + '</div>';
    if (product && product.approvalStatus === 'REJECTED') notes = '<div class="alert bad"><strong>Not approved</strong>' + esc(product.reviewNotes || '') + '</div>';
    if (lockedContent()) notes = '<div class="alert info"><strong>Under review</strong>You can change the price now. Everything else can change after the review.</div>';
    if (product && product.approvalStatus === 'APPROVED') notes = '<div class="alert ok"><strong>Approved</strong>Price changes apply at once. Changing the name, photos or description sends the product back for review.</div>';

    $('#content').innerHTML = notes +
      '<form id="f" novalidate>' +
      '<div class="card"><h2>Photos</h2><p class="muted small">Up to ' + MAX_PHOTOS + ' clear photos on a plain background. Include one of the label showing the NAFDAC number.</p><div class="thumbs" id="thumbs">' + photos() + '</div></div>' +
      '<div class="card"><h2>Details</h2>' +
      '<div class="field"><label for="p-name">Product name</label><input class="input" id="p-name" maxlength="150" value="' + esc(p.name || '') + '"' + (lc ? ' disabled' : '') + ' placeholder="Brand, product and size, e.g. Shea Butter Hair Cream 250ml"></div>' +
      '<div class="grid-2"><div class="field"><label for="p-cat">Category</label><select class="input" id="p-cat"' + (lc ? ' disabled' : '') + '>' + opt('', 'Choose a category', !p.categoryId) +
      categories.map(function (c) { return opt(c.id, c.name, p.categoryId === c.id); }).join('') + '</select></div>' +
      '<div class="field"><label for="p-brand">Brand</label><input class="input" id="p-brand" maxlength="80" value="' + esc(p.brand || '') + '"' + (lc ? ' disabled' : '') + '></div></div>' +
      '<div class="field"><label for="p-desc">Description</label><textarea class="input" id="p-desc" maxlength="4000"' + (lc ? ' disabled' : '') + ' placeholder="What it does, who it is for, how to use it, key ingredients">' + esc(p.description || '') + '</textarea><div class="hint">At least 20 characters. Customers see this.</div></div>' +
      '<div class="grid-2"><div class="field"><label for="p-nafdac">NAFDAC number</label><input class="input mono" id="p-nafdac" maxlength="40" value="' + esc(p.nafdacNumber || '') + '"' + (lc ? ' disabled' : '') + ' placeholder="e.g. A1-2345"><div class="hint">As printed on the label.</div></div>' +
      '<div class="field"><label for="p-sku">Your product code (optional)</label><input class="input" id="p-sku" maxlength="60" value="' + esc(p.sellerSku || '') + '"' + (ro ? ' disabled' : '') + '></div></div></div>' +
      '<div class="card"><h2>Price and stock</h2><div class="grid-2">' +
      '<div class="field"><label for="p-price">Selling price</label><div class="input-group"><input class="input" id="p-price" type="number" min="1" step="0.01" value="' + (p.price || '') + '"' + (ro ? ' disabled' : '') + '><span class="addon">NGN</span></div><div class="hint">What the customer pays. Hairlux\'s commission comes out of this.</div></div>' +
      '<div class="field"><span class="label">Stock at the Receiving Center</span>' +
      (product && product.approvalStatus === 'APPROVED'
        ? '<div class="code-big">' + (p.stock || 0) + '</div><div class="hint">Send more from <a href="stock.html?send=1">Stock</a>. It goes on sale once the Receiving Center has checked it in.</div>'
        : '<div class="hint">Once Hairlux approves this product, send stock to the Hairlux Receiving Center from the Stock page. Customers can buy only what the Receiving Center has checked in.</div>') +
      '</div></div></div>' +
      '<div class="card"><h2>Packaging</h2><p class="muted small">Used to work out delivery. Weigh the product packed, ready to send.</p><div class="grid-2">' +
      '<div class="field"><label for="p-weight">Packed weight</label><div class="input-group"><input class="input" id="p-weight" type="number" min="1" step="1" value="' + (p.weightGrams || '') + '"' + (ro ? ' disabled' : '') + '><span class="addon">grams</span></div></div><div></div></div>' +
      '<div class="grid-3"><div class="field"><label for="p-l">Length (optional)</label><div class="input-group"><input class="input" id="p-l" type="number" min="0" step="0.1" value="' + (p.lengthCm || '') + '"' + (ro ? ' disabled' : '') + '><span class="addon">cm</span></div></div>' +
      '<div class="field"><label for="p-w">Width (optional)</label><div class="input-group"><input class="input" id="p-w" type="number" min="0" step="0.1" value="' + (p.widthCm || '') + '"' + (ro ? ' disabled' : '') + '><span class="addon">cm</span></div></div>' +
      '<div class="field"><label for="p-h">Height (optional)</label><div class="input-group"><input class="input" id="p-h" type="number" min="0" step="0.1" value="' + (p.heightCm || '') + '"' + (ro ? ' disabled' : '') + '><span class="addon">cm</span></div></div></div></div>' +
      (product && product.history && product.history.length ? '<div class="card"><h2>History</h2><ul class="timeline">' + product.history.map(function (h) {
        return '<li><div class="small muted">' + UI.dateTime(h.createdAt) + '</div>' + UI.badge(UI.PRODUCT_STATUS, h.toStatus) + (h.notes ? '<div class="mt-2">' + esc(h.notes) + '</div>' : '') + '</li>';
      }).join('') + '</ul></div>' : '') +
      '<div class="error-text hidden" id="error"></div>' +
      '<div class="sticky-actions">' + actions() + '</div></form>';
    wire();
  }

  function actions() {
    if (!product) {
      return '<button type="button" class="btn btn-outline" data-save="draft" data-busy="Saving">Save as draft</button>' +
        '<button type="button" class="btn btn-gold" data-save="submit" data-busy="Sending">Send for review</button>';
    }
    var a = [];
    if (product.approvalStatus === 'DRAFT') a.push('<button type="button" class="btn btn-danger-outline" id="btn-delete" data-busy="Deleting">Delete draft</button>');
    else if (product.approvalStatus !== 'REJECTED') a.push('<button type="button" class="btn btn-outline" id="btn-visibility" data-busy="Saving">' + (product.status === 'ACTIVE' ? 'Hide product' : 'Show product') + '</button>');
    if (product.approvalStatus === 'REJECTED') return a.join('');
    if (product.approvalStatus === 'DRAFT' || product.approvalStatus === 'CHANGES_REQUESTED') {
      a.push('<button type="button" class="btn btn-outline" data-save="draft" data-busy="Saving">Save</button>');
      a.push('<button type="button" class="btn btn-gold" data-save="submit" data-busy="Sending">' + (product.approvalStatus === 'CHANGES_REQUESTED' ? 'Send for review again' : 'Send for review') + '</button>');
    } else {
      a.push('<button type="button" class="btn btn-gold" data-save="draft" data-busy="Saving">Save changes</button>');
    }
    return a.join('');
  }

  function formData(submit) {
    var f = new FormData();
    function put(k, v) { if (v !== '' && v !== null && v !== undefined) f.append(k, v); }
    if (!lockedContent()) {
      put('name', val('p-name')); put('categoryId', val('p-cat')); put('brand', val('p-brand'));
      put('description', val('p-desc')); put('nafdacNumber', val('p-nafdac'));
    }
    put('sellerSku', val('p-sku')); put('price', val('p-price'));
    put('weightGrams', val('p-weight')); put('lengthCm', val('p-l')); put('widthCm', val('p-w')); put('heightCm', val('p-h'));
    if (removeIds.length) f.append('removeImageIds', removeIds.join(','));
    newFiles.forEach(function (file) { f.append('images', file); });
    if (submit) f.append('submitForReview', 'true');
    return f;
  }

  function showError(m) { var e = $('#error'); e.textContent = m; e.classList.toggle('hidden', !m); }

  function wire() {
    var pick = $('#pick');
    if (pick) pick.addEventListener('change', function () {
      var room = MAX_PHOTOS - ((product ? product.images.length - removeIds.length : 0) + newFiles.length);
      var files = Array.prototype.slice.call(pick.files).filter(function (f) { return /^image\//.test(f.type); });
      if (files.some(function (f) { return f.size > 10 * 1024 * 1024; })) UI.toast('Photos must be 10MB or smaller.', 'bad');
      newFiles = newFiles.concat(files.filter(function (f) { return f.size <= 10 * 1024 * 1024; }).slice(0, room));
      $('#thumbs').innerHTML = photos();
      wire();
    });
    UI.$all('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        var i = removeIds.indexOf(b.dataset.rm);
        if (i >= 0) removeIds.splice(i, 1); else removeIds.push(b.dataset.rm);
        $('#thumbs').innerHTML = photos(); wire();
      };
    });
    UI.$all('[data-rm-new]').forEach(function (b) {
      b.onclick = function () { newFiles.splice(Number(b.dataset.rmNew), 1); $('#thumbs').innerHTML = photos(); wire(); };
    });
    UI.$all('[data-save]').forEach(function (b) {
      b.onclick = function () {
        showError('');
        var submit = b.dataset.save === 'submit';
        if (!product && (!val('p-name') || !val('p-cat') || !val('p-price'))) { showError('Add a name, category and price first.'); return; }
        UI.busy(b, async function () {
          try {
            var saved = product
              ? await VendorApi.request('/vendor/products/' + product.id, { method: 'PATCH', form: formData(submit) })
              : await VendorApi.request('/vendor/products', { method: 'POST', form: formData(submit) });
            newFiles = []; removeIds = [];
            UI.toast(saved.approvalStatus === 'PENDING_REVIEW' ? 'Sent to Hairlux for review.' : 'Saved.', 'ok');
            if (!product) { history.replaceState(null, '', 'product.html?id=' + saved.id); id = saved.id; }
            await load();
            window.scrollTo(0, 0);
          } catch (err) { showError(err.message); }
        });
      };
    });
    var del = $('#btn-delete');
    if (del) del.onclick = function () {
      UI.busy(del, async function () {
        try { await VendorApi.request('/vendor/products/' + product.id, { method: 'DELETE' }); location.href = 'products.html'; }
        catch (err) { showError(err.message); }
      });
    };
    var vis = $('#btn-visibility');
    if (vis) vis.onclick = function () {
      UI.busy(vis, async function () {
        try {
          await VendorApi.request('/vendor/products/' + product.id + '/status', { method: 'PATCH', json: { status: product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } });
          await load();
          UI.toast(product.status === 'ACTIVE' ? 'Product shown.' : 'Product hidden.', 'ok');
        } catch (err) { showError(err.message); }
      });
    };
  }

  async function load() {
    product = id ? await VendorApi.request('/vendor/products/' + id) : null;
    render();
  }

  Promise.all([VendorApi.request('/vendor/categories'), VendorApi.request('/vendor/me')]).then(function (r) {
    categories = r[0];
    if (!id && r[1].seller.status !== 'APPROVED') {
      $('#content').innerHTML = '<div class="alert info"><strong>Products come after approval</strong>You can add products once Hairlux has approved your business. <a href="dashboard.html">Back to the dashboard</a></div>';
      return;
    }
    return load();
  }).catch(function (e) { $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; });
})();
