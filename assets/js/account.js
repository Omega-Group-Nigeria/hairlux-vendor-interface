/** Hairlux Vendor: account (owner details, change password, sign out). */
(function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;

  function render(d) {
    var o = d.owner;
    $('#content').innerHTML =
      '<div class="card"><h2>Owner</h2><div class="grid-2">' +
      '<div class="field"><div class="label">Name</div>' + esc(o.firstName + ' ' + o.lastName) + '</div>' +
      '<div class="field"><div class="label">Email</div>' + esc(o.email) + ' ' + (o.emailVerified ? '<span class="badge ok">Verified</span>' : '<span class="badge warn">Not verified</span>') + '</div>' +
      '<div class="field"><div class="label">Phone</div>' + esc(o.phone || '-') + ' ' + (o.phoneVerified ? '<span class="badge ok">Verified</span>' : '<a href="application.html#verify">Verify</a>') + '</div>' +
      '<div class="field"><div class="label">Business</div>' + esc(d.seller.legalName) + ' ' + UI.badge(UI.STATUS, d.seller.status) + '</div>' +
      '</div><p class="small muted mb-0">To change the owner\'s name or email, contact <a href="mailto:' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '">' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '</a>.</p></div>' +
      '<div class="card"><h2>Change password</h2><form id="f-pw" novalidate><div class="grid-2">' +
      '<div class="field"><label for="pw-cur">Current password</label><input class="input" id="pw-cur" type="password" autocomplete="current-password"></div><div></div>' +
      '<div class="field"><label for="pw-new">New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password"><div class="hint">At least 8 characters with an uppercase letter, a lowercase letter and a number.</div></div>' +
      '<div class="field"><label for="pw-new2">Confirm new password</label><input class="input" id="pw-new2" type="password" autocomplete="new-password"></div></div>' +
      '<div class="error-text hidden" id="pw-err"></div><div class="row end"><button class="btn btn-dark" id="btn-pw" data-busy="Saving">Change password</button></div></form></div>' +
      '<div class="card"><h2>Help</h2><p class="muted mb-0">Email <a href="mailto:' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '">' + esc(window.VENDOR_CONFIG.SUPPORT_EMAIL) + '</a> or call ' + esc(window.VENDOR_CONFIG.SUPPORT_PHONE) + '.</p></div>' +
      '<div class="row end"><button class="btn btn-outline" id="btn-out">Sign out</button></div>';
    $('#btn-out').addEventListener('click', VendorApi.signOut);
    $('#btn-pw').addEventListener('click', function (e) {
      e.preventDefault();
      var err = $('#pw-err');
      err.classList.add('hidden');
      if ($('#pw-new').value !== $('#pw-new2').value) { err.textContent = 'The new passwords do not match.'; err.classList.remove('hidden'); return; }
      UI.busy($('#btn-pw'), async function () {
        try {
          await VendorApi.request('/user/password', { method: 'PUT', json: { currentPassword: $('#pw-cur').value, newPassword: $('#pw-new').value } });
          $('#f-pw').reset();
          UI.toast('Password changed.', 'ok');
        } catch (x) { err.textContent = x.message; err.classList.remove('hidden'); }
      });
    });
  }

  VendorApi.request('/vendor/me').then(render).catch(function (e) { $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; });
})();
