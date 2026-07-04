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
// Íconos por etapa de playoff
const PLAYOFF_STAGE_ICONS = {
  'Dieciseisavos': '🎯',
  'Octavos':       '⚔️',
  'Cuartos':       '🏹',
  'Semifinal':     '⚡',
  'Tercero':       '🥉',
  'Final':         '🏅',
};
// Etapas que aparecen en el detalle (todas las rondas excepto Campeón)
const PLAYOFF_DISPLAY_ROUNDS = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercero', 'Final'];

let appData = null;
let currentGroup = 'ALL';
let currentDetailParticipant = 'Hugo';
let searchQuery = '';
let _stageId = 0;

// Stages that start collapsed (only Fase de Grupos open by default)
const collapsedStages = new Set();

function toggleStage(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('collapsed');
}

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
// ─────────────────────────────────────────────────────────
// BRACKET — flag emoji mapping (Spanish team names)
// ─────────────────────────────────────────────────────────
const TEAM_FLAGS = {
  'México': '🇲🇽', 'Sudáfrica': '🇿🇦', 'Canadá': '🇨🇦',
  'Brasil': '🇧🇷', 'Alemania': '🇩🇪', 'Paraguay': '🇵🇾',
  'Países Bajos': '🇳🇱', 'Marruecos': '🇲🇦', 'Costa de Marfil': '🇨🇮',
  'Noruega': '🇳🇴', 'Francia': '🇫🇷', 'Suecia': '🇸🇪',
  'Ecuador': '🇪🇨', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'RD Congo': '🇨🇩',
  'Bélgica': '🇧🇪', 'Senegal': '🇸🇳', 'Estados Unidos': '🇺🇸',
  'Bosnia y Herzegovina': '🇧🇦', 'España': '🇪🇸', 'Austria': '🇦🇹',
  'Portugal': '🇵🇹', 'Croacia': '🇭🇷', 'Suiza': '🇨🇭',
  'Argelia': '🇩🇿', 'Australia': '🇦🇺', 'Egipto': '🇪🇬',
  'Argentina': '🇦🇷', 'Cabo Verde': '🇨🇻', 'Colombia': '🇨🇴',
  'Ghana': '🇬🇭', 'Japón': '🇯🇵', 'Corea del Sur': '🇰🇷',
  'Uruguay': '🇺🇾', 'Chile': '🇨🇱', 'Perú': '🇵🇪',
  'Irán': '🇮🇷', 'Arabia Saudita': '🇸🇦', 'Qatar': '🇶🇦',
  'Dinamarca': '🇩🇰', 'Polonia': '🇵🇱', 'Serbia': '🇷🇸',
  'Gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Haití': '🇭🇹',
  'República Checa': '🇨🇿', 'Hungría': '🇭🇺',
  'Bielorrusia': '🇧🇾', 'Guinea': '🇬🇳', 'Camerún': '🇨🇲',
  'Nigeria': '🇳🇬', 'Túnez': '🇹🇳',
};

