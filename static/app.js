/* =====================================================
   Polla Mundial 2026 — Frontend Logic
   ===================================================== */

const API = '';  // same origin
const PARTICIPANTS = ['Hugo', 'Oscar', 'Camilo'];
const PARTICIPANT_COLORS = { Hugo: 'hugo', Oscar: 'oscar', Camilo: 'camilo' };
const PARTICIPANT_EMOJIS = { Hugo: '🦅', Oscar: '⭐', Camilo: '🔥' };

const PLAYOFF_ROUNDS = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercero', 'Final', 'Campeón'];
const PLAYOFF_PTS = { Dieciseisavos: 4, Octavos: 6, Cuartos: 8, Semifinal: 10, Tercero: 12, Final: 15, 'Campeón': 20 };
// Orden para el bracket (sin Tercero, que va aparte)
const BRACKET_ROUNDS = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final', 'Campeón'];
// Clases de color por participante
const PARTICIPANT_DOT = { Hugo: 'dp-orange', Oscar: 'dp-blue', Camilo: 'dp-purple' };

let appData = null;
let currentGroup = 'ALL';
let currentDetailParticipant = 'Hugo';
let searchQuery = '';

// =====================================================
// DATA LOADING
// =====================================================
async function loadData() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  document.getElementById('loading').style.display = 'flex';
  // Hide all sections while loading
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('error-container').innerHTML = '';

  try {
    const res = await fetch(`${API}/api/data`);
    const data = await res.json();

    if (data.error) throw new Error(data.error + '\n' + (data.traceback || ''));

    appData = data;
    renderAll();
    // Show current section after data is ready
    document.getElementById('loading').style.display = 'none';
    showSection(currentSection);
    showToast('✅ Datos actualizados correctamente', 'success');
  } catch (err) {
    console.error(err);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-container').innerHTML = `
      <div class="error-box">
        <strong>⚠️ Error cargando datos</strong>
        <pre>${err.message}</pre>
      </div>`;
    showToast('❌ Error al cargar datos', 'error');
  } finally {
    btn.classList.remove('spinning');
  }
}

// =====================================================
// RENDER ALL
// =====================================================
function renderAll() {
  updateProgressBar();
  renderLeaderboard();
  renderGroups();
  renderStandings();
  renderPlayoffs();
  renderFuturePredictions();
  renderBracket();
  renderDetail();
}

// =====================================================
// PROGRESS BAR
// =====================================================
function updateProgressBar() {
  const prog = appData.tournament_progress;
  if (!prog) return;

  const pct = Math.round((prog.played_group_matches / prog.total_group_matches) * 100);
  const bar = document.getElementById('progress-bar-inner');
  const label = document.getElementById('progress-bar-label');

  if (bar) bar.style.width = pct + '%';
  if (label) {
    const roundsWithData = Object.entries(prog.real_playoffs_rounds)
      .filter(([, count]) => count > 0)
      .map(([r]) => r);
    const stageLabel = roundsWithData.length
      ? `Playoffs: ${roundsWithData.join(', ')}`
      : prog.group_stage_complete
        ? '✅ Fase de grupos completa'
        : `Grupos: ${prog.played_group_matches}/${prog.total_group_matches} partidos · ${prog.groups_complete}/12 grupos completos`;
    label.textContent = stageLabel;
  }
}

// =====================================================
// TOURNAMENT BRACKET
// =====================================================
function renderBracket() {
  const flow = document.getElementById('bracket-flow');
  const thirdEl = document.getElementById('bracket-third');
  const legendEl = document.getElementById('bracket-legend');
  if (!flow) return;

  const { participants, real_playoffs } = appData;
  const norm = s => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  // --- CONSTANTS ---
  const SH=38, SW=128, IG=6, OFF=SH/2+IG/2; // slot height, width, gap, center offset(22)
  const CG=22, CW=SW+CG;                      // col gap, col stride(150)
  const BH=92, N=8, HH=N*BH;                  // D16 match height, matches per half, half height(736)
  const PT=46;                                 // header padding top
  const LX=[0,CW,2*CW,3*CW];                  // D16-L, Oct-L, Cuar-L, SF-L  x positions
  const FX=LX[3]+SW+40;                        // Final x
  const CX=FX+SW+28;                           // Champion x
  const CW2=SW+20;                             // champion card width
  const R0=CX+CW2+40;                          // SF-R x
  const RX=[R0, R0+CW, R0+2*CW, R0+3*CW];    // SF-R, Cuar-R, Oct-R, D16-R
  const TW=RX[3]+SW+4, TH=PT+HH+4;
  const YMID=HH/2;                             // vertical center = 368
  const LC='rgba(96,165,250,0.32)';

  // --- LEGEND ---
  if (legendEl) legendEl.innerHTML = `<div class="bracket-legend">
    <div class="bracket-legend-item"><span class="legend-dot" style="background:var(--hugo)"></span> Hugo</div>
    <div class="bracket-legend-item"><span class="legend-dot" style="background:var(--oscar)"></span> Oscar</div>
    <div class="bracket-legend-item"><span class="legend-dot" style="background:var(--camilo)"></span> Camilo</div>
    <div class="bracket-legend-item"><span class="legend-box" style="border-color:rgba(34,197,94,0.6);background:rgba(34,197,94,0.1)"></span> Real ✓</div>
    <div class="bracket-legend-item"><span class="legend-box" style="border-color:rgba(245,200,66,0.4);background:rgba(245,200,66,0.05)"></span> Pendiente</div>
    <div class="bracket-legend-item"><span class="legend-box" style="border-color:rgba(239,68,68,0.2);opacity:0.7"></span> Eliminado ✗</div>
  </div>`;

  // --- TEAM DATA ---
  const HR={}, RD={};
  ['Dieciseisavos','Octavos','Cuartos','Semifinal','Final','Campeón','Tercero'].forEach(r => {
    HR[r] = (real_playoffs[r]||[]).length > 0;
    const map = new Map();
    (real_playoffs[r]||[]).forEach(t => { const k=norm(t); map.set(k,{name:t,k,real:true,preds:[]}); });
    PARTICIPANTS.forEach(pn => {
      (participants[pn]?.playoff_predictions?.[r]||[]).forEach(t => {
        const k=norm(t);
        if (!map.has(k)) map.set(k,{name:t,k,real:false,preds:[]});
        const d=map.get(k); if (!d.preds.includes(pn)) d.preds.push(pn);
      });
    });
    RD[r]=[...map.values()].sort((a,b)=>{
      if(a.real!==b.real) return a.real?-1:1;
      if(a.preds.length!==b.preds.length) return b.preds.length-a.preds.length;
      return a.name.localeCompare(b.name);
    });
  });
  // Split teams: first matchCount*2 = left half, next = right half
  function halfT(r, isRight, mc) { const t=RD[r], n=mc*2; return isRight?t.slice(n,n*2):t.slice(0,n); }

  // --- POSITION MATH ---
  // D16(ri=0): slot center Y = (m+0.5)*BH ± OFF
  // Higher rounds: slot center Y = center of feeding D16 match (recursive)
  function sY(ri,m,s) { return ri===0?(m+0.5)*BH+(s?OFF:-OFF):mY(ri-1,m*2+s); }
  function mY(ri,m)   { return ri===0?(m+0.5)*BH:(sY(ri,m,0)+sY(ri,m,1))/2; }

  // --- HTML + SVG ---
  let H='', S='';

  function ln(x1,y1,x2,y2) {
    S+=`<line x1="${x1.toFixed(1)}" y1="${(y1+PT).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y2+PT).toFixed(1)}" stroke="${LC}" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  function card(team,r,w,champ) {
    w=w||SW;
    if (!team) return `<div class="bracket-slot bt-pending" style="height:${SH}px;width:${w}px"><span style="color:var(--text3);font-size:10px">TBD</span></div>`;
    const isR=team.real, played=HR[r];
    const cls=champ?'bt-champion':isR?'bt-real':played?'bt-miss':'bt-pending';
    const ic=isR?'✓':played?'✗':'·', icc=isR?'var(--green)':played?'#ef4444':'var(--text3)';
    const dots=PARTICIPANTS.map(p=>`<span class="bracket-pred-dot ${team.preds.includes(p)?PARTICIPANT_DOT[p]:'dp-miss'}" title="${p}"></span>`).join('');
    return `<div class="bracket-slot ${cls}" style="height:${SH}px;width:${w}px">
      <div class="bracket-team-name" style="font-size:11px">${champ?'🏆 ':''}${team.name}<span style="color:${icc};font-size:9px;margin-left:3px">${ic}</span></div>
      <div class="bracket-preds">${dots}</div></div>`;
  }

  function put(x,yc,team,r,w,champ) {
    H+=`<div style="position:absolute;left:${x.toFixed(1)}px;top:${(yc-SH/2+PT).toFixed(1)}px">${card(team,r,w,champ)}</div>`;
  }

  function hdr(x,txt,w) {
    w=w||SW;
    H+=`<div style="position:absolute;left:${x.toFixed(1)}px;top:0;width:${w}px;height:${PT}px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px">
      <span style="font-size:9px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:var(--text3);text-align:center;line-height:1.3">${txt}</span></div>`;
  }

  // --- LEFT HALF: D16-L → Oct-L → Cuar-L → SF-L ---
  ['Dieciseisavos','Octavos','Cuartos','Semifinal'].forEach((ronda,ri) => {
    const mc=[N,N/2,N/4,1][ri], x=LX[ri];
    hdr(x,['D16<br>+4pts','Octavos<br>+6pts','Cuartos<br>+8pts','Semis<br>+10pts'][ri]);
    const teams=halfT(ronda,false,mc);
    for (let m=0; m<mc; m++) {
      put(x, sY(ri,m,0), teams[m*2]||null, ronda);
      put(x, sY(ri,m,1), teams[m*2+1]||null, ronda);
      // Right-side connector bracket
      const tY=sY(ri,m,0), bY=sY(ri,m,1), cX=x+SW+CG/2;
      ln(x+SW,tY,cX,tY); ln(x+SW,bY,cX,bY); ln(cX,tY,cX,bY);
      // From match center to parent slot in next round
      if (ri<3) { const pY=sY(ri+1,Math.floor(m/2),m%2); ln(cX,mY(ri,m),LX[ri+1],pY); }
    }
  });
  // SF-L corner midpoint → Final left edge
  const sfLcX=LX[3]+SW+CG/2;
  ln(sfLcX,YMID,FX,YMID);

  // --- FINAL ---
  hdr(FX,'Final<br>+15pts');
  // Both SF inputs arrive at YMID; split vertically to the two Final team slots
  ln(FX,YMID,FX,YMID-OFF); ln(FX,YMID,FX,YMID+OFF);
  put(FX, YMID-OFF, RD['Final'][0]||null, 'Final');
  put(FX, YMID+OFF, RD['Final'][1]||null, 'Final');
  // Final right connector → Champion
  const fCX=FX+SW+14;
  ln(FX+SW,YMID-OFF,fCX,YMID-OFF); ln(FX+SW,YMID+OFF,fCX,YMID+OFF);
  ln(fCX,YMID-OFF,fCX,YMID+OFF); ln(fCX,YMID,CX,YMID);

  // --- CHAMPION ---
  hdr(CX,'🏆 Campeón<br>+20pts',CW2);
  put(CX, YMID, RD['Campeón'][0]||null, 'Campeón', CW2, true);

  // --- RIGHT HALF: D16-R → Oct-R → Cuar-R → SF-R (displayed SF-R first from center) ---
  // Column order from center outward: ri=0→SF-R(RX[0]), ri=1→Cuar-R, ri=2→Oct-R, ri=3→D16-R
  ['Semifinal','Cuartos','Octavos','Dieciseisavos'].forEach((ronda,ri) => {
    const mc=[1,N/4,N/2,N][ri], x=RX[ri], lri=3-ri;
    hdr(x,['Semis<br>+10pts','Cuartos<br>+8pts','Octavos<br>+6pts','D16<br>+4pts'][ri]);
    const teams=halfT(ronda,true,mc);
    for (let m=0; m<mc; m++) {
      put(x, sY(lri,m,0), teams[m*2]||null, ronda);
      put(x, sY(lri,m,1), teams[m*2+1]||null, ronda);
      // Left-side connector bracket (toward center)
      const tY=sY(lri,m,0), bY=sY(lri,m,1), cX=x-CG/2;
      ln(x,tY,cX,tY); ln(x,bY,cX,bY); ln(cX,tY,cX,bY);
      // From match center to next inward round's slot right edge
      if (ri>0) { const pY=sY(lri+1,Math.floor(m/2),m%2); ln(cX,mY(lri,m),RX[ri-1]+SW,pY); }
    }
  });
  // SF-R corner midpoint → Final right edge
  const sfRcX=RX[0]-CG/2;
  ln(sfRcX,YMID,FX+SW,YMID);
  // SF-R input: split from right edge of Final
  ln(FX+SW,YMID,FX+SW,YMID-OFF); ln(FX+SW,YMID,FX+SW,YMID+OFF);

  // --- MOUNT ---
  const scrollDiv=document.createElement('div');
  scrollDiv.style.cssText='overflow-x:auto;overflow-y:visible;padding-bottom:8px';
  scrollDiv.innerHTML=`<div style="position:relative;width:${TW}px;height:${TH}px">
    <svg style="position:absolute;top:0;left:0;width:${TW}px;height:${TH}px;pointer-events:none;overflow:visible">${S}</svg>
    ${H}</div>`;
  flow.innerHTML=''; flow.appendChild(scrollDiv);

  // --- THIRD PLACE ---
  if (thirdEl) {
    const rt=real_playoffs['Tercero']||[], tm=new Map();
    PARTICIPANTS.forEach(pn=>(participants[pn]?.playoff_predictions?.['Tercero']||[]).forEach(t=>{
      const k=norm(t); if(!tm.has(k))tm.set(k,{name:t,k,real:false,preds:[]});
      const d=tm.get(k); if(!d.preds.includes(pn))d.preds.push(pn);
    }));
    rt.forEach(t=>{const k=norm(t);if(!tm.has(k))tm.set(k,{name:t,k,real:true,preds:[]});else tm.get(k).real=true;});
    const cards=[...tm.values()].map(team=>{
      const cls=team.real?'bt-real':HR['Tercero']?'bt-miss':'bt-pending';
      const ic=team.real?'✓':HR['Tercero']?'✗':'·', icc=team.real?'var(--green)':HR['Tercero']?'#ef4444':'var(--text3)';
      const dots=PARTICIPANTS.map(p=>`<span class="bracket-pred-dot ${team.preds.includes(p)?PARTICIPANT_DOT[p]:'dp-miss'}" title="${p}"></span>`).join('');
      return `<div class="bracket-slot ${cls}" style="min-width:120px;height:${SH}px">
        <div class="bracket-team-name" style="font-size:11px">${team.name}<span style="color:${icc};font-size:9px;margin-left:3px">${ic}</span></div>
        <div class="bracket-preds">${dots}</div></div>`;
    }).join('');
    thirdEl.innerHTML=`<div class="bracket-third-section">
      <div class="bracket-third-title">🥉 Tercer Puesto <span style="color:var(--gold);font-size:10px">(+12pts)</span></div>
      <div class="bracket-third-grid">${cards}</div></div>`;
  }
}

