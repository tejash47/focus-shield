document.addEventListener('DOMContentLoaded', async () => {

  /* ── Tab switching ──────────────────────────────── */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  /* ── Break window helpers ───────────────────────── */
  function isBreakNow(windows) {
    if (!windows || !windows.length) return false;
    const n = new Date(), cur = n.getHours()*60 + n.getMinutes();
    for (const bw of windows) {
      if (!bw.start || !bw.end) continue;
      const [sh,sm] = bw.start.split(':').map(Number);
      const [eh,em] = bw.end.split(':').map(Number);
      const s=sh*60+sm, e=eh*60+em;
      if (s<e ? (cur>=s&&cur<=e) : (cur>=s||cur<=e)) return true;
    }
    return false;
  }

  /* ── Load all data ──────────────────────────────── */
  const data = await chrome.storage.local.get([
    'breakWindows','hardcoreFocus','shieldActive','pomoAutoBlock','focusGoalHours',
    'blockedSites','pomoFocus','pomoBreak',
    'todayBlocked','todayBypassed','todaySessions','todayFocusMins','todayDate',
    'totalBlocked','totalFocusMins','currentStreak','longestStreak'
  ]);

  /* ── Settings ───────────────────────────────────── */
  document.getElementById('hardcoreFocus').checked = !!data.hardcoreFocus;
  document.getElementById('shieldActive').checked  = data.shieldActive !== false;
  if (data.pomoAutoBlock) document.getElementById('pomoAutoBlock').checked = true;
  if (data.focusGoalHours) document.getElementById('focusGoalHours').value = data.focusGoalHours;
  if (data.pomoFocus) document.getElementById('pomoFocus').value = data.pomoFocus;
  if (data.pomoBreak) document.getElementById('pomoBreak').value = data.pomoBreak;

  /* ── Break windows ──────────────────────────────── */
  let breakWindows = data.breakWindows && data.breakWindows.length
    ? data.breakWindows
    : [{ start: '', end: '' }];
  renderBreaks(breakWindows);

  if (isBreakNow(data.breakWindows || [])) {
    document.getElementById('breakBadge').style.display = 'inline';
    document.getElementById('breakActiveHint').style.display = 'block';
  }

  function renderBreaks(list) {
    const container = document.getElementById('breaksList');
    container.innerHTML = '';
    list.forEach((bw, i) => {
      const row = document.createElement('div');
      row.className = 'brow';
      row.innerHTML = `
        <span class="blbl">Break ${i+1}</span>
        <input type="time" class="break-start" value="${bw.start||''}">
        <span class="bsep">→</span>
        <input type="time" class="break-end" value="${bw.end||''}">
        <button class="brm" data-i="${i}">×</button>
      `;
      container.appendChild(row);
    });
    container.querySelectorAll('.brm').forEach(btn => {
      btn.addEventListener('click', () => {
        breakWindows.splice(parseInt(btn.dataset.i), 1);
        if (breakWindows.length === 0) breakWindows = [{ start:'', end:'' }];
        renderBreaks(breakWindows);
      });
    });
  }

  document.getElementById('addBreakBtn').addEventListener('click', () => {
    breakWindows.push({ start:'', end:'' });
    renderBreaks(breakWindows);
  });

  // Preset buttons
  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      breakWindows.push({ start: btn.dataset.s, end: btn.dataset.e });
      renderBreaks(breakWindows);
      showToast('+ ' + btn.textContent);
    });
  });

  document.getElementById('saveBreaksBtn').addEventListener('click', async () => {
    const rows = document.querySelectorAll('#breaksList .brow');
    const windows = [];
    rows.forEach(row => {
      const s = row.querySelector('.break-start').value;
      const e = row.querySelector('.break-end').value;
      if (s && e) windows.push({ start:s, end:e });
    });
    breakWindows = windows;
    await chrome.storage.local.set({ breakWindows: windows });

    // Update badge
    if (isBreakNow(windows)) {
      document.getElementById('breakBadge').style.display = 'inline';
      document.getElementById('breakActiveHint').style.display = 'block';
    } else {
      document.getElementById('breakBadge').style.display = 'none';
      document.getElementById('breakActiveHint').style.display = 'none';
    }
    showToast('✓ Break schedule saved');
  });

  /* ── Sites ──────────────────────────────────────── */
  const DEFAULT_SITES = ["youtube.com","instagram.com","reddit.com","facebook.com"];
  const sites = data.blockedSites || DEFAULT_SITES;
  renderSites(sites);

  function renderSites(list) {
    const c = document.getElementById('sitesList');
    c.innerHTML = '';
    list.forEach(site => {
      const row = document.createElement('div');
      row.className = 'site-item';
      row.innerHTML = `<span>${site}</span><button class="site-rm" data-site="${site}">×</button>`;
      c.appendChild(row);
    });
    c.querySelectorAll('.site-rm').forEach(btn => {
      btn.addEventListener('click', async () => {
        const s = await chrome.storage.local.get('blockedSites');
        const updated = (s.blockedSites || DEFAULT_SITES).filter(x => x !== btn.dataset.site);
        await chrome.storage.local.set({ blockedSites: updated });
        renderSites(updated);
      });
    });
  }

  document.getElementById('addSiteBtn').addEventListener('click', async () => {
    const inp = document.getElementById('newSiteInput');
    let val = inp.value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'');
    if (!val) return;
    const s = await chrome.storage.local.get('blockedSites');
    const list = s.blockedSites || DEFAULT_SITES;
    if (!list.includes(val)) {
      list.push(val);
      await chrome.storage.local.set({ blockedSites: list });
      renderSites(list);
      showToast('+ ' + val);
    }
    inp.value = '';
  });
  document.getElementById('newSiteInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addSiteBtn').click();
  });
  document.querySelectorAll('.quick-add').forEach(btn => {
    btn.addEventListener('click', async () => {
      const site = btn.dataset.site;
      const s = await chrome.storage.local.get('blockedSites');
      const list = s.blockedSites || DEFAULT_SITES;
      if (!list.includes(site)) {
        list.push(site);
        await chrome.storage.local.set({ blockedSites: list });
        renderSites(list);
        showToast('+ ' + site);
      }
    });
  });

  /* ── Save settings ──────────────────────────────── */
  document.getElementById('saveBtn').addEventListener('click', async () => {
    await chrome.storage.local.set({
      hardcoreFocus:  document.getElementById('hardcoreFocus').checked,
      shieldActive:   document.getElementById('shieldActive').checked,
      pomoAutoBlock:  document.getElementById('pomoAutoBlock').checked,
      focusGoalHours: parseFloat(document.getElementById('focusGoalHours').value) || 4,
    });
    showToast('✓ Settings saved');
  });

  /* ── Stats ──────────────────────────────────────── */
  const today = new Date().toDateString();
  const isTd = data.todayDate === today;
  document.getElementById('statBlocked').textContent  = isTd ? (data.todayBlocked   || 0) : 0;
  document.getElementById('statFocusMins').textContent= isTd ? (data.todayFocusMins || 0) : 0;
  document.getElementById('statBypassed').textContent = isTd ? (data.todayBypassed  || 0) : 0;
  document.getElementById('statSessions').textContent = isTd ? (data.todaySessions  || 0) : 0;
  document.getElementById('statTotalBlocked').textContent  = data.totalBlocked    || 0;
  document.getElementById('statTotalFocus').textContent    = data.totalFocusMins  || 0;
  document.getElementById('statLongestStreak').textContent = (data.longestStreak  || 0) + 'd';
  document.getElementById('sessionsToday').textContent = isTd ? (data.todaySessions || 0) : 0;
  document.getElementById('pomoStreak').textContent   = data.currentStreak || 0;

  document.getElementById('resetStatsBtn').addEventListener('click', async () => {
    await chrome.storage.local.set({
      todayBlocked:0,todayBypassed:0,todaySessions:0,todayFocusMins:0,
      totalBlocked:0,totalFocusMins:0,currentStreak:0,longestStreak:0
    });
    ['statBlocked','statFocusMins','statBypassed','statSessions','statTotalBlocked','statTotalFocus'].forEach(id => {
      document.getElementById(id).textContent = '0';
    });
    document.getElementById('statLongestStreak').textContent = '0d';
    showToast('Stats reset');
  });

  /* ── Pomodoro ───────────────────────────────────── */
  let pomoState = 'idle';
  let pomoInterval = null;
  let pomoSecondsLeft = 0;
  let pomoTotalSeconds = 0;

  const clockEl  = document.getElementById('pomoClock');
  const labelEl  = document.getElementById('pomoLabel');
  const barEl    = document.getElementById('pomoBar');
  const startBtn = document.getElementById('pomoStartBtn');

  function getFocusSecs() { return (parseInt(document.getElementById('pomoFocus').value)||25)*60; }
  function getBreakSecs() { return (parseInt(document.getElementById('pomoBreak').value)||5)*60; }
  function fmt(s) { return Math.floor(s/60).toString().padStart(2,'0')+':'+((s%60).toString().padStart(2,'0')); }

  function refreshDisp() {
    clockEl.textContent = fmt(pomoSecondsLeft);
    const pct = (pomoSecondsLeft/pomoTotalSeconds)*100;
    barEl.style.width = pct+'%';
    barEl.style.background = pomoState==='break' ? 'var(--green)' : 'var(--accent)';
  }

  function startFocus() {
    pomoTotalSeconds = getFocusSecs();
    pomoSecondsLeft  = pomoTotalSeconds;
    pomoState = 'running';
    labelEl.textContent = '🎯 Focus Session';
    startBtn.textContent = '⏸ Pause';
    refreshDisp();
    chrome.storage.local.set({ pomoFocus: document.getElementById('pomoFocus').value, pomoBreak: document.getElementById('pomoBreak').value, pomoState:'running' });
    pomoInterval = setInterval(tick, 1000);
  }

  function startBreak() {
    pomoTotalSeconds = getBreakSecs();
    pomoSecondsLeft  = pomoTotalSeconds;
    pomoState = 'break';
    labelEl.textContent = '☕ Break Time';
    startBtn.textContent = '⏭ Skip';
    chrome.storage.local.set({ pomoState:'break' });
    refreshDisp();
  }

  async function tick() {
    if (pomoSecondsLeft <= 0) {
      clearInterval(pomoInterval);
      if (pomoState === 'running') {
        const d = await chrome.storage.local.get(['todaySessions','todayFocusMins','totalFocusMins','todayDate']);
        const td = new Date().toDateString();
        const mins = parseInt(document.getElementById('pomoFocus').value)||25;
        const sessions = (d.todayDate===td ? d.todaySessions||0 : 0)+1;
        const fm       = (d.todayDate===td ? d.todayFocusMins||0 : 0)+mins;
        await chrome.storage.local.set({ todaySessions:sessions, todayFocusMins:fm, totalFocusMins:(d.totalFocusMins||0)+mins, todayDate:td });
        document.getElementById('statSessions').textContent = sessions;
        document.getElementById('statFocusMins').textContent = fm;
        document.getElementById('sessionsToday').textContent = sessions;
        startBreak();
        pomoInterval = setInterval(tick, 1000);
      } else {
        pomoState = 'idle';
        labelEl.textContent = 'Focus Session';
        startBtn.textContent = '▶ Start';
        pomoSecondsLeft = getFocusSecs();
        pomoTotalSeconds = pomoSecondsLeft;
        chrome.storage.local.set({ pomoState:'idle' });
        refreshDisp();
      }
      return;
    }
    pomoSecondsLeft--;
    refreshDisp();
  }

  startBtn.addEventListener('click', () => {
    if (pomoState==='idle')    startFocus();
    else if (pomoState==='running') { clearInterval(pomoInterval); pomoState='paused'; startBtn.textContent='▶ Resume'; chrome.storage.local.set({pomoState:'paused'}); }
    else if (pomoState==='paused')  { pomoState='running'; startBtn.textContent='⏸ Pause'; chrome.storage.local.set({pomoState:'running'}); pomoInterval=setInterval(tick,1000); }
    else if (pomoState==='break')   { clearInterval(pomoInterval); pomoState='idle'; labelEl.textContent='Focus Session'; startBtn.textContent='▶ Start'; pomoSecondsLeft=getFocusSecs(); pomoTotalSeconds=pomoSecondsLeft; chrome.storage.local.set({pomoState:'idle'}); refreshDisp(); }
  });

  document.getElementById('pomoResetBtn').addEventListener('click', () => {
    clearInterval(pomoInterval); pomoState='idle';
    startBtn.textContent='▶ Start'; labelEl.textContent='Focus Session';
    pomoSecondsLeft=getFocusSecs(); pomoTotalSeconds=pomoSecondsLeft;
    chrome.storage.local.set({pomoState:'idle'}); refreshDisp();
  });

  document.getElementById('pomoSkipBtn').addEventListener('click', () => {
    clearInterval(pomoInterval);
    if (pomoState==='running') { startBreak(); pomoInterval=setInterval(tick,1000); }
    else { pomoState='idle'; startBtn.textContent='▶ Start'; labelEl.textContent='Focus Session'; pomoSecondsLeft=getFocusSecs(); pomoTotalSeconds=pomoSecondsLeft; chrome.storage.local.set({pomoState:'idle'}); refreshDisp(); }
  });

  pomoSecondsLeft = getFocusSecs(); pomoTotalSeconds = pomoSecondsLeft; refreshDisp();

  /* ── Toast ──────────────────────────────────────── */
  function showToast(msg='✓ Saved') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }
});
