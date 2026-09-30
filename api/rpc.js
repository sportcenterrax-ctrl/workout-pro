const U = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''), K = (process.env.SUPABASE_SERVICE_KEY || '').trim(), TZ = 'Asia/Bangkok';
// คีย์แบบใหม่ (sb_secret_...) ไม่ใช่ JWT จึงส่งผ่าน apikey อย่างเดียว / คีย์แบบเก่า (eyJ...) ต้องส่ง Authorization ด้วย
const H = { apikey: K, 'Content-Type': 'application/json' };
if (K.startsWith('eyJ')) H.Authorization = 'Bearer ' + K;
async function rest(p, o = {}) {
  const r = await fetch(U + '/rest/v1/' + p, { headers: H, ...o });
  if (!r.ok) throw new Error(await r.text());
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function all(t) { let o = [], f = 0; for (;;) { const d = await rest(`${t}?select=*&order=id.asc&limit=1000&offset=${f}`); o = o.concat(d); if (d.length < 1000) return o; f += 1000; } }
const M = { ...H, Prefer: 'return=minimal' };
const ins = (t, rows) => rows.length ? rest(t, { method: 'POST', headers: M, body: JSON.stringify(rows) }) : null;
const upd = (t, patch, ids) => ids.length ? rest(`${t}?id=in.(${ids.join(',')})`, { method: 'PATCH', headers: M, body: JSON.stringify(patch) }) : null;
const s = x => String(x == null ? '' : x);
const lc = x => s(x).trim().toLowerCase();
const dmy = v => { if (!v) return '-'; const a = s(v).slice(0, 10).split('-'); return a[2] + '/' + a[1] + '/' + a[0]; };
const bkk = v => new Date(v).toLocaleDateString('sv-SE', { timeZone: TZ });          // yyyy-mm-dd
const stamp = v => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v)).replace(',', '');
const num = v => { const m = s(v).match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const pRow = (p, client, ex) => ({ trainer: s(p.trainer), program_date: p.date, client, group_name: s(p.programGroup), exercise: s(ex.exercise), load_val: s(ex.load), rep: s(ex.rep), set_count: s(ex.set), rest: s(ex.rest), link: s(ex.link), comment: s(p.comment), hidden: false, status: 'Active' });

const fn = {
  async checkLogin(u, p) {
    const x = (await all('users')).find(r => r.username.trim() === s(u).trim() && r.password.trim() === s(p).trim());
    return x ? { status: 'success', role: s(x.role).trim(), name: s(x.name).trim() } : { status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  },
  async getClientList() { return (await all('users')).filter(r => lc(r.role) === 'client').map(r => s(r.name).trim()); },
  async getTrainerList() { return (await all('users')).filter(r => lc(r.role) === 'trainer').map(r => s(r.name).trim()); },
  async registerUser(d) {
    const u = s(d.username).trim();
    if ((await all('users')).some(r => lc(r.username) === u.toLowerCase())) return { status: 'error', message: 'Username นี้ถูกใช้งานแล้วในระบบ' };
    await ins('users', [{ username: u, password: s(d.password).trim(), role: d.role || 'client', name: s(d.fullName).trim() }]);
    return { status: 'success', message: 'บันทึกข้อมูลเรียบร้อยแล้ว' };
  },
  async saveWorkoutProgram(p) {
    let cl = Array.isArray(p.clientNames) && p.clientNames.length ? p.clientNames : (p.clientName ? [p.clientName] : []);
    cl = cl.map(c => s(c).trim()).filter(Boolean);
    if (!cl.length) throw new Error('กรุณาเลือกชื่อลูกค้าอย่างน้อย 1 คน');
    await ins('programs', cl.flatMap(c => p.exercises.map(ex => pRow(p, c, ex))));
    return cl.length > 1 ? `บันทึกชุดโปรแกรมสำเร็จ! (ออกให้ลูกค้า ${cl.length} คน)` : 'บันทึกชุดโปรแกรมสำเร็จ!';
  },
  async updateWorkoutProgram(p) {
    if (!p || !p.original) throw new Error('ไม่พบข้อมูลโปรแกรมเดิมที่จะแก้ไข');
    if (!p.exercises || !p.exercises.length) throw new Error('กรุณาระบุท่าออกกำลังกายอย่างน้อย 1 ท่า');
    const o = p.original;
    const ids = (await all('programs')).filter(r => (r.status || 'Active') !== 'Archived' && lc(r.client) === lc(o.client) && s(r.group_name).trim() === s(o.groupName).trim() && dmy(r.program_date) === s(o.date).trim()).map(r => r.id);
    if (!ids.length) throw new Error('ไม่พบโปรแกรมต้นฉบับที่จะแก้ไข (อาจถูกแก้ไขไปแล้วจากที่อื่น กรุณารีเฟรชหน้าจอ)');
    await upd('programs', { status: 'Archived' }, ids);
    await ins('programs', p.exercises.map(ex => pRow(p, s(p.clientName).trim(), ex)));
    return 'บันทึกการแก้ไขโปรแกรมสำเร็จ! (ระบบเก็บโปรแกรมเวอร์ชันเดิมไว้เป็นประวัติแล้ว)';
  },
  async toggleProgramVisibility(tr, client, group) {
    const rows = (await all('programs')).filter(r => lc(r.client) === lc(client) && s(r.group_name).trim() === s(group).trim());
    if (!rows.length) return 'ไม่พบโปรแกรมที่ต้องการเปลี่ยนสถานะ';
    await upd('programs', { hidden: !rows[0].hidden }, rows.map(r => r.id));
    return 'อัปเดตสถานะการมองเห็นสำเร็จ!';
  },
  async getTrainerProgramGroups() {
    const g = {};
    for (const r of await all('programs')) {
      const client = s(r.client).trim(); if (!client || (r.status || 'Active') === 'Archived') continue;
      const gn = s(r.group_name).trim(), d = dmy(r.program_date), k = client + '_' + d + '_' + gn;
      if (!g[k]) g[k] = { trainer: s(r.trainer), date: d, formattedDate: d, client, groupName: gn, comment: s(r.comment).trim(), isHidden: !!r.hidden, totalExercises: 0, exercises: [] };
      if (r.exercise) { g[k].totalExercises++; g[k].exercises.push({ exercise: s(r.exercise), load: s(r.load_val), rep: s(r.rep), set: s(r.set_count), rest: s(r.rest), link: s(r.link) }); }
    }
    return Object.values(g).reverse();
  },
  async getClientProgram(c) { if (!c) return []; return (await fn.getTrainerProgramGroups()).filter(g => lc(g.client) === lc(c) && !g.isHidden); },
  async getProgramsByClient(c) {
    const u = {};
    for (const r of await all('programs')) if ((r.status || 'Active') !== 'Archived' && lc(r.client) === lc(c) && r.group_name && !u[r.group_name.trim()]) u[r.group_name.trim()] = { name: r.group_name.trim(), date: dmy(r.program_date) };
    return Object.values(u);
  },
  async getAllExistingExercises() {
    const m = {}; for (const r of await all('programs')) { const n = s(r.exercise).trim(); if (n && !m[n]) m[n] = { name: n, link: s(r.link).trim() }; }
    return Object.values(m);
  },
  async submitWorkoutLog(l) {
    await ins('history_logs', l.exerciseLogs.map(i => ({ client_name: s(l.clientName), program_group: s(l.programGroup), exercise: s(i.exercise), actual_load: s(i.actualLoad), rating: s(l.rating), note: s(l.note) })));
    return 'บันทึกผลการฝึกเรียบร้อย!';
  },
  async getClientHistory(c) {
    return (await all('history_logs')).filter(r => lc(r.client_name) === lc(c)).map(r => ({ date: stamp(r.logged_at), program: r.program_group, exercise: r.exercise, load: r.actual_load, rating: r.rating, note: r.note })).reverse().slice(0, 10);
  },
  async getTrainerLogSummary(trainer, client, group) {
    const own = {}; for (const r of await all('programs')) if (lc(r.trainer) === lc(trainer)) own[lc(r.client) + '_' + lc(r.group_name)] = 1;
    const m = {};
    for (const r of await all('history_logs')) {
      const c = s(r.client_name).trim(), p = s(r.program_group).trim();
      if (!own[c.toLowerCase() + '_' + p.toLowerCase()]) continue;
      if (client && c.toLowerCase() !== lc(client)) continue;
      if (group && group !== 'ALL' && p !== s(group).trim()) continue;
      const d = dmy(bkk(r.logged_at)), k = d + '_' + c.toLowerCase() + '_' + p.toLowerCase();
      if (!m[k]) m[k] = { date: d, clientName: c, programGroup: p, count: 1, note: r.note || '-' };
      else if (s(r.note).trim() && s(r.note).trim() !== '-') m[k].note = r.note;
    }
    return Object.values(m).reverse();
  },
  async getAllClientStatuses(trainer) {
    const last = {}; for (const r of await all('programs')) if (s(r.client).trim()) last[lc(r.client)] = { n: s(r.group_name).trim() || '-', d: dmy(r.program_date) };
    if (!lc(trainer)) return [];
    return (await all('client_status')).filter(r => lc(r.trainer_name) === lc(trainer)).map(r => { const l = last[lc(r.username)]; return { username: s(r.username).trim(), goalType: r.goal_type || '-', targetValue: r.target_value || '-', currentStatus: r.current_status || '-', trainerNote: r.trainer_note || '', updatedAt: r.updated_at ? dmy(bkk(r.updated_at)) : '-', latestProgram: l ? l.n : '-', latestProgramDate: l ? l.d : '-' }; });
  },
  async updateQuickClientStatusOnly(d) {
    const t = lc(d.trainerName), row = (await all('client_status')).find(r => lc(r.username) === lc(d.username) && (!t || lc(r.trainer_name) === t));
    if (row) { await upd('client_status', { current_status: d.currentStatus, updated_at: new Date().toISOString() }, [row.id]); return 'บันทึกสถานะเรียบร้อย'; }
    await ins('client_status', [{ username: d.username, goal_type: '-', target_value: '-', current_status: d.currentStatus, trainer_note: '-', trainer_name: d.trainerName }]);
    return 'สร้างและบันทึกสถานะเรียบร้อย';
  },
  async getBodyMetricsHistory(client) {
    const users = await all('users'), u = users.find(r => lc(r.name) === lc(client)), norm = v => s(v).trim().replace(/^0+(?=\d)/, '').toLowerCase();
    const target = norm(u ? u.username : client);
    return (await all('body_metrics')).filter(r => norm(r.username) === target).sort((a, b) => s(b.test_date) < s(a.test_date) ? -1 : 1).slice(0, 2)
      .map(r => ({ date: dmy(r.test_date), weight: r.weight, fatPercent: r.fat_percent, waterPercent: r.water_percent, muscleMass: r.muscle_mass, bmr: r.bmr, metabolicAge: r.metabolic_age, boneMass: r.bone_mass, visceralFat: r.visceral_fat }));
  },
  async getTrainerOverviewSummary(start, end, tf) {
    const filt = tf && tf !== 'ALL' ? lc(tf) : null, inR = d => d && (!start || d >= start) && (!end || d <= end), tm = {};
    const ens = n => tm[n] || (tm[n] = { trainer: n, programCount: 0, exerciseCount: 0, clientReportCount: 0, followUpCount: 0, programs: [], clientReports: [], followUps: [], pm: {} });
    const owner = {}, gm = {};
    for (const r of await all('programs')) {
      const tr = s(r.trainer).trim(), c = s(r.client).trim(), g = s(r.group_name).trim(); if (!c || !g) continue;
      if (tr) owner[c.toLowerCase() + '||' + g.toLowerCase()] = tr;
      if (!tr || (filt && tr.toLowerCase() !== filt) || !inR(r.program_date)) continue;
      const t = ens(tr), d = dmy(r.program_date), st = r.status || 'Active', k = [tr, c, g, d, st].join('||');
      if (!gm[k]) { gm[k] = { client: c, groupName: g, date: d, status: st, exerciseCount: 0, k: r.program_date }; t.programs.push(gm[k]); t.programCount++; }
      if (r.exercise) {
        gm[k].exerciseCount++; t.exerciseCount++;
        const ex = r.exercise.trim(), pk = c + '||' + ex;
        (t.pm[pk] = t.pm[pk] || { client: c, exercise: ex, entries: [] }).entries.push({ date: d, groupName: g, load: s(r.load_val).trim(), status: st, sortDate: r.program_date });
      }
    }
    const rd = {};
    for (const l of await all('history_logs')) {
      const dk = bkk(l.logged_at); if (!inR(dk)) continue;
      const c = s(l.client_name).trim(), p = s(l.program_group).trim(), ot = owner[c.toLowerCase() + '||' + p.toLowerCase()];
      if (!ot || (filt && ot.toLowerCase() !== filt)) continue;
      const t = ens(ot), k = [ot, dk, c.toLowerCase(), p.toLowerCase()].join('||'), n = s(l.note).trim();
      if (!rd[k]) { rd[k] = { date: dmy(dk), k: dk, clientName: c, programGroup: p, note: l.note || '-' }; t.clientReports.push(rd[k]); t.clientReportCount++; }
      else if (n && n !== '-') rd[k].note = l.note;
    }
    for (const r of await all('client_status')) {
      const tn = s(r.trainer_name).trim(); if (!tn || (filt && tn.toLowerCase() !== filt) || !r.updated_at) continue;
      const dk = bkk(r.updated_at); if (!inR(dk)) continue;
      const t = ens(tn); t.followUps.push({ date: dmy(dk), k: dk, username: r.username, goalType: r.goal_type || '-', targetValue: r.target_value || '-', currentStatus: r.current_status || '-', trainerNote: r.trainer_note || '-' }); t.followUpCount++;
    }
    const desc = (a, b) => a.k < b.k ? 1 : -1;
    return Object.values(tm).map(t => {
      t.programs.sort(desc); t.clientReports.sort(desc); t.followUps.sort(desc);
      t.progression = Object.values(t.pm).map(p => {
        p.entries.sort((a, b) => a.sortDate < b.sortDate ? -1 : 1);
        const ns = p.entries.map(e => num(e.load)).filter(n => n !== null); let dt = '-', dir = 'flat';
        if (ns.length) { const df = ns[ns.length - 1] - ns[0]; if (df > 0) { dt = 'เพิ่มขึ้น +' + df; dir = 'up'; } else if (df < 0) { dt = 'ลดลง ' + df; dir = 'down'; } else dt = 'คงที่'; }
        return { client: p.client, exercise: p.exercise, entries: p.entries, deltaText: dt, deltaDir: dir };
      }).filter(p => p.entries.length > 1 && p.entries.some(e => e.load !== p.entries[0].load)).sort((a, b) => b.entries.length - a.entries.length);
      delete t.pm; return t;
    }).sort((a, b) => a.trainer.localeCompare(b.trainer, 'th'));
  }
};

module.exports = async (req, res) => {
  try {
    const { fn: name, args } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!Object.prototype.hasOwnProperty.call(fn, name)) throw new Error('ไม่พบฟังก์ชัน ' + name);
    res.status(200).json({ result: await fn[name](...(args || [])) });
  } catch (e) { res.status(200).json({ error: e.message }); }
};
