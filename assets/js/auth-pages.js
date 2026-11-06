/**
 * Hairlux Vendor site: sign up, sign in, email verification, password reset.
 * Every call names the VENDOR account type, so a customer or staff account
 * on the same email is never touched.
 */
var AuthPages = (function () {
  'use strict';
  var $ = UI.$;

  function showError(msg) {
    var el = $('#error');
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }
  function val(id) { return ($('#' + id).value || '').trim(); }

  function afterSignIn(user) {
    if (user && user.emailVerified === false) {
      location.href = 'verify-email.html?email=' + encodeURIComponent(user.email);
      return;
    }
    location.href = UI.safeNext('dashboard.html');
  }

  function signUp() {
    if (VendorApi.signedIn()) { location.replace('dashboard.html'); return; }
    VendorApi.request('/public/vendor/info', { anonymous: true }).then(function (i) {
      if (!i.acceptingApplications) { $('#closed').classList.remove('hidden'); $('#submit').disabled = true; }
    }).catch(function () {});
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var body = {
        businessName: val('businessName'), firstName: val('firstName'), lastName: val('lastName'),
        email: val('email').toLowerCase(), phone: val('phone'), password: $('#password').value,
      };
      if (!body.businessName || !body.firstName || !body.lastName || !body.email || !body.phone || !body.password) {
        showError('Fill in every field.');
        return;
      }
      await UI.busy($('#submit'), async function () {
        try {
          var data = await VendorApi.request('/auth/register-vendor', { method: 'POST', json: body, anonymous: true });
          VendorApi.saveSession(data);
          location.href = 'verify-email.html?email=' + encodeURIComponent(body.email);
        } catch (err) {
          showError(err.status === 409 ? 'A vendor account already uses this email or phone. Sign in instead, or use different details.' : err.message);
        }
      });
    });
  }

  function logIn() {
    if (VendorApi.signedIn()) { location.replace(UI.safeNext('dashboard.html')); return; }
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var email = val('email').toLowerCase();
      var password = $('#password').value;
      if (!email || !password) { showError('Enter your email and password.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          var data = await VendorApi.request('/auth/login', { method: 'POST', json: { email: email, password: password, type: 'VENDOR' }, anonymous: true });
          VendorApi.saveSession(data);
          afterSignIn(data.user);
        } catch (err) {
          showError(/No vendor account/i.test(err.message) ? 'There is no vendor account for this email. Apply to sell first.' : err.message);
        }
      });
    });
  }

  function verifyEmail() {
    var u = VendorApi.user();
    var email = (UI.params().get('email') || (u && u.email) || '').toLowerCase();
    if (!email) { location.replace('log-in.html'); return; }
    $('#email-label').textContent = email;
    $('#code').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var code = val('code');
      if (code.length !== 6) { showError('Enter the 6-digit code.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          var data = await VendorApi.request('/auth/verify-otp', { method: 'POST', json: { email: email, otpCode: code, type: 'VENDOR' }, anonymous: true });
          if (data && (data.accessToken || data.user)) VendorApi.saveSession(data);
          var cur = VendorApi.user();
          if (cur) { cur.emailVerified = true; VendorApi.saveSession({ user: cur }); }
          UI.toast('Email verified.', 'ok');
          location.href = VendorApi.signedIn() ? 'application.html' : 'log-in.html';
        } catch (err) { showError(err.message); }
      });
    });
    $('#resend').addEventListener('click', async function () {
      await UI.busy($('#resend'), async function () {
        try {
          await VendorApi.request('/auth/resend-otp', { method: 'POST', json: { email: email, type: 'VENDOR' }, anonymous: true });
          UI.toast('A new code is on its way.', 'ok');
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    });
  }

  function forgot() {
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var email = val('email').toLowerCase();
      if (!email) { showError('Enter your email.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          await VendorApi.request('/auth/forgot-password', { method: 'POST', json: { email: email, type: 'VENDOR' }, anonymous: true });
          $('#sent').classList.remove('hidden');
          $('#form').classList.add('hidden');
        } catch (err) { showError(err.message); }
      });
    });
  }

  function reset() {
    var token = UI.params().get('token');
    if (!token) { showError('This reset link is incomplete. Request a new one.'); $('#submit').disabled = true; }
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var pw = $('#password').value;
      if (pw !== $('#confirm').value) { showError('The two passwords do not match.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          await VendorApi.request('/auth/reset-password', { method: 'POST', json: { token: token, newPassword: pw }, anonymous: true });
          VendorApi.clearSession();
          UI.toast('Password changed. Sign in with your new password.', 'ok');
          setTimeout(function () { location.href = 'log-in.html'; }, 1200);
        } catch (err) { showError(err.message); }
      });
    });
  }

  return { signUp: signUp, logIn: logIn, verifyEmail: verifyEmail, forgot: forgot, reset: reset };
})();
