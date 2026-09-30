// จำลอง google.script.run ให้เรียก Netlify Function แทน (ทำให้ไม่ต้องแก้โค้ดหน้าเว็บเดิม)
(function () {
  // ถ้าหน้าเว็บไม่ได้ตั้งตัวรับ error ไว้ ให้แสดงข้อความแจ้งเตือนเองและปิดวงกลมหมุน
  function report(fail, msg) {
    if (fail) return fail({ message: msg });
    console.error(msg);
    if (window.Swal) Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: msg });
  }
  function make(ok, fail) {
    return new Proxy({}, { get: function (_, name) {
      if (name === 'withSuccessHandler') return function (f) { return make(f, fail); };
      if (name === 'withFailureHandler') return function (f) { return make(ok, f); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fn: name, args: args }) })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.error) { report(fail, d.error); }
            else if (ok) ok(d.result);
          })
          .catch(function (e) { report(fail, e.message); });
      };
    }});
  }
  window.google = { script: { run: make(null, null) } };
})();
