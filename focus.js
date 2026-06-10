/* ────── QUOTES ────── */
const QQ = [
  {q:"The secret of getting ahead is getting started.",a:"Mark Twain"},
  {q:"Focus is a matter of deciding what things you're not going to do.",a:"John Carmack"},
  {q:"Deep work is the ability to focus without distraction on a cognitively demanding task.",a:"Cal Newport"},
  {q:"You don't need more time. You need to decide.",a:"Seth Godin"},
  {q:"The successful warrior is the average man, with laser-like focus.",a:"Bruce Lee"},
  {q:"Where focus goes, energy flows.",a:"Tony Robbins"},
  {q:"Starve your distractions. Feed your focus.",a:"Unknown"},
  {q:"Discipline is choosing between what you want now and what you want most.",a:"Abraham Lincoln"},
  {q:"Concentrate all your thoughts upon the work at hand.",a:"Alexander Graham Bell"},
  {q:"Your future is created by what you do today, not tomorrow.",a:"Robert Kiyosaki"},
  {q:"It's not about having time. It's about making time.",a:"Unknown"},
  {q:"The key is not to prioritize what's on your schedule, but to schedule your priorities.",a:"Stephen Covey"},
];

/* ────── STATE ────── */
let origUrl = null, reason = null, cdTimer = null;
let pomoSecs = 25*60, pomoTotal = 25*60, pomoRunning = false, pomoPhase = 'focus', pomoInterval = null;

/* ────── INIT ────── */
document.addEventListener('DOMContentLoaded', async () => {
  startClock();
  const q = QQ[Math.floor(Math.random()*QQ.length)];
  document.getElementById('q-txt').textContent = '\u201c'+q.q+'\u201d';
  document.getElementById('q-by').textContent  = '\u2014 '+q.a;

  const p = new URLSearchParams(window.location.search);
  origUrl = p.get('url');
  if (origUrl) {
    try { document.getElementById('t-site').textContent = new URL(origUrl).hostname.replace('www.',''); }
    catch(_) {}
  }

  const d = await chrome.storage.local.get([
    'hardcoreFocus','shieldActive','breakWindows',
    'todayBlocked','todayBypassed','todayFocusMins','todaySessions','todayDate',
    'focusGoalHours','pomoFocusMins','pomoBreakMins'
  ]);
  const today = new Date().toDateString();
  let blocked=0, bypassed=0, focusMins=0;
  if (d.todayDate===today) { blocked=d.todayBlocked||0; bypassed=d.todayBypassed||0; focusMins=d.todayFocusMins||0; }

  const nb = blocked+1;
  await chrome.storage.local.set({todayBlocked:nb, todayDate:today});

  document.getElementById('sv-blocked').textContent = nb;
  document.getElementById('sv-saved').textContent   = (nb*8)+'m';
  document.getElementById('sv-bypass').textContent  = bypassed;
  document.getElementById('dcount').textContent     = nb;
  renderDots(nb);

  const goalH = parseFloat(d.focusGoalHours)||4;
  const pct   = Math.min(100, Math.round((focusMins/(goalH*60))*100));
  document.getElementById('spct').textContent   = pct+'%';
  document.getElementById('g-pct').textContent  = pct+'%';
  document.getElementById('g-text').textContent = focusMins+'m / '+goalH+'h';
  document.getElementById('g-note').textContent = focusMins>=goalH*60 ? '🎉 Daily goal reached!' : ((goalH*60-focusMins)+'m remaining today');
  setTimeout(()=>{ document.getElementById('ring').style.strokeDashoffset = 169.6*(1-pct/100); },200);
  setTimeout(()=>{ document.getElementById('g-bar').style.width = pct+'%'; },300);

  const hc = !!d.hardcoreFocus;
  document.getElementById('hctoggle').checked = hc;
  applyHC(hc);

  const bws = d.breakWindows||[];
  renderBW(bws);
  const onB = isBreakNow(bws);
  document.getElementById('st-break').textContent = onB ? 'Active ☕' : (bws.length ? 'Scheduled' : 'Not Set');
  document.getElementById('st-break').className   = 'badge '+(onB ? 'bbrk' : 'bidle');
  document.getElementById('st-shield').textContent = d.shieldActive===false ? 'Off' : 'Active';
  document.getElementById('st-shield').className   = 'badge '+(d.shieldActive===false ? 'boff' : 'bon');

  pomoSecs  = (parseInt(d.pomoFocusMins)||25)*60;
  pomoTotal = pomoSecs;
  updatePomo();

  // Hardcore toggle
  document.getElementById('hctoggle').addEventListener('change', async e=>{
    const v=e.target.checked;
    await chrome.storage.local.set({hardcoreFocus:v});
    applyHC(v);
    document.getElementById('st-hc').textContent = v ? 'On 🔒' : 'Off';
    document.getElementById('st-hc').className   = 'badge '+(v?'boff':'bidle');
  });

  // Reason chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => pickReason(chip));
  });

  // Main action buttons
  document.getElementById('btnp').addEventListener('click', startCD);
  document.getElementById('btnl').addEventListener('click', () => { window.location.href='https://www.google.com'; });
  document.getElementById('cdcancel').addEventListener('click', cancelCD);

  // Pomodoro buttons
  document.getElementById('pomobtn').addEventListener('click', pomoToggle);
  document.getElementById('pomoreset').addEventListener('click', pomoReset);
  document.getElementById('pomoskip').addEventListener('click', pomoSkip);
});