// =====================================================
// FUTURE PREDICTIONS (predicciones para rondas sin resultado)
// =====================================================
function renderFuturePredictions() {
  const el = document.getElementById('future-predictions-panel');
  if (!el) return;

  const participants = appData.participants;
  const futureRoundsSet = new Set();
  PARTICIPANTS.forEach(name => {
    Object.keys(participants[name]?.future_predictions || {}).forEach(r => futureRoundsSet.add(r));
  });

  if (!futureRoundsSet.size) {
    el.innerHTML = '';
    return;
  }

  // Ordenar según el orden canónico del torneo
  const orderedRounds = PLAYOFF_ROUNDS.filter(r => futureRoundsSet.has(r));

  const cards = orderedRounds.map(ronda => {
    const pts = PLAYOFF_PTS[ronda] || 0;
    const participantRows = PARTICIPANTS.map(name => {
      const teams = (participants[name]?.future_predictions?.[ronda] || []);
      if (!teams.length) return '';
      const chips = teams.map(t => `<span class="future-team-chip">${t}</span>`).join('');
      const color = PARTICIPANT_COLORS[name];
      return `<div class="future-round-participant">
        <span style="color:var(--${color})">${PARTICIPANT_EMOJIS[name]} ${name}</span>
        <div class="future-teams-list">${chips}</div>
      </div>`;
    }).filter(Boolean).join('');

    return `<div class="future-round-card">
      <div class="future-round-name">${ronda} <span style="color:var(--gold);font-size:10px">(+${pts}pts c/u)</span></div>
      ${participantRows}
    </div>`;
  }).join('');

  el.innerHTML = `<div class="future-panel">
    <div class="future-panel-title">🔮 Predicciones pendientes de confirmar</div>
    <div class="future-rounds-grid">${cards}</div>
  </div>`;
}