function renderBracket() {
  const flow     = document.getElementById('bracket-flow');
  const thirdEl  = document.getElementById('bracket-third');
  const legendEl = document.getElementById('bracket-legend');
  if (!flow) return;

  const { participants, real_playoffs, real_playoff_matches } = appData;

  // ── helpers ─────────────────────────────────────────────────────────
  const norm = s => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

  // Who advances each round (from Realidad Playoffs)
  const realByRound = {};
  ['Dieciseisavos','Octavos','Cuartos','Semifinal','Tercero','Final','Campeón'].forEach(r => {
    realByRound[r] = new Set((real_playoffs[r] || []).map(norm));
  });

  // Matches grouped by round (from Realidad Playoffs Predicciones)
  const matchesByRound = {};
  (real_playoff_matches || []).forEach(m => {
    if (!matchesByRound[m.ronda]) matchesByRound[m.ronda] = [];
    matchesByRound[m.ronda].push(m);
  });

  // Prediction data per participant per round
  function predStatus(team, ronda, participant) {
    const rd = participants[participant]?.playoffs?.por_ronda?.[ronda];
    if (!rd) return 'none';
    const t = norm(team);
    if ((rd.acertados || []).some(x => norm(x) === t)) return 'hit';
    if ((rd.predichos || []).some(x => norm(x) === t)) return 'pred';
    return 'none';
  }

  // Winner of a match:
  // 1. Compare goals directly (most reliable — no dependency on other sheets)
  // 2. Fallback: check who appeared in the next round (handles penalties / missing scores)
  function matchWinner(m, nextRonda) {
    if (!m.played) return null;
    const gl = m.g_local, gv = m.g_visitante;
    if (gl !== null && gl !== undefined && gv !== null && gv !== undefined) {
      if (gl > gv) return m.local;
      if (gv > gl) return m.visitante;
      // Draw → must have gone to penalties; use next-round presence as tiebreaker
    }
    if (!nextRonda) return null;
    const nextTeams = realByRound[nextRonda] || new Set();
    if (nextTeams.has(norm(m.local)))     return m.local;
    if (nextTeams.has(norm(m.visitante))) return m.visitante;
    return null; // can't determine yet
  }

  // Render one team slot inside a match
  function teamSlot(team, ronda, isWinner, isLoser, score = null) {
    if (!team) return `<div class="bk-team bk-unknown"><span>?</span></div>`;
    const flag  = TEAM_FLAGS[team] || '🏳️';
    const cls   = isWinner ? 'bk-winner' : isLoser ? 'bk-loser' : '';
    const badges = PARTICIPANTS.map(name => {
      const s = predStatus(team, ronda, name);
      return `<span class="bk-badge bk-badge-${s} bk-badge-${PARTICIPANT_COLORS[name]}"
        title="${name}: ${s === 'hit' ? '✅ acertó' : s === 'pred' ? '🟡 predijo' : '➖ no predijo'}"
      >${PARTICIPANT_EMOJIS[name]}</span>`;
    }).join('');
    const scoreHtml = score !== null ? `<span class="bk-score ${isWinner ? 'bk-score-win' : isLoser ? 'bk-score-lose' : ''}">${score}</span>` : '';
    return `<div class="bk-team ${cls}">
      <div class="bk-team-flag-row">
        <span class="bk-flag">${flag}</span>
        ${scoreHtml}
        ${isWinner ? '<span class="bk-win-arrow">›</span>' : ''}
      </div>
      <div class="bk-team-name-row"><span class="bk-name">${team}</span></div>
      <div class="bk-badges">${badges}</div>
    </div>`;
  }

  // Render one match pair
  function matchPair(m, ronda, nextRonda, cls = '') {
    if (!m) return `<div class="bk-match ${cls}">
      ${teamSlot(null, ronda, false, false)}
      ${teamSlot(null, ronda, false, false)}
    </div>`;
    const winner    = matchWinner(m, nextRonda);
    const localWins = winner !== null && norm(winner) === norm(m.local);
    const visWins   = winner !== null && norm(winner) === norm(m.visitante);
    // Only mark as loser when we know who won — avoids dimming both teams
    const localLoses = winner !== null && m.played && !localWins;
    const visLoses   = winner !== null && m.played && !visWins;
    const scoreL = m.played && m.g_local     != null ? m.g_local     : null;
    const scoreV = m.played && m.g_visitante != null ? m.g_visitante : null;
    return `<div class="bk-match ${cls}">
      ${teamSlot(m.local,     ronda, localWins, localLoses, scoreL)}
      ${teamSlot(m.visitante, ronda, visWins,   visLoses,   scoreV)}
    </div>`;
  }

  // Render a single-team winner advancing slot (for Octavos→Cuartos etc.)
  function winnerSlot(team, ronda, nextRonda) {
    if (!team) return `<div class="bk-winner-slot bk-unknown"><span>?</span></div>`;
    const flag  = TEAM_FLAGS[team] || '🏳️';
    const isAdvancing = nextRonda ? realByRound[nextRonda]?.has(norm(team)) : false;
    const isElim       = !isAdvancing && realByRound[ronda]?.has(norm(team)) && nextRonda && realByRound[nextRonda]?.size > 0;
    const cls   = isAdvancing ? 'bk-advancing' : isElim ? 'bk-eliminated' : '';
    const badges = PARTICIPANTS.map(name => {
      const s = predStatus(team, ronda, name);
      return `<span class="bk-badge bk-badge-${s} bk-badge-${PARTICIPANT_COLORS[name]}"
        title="${name}: ${s === 'hit' ? '✅ acertó' : s === 'pred' ? '🟡 predijo' : '➖ no predijo'}"
      >${PARTICIPANT_EMOJIS[name]}</span>`;
    }).join('');
    return `<div class="bk-winner-slot ${cls}">
      <span class="bk-flag">${flag}</span>
      <span class="bk-name">${team}</span>
      <div class="bk-badges">${badges}</div>
    </div>`;
  }

  // ── Build bracket halves ──────────────────────────────────────────────
  const r32 = matchesByRound['Dieciseisavos'] || [];
  const r16 = matchesByRound['Octavos']       || [];
  const qf  = matchesByRound['Cuartos']       || [];
  const sf  = matchesByRound['Semifinal']     || [];
  const bronzeMatches = matchesByRound['Tercero'] || [];
  const finalMatches  = matchesByRound['Final']   || [];

  // Left half: matches 1-8 (indices 0-7)
  // Right half: matches 9-16 (indices 8-15)
  const r32L = r32.slice(0, 8);
  const r32R = r32.slice(8, 16);
  const r16L = r16.slice(0, 4);
  const r16R = r16.slice(4, 8);
  const qfL  = qf.slice(0, 2);
  const qfR  = qf.slice(2, 4);
  const sfL  = sf.slice(0, 1)[0] || null;
  const sfR  = sf.slice(1, 2)[0] || null;
  const bronzeMatch = bronzeMatches[0] || null;
  const finalMatch  = finalMatches[0]  || null;

  // ── Derive missing team names from previous-round winners ────────────
  // If Excel formula cache is empty, auto-populate from known results.
  function getWinner(prevMatches, idx, prevRonda) {
    const m = prevMatches[idx];
    return m ? matchWinner(m, prevRonda) : null;
  }
  function fillTeams(matches, prevMatches, prevRonda) {
    return matches.map((m, i) => {
      if (!m) return m;
      let local     = m.local     || getWinner(prevMatches, i * 2,     prevRonda);
      let visitante = m.visitante || getWinner(prevMatches, i * 2 + 1, prevRonda);
      return {...m, local: local || '', visitante: visitante || ''};
    });
  }

  const r16L_f = fillTeams(r16L, r32L, 'Dieciseisavos');
  const r16R_f = fillTeams(r16R, r32R, 'Dieciseisavos');
  const qfL_f  = fillTeams(qfL,  r16L_f, 'Octavos');
  const qfR_f  = fillTeams(qfR,  r16R_f, 'Octavos');
  const sfL_f  = sfL ? (sfL.local && sfL.visitante ? sfL : {
    ...sfL,
    local:     sfL.local     || getWinner(qfL_f, 0, 'Cuartos'),
    visitante: sfL.visitante || getWinner(qfL_f, 1, 'Cuartos'),
  }) : null;
  const sfR_f  = sfR ? (sfR.local && sfR.visitante ? sfR : {
    ...sfR,
    local:     sfR.local     || getWinner(qfR_f, 0, 'Cuartos'),
    visitante: sfR.visitante || getWinner(qfR_f, 1, 'Cuartos'),
  }) : null;

  // ── Helper: build a column of matches ────────────────────────────────
  function buildMatchColumn(matches, ronda, nextRonda, label, pts, colCls = '') {
    const pairs = matches.map(m => matchPair(m, ronda, nextRonda)).join('');
    return `<div class="bk-col ${colCls}">
      <div class="bk-col-hdr"><span class="bk-col-label">${label}</span><span class="bk-col-pts">${pts}pts/eq</span></div>
      <div class="bk-col-matches">${pairs}</div>
    </div>`;
  }

  // ── Build champion / final center slot ───────────────────────────────
  const champion = [...realByRound['Campeón']][0] || null;
  const finalWinner = finalMatch ? matchWinner(finalMatch, 'Campeón') : null;

  function centerSlot(team, ronda, label, pts, isChamp = false) {
    if (!team) return `<div class="bk-center-slot bk-unknown ${isChamp ? 'bk-champ-slot' : ''}">
      <span class="bk-center-label">${label}</span>
      <span class="bk-question">?</span>
      <span class="bk-center-pts">${pts}pts</span>
    </div>`;
    const flag = TEAM_FLAGS[team] || '🏳️';
    const badges = PARTICIPANTS.map(name => {
      const s = predStatus(team, ronda, name);
      return `<span class="bk-badge bk-badge-${s} bk-badge-${PARTICIPANT_COLORS[name]}" title="${name}">${PARTICIPANT_EMOJIS[name]}</span>`;
    }).join('');
    return `<div class="bk-center-slot ${isChamp ? 'bk-champ-slot bk-champ-filled' : 'bk-final-team'}">
      <span class="bk-center-label">${label}</span>
      <span class="bk-flag bk-flag-lg">${flag}</span>
      <span class="bk-name">${team}</span>
      <div class="bk-badges">${badges}</div>
      ${isChamp ? '<span class="bk-trophy">🏆</span>' : ''}
    </div>`;
  }

  // ── SF single-match column ────────────────────────────────────────────
  function sfColumn(match, side) {
    if (!match) return `<div class="bk-col bk-sf-col bk-sf-${side}">
      <div class="bk-col-hdr"><span class="bk-col-label">Semifinal</span><span class="bk-col-pts">10pts/eq</span></div>
      <div class="bk-col-matches">${matchPair(null,'Semifinal','Final')}</div>
    </div>`;
    const winner     = matchWinner(match, 'Final');
    const localWins  = winner !== null && norm(winner) === norm(match.local);
    const visWins    = winner !== null && norm(winner) === norm(match.visitante);
    const localLoses = winner !== null && match.played && !localWins;
    const visLoses   = winner !== null && match.played && !visWins;
    const scoreL = match.played && match.g_local     != null ? match.g_local     : null;
    const scoreV = match.played && match.g_visitante != null ? match.g_visitante : null;
    return `<div class="bk-col bk-sf-col bk-sf-${side}">
      <div class="bk-col-hdr"><span class="bk-col-label">Semifinal</span><span class="bk-col-pts">10pts/eq</span></div>
      <div class="bk-col-matches">
        <div class="bk-match">
          ${teamSlot(match.local,     'Semifinal', localWins, localLoses, scoreL)}
          ${teamSlot(match.visitante, 'Semifinal', visWins,   visLoses,   scoreV)}
        </div>
      </div>
    </div>`;
  }

  // ── Assemble left side ────────────────────────────────────────────────
  const leftHtml = `<div class="bk-half bk-half-left">
    ${buildMatchColumn(r32L,   'Dieciseisavos', 'Octavos',  '16vos de Final',   4, 'bk-r32')}
    ${buildMatchColumn(r16L_f, 'Octavos',       'Cuartos',  'Octavos de Final', 6, 'bk-r16')}
    ${buildMatchColumn(qfL_f,  'Cuartos',       'Semifinal','Cuartos de Final', 8, 'bk-qf')}
    ${sfColumn(sfL_f, 'left')}
  </div>`;

  // ── Assemble center ───────────────────────────────────────────────────
  const finalLocalWins  = finalMatch ? (finalWinner && norm(finalWinner) === norm(finalMatch.local)) : false;
  const finalVisWins    = finalMatch ? (finalWinner && norm(finalWinner) === norm(finalMatch.visitante)) : false;

  const centerHtml = `<div class="bk-center">
    <div class="bk-center-title">🏆 Final</div>
    <div class="bk-final-match">
      ${teamSlot(finalMatch?.local,     'Final', finalLocalWins, finalMatch?.played && !finalLocalWins)}
      ${teamSlot(finalMatch?.visitante, 'Final', finalVisWins,   finalMatch?.played && !finalVisWins)}
    </div>
    ${centerSlot(champion, 'Campeón', '🌟 Campeón Mundial', '20', true)}
    <div class="bk-bronze-divider">
      <span>🥉 Partido por el 3er puesto</span>
      <span class="bk-col-pts">12pts/eq</span>
    </div>
    <div class="bk-bronze-match">
      ${matchPair(bronzeMatch, 'Tercero', null, 'bk-bronze')}
    </div>
  </div>`;

  // ── Assemble right side (reversed columns) ────────────────────────────
  const rightHtml = `<div class="bk-half bk-half-right">
    ${sfColumn(sfR_f, 'right')}
    ${buildMatchColumn(qfR_f,  'Cuartos',       'Semifinal','Cuartos de Final', 8, 'bk-qf')}
    ${buildMatchColumn(r16R_f, 'Octavos',       'Cuartos',  'Octavos de Final', 6, 'bk-r16')}
    ${buildMatchColumn(r32R,   'Dieciseisavos', 'Octavos',  '16vos de Final',   4, 'bk-r32')}
  </div>`;

  // ── Legend ─────────────────────────────────────────────────────────────
  if (legendEl) {
    const participantRows = PARTICIPANTS.map(n => `
      <tr>
        <td class="bk-leg-name">${PARTICIPANT_EMOJIS[n]} ${n}</td>
        <td><span class="bk-badge bk-badge-hit bk-badge-${PARTICIPANT_COLORS[n]}" style="width:16px;height:16px;font-size:9px">${PARTICIPANT_EMOJIS[n]}</span> <span class="bk-leg-lbl">Acertó</span></td>
        <td><span class="bk-badge bk-badge-pred bk-badge-${PARTICIPANT_COLORS[n]}" style="width:16px;height:16px;font-size:9px">${PARTICIPANT_EMOJIS[n]}</span> <span class="bk-leg-lbl">Predijo</span></td>
      </tr>`).join('');

    legendEl.innerHTML = `<div class="bk-legend-wrap">
      <div class="bk-legend-misc">
        <span><span class="bk-win-arrow">›</span> Avanzó</span>
        <span><span class="bk-loser-eliminated">Eliminado</span></span>
      </div>
      <table class="bk-legend-table">
        <tbody>${participantRows}</tbody>
      </table>
    </div>`;
  }

  flow.innerHTML = leftHtml + centerHtml + rightHtml;
  if (thirdEl) thirdEl.innerHTML = '';
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

// ── Phase helpers ─────────────────────────────────────────────────────────
function getCurrentPhaseKey() {
  const prog = appData?.tournament_progress;
  if (!prog) return 'grupos';
  if (!prog.group_stage_complete) return 'grupos';

  // Use match data instead of team counts — team counts can be populated
  // for future rounds by heal logic even while current round is in progress.
  const matches = appData?.real_playoff_matches || [];
  const order = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];
  // Expected number of matches per round
  const expected = { Dieciseisavos: 16, Octavos: 8, Cuartos: 4, Semifinal: 2, Final: 1 };

  let lastRoundWithMatches = null;

  for (const ronda of order) {
    const roundMatches = matches.filter(m => m.ronda === ronda);
    if (roundMatches.length === 0) {
      // No match rows in sheet yet → round hasn't started
      break;
    }
    const playedCount = roundMatches.filter(m => m.played).length;
    const totalExpected = expected[ronda] || roundMatches.length;
    lastRoundWithMatches = ronda;

    if (playedCount < totalExpected) {
      // Round is in progress (some or all unplayed)
      return ronda;
    }
    // All matches played → round complete, check next
  }

  // If all rounds with match rows are complete, the current phase is
  // the next one after the last completed (or the last completed if tournament done)
  if (lastRoundWithMatches) {
    const idx = order.indexOf(lastRoundWithMatches);
    return order[idx + 1] || lastRoundWithMatches;
  }

  return 'Dieciseisavos'; // groups done, R32 starting
}

