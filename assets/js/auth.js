(function () {
  "use strict";

  var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  function getProfile(userId) {
    return client.from("profiles").select("role").eq("id", userId).maybeSingle().then(function (res) {
      return res.data || null;
    });
  }

  function requireAdminSession(onReady) {
    client.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) {
        window.location.replace("/login/");
        return;
      }
      getProfile(session.user.id).then(function (profile) {
        if (!profile || profile.role !== "admin") {
          window.location.replace("/login/");
          return;
        }
        onReady(session, client);
      });
    });
  }

  function logout() {
    client.auth.signOut().then(function () {
      window.location.href = "/login/";
    });
  }

  window.mkCRM = {
    client: client,
    getProfile: getProfile,
    requireAdminSession: requireAdminSession,
    logout: logout
  };
})();
