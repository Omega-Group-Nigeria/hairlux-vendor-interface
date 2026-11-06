/**
 * Hairlux Vendor: the application (verification, business details, owner
 * NIN, KYC documents, payout account, agreement, submit). The same page shows
 * a locked, read-only view while Hairlux reviews it, and after approval only
 * contact details and the payout account can change.
 */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;

  var STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
  var TYPES = [
    ['SOLE_PROPRIETOR', 'Not registered (sole trader)'],
    ['BUSINESS_NAME', 'Registered business name (BN)'],
    ['LIMITED_COMPANY', 'Limited company (RC)'],
    ['OTHER', 'Other'],
  ];
  var CATEGORIES = ['Hair care', 'Hair extensions and wigs', 'Skin care', 'Makeup', 'Nail care', 'Fragrance', 'Salon tools and equipment', 'Wellness'];
  var DOCS = [
    { type: 'OWNER_ID', label: "Owner's government ID", hint: 'NIN slip, national ID card, international passport or driver\'s licence. All corners visible.', required: true },
    { type: 'CAC_CERTIFICATE', label: 'CAC certificate', hint: 'Certificate of registration (BN or RC).', requiredIfCac: true },
    { type: 'SHOP_PHOTO', label: 'Photo of your shop or store front', hint: 'Where your products are kept or sold. Your sign should be visible if you have one.', required: true },
    { type: 'PROOF_OF_ADDRESS', label: 'Proof of address (optional)', hint: 'Recent utility bill or tenancy agreement.' },
    { type: 'OTHER', label: 'Anything else (optional)', hint: 'For example a trademark certificate or distributor letter.' },
  ];

  var d = null;
  var banks = null;
  var phoneCodeSent = false;

  function needsCac(t) { return t === 'BUSINESS_NAME' || t === 'LIMITED_COMPANY'; }
  function done(key) { var c = d.checklist.find(function (x) { return x.key === key; }); return !c || c.done; }
  function editable() { return d.canEditApplication; }
  function approved() { return d.seller.status === 'APPROVED'; }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function dis(on) { return on ? '' : ' disabled'; }

  // ── Sections ──────────────────────────────────────────────────────────

  function verifySection() {
    var o = d.owner;
    var phone = o.phoneVerified
      ? '<span class="badge ok">Verified</span>'
      : '<div class="grid-2 mt-2"><div class="field"><label for="v-phone">Phone number</label><input class="input" id="v-phone" type="tel" value="' + esc(o.phone || '') + '"></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn btn-dark btn-block" id="btn-send-code" data-busy="Sending">' + (phoneCodeSent ? 'Send a new code' : 'Text me a code') + '</button></div></div>' +
        '<div class="grid-2' + (phoneCodeSent ? '' : ' hidden') + '" id="phone-code-row"><div class="field"><label for="v-code">6-digit code</label><input class="input otp-input" id="v-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn btn-gold btn-block" id="btn-verify-phone" data-busy="Checking">Verify phone</button></div></div>';
    return '<section class="card section" id="verify"><div class="card-head"><h2>1. Verify your contacts</h2></div>' +
      '<div class="row between"><div><div class="label">Email</div>' + esc(o.email) + '</div>' +
      (o.emailVerified ? '<span class="badge ok">Verified</span>' : '<a class="btn btn-outline btn-sm" href="verify-email.html?email=' + encodeURIComponent(o.email) + '">Verify email</a>') + '</div>' +
      '<div class="mt-3"><div class="row between"><div><div class="label">Phone</div>' + esc(o.phone || '-') + '</div>' + (o.phoneVerified ? phone : '') + '</div>' + (o.phoneVerified ? '' : phone) + '</div>' +
      '</section>';
  }

  function businessSection() {
    var s = d.seller;
    var legal = editable();       // legal details: only while the application is open
    var contact = editable() || approved();
    var cats = CATEGORIES.concat(s.categories.filter(function (c) { return CATEGORIES.indexOf(c) < 0; }));
    return '<section class="card section" id="business"><div class="card-head"><h2>2. Business details</h2>' +
      (approved() ? '<span class="locked-note">Business name, type and CAC number are locked after approval.</span>' : '') + '</div>' +
      '<form id="f-business" novalidate>' +
      '<div class="grid-2"><div class="field"><label for="b-legal">Business name</label><input class="input" id="b-legal" maxlength="150" value="' + esc(s.legalName) + '"' + dis(legal) + '></div>' +
      '<div class="field"><label for="b-trading">Trading name (optional)</label><input class="input" id="b-trading" maxlength="150" value="' + esc(s.tradingName || '') + '"' + dis(legal) + '></div></div>' +
      '<div class="grid-2"><div class="field"><label for="b-type">Business type</label><select class="input" id="b-type"' + dis(legal) + '>' + opt('', 'Choose one', !s.businessType) +
      TYPES.map(function (t) { return opt(t[0], t[1], s.businessType === t[0]); }).join('') + '</select></div>' +
      '<div class="field" id="cac-field"><label for="b-cac">CAC number</label><input class="input" id="b-cac" maxlength="30" placeholder="BN1234567 or RC1234567" value="' + esc(s.cacNumber || '') + '"' + dis(legal) + '></div></div>' +
      '<div class="grid-2"><div class="field"><label for="b-phone">Business phone</label><input class="input" id="b-phone" type="tel" value="' + esc(s.businessPhone || '') + '"' + dis(contact) + '></div>' +
      '<div class="field"><label for="b-email">Business email</label><input class="input" id="b-email" type="email" value="' + esc(s.businessEmail || '') + '"' + dis(contact) + '></div></div>' +
      '<div class="field"><label for="b-address">Address where products are kept</label><input class="input" id="b-address" maxlength="300" value="' + esc(s.address || '') + '"' + dis(contact) + '><div class="hint">Used for delivery pickups. Never shown to customers.</div></div>' +
      '<div class="grid-2"><div class="field"><label for="b-city">City or town</label><input class="input" id="b-city" maxlength="80" value="' + esc(s.city || '') + '"' + dis(contact) + '></div>' +
      '<div class="field"><label for="b-state">State</label><select class="input" id="b-state"' + dis(contact) + '>' + opt('', 'Choose a state', !s.state) +
      STATES.map(function (x) { return opt(x, x, s.state === x); }).join('') + '</select></div></div>' +
      '<div class="field"><div class="label">What do you sell?</div><div class="row" style="gap:8px 18px">' + cats.map(function (c, i) {
        return '<label class="check"><input type="checkbox" name="b-cat" value="' + esc(c) + '"' + (s.categories.indexOf(c) >= 0 ? ' checked' : '') + dis(contact) + '> ' + esc(c) + '</label>';
      }).join('') + '</div></div>' +
      '<div class="field"><label for="b-desc">About your business (optional)</label><textarea class="input" id="b-desc" maxlength="1000"' + dis(contact) + '>' + esc(s.description || '') + '</textarea></div>' +
      (contact ? '<div class="row end"><button class="btn btn-dark" id="btn-save-business" data-busy="Saving">Save business details</button></div>' : '') +
      '</form></section>';
  }

  function ownerSection() {
    var s = d.seller;
    var can = editable();
    var field = s.hasOwnerNin && !can
      ? '<div class="mono">' + esc(s.ownerNinMasked) + '</div>'
      : '<div class="grid-2"><div class="field"><label for="o-nin">NIN (11 digits)</label><input class="input mono" id="o-nin" inputmode="numeric" maxlength="11" placeholder="' + (s.hasOwnerNin ? esc(s.ownerNinMasked) + ' (saved)' : '') + '"></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn btn-dark btn-block" id="btn-save-nin" data-busy="Saving">' + (s.hasOwnerNin ? 'Replace NIN' : 'Save NIN') + '</button></div></div>';
    return '<section class="card section" id="owner"><div class="card-head"><h2>3. Owner\'s NIN</h2>' + (s.hasOwnerNin ? '<span class="badge ok">Saved</span>' : '') + '</div>' +
      '<p class="muted">Hairlux checks the NIN against the owner\'s name on this account (' + esc(d.owner.firstName + ' ' + d.owner.lastName) + '). It is stored securely and never shown in full.</p>' + field + '</section>';
  }

  function documentsSection() {
    var cac = needsCac(d.seller.businessType);
    var can = editable();
    var rows = DOCS.filter(function (x) { return x.type !== 'CAC_CERTIFICATE' || cac; }).map(function (slot) {
      var files = d.documents.filter(function (doc) { return doc.type === slot.type; });
      var have = files.some(function (f) { return f.status !== 'REJECTED'; });
      var list = files.map(function (f) {
        var st = f.status === 'ACCEPTED' ? '<span class="badge ok">Accepted</span>' : f.status === 'REJECTED' ? '<span class="badge bad">Not accepted</span>' : '<span class="badge">Uploaded</span>';
        return '<div class="doc-file">' + st + ' <span>' + esc(f.fileName) + '</span> <button class="btn-link small" data-doc-open="' + f.id + '">View</button>' +
          (can && f.status !== 'ACCEPTED' ? ' <button class="btn-link small" style="color:var(--bad)" data-doc-del="' + f.id + '">Remove</button>' : '') +
          (f.reviewNote ? '<div class="small" style="color:var(--bad);width:100%">' + esc(f.reviewNote) + '</div>' : '') + '</div>';
      }).join('');
      var needed = slot.required || (slot.requiredIfCac && cac);
      return '<div class="doc-slot"><div><div class="label" style="margin:0">' + esc(slot.label) + (needed && !have ? ' <span class="badge warn">Needed</span>' : '') + '</div>' +
        '<div class="small muted">' + esc(slot.hint) + '</div>' + list + '</div>' +
        (can ? '<div><label class="btn btn-outline btn-sm" style="cursor:pointer">' + (files.length ? 'Upload another' : 'Upload') +
          '<input type="file" class="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" data-upload="' + slot.type + '"></label></div>' : '<div></div>') + '</div>';
    }).join('');
    return '<section class="card section" id="documents"><div class="card-head"><h2>4. Documents</h2><span class="small muted">PDF, JPG, PNG or WEBP, up to 8MB each</span></div>' +
      '<p class="muted">Only Hairlux\'s review team can open these, and every view is recorded.</p>' + rows + '</section>';
  }

  function bankSection() {
    var can = !['PENDING_REVIEW', 'REJECTED', 'SUSPENDED'].includes(d.seller.status);
    var list = d.bankAccounts.map(function (b) {
      return '<div class="bank-row"><div class="acct"><div class="fw" style="font-weight:600">' + esc(b.accountName) + '</div><div class="small muted">' + esc(b.bankName) + ' <span class="mono">' + esc(b.accountNumber) + '</span></div></div>' +
        (b.isDefault ? '<span class="badge gold">Payouts go here</span>' : (can ? '<button class="btn btn-outline btn-sm" data-bank-default="' + b.id + '">Use for payouts</button>' : '')) +
        (can ? '<button class="btn btn-danger-outline btn-sm" data-bank-del="' + b.id + '">Remove</button>' : '') + '</div>';
    }).join('');
    var form = can ? '<form id="f-bank" class="mt-3" novalidate><div class="grid-2"><div class="field"><label for="k-bank">Bank</label><select class="input" id="k-bank"><option value="">Loading banks...</option></select></div>' +
      '<div class="field"><label for="k-number">Account number</label><input class="input mono" id="k-number" inputmode="numeric" maxlength="10" placeholder="10 digits"></div></div>' +
      '<div id="k-resolved"></div><div class="row end"><button class="btn btn-dark" id="btn-add-bank" data-busy="Adding" disabled>Add account</button></div></form>' : '';
    return '<section class="card section" id="bank"><div class="card-head"><h2>5. Payout account</h2></div>' +
      '<p class="muted">Your share of each sale is paid here. We check the account name with your bank, and it should match your business or owner name.</p>' +
      (list || '<p class="small muted">No account yet.</p>') + form + '</section>';
  }

  function agreementSection() {
    var s = d.seller;
    var current = s.agreementAcceptedAt && s.agreementVersion === d.settings.agreementVersion;
    var link = d.settings.agreementUrl ? '<p><a href="' + esc(d.settings.agreementUrl) + '" target="_blank" rel="noopener">Read the full Hairlux Vendor Agreement</a></p>' : '';
    return '<section class="card section" id="agreement"><div class="card-head"><h2>6. Vendor agreement</h2>' + (current ? '<span class="badge ok">Accepted ' + UI.date(s.agreementAcceptedAt) + '</span>' : '') + '</div>' +
      '<p class="muted">The key points:</p><ul class="muted">' +
      '<li>Customers buy from Hairlux. Your business details are not shown to them.</li>' +
      '<li>You sell only genuine products with valid NAFDAC numbers. Fakes lead to suspension and forfeited payouts.</li>' +
      '<li>Hairlux takes a commission on each sale (' + (s.commissionPercent === null ? 'set by Hairlux' : s.commissionPercent + '%' + (s.hasOwnCommission ? '' : ' by default; some product categories have their own rate')) + ') and pays your share after delivery and the return period.</li>' +
      '<li>You keep stock levels accurate and confirm orders on time.</li></ul>' + link +
      (current || !editable() ? '' : '<label class="check mt-3"><input type="checkbox" id="agree-box"> I have read and accept the Hairlux Vendor Agreement (version ' + esc(d.settings.agreementVersion) + ').</label>' +
        '<div class="row end mt-3"><button class="btn btn-dark" id="btn-agree" data-busy="Saving" disabled>Accept agreement</button></div>') + '</section>';
  }

  function submitSection() {
    if (!editable()) return '';
    var missing = d.checklist.filter(function (c) { return !c.done; });
    return '<section class="card section" id="submit"><div class="card-head"><h2>7. Send to Hairlux</h2></div>' +
      (missing.length
        ? '<p class="muted">Finish these first:</p><ul class="checklist">' + missing.map(function (c) { return '<li><span class="tick"></span><span class="what">' + esc(c.label) + '</span></li>'; }).join('') + '</ul>'
        : '<p>Everything is ready. We will review your application within ' + d.settings.reviewSlaHours + ' hours and email you the outcome.</p>') +
      '<div class="field mt-3"><label for="s-note">Note to the review team (optional)</label><textarea class="input" id="s-note" maxlength="500" style="min-height:80px"></textarea></div>' +
      '<div class="row end"><button class="btn btn-gold" id="btn-submit" data-busy="Sending"' + (d.canSubmit ? '' : ' disabled') + '>' + (d.seller.status === 'CHANGES_REQUESTED' ? 'Resubmit application' : 'Submit application') + '</button></div></section>';
  }

  function banner() {
    var s = d.seller;
    if (s.status === 'PENDING_REVIEW') return '<div class="alert info"><strong>Your application is with Hairlux</strong>It is locked while we review it. You can still verify your phone.</div>';
    if (s.status === 'CHANGES_REQUESTED') return '<div class="alert warn"><strong>Changes needed</strong>' + esc(s.statusReason || '') + '</div>';
    if (s.status === 'APPROVED') return '<div class="alert ok"><strong>Approved</strong>You can update your contact details, address and payout account here.</div>';
    if (s.status === 'REJECTED' || s.status === 'SUSPENDED') return '<div class="alert bad"><strong>' + (s.status === 'REJECTED' ? 'Not approved' : 'Suspended') + '</strong>' + esc(s.statusReason || '') + '</div>';
    return '';
  }

  function steps() {
    var items = [
      ['verify', 'Verify', done('email') && done('phone')], ['business', 'Business', done('business')], ['owner', 'NIN', done('owner_nin')],
      ['documents', 'Documents', done('doc_owner_id') && done('doc_cac') && done('doc_shop_photo')], ['bank', 'Payout', done('bank')],
      ['agreement', 'Agreement', done('agreement')],
    ];
    if (editable()) items.push(['submit', 'Submit', false]);
    return items.map(function (i) { return '<a href="#' + i[0] + '" class="' + (i[2] ? 'done' : '') + '">' + esc(i[1]) + '</a>'; }).join('');
  }

  function render() {
    $('#head-badge').innerHTML = UI.badge(UI.STATUS, d.seller.status);
    $('#banner').innerHTML = banner();
    $('#steps').innerHTML = steps();
    $('#content').innerHTML = [verifySection(), businessSection(), ownerSection(), documentsSection(), bankSection(), agreementSection(), submitSection()].join('');
    wire();
    if (location.hash && !render.scrolled) { render.scrolled = true; var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
  }

  async function reload(msg) {
    d = await VendorApi.request('/vendor/me');
    render();
    if (msg) UI.toast(msg, 'ok');
  }

  // ── Actions ───────────────────────────────────────────────────────────

  function wire() {
    var type = $('#b-type');
    function syncCac() { $('#cac-field').classList.toggle('hidden', !needsCac(type.value)); }
    if (type) { syncCac(); type.addEventListener('change', syncCac); }

    var saveBiz = $('#btn-save-business');
    if (saveBiz) saveBiz.addEventListener('click', function (e) {
      e.preventDefault();
      UI.busy(saveBiz, async function () {
        var body = {
          businessPhone: $('#b-phone').value.trim() || undefined,
          businessEmail: $('#b-email').value.trim(),
          address: $('#b-address').value.trim() || undefined,
          city: $('#b-city').value.trim() || undefined,
          state: $('#b-state').value || undefined,
          categories: UI.$all('input[name="b-cat"]:checked').map(function (x) { return x.value; }),
          description: $('#b-desc').value.trim(),
        };
        if (editable()) {
          body.legalName = $('#b-legal').value.trim();
          body.tradingName = $('#b-trading').value.trim();
          if (type.value) body.businessType = type.value;
          if (needsCac(type.value)) body.cacNumber = $('#b-cac').value.trim();
        }
        try { d = await VendorApi.request('/vendor/me', { method: 'PATCH', json: body }); render(); UI.toast('Business details saved.', 'ok'); }
        catch (err) { UI.toast(err.message, 'bad'); }
      });
    });

    var nin = $('#btn-save-nin');
    if (nin) nin.addEventListener('click', function () {
      var v = $('#o-nin').value.replace(/\D/g, '');
      if (v.length !== 11) { UI.toast('Enter the 11-digit NIN.', 'bad'); return; }
      UI.busy(nin, async function () {
        try { d = await VendorApi.request('/vendor/me', { method: 'PATCH', json: { ownerNin: v } }); render(); UI.toast('NIN saved.', 'ok'); }
        catch (err) { UI.toast(err.message, 'bad'); }
      });
    });

    var send = $('#btn-send-code');
    if (send) send.addEventListener('click', function () {
      UI.busy(send, async function () {
        try {
          await VendorApi.request('/user/phone/request-otp', { method: 'POST', json: { phone: $('#v-phone').value.trim() } });
          phoneCodeSent = true;
          $('#phone-code-row').classList.remove('hidden');
          UI.toast('Code sent by SMS.', 'ok');
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    });
    var vp = $('#btn-verify-phone');
    if (vp) vp.addEventListener('click', function () {
      UI.busy(vp, async function () {
        try {
          await VendorApi.request('/user/phone/verify-otp', { method: 'POST', json: { otpCode: $('#v-code').value.trim() } });
          phoneCodeSent = false;
          await reload('Phone verified.');
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    });

    UI.$all('[data-upload]').forEach(function (input) {
      input.addEventListener('change', async function () {
        var f = input.files[0];
        if (!f) return;
        if (f.size > 8 * 1024 * 1024) { UI.toast('That file is over 8MB.', 'bad'); input.value = ''; return; }
        var label = input.parentElement;
        label.classList.add('disabled');
        label.firstChild.textContent = 'Uploading...';
        var form = new FormData();
        form.append('type', input.dataset.upload);
        form.append('file', f);
        try { await VendorApi.request('/vendor/documents', { method: 'POST', form: form }); await reload('Uploaded.'); }
        catch (err) { UI.toast(err.message, 'bad'); render(); }
      });
    });

    var bankSel = $('#k-bank');
    if (bankSel) {
      (banks ? Promise.resolve(banks) : VendorApi.request('/vendor/banks')).then(function (b) {
        banks = b;
        bankSel.innerHTML = opt('', 'Choose your bank', true) + b.map(function (x) { return opt(x.code, x.name, false); }).join('');
      }).catch(function () { bankSel.innerHTML = opt('', 'Could not load banks', true); });
      var num = $('#k-number');
      var addBtn = $('#btn-add-bank');
      var tries = 0;
      async function resolve() {
        $('#k-resolved').innerHTML = '';
        addBtn.disabled = true;
        var n = num.value.replace(/\D/g, '');
        num.value = n;
        if (n.length !== 10 || !bankSel.value) return;
        var my = ++tries;
        $('#k-resolved').innerHTML = '<div class="small muted mb-3"><span class="spinner" style="display:inline-block;vertical-align:middle"></span> Checking the account...</div>';
        try {
          var r = await VendorApi.request('/vendor/bank-accounts/resolve', { method: 'POST', json: { bankCode: bankSel.value, accountNumber: n } });
          if (my !== tries) return;
          $('#k-resolved').innerHTML = '<div class="resolved">' + esc(r.accountName) + '</div>';
          addBtn.disabled = false;
        } catch (err) {
          if (my !== tries) return;
          $('#k-resolved').innerHTML = '<div class="error-text mb-3">' + esc(err.message) + '</div>';
        }
      }
      num.addEventListener('input', resolve);
      bankSel.addEventListener('change', resolve);
      addBtn.addEventListener('click', function (e) {
        e.preventDefault();
        UI.busy(addBtn, async function () {
          try {
            var r = await VendorApi.request('/vendor/bank-accounts', { method: 'POST', json: { bankCode: bankSel.value, accountNumber: num.value } });
            await reload(r.nameMatchesBusiness ? 'Payout account added.' : 'Account added. The name does not match your business or owner name, so Hairlux will check it.');
          } catch (err) { UI.toast(err.message, 'bad'); }
        });
      });
    }

    var agreeBox = $('#agree-box');
    if (agreeBox) {
      agreeBox.addEventListener('change', function () { $('#btn-agree').disabled = !agreeBox.checked; });
      $('#btn-agree').addEventListener('click', function () {
        UI.busy($('#btn-agree'), async function () {
          try { await VendorApi.request('/vendor/agreement/accept', { method: 'POST', json: { version: d.settings.agreementVersion } }); await reload('Agreement accepted.'); }
          catch (err) { UI.toast(err.message, 'bad'); }
        });
      });
    }

    var sub = $('#btn-submit');
    if (sub) sub.addEventListener('click', function () {
      UI.busy(sub, async function () {
        try {
          d = await VendorApi.request('/vendor/submit', { method: 'POST', json: { note: $('#s-note').value.trim() || undefined } });
          render();
          window.scrollTo(0, 0);
          UI.toast('Application sent. We will email you the outcome.', 'ok');
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    });
  }

  // Delegated: document view and remove, bank default and remove.
  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-doc-open],[data-doc-del],[data-bank-default],[data-bank-del]');
    if (!t) return;
    e.preventDefault();
    try {
      if (t.dataset.docOpen) {
        var win = window.open('', '_blank');
        var r = await VendorApi.request('/vendor/documents/' + t.dataset.docOpen + '/url');
        if (win) win.location = r.url; else location.href = r.url;
      } else if (t.dataset.docDel) {
        await VendorApi.request('/vendor/documents/' + t.dataset.docDel, { method: 'DELETE' });
        await reload('Removed.');
      } else if (t.dataset.bankDefault) {
        await VendorApi.request('/vendor/bank-accounts/' + t.dataset.bankDefault + '/default', { method: 'PATCH' });
        await reload('Payout account updated.');
      } else if (t.dataset.bankDel) {
        await VendorApi.request('/vendor/bank-accounts/' + t.dataset.bankDel, { method: 'DELETE' });
        await reload('Account removed.');
      }
    } catch (err) { UI.toast(err.message, 'bad'); }
  });

  reload().catch(function (e) { $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; });
})();