function getPhaseStatus(stageKey) {
  const prog = appData?.tournament_progress;

  // Grupos: check directly via group stage progress
  if (stageKey === 'grupos') {
    if (!prog) return 'future';
    if (prog.group_stage_complete) return 'past';
    if ((prog.played_group_matches || 0) > 0) return 'current';
    return 'future';
  }

  const currentKey = getCurrentPhaseKey();
  const order = ['grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinal', 'Tercero', 'Final', 'Campeón'];
  // Tercero is tied to Final timeline
  if (stageKey === 'Tercero') {
    const rounds = prog?.real_playoffs_rounds || {};
    if ((rounds['Campeón'] || 0) > 0) return 'past';
    if ((rounds['Semifinal'] || 0) >= 4) return 'current';
    return 'future';
  }
  const currentIdx = order.indexOf(currentKey);
  const stageIdx  = order.indexOf(stageKey);
  if (currentIdx < 0 || stageIdx < 0) return 'future';
  if (stageIdx < currentIdx) return 'past';
  if (stageIdx === currentIdx) return 'current';
  return 'future';
}

// Compute per-stage points for a participant
function getStageBreakdown(p) {
  const stages = [];

  // Groups
  const groupPts = p.group_total || 0;
  stages.push({
    key: 'grupos', label: 'Grupos', icon: '⚽',
    pts: groupPts, sub: groupPts > 0 ? `Partidos: +${groupPts}` : null,
  });

  // Playoff rounds — filter match details by ronda field (works for all rounds)
  PLAYOFF_DISPLAY_ROUNDS.forEach(ronda => {
    const rd = p.playoffs?.por_ronda?.[ronda];
    const teamPts = rd?.total_ronda || 0;
    // Match-level pts for this round — filter by ronda field from API
    const matchPts = (p.playoff_match_details || [])
      .filter(m => m.ronda === ronda)
      .reduce((s, m) => s + (m.total || 0), 0);
    const total = teamPts + matchPts;
    const subs = [];
    if (matchPts > 0) subs.push(`Partidos: +${matchPts}`);
    if (teamPts > 0)  subs.push(`Equipos: +${teamPts}`);
    stages.push({
      key: ronda, label: ronda, icon: PLAYOFF_STAGE_ICONS[ronda] || '🎯',
      pts: total, sub: subs.length ? subs.join(' · ') : null,
      pending: !rd || (!rd.reales?.length),
    });
  });

  return stages;
}