/* ────── CLOCK ────── */
function startClock() {
  function tick(){
    const n=new Date();
    const t=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const dt=n.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
    document.getElementById('clkcorner').textContent=t;
    document.getElementById('t-clock').textContent=t;
    document.getElementById('t-date').textContent=dt;
  }
  tick(); setInterval(tick,1000);
}

/* ────── DOTS ────── */
function renderDots(n){
  const g=document.getElementById('dtrail'); g.innerHTML='';
  const total=Math.max(n,12);
  for(let i=0;i<total;i++){const d=document.createElement('div');d.className='tdot'+(i<n?' lit':'');g.appendChild(d);}
}

/* ────── BREAK WINDOWS ────── */
function isBreakNow(w){
  if(!w||!w.length)return false;
  const n=new Date(), cur=n.getHours()*60+n.getMinutes();
  for(const b of w){
    if(!b.start||!b.end)continue;
    const[sh,sm]=b.start.split(':').map(Number),[eh,em]=b.end.split(':').map(Number);
    const s=sh*60+sm,e=eh*60+em;
    if(s<e?cur>=s&&cur<=e:cur>=s||cur<=e)return true;
  }
  return false;
}
function renderBW(w){
  const el=document.getElementById('bwlist');
  const v=(w||[]).filter(b=>b.start&&b.end);
  if(!v.length){el.textContent='No breaks configured';return;}
  el.innerHTML=v.map((b,i)=>`<div class="bi"><span class="bb">Break ${i+1}</span><span class="bt">${b.start} \u2192 ${b.end}</span></div>`).join('');
}

/* ────── REASON CHIPS ────── */
function pickReason(el){
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('sok','swarn'));
  const type=el.dataset.type; reason=el.dataset.label;
  el.classList.add(type==='ok'?'sok':'swarn');
  document.getElementById('wbanner').style.display = type==='warn'?'block':'none';
  if(!document.getElementById('hctoggle').checked){
    const b=document.getElementById('btnp');
    b.disabled=false;
    b.textContent=type==='warn'?'⚠️ I understand — open anyway':'Open for '+reason;
  }
}

/* ────── HARDCORE UI ────── */
function applyHC(on){
  const n=document.getElementById('sbanner'), b=document.getElementById('btnp');
  if(on){
    n.style.display='block'; b.disabled=true; b.textContent='🔒 Hardcore Focus Mode — no bypass';
    document.getElementById('st-hc').textContent='On 🔒'; document.getElementById('st-hc').className='badge boff';
  } else {
    n.style.display='none';
    document.getElementById('st-hc').textContent='Off'; document.getElementById('st-hc').className='badge bidle';
    if(reason){b.disabled=false;b.textContent='Open for '+reason;}
    else{b.disabled=true;b.textContent='Select a reason above to proceed';}
  }
}

/* ────── 5s COUNTDOWN ────── */
function startCD(){
  if(!origUrl||document.getElementById('hctoggle').checked)return;
  clearCD();
  document.getElementById('btnp').disabled=true;
  document.getElementById('cdwrap').style.display='block';
  let s=5;
  document.getElementById('cdnum').textContent=s;
  document.getElementById('cdbar').style.width='100%';
  cdTimer=setInterval(async()=>{
    s--;
    document.getElementById('cdnum').textContent=s;
    document.getElementById('cdbar').style.width=(s/5*100)+'%';
    if(s<=0){clearCD();await doAccess();}
  },1000);
}
function cancelCD(){
  clearCD(); document.getElementById('cdwrap').style.display='none';
  const b=document.getElementById('btnp'); b.disabled=false;
  b.textContent=reason?'Open for '+reason:'Select a reason above to proceed';
}
function clearCD(){if(cdTimer){clearInterval(cdTimer);cdTimer=null;}}
async function doAccess(){
  if(!origUrl)return;
  try{
    const h=new URL(origUrl).hostname.replace('www.','');
    await chrome.storage.local.set({['bypass_'+h]:Date.now()+2*60*1000});
    const d=await chrome.storage.local.get(['todayBypassed','todayDate']);
    const today=new Date().toDateString();
    await chrome.storage.local.set({todayBypassed:(d.todayDate===today?d.todayBypassed||0:0)+1});
    window.location.href=origUrl;
  }catch(e){alert('Could not navigate.');}
}

