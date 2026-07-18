(function () {
  "use strict";

  var client = window.mkCRM.client;
  var form = document.getElementById("loginForm");
  var status = document.getElementById("formStatus");
  var btn = document.getElementById("loginBtn");

  // Bereits eingeloggt? Direkt weiter zur Pipeline.
  client.auth.getSession().then(function (res) {
    if (res.data && res.data.session) {
      window.location.replace("/pipeline/");
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    btn.disabled = true;
    status.textContent = "Wird geprüft …";
    status.className = "crm-form-status";
    client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      window.location.href = "/pipeline/";
    }).catch(function (err) {
      status.textContent = "Login fehlgeschlagen: " + (err && err.message ? err.message : "unbekannter Fehler");
      status.className = "crm-form-status crm-form-status--error";
      btn.disabled = false;
    });
  });
})();