function renderLeaderboard() {
  const { ranking, participants } = appData;

  // ── Podium cards ─────────────────────────────────────────────
  const podium = document.getElementById('podium-container');
  podium.innerHTML = ranking.map((r, i) => {
    const p = participants[r.name];
    const color = PARTICIPANT_COLORS[r.name];
    const emoji = PARTICIPANT_EMOJIS[r.name];
    const maxTotal = p.max_total || p.grand_total;
    const maxExtra = p.max_possible_extra || 0;
    const maxPct = Math.min(100, Math.round((p.grand_total / Math.max(maxTotal, 1)) * 100));

    // Mini stage bars inside podium card
    const stages = getStageBreakdown(p);
    const maxStagePts = Math.max(...stages.map(s => s.pts), 1);
    const stageMini = stages
      .filter(s => s.pts > 0 || !s.pending)
      .map(s => {
        const pct = Math.round((s.pts / maxStagePts) * 100);
        const phase = getPhaseStatus(s.key);
        const isCurrent = phase === 'current';
        const isPast    = phase === 'past';
        return `<div class="pm-stage-row pm-phase-${phase}">
          <span class="pm-stage-icon">${s.icon}</span>
          <div class="pm-stage-bar-wrap">
            <div class="pm-stage-bar" style="width:${pct}%;background:${isCurrent ? 'var(--green)' : `var(--${color})`};opacity:${s.pts > 0 ? (isPast ? 0.55 : 1) : 0.2}"></div>
          </div>
          <span class="pm-stage-pts ${s.pts > 0 ? (isCurrent ? 'color-green' : 'color-' + color) : 'text-dim'}">${s.pts > 0 ? '+' + s.pts : '–'}</span>
        </div>`;
      }).join('');

    return `
      <div class="podium-card rank-${i+1}">
        <div class="rank-badge">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
        <div class="podium-avatar bg-${color}">${emoji}</div>
        <div class="podium-name">${r.name}</div>
        <div class="podium-total color-${color}">${r.total}</div>
        <div class="pm-stage-breakdown">${stageMini}</div>
        ${maxExtra > 0
          ? `<div class="max-pts-bar" style="margin-top:10px">
              <span class="max-pts-label">Máx: <strong style="color:var(--text)">${maxTotal}pts</strong></span>
              <div class="max-pts-track"><div class="max-pts-fill" style="width:${maxPct}%"></div></div>
              <span class="max-pts-value" style="font-size:11px;color:var(--text2)">+${maxExtra} posibles</span>
            </div>`
          : `<div style="font-size:11px;color:var(--green);margin-top:8px">✅ Puntos finalizados</div>`}
      </div>`;
  }).join('');

  // stats-grid unused
  const statsGrid = document.getElementById('stats-grid');
  if (statsGrid) statsGrid.innerHTML = '';

  // ── Desglose por Etapa ────────────────────────────────────────
  renderBreakdownSection(participants);
}

// ── Calcula el máximo posible de puntos para una etapa dada ──────────────
function getMaxPossibleForStage(stageKey) {
  const prog = appData.tournament_progress;

  if (stageKey === 'grupos') {
    // 72 partidos × 4 pts máx cada uno (GL + GV + Resultado + Diferencia)
    return 72 * 4;
  }

  // Para rondas de playoff: puntos por equipos + puntos por partidos
  if (PLAYOFF_ROUNDS.includes(stageKey)) {
    // Equipos máximos por ronda
    const teamSlots = {
      'Dieciseisavos': 32, 'Octavos': 16, 'Cuartos': 8,
      'Semifinal': 4, 'Tercero': 2, 'Final': 2, 'Campeón': 1,
    };
    const ptsPerTeam = PLAYOFF_PTS[stageKey] || 0;
    const maxTeamPts = (teamSlots[stageKey] || 0) * ptsPerTeam;

    // Partidos por ronda × 4 pts máx por partido
    const matchSlots = {
      'Dieciseisavos': 16, 'Octavos': 8, 'Cuartos': 4,
      'Semifinal': 2, 'Tercero': 1, 'Final': 1, 'Campeón': 0,
    };
    const maxMatchPts = (matchSlots[stageKey] || 0) * 4;

    return maxTeamPts + maxMatchPts;
  }

  return 1;
}