// =====================================================
// STANDINGS / CLASIFICADOS
// =====================================================
function renderStandings() {
  if (!appData.standings) return;

  renderQualifiedSummary();
  renderThirdsTable();
  renderGroupStandings();
}

function renderQualifiedSummary() {
  const qualified = appData.qualified || [];
  const allThirds = appData.all_thirds || [];
  const el = document.getElementById('qualified-summary');

  if (!qualified.length) {
    el.innerHTML = `<div class="qualified-banner">
      <div class="qualified-count" style="color:var(--text3)">0</div>
      <div>
        <div class="qualified-label">Ningún equipo clasificado aún</div>
        <div class="qualified-sub">Se calcularán automáticamente al ingresar resultados en la hoja <strong>Realidad</strong> del Excel</div>
      </div>
    </div>`;
    return;
  }

  const groupsComplete = Object.values(appData.standings).filter(g => g.complete).length;
  const thirds = appData.best_8_thirds || [];

  el.innerHTML = `<div class="qualified-banner">
    <div class="qualified-count">${qualified.length}</div>
    <div>
      <div class="qualified-label">Equipos clasificados al Dieciseisavos</div>
      <div class="qualified-sub">
        Grupos completos: ${groupsComplete}/12 ·
        Primeros: ${qualified.filter(q => q.pos === 1).length} ·
        Segundos: ${qualified.filter(q => q.pos === 2).length} ·
        Mejores terceros: ${thirds.length}
      </div>
    </div>
  </div>`;
}

