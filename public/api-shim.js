// จำลอง google.script.run ให้เรียก Netlify Function แทน (ทำให้ไม่ต้องแก้โค้ดหน้าเว็บเดิม)
(function () {
  function make(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === 'withSuccessHandler') return function (f) { return make(f, fail); };
      if (name === 'withFailureHandler') return function (f) { return make(ok, f); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: name, args: args }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { if (fail) fail({ message: d.error }); else console.error(d.error); }
            else if (ok) ok(d.result);
          })
          .catch(function (e) { if (fail) fail({ message: e.message }); });
      };
    }});
  }
  window.google = { script: { run: make(null, null) } };
})();