function renderBreakdownSection(participants) {
  const el = document.getElementById('leaderboard-breakdown');
  if (!el) return;

  // Build stage data for all participants
  const allStages = getStageBreakdown(participants['Hugo']); // same keys for all
  const grandMax = Math.max(
    ...PARTICIPANTS.map(n => participants[n].grand_total), 1
  );

  // ── 1. Stage-by-stage comparison rows ──
  const stageRows = allStages.map(stageDef => {
    const values = PARTICIPANTS.map(name => ({
      name, pts: getStageBreakdown(participants[name]).find(s => s.key === stageDef.key)?.pts || 0,
      color: PARTICIPANT_COLORS[name],
      sub: getStageBreakdown(participants[name]).find(s => s.key === stageDef.key)?.sub,
    }));
    // 100% = máximo posible en esa etapa (no el mayor entre participantes)
    const maxPossible = getMaxPossibleForStage(stageDef.key);
    const leader = values.reduce((a, b) => b.pts > a.pts ? b : a);
    const hasAnyPts = values.some(v => v.pts > 0);
    const isPending = stageDef.pending && !hasAnyPts;

    const phaseStatus = getPhaseStatus(stageDef.key);
    const isCurrent   = phaseStatus === 'current';
    const isPastPhase = phaseStatus === 'past';

    const bars = values.map(v => {
      const pct = maxPossible > 0 ? Math.round((v.pts / maxPossible) * 100) : 0;
      const isLeader = v.pts === leader.pts && v.pts > 0;
      const ptsLabel = v.pts > 0
        ? `${v.pts} / ${maxPossible} pts`
        : (isPending ? '⏳' : `0 / ${maxPossible} pts`);
      const barColor = isCurrent ? 'var(--green)' : `var(--${v.color})`;
      const barOpacity = isPastPhase ? 0.5 : 1;
      const labelCls = v.pts > 0 ? (isCurrent ? 'color-green' : 'color-' + v.color) : 'bs-pts-dim';
      return `<div class="bs-participant">
        <div class="bs-participant-name color-${v.color}">${PARTICIPANT_EMOJIS[v.name]} ${v.name}</div>
        <div class="bs-bar-row">
          <div class="bs-bar-track">
            <div class="bs-bar-fill" style="width:${hasAnyPts ? pct : 0}%;background:${barColor};opacity:${barOpacity}"></div>
          </div>
          <span class="bs-pts ${labelCls}">
            ${ptsLabel}
            ${isLeader && values.filter(x => x.pts === leader.pts).length === 1 ? '<span class="bs-crown">👑</span>' : ''}
          </span>
        </div>
        ${v.sub ? `<div class="bs-sub">${v.sub}</div>` : ''}
      </div>`;
    }).join('');

    const currentBadge = isCurrent
      ? '<span class="bs-current-badge">● En curso</span>'
      : '';

    return `<div class="bs-stage-card ${isPending ? 'bs-pending' : ''} bs-phase-${phaseStatus}">
      <div class="bs-stage-header">
        <span class="bs-stage-icon">${stageDef.icon}</span>
        <span class="bs-stage-label">${stageDef.label}</span>
        ${isPending ? '<span class="bs-pending-badge">⏳ Pendiente</span>' : ''}
        ${currentBadge}
      </div>
      <div class="bs-participants">${bars}</div>
    </div>`;
  }).join('');

  // ── 2. Summary comparison table ──
  const tableRows = allStages.map(stageDef => {
    const cells = PARTICIPANTS.map(name => {
      const pts = getStageBreakdown(participants[name]).find(s => s.key === stageDef.key)?.pts || 0;
      const color = PARTICIPANT_COLORS[name];
      const colPts = PARTICIPANTS.map(n => getStageBreakdown(participants[n]).find(s => s.key === stageDef.key)?.pts || 0);
      const isMax = pts === Math.max(...colPts) && pts > 0;
      const isMin = pts === Math.min(...colPts) && pts < Math.max(...colPts) && pts >= 0;
      return `<td class="bs-table-cell ${isMax ? 'bs-cell-max' : isMin ? 'bs-cell-min' : ''}">
        <span style="color:var(--${color})">${pts > 0 ? '+' + pts : '–'}</span>
      </td>`;
    }).join('');
    return `<tr>
      <td class="bs-table-stage">${stageDef.icon} ${stageDef.label}</td>
      ${cells}
    </tr>`;
  }).join('');

  // Totals row
  const totalCells = PARTICIPANTS.map(name => {
    const color = PARTICIPANT_COLORS[name];
    return `<td class="bs-table-cell bs-table-total"><span style="color:var(--${color})">${participants[name].grand_total}</span></td>`;
  }).join('');

  // ── 3. Stacked total bar per participant ──
  const stackedBars = PARTICIPANTS.map(name => {
    const p = participants[name];
    const color = PARTICIPANT_COLORS[name];
    const pct = Math.round((p.grand_total / grandMax) * 100);
    const groupPct = Math.round((p.group_total / Math.max(p.grand_total, 1)) * 100);
    return `<div class="bs-total-bar-block">
      <div class="bs-total-bar-label color-${color}">${PARTICIPANT_EMOJIS[name]} ${name}</div>
      <div class="bs-total-bar-track">
        <div class="bs-total-bar-fill" style="width:${pct}%;background:var(--${color})">
          <div class="bs-total-bar-group" style="width:${groupPct}%;background:rgba(255,255,255,0.15)"></div>
        </div>
      </div>
      <span class="bs-total-pts color-${color}">${p.grand_total} pts</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="bs-section">
      <div class="bs-section-title">
        <span class="icon">📊</span> Desglose por Etapa
        <span class="bs-title-sub">Puntos obtenidos vs. máximo posible por fase</span>
      </div>

      <!-- Stage cards grid -->
      <div class="bs-stages-grid">${stageRows}</div>

      <!-- Total stacked bars -->
      <div class="bs-totals-card">
        <div class="bs-totals-title">⚖️ Comparativa Total</div>
        <div class="bs-totals-bars">${stackedBars}</div>
      </div>

      <!-- Summary table -->
      <div class="bs-table-card">
        <div class="bs-totals-title">📋 Tabla Resumen</div>
        <div class="table-wrapper">
          <table class="bs-summary-table">
            <thead><tr>
              <th>Etapa</th>
              ${PARTICIPANTS.map(n => `<th class="color-${PARTICIPANT_COLORS[n]}">${PARTICIPANT_EMOJIS[n]} ${n}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${tableRows}
              <tr class="bs-total-row">
                <td class="bs-table-stage"><strong>🏆 Total</strong></td>
                ${totalCells}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
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
  `).join('');
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

  // Apply phase styling to the static "Fase de Grupos" accordion in index.html
  const gruposSection = document.getElementById('groups-stage-grupos');
  if (gruposSection) {
    const phase = getPhaseStatus('grupos');
    gruposSection.classList.remove('dss-phase-past', 'dss-phase-current', 'dss-phase-future');
    gruposSection.classList.add(`dss-phase-${phase}`);
    const header = gruposSection.querySelector('.detail-stage-header');
    if (header) {
      // Remove any existing badge
      header.querySelectorAll('.detail-phase-badge').forEach(b => b.remove());
      let badge = '';
      if (phase === 'past')    badge = '<span class="detail-phase-badge detail-phase-past">✓ Finalizada</span>';
      if (phase === 'current') badge = '<span class="detail-phase-badge detail-phase-current">● En curso</span>';
      if (badge) {
        const chevron = header.querySelector('.detail-stage-chevron');
        chevron.insertAdjacentHTML('beforebegin', badge);
      }
    }
  }

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
  } else {
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

  // ── Playoff stage sections below the group matches table ──
  const playoffContainer = document.getElementById('groups-playoff-stages');
  if (!playoffContainer) return;

  const allMatches = (appData.playoff_all_matches || []).filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery;
    return m.local.toLowerCase().includes(q) || m.visitante.toLowerCase().includes(q);
  });
  if (!allMatches.length && searchQuery) {
    playoffContainer.innerHTML = `<p class="stage-empty" style="padding:16px 0;text-align:center">No hay partidos de playoff que coincidan con "${searchQuery}"</p>`;
    return;
  }
  if (!allMatches.length) {
    playoffContainer.innerHTML = '';
    return;
  }

  // Build stage sections — filter allMatches by ronda field (backend now provides it)
  const stageConfigs = [
    { key: 'Dieciseisavos', icon: '🎯', label: 'Partidos de Dieciseisavos' },
    { key: 'Octavos',       icon: '⚔️', label: 'Partidos de Octavos de Final' },
    { key: 'Cuartos',       icon: '🏹', label: 'Partidos de Cuartos de Final' },
    { key: 'Semifinal',     icon: '⚡', label: 'Partidos de Semifinal' },
    { key: 'Tercero',       icon: '🥉', label: 'Partido por el Tercer Puesto' },
    { key: 'Final',         icon: '🏅', label: 'Partido de la Final' },
  ];

  const stagesHtml = stageConfigs.map((cfg, si) => {
    // Filter matches for this specific round using the ronda field from the API
    const stageMatches = allMatches.filter(m => m.ronda === cfg.key);

    let content;
    if (!stageMatches.length) {
      content = '<p class="stage-empty">Sin partidos en esta ronda aún.</p>';
    } else {
      const playedCount = stageMatches.filter(m => m.played).length;
      const rows = stageMatches.map(m => {
        const played = m.played;
        const realStr = played
          ? `<span class="score-real">${m.real_g_local} – ${m.real_g_visitante}</span>`
          : '<span class="score-real pending">Pendiente</span>';

        const participantCols = PARTICIPANTS.map(name => {
          const p = m.participants[name];
          const predStr = (p.pred_g_local !== null && p.pred_g_visitante !== null)
            ? `${p.pred_g_local} – ${p.pred_g_visitante}`
            : '<span style="color:var(--text3)">?</span>';
          const pip = renderPtsPips({
            pts_g_local:     p.pts_g_local,
            pts_g_visitante: p.pts_g_visitante,
            pts_resultado:   p.pts_resultado,
            pts_diferencia:  p.pts_diferencia,
            total:           p.total,
          }, played);
          return `<td class="center" style="font-size:13px;color:var(--text2)">${predStr}</td><td class="center">${pip}</td>`;
        }).join('');

        return `<tr class="${!played ? 'not-played' : ''}">
          <td><span class="partido-num">${m.partido}</span></td>
          <td style="font-size:13px;font-weight:500">${m.local} <span class="match-vs">vs</span> ${m.visitante}</td>
          <td class="center">${realStr}</td>
          ${participantCols}
        </tr>`;
      }).join('');

      content = `<div class="table-wrapper"><table class="match-table playoff-group-table">
        <thead>
          <tr>
            <th rowspan="2">#</th>
            <th rowspan="2">Partido</th>
            <th rowspan="2" class="center">Resultado Real</th>
            ${PARTICIPANTS.map(n => `<th colspan="2" class="center participant-header-${PARTICIPANT_COLORS[n]}">${PARTICIPANT_EMOJIS[n]} ${n}</th>`).join('')}
          </tr>
          <tr>
            ${PARTICIPANTS.map(() => '<th class="center" style="font-size:10px">PRED.</th><th class="center" style="font-size:10px">PTS</th>').join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div style="margin-top:8px;display:flex;gap:16px;font-size:12px;color:var(--text3);padding:0 4px">
        <span>${playedCount}/${stageMatches.length} partidos jugados</span>
        ${PARTICIPANTS.map(name => {
          const total = stageMatches.reduce((s, m) => s + (m.participants[name]?.total || 0), 0);
          return `<span style="color:var(--${PARTICIPANT_COLORS[name]})"><strong>${name}:</strong> ${total} pts</span>`;
        }).join('')}
      </div>`;
    }

    // All playoff stages start collapsed except Octavos (most recently completed phase)
    const id = `groups-stage-${cfg.key}`;
    const collapsed = cfg.key === 'Octavos' ? '' : ' collapsed';
    const phaseStatus = getPhaseStatus(cfg.key);
    const phaseBadge = phaseStatus === 'current'
      ? '<span class="detail-phase-badge detail-phase-current">● En curso</span>'
      : phaseStatus === 'past'
      ? '<span class="detail-phase-badge detail-phase-past">✓ Finalizada</span>'
      : '';
    return `<div class="detail-stage-section${collapsed} dss-phase-${phaseStatus}" id="${id}">
      <div class="detail-stage-header" onclick="toggleStage('${id}')">
        <span class="detail-stage-icon">${cfg.icon}</span>
        <span class="detail-stage-label">${cfg.label}</span>
        ${phaseBadge}
        <span class="detail-stage-chevron">&#8250;</span>
      </div>
      <div class="detail-stage-content">${content}</div>
    </div>`;
  }).join('');

  playoffContainer.innerHTML = `<div class="section-title" style="font-size:16px;margin:32px 0 16px">
    <span class="icon">🎯</span> Partidos de Playoffs
  </div>
  <div class="detail-stages-container">${stagesHtml}</div>`;
}

function renderPtsPips(m, played) {
  if (!played) return `<span class="pts-total pending">–</span>`;
  const pips = [
    { label: 'GL', hit: m.pts_g_local > 0 },
    { label: 'GV', hit: m.pts_g_visitante > 0 },
    { label: 'R',  hit: m.pts_resultado > 0 },
    { label: 'Δ',  hit: m.pts_diferencia > 0 },
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

    <div class="section-title" style="font-size:16px;margin-bottom:16px">
      <span class="icon">⚽</span> Rendimiento por Criterio
    </div>
    ${renderDetailCriteria(data, color)}

    <div class="section-title" style="font-size:16px;margin:28px 0 16px">
      <span class="icon">📋</span> Partidos Jugados
    </div>
    ${renderDetailMatches(data, color)}
  `;
}

// Helper: renders a collapsible stage accordion block
function renderDetailStageBlock(icon, label, contentHtml, startCollapsed = false, phaseStatus = 'future') {
  const id = `stage-${++_stageId}`;
  const cls = startCollapsed ? 'detail-stage-section collapsed' : 'detail-stage-section';
  const currentBadge = phaseStatus === 'current'
    ? '<span class="detail-phase-badge detail-phase-current">● En curso</span>'
    : phaseStatus === 'past'
    ? '<span class="detail-phase-badge detail-phase-past">✓ Finalizada</span>'
    : '';
  return `<div class="${cls} dss-phase-${phaseStatus}" id="${id}">
    <div class="detail-stage-header" onclick="toggleStage('${id}')">
      <span class="detail-stage-icon">${icon}</span>
      <span class="detail-stage-label">${label}</span>
      ${currentBadge}
      <span class="detail-stage-chevron">&#8250;</span>
    </div>
    <div class="detail-stage-content">${contentHtml}</div>
  </div>`;
}

function renderDetailCriteria(data, color) {
  let html = '<div class="detail-stages-container">';

  // Helper: build GL/GV/R/Δ bars from an array of played match objects
  function buildCriteriaBars(playedMatches) {
    const criteria = [
      { key: 'pts_g_local',     label: 'Goles Local' },
      { key: 'pts_g_visitante', label: 'Goles Visitante' },
      { key: 'pts_resultado',   label: 'Resultado (L/E/V)' },
      { key: 'pts_diferencia',  label: 'Diferencia de Goles' },
    ];
    const n = playedMatches.length;
    return criteria.map(c => {
      const hits = playedMatches.reduce((s, m) => s + (m[c.key] || 0), 0);
      const pct  = n > 0 ? Math.round((hits / n) * 100) : 0;
      return `<div class="criteria-row">
        <div class="criteria-label-row">
          <span style="color:var(--text2)">${c.label}</span>
          <span style="font-weight:600">${hits}/${n} <span style="color:var(--text3);font-weight:400">(${pct}%)</span></span>
        </div>
        <div class="criteria-track">
          <div class="criteria-fill" style="width:${pct}%;background:var(--${color})"></div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Fase de grupos ──
  const played = data.group_matches.filter(m => m.played);
  if (!played.length) {
    html += renderDetailStageBlock('⚽', 'Fase de grupos',
      '<p class="stage-empty">No hay partidos jugados aún.</p>', true, getPhaseStatus('grupos'));
  } else {
    html += renderDetailStageBlock('⚽', 'Fase de grupos', buildCriteriaBars(played), true, getPhaseStatus('grupos'));
  }

  // ── Playoff rounds ──
  PLAYOFF_DISPLAY_ROUNDS.forEach(ronda => {
    const icon = PLAYOFF_STAGE_ICONS[ronda] || '🎯';
    const rd   = data.playoffs?.por_ronda?.[ronda];

    // Match-level data for this round — filter by ronda field from the API
    const matchDetails  = (data.playoff_match_details || []).filter(m => m.ronda === ronda);
    const playedMatches = matchDetails.filter(m => m.played);

    let content;

    if (!rd || (!rd.predichos.length && !rd.reales.length)) {
      content = '<p class="stage-empty">Sin datos para esta ronda a\u00fan.</p>';

    } else if (rd.predichos.length && !rd.reales.length) {
      // Round not yet played — show match criteria if available, else pending
      if (playedMatches.length > 0) {
        content = buildCriteriaBars(playedMatches) +
          `<p class="stage-empty" style="margin-top:10px">⏳ Equipos: ronda pendiente de confirmar.</p>`;
      } else {
        content = `<p class="stage-empty">⏳ ${rd.predichos.length} equipos predichos — Ronda pendiente de jugarse.</p>`;
      }

    } else {
      // Round has real results
      let parts = '';

      // 1. Match-level GL/GV/R/Δ bars (if any matches played)
      if (playedMatches.length > 0) {
        parts += `<div class="criteria-section-label">Partidos (${playedMatches.length}/${matchDetails.length} jugados)</div>`;
        parts += buildCriteriaBars(playedMatches);
        parts += `<div class="criteria-divider"></div>
          <div class="criteria-section-label">Equipos que avanzan</div>`;
      }

      // 2. Team advancement bar (always present when rd.reales exists)
      const hits  = rd.acertados.length;
      const total = rd.predichos.length;
      const pct   = total > 0 ? Math.round((hits / total) * 100) : 0;
      parts += `<div class="criteria-row">
        <div class="criteria-label-row">
          <span style="color:var(--text2)">Equipos acertados</span>
          <span style="font-weight:600">${hits}/${total} <span style="color:var(--text3);font-weight:400">(${pct}%)</span></span>
        </div>
        <div class="criteria-track">
          <div class="criteria-fill" style="width:${pct}%;background:var(--${color})"></div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-top:10px">
        Puntos ganados: <strong style="color:var(--${color})">${rd.total_ronda}</strong> pts · ${rd.puntos_por_acierto} pts/equipo
      </div>`;

      content = parts;
    }

    const startCollapsed = ronda !== 'Octavos';
    html += renderDetailStageBlock(icon, ronda, content, startCollapsed, getPhaseStatus(ronda));
  });

  html += '</div>';
  return html;
}

function renderDetailMatches(data, color) {
  const norm = s => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
  let html = '<div class="detail-stages-container">';

  // ── Fase de grupos ──
  const played = data.group_matches.filter(m => m.played);
  let groupContent;
  if (!played.length) {
    groupContent = '<p class="stage-empty">No hay partidos jugados aún.</p>';
  } else {
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
    groupContent = `<div class="table-wrapper"><table class="match-table">
      <thead><tr>
        <th>#</th><th>Grupo</th><th>Partido</th>
        <th class="center">Real</th>
        <th class="center">Predicción</th>
        <th class="center">Pts</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }
  html += renderDetailStageBlock('⚽', 'Fase de grupos', groupContent, true, getPhaseStatus('grupos'));

  // ── Playoff rounds ──
  PLAYOFF_DISPLAY_ROUNDS.forEach(ronda => {
    const icon      = PLAYOFF_STAGE_ICONS[ronda] || '🎯';
    const rd        = data.playoffs?.por_ronda?.[ronda];
    const predichos = rd?.predichos || [];
    const reales    = rd?.reales   || [];
    const acertadosNorm = new Set((rd?.acertados || []).map(norm));
    const hasReal   = reales.length > 0;
    const ptsPerHit = rd?.puntos_por_acierto || PLAYOFF_PTS[ronda] || 0;

    // Match-level data for this round — filter by ronda field from the API
    const matchDetails = (data.playoff_match_details || []).filter(m => m.ronda === ronda);

    // Table 1: match-by-match (Real vs Pred vs Pts)
    let matchTable = '';
    if (matchDetails.length > 0) {
      const matchRows = matchDetails.map(m => {
        const predStr = (m.pred_g_local !== null && m.pred_g_visitante !== null)
          ? `${m.pred_g_local} – ${m.pred_g_visitante}`
          : '<span style="color:var(--text3)">Sin pred.</span>';
        const realStr = m.played
          ? `<strong>${m.real_g_local} – ${m.real_g_visitante}</strong>`
          : '<span style="color:var(--text3)">Pendiente</span>';
        const ptsColor = m.total > 0 ? `var(--${color})` : 'var(--text3)';
        const ptsStr = m.played ? m.total : '–';
        return `<tr class="${!m.played ? 'not-played' : ''}">
          <td style="padding:8px 12px"><span class="partido-num">${m.partido}</span></td>
          <td style="padding:8px 12px;font-size:13px;font-weight:500">${m.local} vs ${m.visitante}</td>
          <td style="padding:8px 12px;text-align:center">${realStr}</td>
          <td style="padding:8px 12px;text-align:center;font-size:13px;color:var(--text2)">${predStr}</td>
          <td style="padding:8px 12px;text-align:center;font-weight:700;font-size:15px;color:${ptsColor}">${ptsStr}</td>
        </tr>`;
      }).join('');

      const playedCount = matchDetails.filter(m => m.played).length;
      const totalPts = matchDetails.reduce((s, m) => s + (m.total || 0), 0);

      matchTable = `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text3);margin-bottom:8px">Partidos</div>
        <div class="table-wrapper"><table class="match-table">
          <thead><tr>
            <th>#</th>
            <th>Partido</th>
            <th class="center">Real</th>
            <th class="center">Predicción</th>
            <th class="center">Pts</th>
          </tr></thead>
          <tbody>${matchRows}</tbody>
        </table></div>
        ${playedCount > 0 ? `<div class="stage-total-row" style="margin-top:8px">
          <span style="color:var(--text3)">${playedCount}/${matchDetails.length} partidos jugados:</span>
          <span style="color:var(--${color});font-weight:700">+${totalPts} pts</span>
        </div>` : ''}
        <div style="margin:20px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text3)">Equipos predichos que avanzan</div>`;
    }

    // Table 2: team advancement (existing)
    let advTable = '';
    if (!predichos.length && !reales.length) {
      advTable = '<p class="stage-empty">Sin datos para esta ronda aún.</p>';
    } else if (!predichos.length) {
      advTable = '<p class="stage-empty">Sin predicciones para esta ronda.</p>';
    } else {
      const rows = predichos.map((equipo, i) => {
        const isHit       = hasReal && acertadosNorm.has(norm(equipo));
        const isMiss      = hasReal && !isHit;
        const earnedPts   = isHit ? ptsPerHit : 0;
        const statusIcon  = !hasReal ? '⏳' : (isHit ? '✓' : '✗');
        const statusColor = !hasReal ? 'var(--text3)' : (isHit ? 'var(--green)' : 'var(--red,#ef4444)');
        return `<tr class="${isMiss ? 'not-played' : ''}">
          <td style="padding:9px 12px"><span class="partido-num">${i + 1}</span></td>
          <td style="padding:9px 12px;font-size:13px;font-weight:500">${equipo}</td>
          <td style="padding:9px 12px;text-align:center;font-size:16px;color:${statusColor};font-weight:700">${statusIcon}</td>
          <td style="padding:9px 12px;text-align:center;font-weight:700;font-size:16px;color:${earnedPts > 0 ? 'var(--' + color + ')' : 'var(--text3)'}">
            ${hasReal ? earnedPts : '–'}
          </td>
        </tr>`;
      }).join('');

      advTable = `<div class="table-wrapper"><table class="match-table">
        <thead><tr>
          <th>#</th>
          <th>Equipo predicho</th>
          <th class="center">¿Avanzó?</th>
          <th class="center">Pts</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;

      if (hasReal) {
        advTable += `<div class="stage-total-row">
          <span style="color:var(--text3)">Total equipos acertados:</span>
          <span style="color:var(--${color});font-weight:700">+${rd.total_ronda} pts</span>
        </div>`;
      }
    }

    const content = matchTable + advTable;
    const startCollapsed = ronda !== 'Octavos';
    html += renderDetailStageBlock(icon, ronda, content, startCollapsed, getPhaseStatus(ronda));
  });

  html += '</div>';
  return html;
}


// =====================================================
// NAV
// =====================================================
let currentSection = 'leaderboard';
let winnerAnimationPlayed = false;

function triggerWinnerAnimation(winnerName) {
  if (winnerAnimationPlayed) return;
  if (typeof confetti === 'undefined') return;
  winnerAnimationPlayed = true;

  const flagEmoji = TEAM_FLAGS[winnerName] || '🏆';
  let flagShape;
  try {
    flagShape = confetti.shapeFromText({ text: flagEmoji, scalar: 4 });
  } catch(e) {
    flagShape = 'circle'; // fallback if shapeFromText not supported
  }

  const duration = 5000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'],
      shapes: [flagShape, 'square', 'circle']
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'],
      shapes: [flagShape, 'square', 'circle']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}


function showSection(name) {
  currentSection = name;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
  
  if (name === 'bracket' && typeof appData !== 'undefined' && appData.real_playoffs && appData.real_playoffs['Campeón'] && appData.real_playoffs['Campeón'].length > 0) {
    triggerWinnerAnimation(appData.real_playoffs['Campeón'][0]);
  }
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