function renderThirdsTable() {
  const allThirds = appData.all_thirds || [];
  const best8 = new Set((appData.best_8_thirds || []).map(t => t.equipo));
  const el = document.getElementById('thirds-table');

  if (!allThirds.length) {
    el.innerHTML = '';
    return;
  }

  const rows = allThirds.map((t, i) => {
    const isClassified = best8.has(t.equipo);
    const cls = isClassified ? 'classified' : 'eliminated';
    // La línea de corte va DESPUÉS del 8° (índice 7), es decir ANTES del 9° (índice 8)
    const showCutoff = i === 8 && allThirds.length > 8
      ? `<tr class="thirds-cutoff"><td colspan="7">──── LÍMITE DE CLASIFICACIÓN ────</td></tr>`
      : '';
    return `${showCutoff}<tr class="${cls}">
      <td><span class="rank-number ${i < 8 ? 'top' : ''}">${i + 1}</span></td>
      <td>
        ${isClassified ? '✅' : '❌'} ${t.equipo}
        <span class="grupo-badge" style="margin-left:6px">${t.grupo}</span>
      </td>
      <td>${t.pts}</td>
      <td>${t.dg >= 0 ? '+' : ''}${t.dg}</td>
      <td>${t.gf}</td>
      <td>${t.gc}</td>
      <td style="color:var(--text3);font-size:11px">#${t.fifa_rank}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div class="thirds-section">
    <div class="thirds-header">
      <h3>⭐ Ranking de Terceros Lugares</h3>
      <span class="badge">${allThirds.filter((_, i) => i < 8 && best8.has(allThirds[i]?.equipo)).length || Math.min(best8.size, 8)} clasificados</span>
    </div>
    <table class="thirds-table">
      <thead><tr>
        <th>#</th><th>Equipo</th>
        <th>Pts</th><th>DG</th><th>GF</th><th>GC</th><th>FIFA</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderGroupStandings() {
  const standings = appData.standings || {};
  const best8Set = new Set((appData.best_8_thirds || []).map(t => t.equipo));
  const el = document.getElementById('group-standings-grid');

  const cards = Object.entries(standings).sort(([a], [b]) => a.localeCompare(b)).map(([grupo, data]) => {
    const { table, complete, started, matches_played } = data;

    let statusCls = 'pending';
    let statusLabel = 'Sin iniciar';
    if (complete) { statusCls = 'complete'; statusLabel = 'Completo'; }
    else if (started) { statusCls = 'partial'; statusLabel = `${matches_played}/6 partidos`; }

    const rows = table.map((t) => {
      const pos = t.pos;
      let rowCls = `pos-${pos}`;
      if (pos === 3) {
        rowCls = best8Set.has(t.equipo) ? 'pos-3-qualified' : 'pos-3-eliminated';
      }

      let qual = '';
      if (pos <= 2) qual = '✅';
      else if (pos === 3 && best8Set.has(t.equipo)) qual = '⭐';
      else if (pos === 3 && started) qual = '❌';

      return `<tr class="${rowCls}">
        <td>
          <span class="pos-badge">${pos}</span>
          ${t.equipo} <span class="qualified-icon">${qual}</span>
        </td>
        <td>${t.pj}</td>
        <td>${t.pts}</td>
        <td>${t.dg >= 0 ? '+' : ''}${t.dg}</td>
        <td>${t.gf}</td>
        <td>${t.gc}</td>
      </tr>`;
    }).join('');

    return `<div class="group-card">
      <div class="group-card-header">
        <span class="group-card-title">Grupo ${grupo}</span>
        <span class="group-card-status ${statusCls}">${statusLabel}</span>
      </div>
      <table class="group-table">
        <thead><tr>
          <th>Equipo</th><th>PJ</th><th>Pts</th><th>DG</th><th>GF</th><th>GC</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="group-standings-grid">${cards}</div>`;
}

// =====================================================
// SYNC AND RELOAD (un solo click: guarda clasificados + recarga todo)
// =====================================================
async function syncAndReload() {
  const btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="refresh-icon" style="display:inline-block;animation:spin 1s linear infinite">↺</span> Sincronizando…';
  }
  document.getElementById('loading').style.display = 'flex';
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  try {
    const res = await fetch('/api/sync-and-reload', { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    appData = data;
    renderAll();
    document.getElementById('loading').style.display = 'none';
    showSection(currentSection);
    showToast(`✅ ${data.sync_message || 'Actualizado correctamente'}`, 'success');
  } catch (err) {
    document.getElementById('loading').style.display = 'none';
    showToast(`❌ Error: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="refresh-icon" style="display:inline-block">↺</span> Actualizar Todo';
    }
  }
}

