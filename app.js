(function () {
  'use strict';
  const DATA = window.STUDENTS || [];
  const SMALL = 120;
  const MID = 600;
  const GRADES = ['อ.1', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3'];
  const LEVELS = [['ก่อนประถมศึกษา', 'ก่อนประถม', 0, 3], ['ประถมศึกษา', 'ประถม', 3, 9], ['มัธยมศึกษาตอนต้น', 'ม.ต้น', 9, 12]];
  const BINS = [[1, 20], [21, 40], [41, 60], [61, 80], [81, SMALL], [SMALL + 1, MID], [MID + 1, Infinity]];
  const F = {code: 'รหัสโรงเรียน', name: 'ชื่อโรงเรียน', m: 'รวมทั้งหมด ชาย', f: 'รวมทั้งหมด หญิง', t: 'รวมทั้งหมด', r: 'รวมห้องทั้งหมด', sec: 'รวมม.ต้น', kin: 'รวมก่อนประถม'};
  const C0 = 'var(--c0)', C1 = 'var(--c1)';
  const num = (v) => +v || 0;
  const r1 = (x) => Math.round(x * 10) / 10;
  const fmt = d3.format(',');
  const fmt1 = d3.format(',.1f');
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const S = {q: '', size: '', level: '', key: F.t, dir: -1, sel: null};

  /* ---------- สรุปข้อมูล ---------- */
  const sum = (k) => d3.sum(DATA, (d) => num(d[k]));
  const total = sum(F.t), male = sum(F.m), female = sum(F.f), rooms = sum(F.r);
  const small = DATA.filter((d) => num(d[F.t]) <= SMALL).length;
  const totals = {
    schools: DATA.length, total, male, female, rooms,
    malePct: r1(male / total * 100), femalePct: r1(female / total * 100),
    perRoom: r1(total / rooms), perSchool: r1(total / DATA.length),
    median: d3.median(DATA, (d) => num(d[F.t])),
    small, smallPct: r1(small / DATA.length * 100),
    lowerSec: DATA.filter((d) => num(d[F.sec]) > 0).length
  };
  const grades = GRADES.map((g) => ({
    grade: g,
    male: sum(g + ' ชาย'), female: sum(g + ' หญิง'), total: sum('รวม' + g), rooms: sum(g + ' ห้อง')
  }));
  const levels = LEVELS.map(([level, k]) => {
    const t = sum('รวม' + k), r = sum('รวมห้อง' + k);
    return {level, schools: DATA.filter((d) => num(d['รวม' + k]) > 0).length, male: sum('รวม' + k + ' ชาย'), female: sum('รวม' + k + ' หญิง'), total: t, rooms: r, perRoom: r ? r1(t / r) : 0};
  });
  const sizes = BINS.map(([lo, hi]) => {
    const inBin = DATA.filter((d) => num(d[F.t]) >= lo && num(d[F.t]) <= hi);
    return {
      size: hi === Infinity ? fmt(lo) + ' คนขึ้นไป' : lo + '–' + hi + ' คน',
      schools: inBin.length, share: r1(inBin.length / DATA.length * 100), students: d3.sum(inBin, (d) => num(d[F.t]))
    };
  });
  const emptyRooms = DATA.flatMap((d) => GRADES.filter((g) => num(d['รวม' + g]) === 0 && num(d[g + ' ห้อง']) > 0)
    .map((g) => ({school: d[F.name], grade: g, rooms: num(d[g + ' ห้อง'])})));

  /* ---------- เครื่องมือวาดกราฟ ---------- */
  function showVal(v, f) {
    if (f === 'dec') return fmt1(v);
    if (f === 'pct') return fmt1(v) + '%';
    return fmt(v);
  }
  function tipBox(box) {
    const t = document.createElement('div');
    t.className = 'sm-tip';
    t.hidden = true;
    box.append(t);
    return t;
  }
  function showTip(t, box, event, lines) {
    t.replaceChildren(...lines.map((s, i) => {
      const d = document.createElement('div');
      if (i === 0) d.className = 'sm-tip-h';
      d.textContent = s;
      return d;
    }));
    t.hidden = false;
    const b = box.getBoundingClientRect();
    let x = event.clientX - b.left + 12;
    let y = event.clientY - b.top + 12;
    x = Math.max(0, Math.min(x, b.width - t.offsetWidth - 2));
    y = Math.max(0, Math.min(y, b.height - t.offsetHeight - 2));
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function textW(svg, strs) {
    const t = svg.append('text').style('visibility', 'hidden');
    let w = 0;
    for (const s of strs) {
      t.text(s);
      w = Math.max(w, t.node().getComputedTextLength());
    }
    t.remove();
    return w;
  }
  function newSvg(el, W, H, label) {
    el.replaceChildren();
    return d3.select(el).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('height', H).attr('role', 'img').attr('aria-label', label);
  }

  function gradeBars(el, rows, label, H) {
    const W = el.clientWidth;
    if (!W) return;
    const svg = newSvg(el, W, H, label);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.total) || 1]).nice(5).range([H - 26, 20]);
    const ticks = y.ticks(5).filter(Number.isInteger);
    const ml = textW(svg, ticks.map(fmt)) + 10;
    const x = d3.scaleBand().domain(rows.map((d) => d.grade)).range([ml, W - 2]).padding(0.25);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', ml).attr('x2', W - 2).attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .style('stroke', (d) => d === 0 ? 'var(--axis)' : 'var(--grid)');
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', ml - 6).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => fmt(d));
    svg.append('g').selectAll('text').data(rows).join('text')
      .attr('x', (d) => x(d.grade) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').text((d) => d.grade);
    const bars = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (d) => 'translate(' + x(d.grade) + ',0)');
    bars.append('rect').attr('width', x.bandwidth()).attr('y', (d) => y(d.male)).attr('height', (d) => y(0) - y(d.male)).style('fill', C0);
    bars.append('rect').attr('width', x.bandwidth()).attr('y', (d) => y(d.total)).attr('height', (d) => Math.max(0, y(d.male) - y(d.total) - 1)).style('fill', C1);
    if (textW(svg, rows.map((d) => fmt(d.total))) <= x.step() - 2) {
      bars.append('text').attr('x', x.bandwidth() / 2).attr('y', (d) => y(d.total) - 5).attr('text-anchor', 'middle').text((d) => fmt(d.total));
    }
    const t = tipBox(el);
    bars.append('rect').attr('width', x.bandwidth()).attr('y', 0).attr('height', H).style('fill', 'transparent')
      .on('pointerenter pointermove pointerdown', (event, d) => showTip(t, el, event, [
        'ชั้น ' + d.grade,
        'ชาย ' + fmt(d.male) + ' คน',
        'หญิง ' + fmt(d.female) + ' คน',
        'รวม ' + fmt(d.total) + ' คน',
        'ห้องเรียน ' + fmt(d.rooms) + ' ห้อง'
      ]))
      .on('pointerleave', () => { t.hidden = true; });
  }

  function drawSizes() {
    const el = $('#sizeChart');
    const W = el.clientWidth;
    if (!W) return;
    const RH = 32, H = sizes.length * RH + 4;
    const svg = newSvg(el, W, H, 'จำนวนโรงเรียนตามช่วงจำนวนนักเรียน');
    const ml = textW(svg, sizes.map((d) => d.size)) + 10;
    const mr = textW(svg, sizes.map((d) => d.schools + ' แห่ง')) + 8;
    const x = d3.scaleLinear().domain([0, d3.max(sizes, (d) => d.schools) || 1]).range([0, Math.max(10, W - ml - mr)]);
    const t = tipBox(el);
    const row = svg.selectAll('g').data(sizes).join('g').attr('transform', (d, i) => 'translate(0,' + (i * RH + 2) + ')');
    row.append('text').attr('x', ml - 8).attr('y', RH / 2).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => d.size);
    row.append('rect').attr('x', ml).attr('y', 6).attr('height', RH - 12).attr('rx', 3).attr('width', (d) => x(d.schools)).style('fill', C0);
    row.append('text').attr('x', (d) => ml + x(d.schools) + 6).attr('y', RH / 2).attr('dy', '0.32em').text((d) => d.schools + ' แห่ง');
    row.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', RH).style('fill', 'transparent')
      .on('pointerenter pointermove pointerdown', (event, d) => showTip(t, el, event, [
        'นักเรียน ' + d.size,
        fmt(d.schools) + ' โรงเรียน (' + fmt1(d.share) + '%)',
        'นักเรียนรวม ' + fmt(d.students) + ' คน'
      ]))
      .on('pointerleave', () => { t.hidden = true; });
  }

  function drawRank() {
    const el = $('#rankChart');
    const W = el.clientWidth;
    if (!W) return;
    const bottom = $('#rank').value === 'bottom';
    const rows = [...DATA].sort((a, b) => (bottom ? 1 : -1) * (num(a[F.t]) - num(b[F.t]))).slice(0, 10);
    const RH = 42, H = rows.length * RH + 2;
    const svg = newSvg(el, W, H, bottom ? 'โรงเรียนที่มีนักเรียนน้อยที่สุด 10 อันดับ' : 'โรงเรียนที่มีนักเรียนมากที่สุด 10 อันดับ');
    const mr = textW(svg, rows.map((d) => fmt(num(d[F.t])) + ' คน')) + 8;
    const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => num(d[F.t])) || 1]).range([0, Math.max(10, W - mr)]);
    const t = tipBox(el);
    const row = svg.selectAll('g').data(rows).join('g').attr('class', 'sm-click').attr('transform', (d, i) => 'translate(0,' + (i * RH) + ')');
    row.append('text').attr('class', 'sm-name').attr('x', 0).attr('y', 14).text((d, i) => (i + 1) + '. ' + d[F.name]);
    row.append('rect').attr('x', 0).attr('y', 21).attr('height', 12).attr('rx', 3).attr('width', (d) => x(num(d[F.t]))).style('fill', C0);
    row.append('text').attr('x', (d) => x(num(d[F.t])) + 6).attr('y', 27).attr('dy', '0.32em').text((d) => fmt(num(d[F.t])) + ' คน');
    row.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', RH).style('fill', 'transparent')
      .on('pointerenter pointermove', (event, d) => showTip(t, el, event, [
        d[F.name],
        'นักเรียน ' + fmt(num(d[F.t])) + ' คน (ชาย ' + fmt(num(d[F.m])) + ' หญิง ' + fmt(num(d[F.f])) + ')',
        'ห้องเรียน ' + fmt(num(d[F.r])) + ' ห้อง',
        'คลิกเพื่อดูรายละเอียด'
      ]))
      .on('pointerleave', () => { t.hidden = true; })
      .on('click', (event, d) => goSchool(d[F.code]));
  }

  /* ---------- หน้าภาพรวม ---------- */
  function drawOverviewCharts() {
    gradeBars($('#gradeChart'), grades, 'จำนวนนักเรียนรายชั้น อนุบาล 1 ถึงมัธยมศึกษาปีที่ 3 แยกชายและหญิง', 300);
    drawSizes();
    drawRank();
  }
  function fillStatic() {
    $$('[data-v]').forEach((el) => { el.textContent = showVal(totals[el.dataset.v], el.dataset.fmt); });
    $$('[data-limit]').forEach((el) => { el.textContent = fmt(el.dataset.limit === 'mid' ? MID : SMALL); });
    const fields = $$('#levelRows').length ? [...$('#levelRows').closest('table').querySelectorAll('thead th')].map((th) => th.dataset.field) : [];
    $('#levelRows').replaceChildren(...levels.map((d) => {
      const tr = document.createElement('tr');
      for (const f of fields) {
        const td = document.createElement('td');
        td.textContent = f === 'level' ? d.level : f === 'perRoom' ? fmt1(d[f]) : fmt(d[f]);
        tr.append(td);
      }
      return tr;
    }));
    if (emptyRooms.length) {
      $('#emptyRooms').textContent = emptyRooms.map((d) => d.school + ' ชั้น ' + d.grade + ' (' + d.rooms + ' ห้อง)').join(', ');
      $('#emptyNote').hidden = false;
    }
  }

  /* ---------- หน้าค้นหาโรงเรียน ---------- */
  function filtered() {
    const q = S.q.trim().toLowerCase();
    const out = DATA.filter((d) => {
      const t = num(d[F.t]);
      if (q && !(String(d[F.name]).toLowerCase().includes(q) || String(d[F.code]).includes(q))) return false;
      if (S.size === 's' && t > SMALL) return false;
      if (S.size === 'm' && (t <= SMALL || t > MID)) return false;
      if (S.size === 'l' && t <= MID) return false;
      const sec = num(d[F.sec]) > 0;
      if (S.level === 'sec' && !sec) return false;
      if (S.level === 'pri' && sec) return false;
      return true;
    });
    const k = S.key;
    out.sort((a, b) => k === F.name
      ? S.dir * String(a[k]).localeCompare(String(b[k]), 'th')
      : S.dir * (num(a[k]) - num(b[k])));
    return out;
  }
  function drawList() {
    const ths = $$('#schoolTable thead th');
    ths.forEach((th) => th.setAttribute('aria-sort', th.dataset.field === S.key ? (S.dir > 0 ? 'ascending' : 'descending') : 'none'));
    const fields = ths.map((th) => th.dataset.field);
    const rows = filtered();
    $('#found').textContent = fmt(rows.length);
    $('#schoolRows').replaceChildren(...rows.map((d) => {
      const tr = document.createElement('tr');
      tr.dataset.key = String(d[F.code]);
      tr.tabIndex = 0;
      if (String(d[F.code]) === S.sel) tr.className = 'sm-on';
      for (const f of fields) {
        const td = document.createElement('td');
        td.textContent = f === F.code || f === F.name ? String(d[f]) : fmt(num(d[f]));
        tr.append(td);
      }
      return tr;
    }));
  }
  function selRow() {
    return S.sel ? DATA.find((d) => String(d[F.code]) === S.sel) : null;
  }
  function drawDetailChart() {
    const d = selRow();
    if (!d) return;
    const rows = GRADES.map((g) => ({grade: g, male: num(d[g + ' ชาย']), female: num(d[g + ' หญิง']), total: num(d['รวม' + g]), rooms: num(d[g + ' ห้อง'])}));
    gradeBars($('#selChart'), rows, 'จำนวนนักเรียนรายชั้นของโรงเรียน' + d[F.name] + ' แยกชายและหญิง', 220);
  }
  function drawDetail() {
    const d = selRow();
    if (!d) return;
    $$('[data-s]').forEach((el) => {
      const f = el.dataset.s;
      el.textContent = f === F.code || f === F.name ? String(d[f]) : fmt(num(d[f]));
    });
    $('#selRank').textContent = fmt(1 + DATA.filter((o) => num(o[F.t]) > num(d[F.t])).length);
    $('#selPerRoom').textContent = num(d[F.r]) ? fmt1(num(d[F.t]) / num(d[F.r])) : '—';
    const line = (label, cols, cls) => {
      const tr = document.createElement('tr');
      if (cls) tr.className = cls;
      const first = document.createElement('td');
      first.textContent = label;
      tr.append(first);
      for (const c of cols) {
        const td = document.createElement('td');
        if (!num(d[c])) td.className = 'sm-zero';
        td.textContent = fmt(num(d[c]));
        tr.append(td);
      }
      return tr;
    };
    const out = [];
    for (const [level, k, from, to] of LEVELS) {
      if (!num(d['รวม' + k]) && !num(d['รวมห้อง' + k])) continue;
      for (const g of GRADES.slice(from, to)) out.push(line(g, [g + ' ชาย', g + ' หญิง', 'รวม' + g, g + ' ห้อง']));
      out.push(line('รวม' + level, ['รวม' + k + ' ชาย', 'รวม' + k + ' หญิง', 'รวม' + k, 'รวมห้อง' + k], 'sm-subtotal'));
    }
    out.push(line('รวมทั้งหมด', [F.m, F.f, F.t, F.r], 'sm-subtotal'));
    $('#selGrades').replaceChildren(...out);
    drawDetailChart();
  }
  function selectSchool(code) {
    S.sel = String(code);
    $('#detailEmpty').hidden = true;
    $('#detailBody').hidden = false;
    drawList();
    drawDetail();
    $('#detail').scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }
  function resetFilters() {
    S.q = ''; S.size = ''; S.level = '';
    $('#q').value = ''; $('#size').value = ''; $('#level').value = '';
  }
  function showTab(id, keepHash) {
    $$('.sm-sec').forEach((s) => { s.hidden = s.id !== id; });
    $$('.sm-tab').forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    if (!keepHash) history.replaceState(null, '', '#' + id);
    if (id === 'overview') drawOverviewCharts();
    else { drawList(); drawDetailChart(); }
  }
  function goSchool(code) {
    resetFilters();
    showTab('schools');
    selectSchool(code);
  }

  /* ---------- เริ่มทำงาน ---------- */
  $$('.sm-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#rank').addEventListener('change', drawRank);
  $('#q').addEventListener('input', (e) => { S.q = e.target.value; drawList(); });
  $('#size').addEventListener('change', (e) => { S.size = e.target.value; drawList(); });
  $('#level').addEventListener('change', (e) => { S.level = e.target.value; drawList(); });
  $('#reset').addEventListener('click', () => { resetFilters(); drawList(); });
  $$('#schoolTable thead th').forEach((th) => {
    const sortBy = () => {
      const k = th.dataset.field;
      if (S.key === k) S.dir = -S.dir;
      else { S.key = k; S.dir = k === F.name || k === F.code ? 1 : -1; }
      drawList();
    };
    th.addEventListener('click', sortBy);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(); }
    });
  });
  const tb = $('#schoolRows');
  tb.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (tr) selectSchool(tr.dataset.key);
  });
  tb.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr');
    if (tr && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      selectSchool(tr.dataset.key);
    }
  });
  let timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!$('#overview').hidden) drawOverviewCharts();
      else drawDetailChart();
    }, 120);
  });

  fillStatic();
  showTab(location.hash === '#schools' ? 'schools' : 'overview', true);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (!$('#overview').hidden) drawOverviewCharts(); else drawDetailChart(); });
  }
})();