/* ────── POMODORO ────── */
function updatePomo(){
  const m=Math.floor(pomoSecs/60).toString().padStart(2,'0'),s=(pomoSecs%60).toString().padStart(2,'0');
  document.getElementById('pomoclock').textContent=m+':'+s;
  const pct=(pomoSecs/pomoTotal)*100;
  const bar=document.getElementById('pomobar');
  bar.style.width=pct+'%';
  bar.style.background=pomoPhase==='break'?'linear-gradient(90deg,#34d399,#6ee7b7)':'linear-gradient(90deg,#7c6af7,#a78bfa)';
  bar.style.boxShadow=pomoPhase==='break'?'0 0 8px rgba(52,211,153,.4)':'0 0 8px rgba(124,106,247,.45)';
}
function pomoToggle(){
  const btn=document.getElementById('pomobtn');
  if(pomoRunning){
    clearInterval(pomoInterval);pomoRunning=false;btn.textContent='▶ Resume';btn.classList.remove('active');
    document.getElementById('pomophase').textContent='Paused';
    document.getElementById('st-pomo').textContent='Paused';
    chrome.storage.local.set({pomoState:'paused'});
  } else {
    pomoRunning=true;btn.textContent='⏸ Pause';btn.classList.add('active');
    document.getElementById('pomophase').textContent=pomoPhase==='focus'?'🎯 Focus Session':'☕ Break Time';
    document.getElementById('st-pomo').textContent=pomoPhase==='focus'?'Running':'Break';
    document.getElementById('st-pomo').className='badge '+(pomoPhase==='focus'?'bon':'bbrk');
    chrome.storage.local.set({pomoState:'running'});
    pomoInterval=setInterval(async()=>{
      if(pomoSecs<=0){
        clearInterval(pomoInterval);pomoRunning=false;btn.classList.remove('active');
        if(pomoPhase==='focus'){
          const d=await chrome.storage.local.get(['todayFocusMins','todaySessions','todayDate','totalFocusMins']);
          const today=new Date().toDateString(), mins=Math.round(pomoTotal/60);
          const fm=(d.todayDate===today?d.todayFocusMins||0:0)+mins;
          await chrome.storage.local.set({todayFocusMins:fm,todaySessions:(d.todayDate===today?d.todaySessions||0:0)+1,totalFocusMins:(d.totalFocusMins||0)+mins,todayDate:today});
          document.getElementById('sv-saved').textContent=fm+'m';
          pomoPhase='break';
          const b=await chrome.storage.local.get('pomoBreakMins');
          pomoTotal=pomoSecs=(parseInt(b.pomoBreakMins)||5)*60;
          document.getElementById('pomophase').textContent='☕ Break Time';btn.textContent='▶ Start Break';
          document.getElementById('st-pomo').textContent='Break';document.getElementById('st-pomo').className='badge bbrk';
          chrome.storage.local.set({pomoState:'break'});
        } else {
          pomoPhase='focus';
          const b=await chrome.storage.local.get('pomoFocusMins');
          pomoTotal=pomoSecs=(parseInt(b.pomoFocusMins)||25)*60;
          document.getElementById('pomophase').textContent='Ready to focus';btn.textContent='▶ Start';
          document.getElementById('st-pomo').textContent='Idle';document.getElementById('st-pomo').className='badge bidle';
          chrome.storage.local.set({pomoState:'idle'});
        }
        updatePomo();return;
      }
      pomoSecs--;updatePomo();
    },1000);
  }
}
function pomoReset(){
  clearInterval(pomoInterval);pomoRunning=false;pomoPhase='focus';
  const btn=document.getElementById('pomobtn');btn.textContent='▶ Start';btn.classList.remove('active');
  chrome.storage.local.get('pomoFocusMins').then(b=>{
    pomoTotal=pomoSecs=(parseInt(b.pomoFocusMins)||25)*60;
    document.getElementById('pomophase').textContent='Ready to focus';
    document.getElementById('st-pomo').textContent='Idle';document.getElementById('st-pomo').className='badge bidle';
    chrome.storage.local.set({pomoState:'idle'});updatePomo();
  });
}
function pomoSkip(){
  clearInterval(pomoInterval);pomoRunning=false;document.getElementById('pomobtn').classList.remove('active');
  if(pomoPhase==='focus'){
    pomoPhase='break';
    chrome.storage.local.get('pomoBreakMins').then(b=>{
      pomoTotal=pomoSecs=(parseInt(b.pomoBreakMins)||5)*60;
      document.getElementById('pomophase').textContent='☕ Break Time';
      document.getElementById('pomobtn').textContent='▶ Start Break';updatePomo();
    });
  } else { pomoReset(); }
}