// =====================================================
// SYNC PLAYOFFS TO EXCEL
// =====================================================
async function syncPlayoffs() {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Guardando…';

  try {
    const res = await fetch('/api/sync-playoffs', { method: 'POST' });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    if (data.success) {
      showToast(`✅ ${data.message}`, 'success');
      await loadData();
    } else {
      showToast(`⚠️ ${data.message}`, '');
    }
  } catch (err) {
    showToast(`❌ Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ Guardar en Excel';
  }
}


// =====================================================
// LEADERBOARD
// =====================================================
function renderLeaderboard() {
  const { ranking, participants } = appData;

  // Podium
  const podium = document.getElementById('podium-container');
  podium.innerHTML = ranking.map((r, i) => {
    const p = participants[r.name];
    const color = PARTICIPANT_COLORS[r.name];
    const emoji = PARTICIPANT_EMOJIS[r.name];
    return `
      <div class="podium-card rank-${i+1}">
        <div class="rank-badge">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
        <div class="podium-avatar bg-${color}">${emoji}</div>
        <div class="podium-name">${r.name}</div>
        <div class="podium-total color-${color}">${r.total}</div>
        <div class="podium-breakdown">
          Grupos: <span>${p.group_total}</span> · Playoffs: <span>${p.playoff_total}</span>
        </div>
      </div>`;
  }).join('');

  // Stats grid - tarjetas por participante con proyeccion de max puntos
  const statsGrid = document.getElementById('stats-grid');
  statsGrid.innerHTML = PARTICIPANTS.map(name => {
    const p = participants[name];
    const color = PARTICIPANT_COLORS[name];
    const rank = ranking.findIndex(r => r.name === name) + 1;
    const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
    const maxTotal = p.max_total || p.grand_total;
    const maxExtra = p.max_possible_extra || 0;
    const maxPct = Math.min(100, Math.round((p.grand_total / Math.max(maxTotal, 1)) * 100));

    return `<div class="stat-card stat-${color}">
      <div class="stat-header">
        <span class="stat-rank">${rankLabel}</span>
        <span class="stat-name">${PARTICIPANT_EMOJIS[name]} ${name}</span>
        <span class="stat-total">${p.grand_total}pts</span>
      </div>
      <div class="stat-breakdown">
        <div class="stat-item"><span>⚽ Grupos</span><strong>${p.group_total}</strong></div>
        <div class="stat-item"><span>🎯 Playoffs</span><strong>${p.playoff_total}</strong></div>
      </div>
      ${maxExtra > 0 ? `<div class="max-pts-bar">
        <span class="max-pts-label">Máx: <strong style="color:var(--text)">${maxTotal}pts</strong></span>
        <div class="max-pts-track"><div class="max-pts-fill" style="width:${maxPct}%"></div></div>
        <span class="max-pts-value" style="font-size:11px;color:var(--text2)">+${maxExtra} posibles</span>
      </div>` : '<div style="font-size:11px;color:var(--green)">✅ Todos los puntos finalizados</div>'}
    </div>`;
  }).join('');
}

// =====================================================
// GROUPS
// =====================================================
function renderGroupFilters(groups) {
  const filtersEl = document.getElementById('group-filters');
  const allGroups = ['ALL', ...groups];
  filtersEl.innerHTML = allGroups.map(g => `
    <button class="group-filter-btn ${g === currentGroup ? 'active' : ''}"
      onclick="filterGroup('${g}')">${g === 'ALL' ? 'Todos' : 'Grupo ' + g}</button>
  `).join('') + `
    <input class="search-input" type="text" placeholder="🔍 Buscar equipo…"
      oninput="filterSearch(this.value)" value="${searchQuery}" />`;
}

function filterGroup(g) {
  currentGroup = g;
  renderGroups();
}

function filterSearch(q) {
  searchQuery = q.toLowerCase();
  renderGroups();
}

function renderGroups() {
  const hugoMatches = appData.participants['Hugo'].group_matches;
  const oscarMatches = appData.participants['Oscar'].group_matches;
  const camiloMatches = appData.participants['Camilo'].group_matches;

  // Build a map by partido number
  const oscarMap = {};
  const camiloMap = {};
  oscarMatches.forEach(m => oscarMap[m.partido] = m);
  camiloMatches.forEach(m => camiloMap[m.partido] = m);

  // Get unique groups
  const groups = [...new Set(hugoMatches.map(m => m.grupo))].filter(Boolean).sort();
  renderGroupFilters(groups);

  // Filter
  let matches = hugoMatches.filter(m => {
    if (currentGroup !== 'ALL' && m.grupo !== currentGroup) return false;
    if (searchQuery) {
      const q = searchQuery;
      return m.local?.toLowerCase().includes(q) || m.visitante?.toLowerCase().includes(q);
    }
    return true;
  });

  const tbody = document.getElementById('groups-tbody');
  if (!matches.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text3)">No hay partidos para mostrar</td></tr>`;
    return;
  }

  tbody.innerHTML = matches.map(h => {
    const o = oscarMap[h.partido] || {};
    const c = camiloMap[h.partido] || {};
    const played = h.played;

    return `<tr class="${!played ? 'not-played' : ''}">
      <td><span class="partido-num">${h.partido}</span></td>
      <td><span class="grupo-badge">${h.grupo}</span></td>
      <td>
        <div class="match-teams">
          ${h.local} <span class="match-vs">vs</span> ${h.visitante}
        </div>
      </td>
      <td class="center">
        ${played
          ? `<span class="score-real">${h.real_g_local} – ${h.real_g_visitante}</span>`
          : `<span class="score-real pending">Pendiente</span>`}
      </td>
      <td class="center" style="font-size:13px;color:var(--text2)">${h.pred_g_local ?? '?'} – ${h.pred_g_visitante ?? '?'}</td>
      <td class="center">${renderPtsPips(h, played)}</td>
      <td class="center" style="font-size:13px;color:var(--text2)">${o.pred_g_local ?? '?'} – ${o.pred_g_visitante ?? '?'}</td>
      <td class="center">${renderPtsPips(o, played)}</td>
      <td class="center" style="font-size:13px;color:var(--text2)">${c.pred_g_local ?? '?'} – ${c.pred_g_visitante ?? '?'}</td>
      <td class="center">${renderPtsPips(c, played)}</td>
    </tr>`;
  }).join('');
}

function renderPtsPips(m, played) {
  if (!played) return `<span class="pts-total pending">–</span>`;
  const pips = [
    { label: 'GL', hit: m.pts_g_local === 1 },
    { label: 'GV', hit: m.pts_g_visitante === 1 },
    { label: 'R', hit: m.pts_resultado === 1 },
    { label: 'Δ', hit: m.pts_diferencia === 1 },
  ];
  const total = m.total ?? 0;
  return `<div class="pts-cell">
    ${pips.map(p => `<div class="pts-pip ${p.hit ? 'hit' : 'miss'}" title="${p.label}">${p.hit ? '✓' : ''}</div>`).join('')}
    <span class="pts-total ${total > 0 ? 'has-pts' : 'zero'}">${total}</span>
  </div>`;
}

// =====================================================
// PLAYOFFS
// =====================================================
function renderPlayoffs() {
  const grid = document.getElementById('playoffs-grid');
  const real = appData.real_playoffs;

  grid.innerHTML = PLAYOFF_ROUNDS.map(round => {
    const realTeams = real[round] || [];
    const hasReal = realTeams.length > 0;
    const pts = PLAYOFF_PTS[round];

    const participantRows = PARTICIPANTS.map(name => {
      const data = appData.participants[name].playoffs.por_ronda[round];
      if (!data) return '';
      const color = PARTICIPANT_COLORS[name];
      const acertados = new Set(data.acertados);
      const predichos = data.predichos;
      const realSet = new Set(data.reales);

      const tags = predichos.map(t => {
        let cls = '';
        if (!hasReal) cls = '';
        else if (acertados.has(t)) cls = 'hit';
        else cls = 'miss';
        return `<span class="playoff-team-tag ${cls}">${t}</span>`;
      }).join('');

      const ptsPts = data.total_ronda;

      return `
        <div class="playoff-participant-row">
          <div class="playoff-participant-name color-${color}">${name} · ${ptsPts > 0 ? '+' + ptsPts + ' pts' : '0 pts'}</div>
          <div class="playoff-teams-list">${tags || '<span style="color:var(--text3);font-size:12px">Sin predicciones</span>'}</div>
        </div>`;
    }).join('<div style="height:8px"></div>');

    // Real teams row
    const realRow = hasReal ? `
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
        <div class="playoff-participant-name" style="color:var(--text3)">Real ✓</div>
        <div class="playoff-teams-list">
          ${realTeams.map(t => `<span class="playoff-team-tag real">${t}</span>`).join('')}
        </div>
      </div>` : '';

    return `
      <div class="playoff-round-card">
        <div class="playoff-round-header">
          <div class="playoff-round-name">${round}</div>
          <div class="playoff-round-pts"><strong>${pts}</strong> pts/equipo</div>
        </div>
        <div class="playoff-body">
          ${participantRows}
          ${realRow}
          ${!hasReal ? '<div class="playoff-no-data">⏳ Sin resultados aún</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

// =====================================================
// DETAIL
// =====================================================
function renderDetail() {
  // Tabs
  const tabs = document.getElementById('detail-tabs');
  tabs.innerHTML = PARTICIPANTS.map(name => {
    const color = PARTICIPANT_COLORS[name];
    const emoji = PARTICIPANT_EMOJIS[name];
    const isActive = name === currentDetailParticipant;
    return `<button class="detail-tab ${color} ${isActive ? 'active ' + color : ''}"
      onclick="selectDetailParticipant('${name}')">${emoji} ${name}</button>`;
  }).join('');

  renderDetailContent();
}

function selectDetailParticipant(name) {
  currentDetailParticipant = name;
  renderDetail();
}

function renderDetailContent() {
  const name = currentDetailParticipant;
  const data = appData.participants[name];
  const color = PARTICIPANT_COLORS[name];
  const el = document.getElementById('detail-content');

  const playedMatches = data.group_matches.filter(m => m.played);
  const totalPossibleGroups = playedMatches.length * 4;
  const efficiency = totalPossibleGroups > 0
    ? Math.round((data.group_total / totalPossibleGroups) * 100)
    : 0;

  el.innerHTML = `
    <div class="detail-summary">
      <div class="detail-stat">
        <div class="detail-stat-value color-${color}">${data.grand_total}</div>
        <div class="detail-stat-label">Puntos Totales</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-value">${data.group_total}</div>
        <div class="detail-stat-label">Puntos Grupos</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-value">${data.playoff_total}</div>
        <div class="detail-stat-label">Puntos Playoffs</div>
      </div>
    </div>

    <div class="section-title" style="font-size:16px;margin-bottom:12px">
      <span class="icon">⚽</span> Rendimiento por Criterio (Grupos)
    </div>
    ${renderDetailCriteria(data, color)}

    <div class="section-title" style="font-size:16px;margin:24px 0 12px">
      <span class="icon">🎯</span> Puntos Playoffs por Ronda
    </div>
    ${renderDetailPlayoffs(data)}

    <div class="section-title" style="font-size:16px;margin:24px 0 12px">
      <span class="icon">📋</span> Partidos Jugados
    </div>
    ${renderDetailMatches(data, color)}
  `;
}

function renderDetailCriteria(data, color) {
  const played = data.group_matches.filter(m => m.played);
  if (!played.length) return '<p style="color:var(--text3);font-size:14px">No hay partidos jugados aún.</p>';

  const criteria = [
    { key: 'pts_g_local', label: 'Goles Local', max: played.length },
    { key: 'pts_g_visitante', label: 'Goles Visitante', max: played.length },
    { key: 'pts_resultado', label: 'Resultado (L/E/V)', max: played.length },
    { key: 'pts_diferencia', label: 'Diferencia de Goles', max: played.length },
  ];

  return `<div style="display:flex;flex-direction:column;gap:10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
    ${criteria.map(c => {
      const hits = played.reduce((sum, m) => sum + (m[c.key] || 0), 0);
      const pct = Math.round((hits / c.max) * 100);
      return `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
            <span style="color:var(--text2)">${c.label}</span>
            <span style="font-weight:600">${hits}/${c.max} <span style="color:var(--text3);font-weight:400">(${pct}%)</span></span>
          </div>
          <div style="background:var(--surface2);border-radius:4px;height:6px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--${color});border-radius:4px;transition:width 0.5s ease"></div>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

function renderDetailPlayoffs(data) {
  const playoff = data.playoffs.por_ronda;
  const rows = PLAYOFF_ROUNDS.map(round => {
    const r = playoff[round];
    if (!r) return '';
    const pts = r.total_ronda;
    return `
      <tr>
        <td style="padding:10px 12px;font-size:14px;font-weight:500">${round}</td>
        <td style="padding:10px 12px;font-size:13px;color:var(--text2)">${r.predichos.join(', ') || '–'}</td>
        <td style="padding:10px 12px;text-align:center;font-size:13px;color:var(--green);font-weight:500">
          ${r.acertados.length > 0 ? r.acertados.join(', ') : '–'}
        </td>
        <td style="padding:10px 12px;text-align:center;font-weight:700;font-size:15px;color:${pts > 0 ? 'var(--green)' : 'var(--text3)'}">
          ${pts > 0 ? '+' + pts : '–'}
        </td>
      </tr>`;
  }).join('');

  return `<div class="table-wrapper"><table class="match-table">
    <thead><tr>
      <th>Ronda</th>
      <th>Predichos</th>
      <th class="center">Acertados</th>
      <th class="center">Puntos</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderDetailMatches(data, color) {
  const played = data.group_matches.filter(m => m.played);
  if (!played.length) return '<p style="color:var(--text3);font-size:14px">No hay partidos jugados aún.</p>';

  const rows = played.map(m => `
    <tr>
      <td style="padding:9px 12px"><span class="partido-num">${m.partido}</span></td>
      <td style="padding:9px 12px"><span class="grupo-badge">${m.grupo}</span></td>
      <td style="padding:9px 12px;font-size:13px;font-weight:500">${m.local} vs ${m.visitante}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:700">${m.real_g_local} – ${m.real_g_visitante}</td>
      <td style="padding:9px 12px;text-align:center;font-size:13px;color:var(--text2)">${m.pred_g_local} – ${m.pred_g_visitante}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:700;font-size:16px;color:${m.total > 0 ? 'var(--' + color + ')' : 'var(--text3)'}">
        ${m.total}
      </td>
    </tr>`).join('');

  return `<div class="table-wrapper"><table class="match-table">
    <thead><tr>
      <th>#</th><th>Grupo</th><th>Partido</th>
      <th class="center">Real</th>
      <th class="center">Predicción</th>
      <th class="center">Pts</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// =====================================================
// NAV
// =====================================================
let currentSection = 'leaderboard';

function showSection(name) {
  currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
}

// =====================================================
// TOAST
// =====================================================
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3000);
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Don't call showSection until data loads - loadData will call it after render
  loadData();
});
