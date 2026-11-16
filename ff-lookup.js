/* ===== Free Fire Player Info / Account Value =====
   One script for both pages (<body data-feature="info"> or "value").
   Each user gets 2 lookups per feature; when the 2nd is used the feature locks for 24 hours (live countdown). */
const FEATURE = document.body.getAttribute('data-feature') === 'value' ? 'value' : 'info';
const FETCHED_VIA = 'Fetched Via - WWW.SAKINDU.STORE';
let lkTimer = null, lkState = null, lkBusy = false, lkLast = null;

function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function isEmptyVal(v){ return v == null || v === '' || v === 'None' || v === 'null'; }
function fmtVal(v){
  if(isEmptyVal(v)) return '—';
  if(typeof v === 'boolean') return v ? 'Yes' : 'No';
  if(typeof v === 'number') return v.toLocaleString();
  return String(v).replace(/^(Gender|Language|ModePrefer|TimeActive|RankShow)_/, '');
}
function stripColors(t){ return String(t == null ? '' : t).replace(/\[(?:[0-9a-fA-F]{6}|\/?[a-zA-Z])\]/g, '').trim(); }
function prettyLabel(k){ return String(k).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function session(){ try{ return JSON.parse(localStorage.getItem('sakindu_session') || 'null'); }catch(e){ return null; } }
function apiOrigin(){ try{ return new URL(PLAYER_INFO_URL.replace('{uid}', '0')).origin; }catch(e){ return ''; } }
function $(id){ return document.getElementById(id); }

/* ---------- limit (90 per month, restarts on the 1st — admin accounts unlimited) ---------- */
async function refreshLimit(){
  const s = session();
  if(!s){ lkState = null; renderLimit(); return; }
  try{ lkState = await fsGetInfoLimit(s.phone, FEATURE); }catch(e){ console.error('[lookup] limit', e); lkState = null; }
  renderLimit();
}
function renderLimit(){
  const box = $('limitBox'), btn = $('lookupBtn'), input = $('lookupUid');
  const s = session();
  if(!s){
    box.innerHTML = `<div class="lk-login">මේ service එක භාවිත කරන්න <a href="#" onclick="openAuth('login');return false;">Login / Sign Up</a> වෙන්න.</div>`;
    btn.disabled = false; input.disabled = false; return;
  }
  if(!lkState){ box.innerHTML = '<div class="lk-meta">Loading...</div>'; return; }
  if(lkState.unlimited){
    box.innerHTML = `<div class="lk-meta">♾️ <strong>Unlimited</strong> <span>(Admin account)</span></div>`;
    btn.disabled = false; input.disabled = false; return;
  }
  if(lkState.remaining > 0){
    box.innerHTML = `<div class="lk-meta">🎟️ ඉතිරි lookups: <strong>${lkState.remaining} / ${lkState.limit}</strong> <span>(මාසයකට ${lkState.limit}ක් · හැම මාසෙම 1 වෙනිදා අලුත් වේ)</span></div>`;
    btn.disabled = false; input.disabled = false; return;
  }
  btn.disabled = true; input.disabled = true;
  const d = new Date(lkState.resetsAt + 5.5 * 3600 * 1000);
  box.innerHTML = `<div class="lk-locked"><div class="lk-lock-title">⏳ මේ මාසයේ Limit එක ඉවරයි</div><div class="lk-lock-sub">ඊළඟ මාසේ 1 වෙනිදා (${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01) නැවත ලැබේ.</div></div>`;
}

/* ---------- lookup ---------- */
async function doLookup(){
  if(lkBusy) return;
  const s = session();
  if(!s){ openAuth('login'); return; }
  const st = $('lookupStatus'), out = $('lookupResult');
  const uid = $('lookupUid').value.replace(/\D/g, '');
  $('lookupUid').value = uid;
  if(!/^\d{8,12}$/.test(uid)){ st.className = 'verify-status err'; st.textContent = '⚠️ UID එක වැරදියි. ඉලක්කම් 8-12ක් තිබිය යුතුයි.'; return; }
  if(typeof isStoreClosed === 'function' && isStoreClosed()){ st.className = 'verify-status err'; st.textContent = '🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත.'; return; }
  lkBusy = true; $('lookupBtn').disabled = true; out.innerHTML = '';
  try{
    const cur = await fsGetInfoLimit(s.phone, FEATURE);
    if(cur.remaining <= 0){ lkState = cur; renderLimit(); st.textContent = ''; return; }
    st.className = 'verify-status'; st.innerHTML = '⏳ Account එක check කරනවා... (පළමු වතාවේ තත්පර කීපයක් යා හැක)';
    const info = await lookupPlayerInfo(uid);
    if(!info.ok){ st.className = 'verify-status err'; st.textContent = info.error === 'not_found' ? '❌ මේ UID එක හොයාගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.' : '⚠️ දැනට විස්තර ගන්න බැහැ. ටිකකින් නැවත try කරන්න. (මේ උත්සාහය ගණන් ගත්තේ නැහැ)'; return; }
    if(info.fallback || !info.raw){ st.className = 'verify-status err'; st.textContent = '⚠️ Player info service එක දැනට වැඩ නැහැ. ටිකකින් නැවත try කරන්න. (මේ උත්සාහය ගණන් ගත්තේ නැහැ)'; return; }
    // only a successful lookup uses up one of the two
    const used = await fsConsumeInfoLookup(s.phone, FEATURE);
    if(!used.allowed){ lkState = used; renderLimit(); st.textContent = ''; return; }
    st.className = 'verify-status'; st.innerHTML = playerCardHtml({ nickname: stripColors(info.raw.name), level: info.raw.level, region: info.raw.region_name || info.raw.region }, uid, true);
    celebrateVerified();
    lkLast = info.raw;
    out.innerHTML = FEATURE === 'value' ? renderValue(info.raw, uid) : renderInfo(info.raw, uid);
    lkState = used.unlimited ? used : infoLimitState({ count: used.count, month: used.month }, Date.now());
    renderLimit();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e){
    console.error('[lookup]', e); st.className = 'verify-status err'; st.textContent = '❌ ' + (e.message || e);
  } finally { lkBusy = false; if(!lkState || lkState.remaining > 0) $('lookupBtn').disabled = false; }
}

/* ---------- rendering ---------- */
/* IDs / UIDs / title codes are shown exactly as they are (no thousands separators) */
function row(label, v){
  const raw = typeof v === 'number' && /\b(id|uid|ids|title)\b/i.test(label);
  return `<div class="pi-row"><span>${esc(label)}</span><strong>${esc(raw ? String(v) : fmtVal(v))}</strong></div>`;
}
function section(title, rowsHtml){ return rowsHtml ? `<div class="pi-section"><h3>${title}</h3><div class="pi-grid">${rowsHtml}</div></div>` : ''; }
function listVal(arr){ return Array.isArray(arr) && arr.length ? arr.join(', ') : null; }
function header(d, uid){
  const flag = d.region_flag ? esc(d.region_flag) + ' ' : '';
  const banner = d.banner_image && !isEmptyVal(d.banner_image) ? (String(d.banner_image).startsWith('/') ? apiOrigin() + d.banner_image : d.banner_image) : '';
  return `${banner ? `<img class="pi-banner" src="${esc(banner)}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="pi-head">
      <div class="pi-name">${esc(stripColors(d.name))}</div>
      <div class="pi-sub">UID ${esc(d.uid || uid)} · ${flag}${esc(d.region_name || d.region || '')}</div>
      <div class="pi-chips"><span>Lv ${esc(fmtVal(d.level))}</span>${d.likes != null ? `<span>❤️ ${esc(fmtVal(Number(d.likes)))}</span>` : ''}${d.exp != null ? `<span>EXP ${esc(fmtVal(d.exp))}</span>` : ''}</div>
    </div>`;
}
function footer(){ return `<div class="pi-fetched">${esc(FETCHED_VIA)}</div>`; }
/* everything the API knows about the account EXCEPT its value (that is a separate service) */
function renderInfo(d, uid){
  const br = d.battle_royale || {}, cs = d.clash_squad || {}, g = d.guild || {}, pet = d.pet || {}, eq = d.equipment || {};
  let html = header(d, uid);
  html += section('👤 Profile',
    row('Gender', d.gender) + row('Language', d.language) + row('Mode prefer', d.mode_prefer) + row('Time active', d.time_active) +
    row('Rank shown', d.rank_show) + row('Prime level', d.prime_level) + row('Credit score', d.credit_score) + row('Honor score', d.honor_score) +
    row('Title ID', d.title) + row('Signature', stripColors(d.signature)) + row('Created', d.created_at) + row('Last login', d.last_login) +
    row('Account age (days)', d.days_old) + row('Season', d.season_id) + row('Game version', d.release_version) + row('Account type', d.account_type));
  html += section('🏆 Ranks',
    row('BR tier', br.tier) + row('BR max rank', br.max_rank) + row('BR points', br.points) + row('BR current rank', br.current_rank) +
    row('CS tier', cs.tier) + row('CS max rank', cs.max_rank) + row('CS points', cs.points) + row('CS peak points', cs.peak_points));
  html += section('🛡️ Guild',
    row('Name', stripColors(g.name)) + row('Guild ID', g.id) + row('Level', g.level) +
    row('Members', g.member_count != null ? g.member_count + ' / ' + (g.capacity ?? '?') : null) +
    row('Leader', stripColors(g.leader_name)) + row('Leader UID', g.leader_uid) + row('Leader level', g.leader_level) + row('Leader likes', g.leader_likes) +
    row('Leader region', g.leader_region) + row('Leader BR max rank', g.leader_br_max_rank) + row('Leader CS max rank', g.leader_cs_max_rank) +
    row('Leader last login', g.leader_last_login) + row('Leader created', g.leader_created_at));
  html += section('🐾 Pet',
    row('Name', pet.name) + row('Level', pet.level) + row('EXP', pet.exp) + row('Pet ID', pet.id) + row('Skin ID', pet.skin_id) + row('Skill ID', pet.skill_id) + row('Selected', pet.is_selected));
  html += section('🎒 Equipment',
    row('Outfits equipped', eq.outfit_count) + row('Outfit IDs', listVal(eq.outfits)) + row('Weapons equipped', eq.weapon_count) + row('Weapon IDs', listVal(eq.weapons)) +
    row('Skill IDs', listVal(eq.skills)) + row('Avatar ID', eq.avatar_id) + row('Banner ID', eq.banner_id) + row('Booyah pass ID', eq.bp_id) + row('BP badges', eq.bp_badges));
  // every field exactly as the API lists it (value fields are left out)
  const all = (Array.isArray(d.all_fields) ? d.all_fields : Object.keys(d).filter(k => d[k] == null || typeof d[k] !== 'object').map(k => ({ key: k, label: prettyLabel(k), value: d[k] })))
    .filter(f => !/valuation|account[ _]?value|worth/i.test(f.key + ' ' + f.label));
  html += `<details class="pi-all" open><summary>📋 All fields (${all.length})</summary><div class="pi-grid">${all.map(f => row(f.label, f.key === 'signature' ? stripColors(f.value) : f.value)).join('')}</div></details>`;
  html += `<button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="downloadLookupImage(this)">⬇️ Download as Image</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="copyLookup(this)">📋 Copy summary</button>` + footer();
  return `<div class="pi-card">${html}</div>`;
}
/* Account Value: the API's amount is doubled and shown in USD + LKR (BDT is not shown). The USD -> LKR rate is set in Admin -> Store Status. */
function parseMoney(x){ if(x == null) return null; const n = parseFloat(String(x).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : null; }
function usdToLkrRate(){ return (typeof storeCache !== 'undefined' && Number(storeCache.usdToLkr) > 0) ? Number(storeCache.usdToLkr) : 300; }
function valueMoney(v){
  const usd = parseMoney(v.usd);
  if(usd == null) return null;
  const dUsd = usd * 2;
  return { usd: dUsd, lkr: Math.round(dUsd * usdToLkrRate()) };
}
function fmtUsd(n){ return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function renderValue(d, uid){
  const v = d.valuation;
  let html = header(d, uid);
  if(v && typeof v === 'object'){
    const tier = v.rarity_tier || v.tier || '';
    const known = ['usd', 'bdt', 'rarity_tier', 'tier'];
    const m = valueMoney(v);
    html += `<div class="pi-value">
        ${tier ? `<div class="pi-tier tier-${esc(String(tier).toLowerCase().replace(/[^a-z]/g, ''))}">${esc(tier)}</div>` : ''}
        <div class="pi-value-label">ACCOUNT VALUE</div>
        <div class="pi-money">${m ? 'LKR ' + m.lkr.toLocaleString('en-US') : '—'}</div>
        <div class="pi-money sub">${m ? fmtUsd(m.usd) + ' USD' : ''}</div>
      </div>`;
    const extra = Object.keys(v).filter(k => !known.includes(k)).map(k => row(prettyLabel(k), v[k])).join('');
    if(extra) html += section('📊 More', extra);
  } else {
    html += `<div class="verify-status err" style="margin-top:14px;">මේ account එකේ Value data API එකෙන් ලැබුණේ නැහැ.</div>`;
  }
  html += `<button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="downloadLookupImage(this)">⬇️ Download as Image</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="copyLookup(this)">📋 Copy summary</button>` + footer();
  return `<div class="pi-card">${html}</div>`;
}
/* Draws the whole result card (every section / field that is on screen) onto a canvas and downloads it as a PNG */
async function downloadLookupImage(btn){
  const card = document.querySelector('#lookupResult .pi-card'); if(!card) return;
  const old = btn ? btn.textContent : ''; if(btn){ btn.disabled = true; btn.textContent = '⏳ Preparing image...'; }
  try{
    try{ await document.fonts.ready; }catch(e){}
    const W = 1000, PAD = 44, FONT = 'Poppins, "Noto Sans Sinhala", Arial, sans-serif', LABEL_W = 330;
    const txt = (sel, root) => { const el = (root || card).querySelector(sel); return el ? el.textContent.trim() : ''; };
    const title = FEATURE === 'value' ? 'Free Fire Account Value' : 'Free Fire Player Info';
    const head = { name: txt('.pi-name'), sub: txt('.pi-sub'), chips: Array.from(card.querySelectorAll('.pi-chips span')).map(s => s.textContent.trim()) };
    const val = card.querySelector('.pi-value') ? { tier: txt('.pi-tier'), label: txt('.pi-value-label'), money: Array.from(card.querySelectorAll('.pi-money')).map(m => m.textContent.trim()).filter(Boolean) } : null;
    const sections = [];
    card.querySelectorAll('.pi-section, details.pi-all').forEach(sec => {
      const h = sec.matches('details') ? txt('summary', sec) : txt('h3', sec);
      const rows = Array.from(sec.querySelectorAll('.pi-row')).map(r => [r.children[0].textContent.trim(), r.children[1].textContent.trim()]);
      if(rows.length) sections.push({ title: h, rows });
    });
    const fetched = txt('.pi-fetched') || FETCHED_VIA;

    const probe = document.createElement('canvas').getContext('2d');
    function wrapLines(text, font, maxW){
      probe.font = font; const out = []; let line = '';
      String(text).split(/(\s+)/).forEach(tok => {
        if(probe.measureText(tok).width > maxW){                                  // very long token (ID lists) -> break by characters
          for(const ch of tok){ if(probe.measureText(line + ch).width > maxW){ out.push(line); line = ch; } else line += ch; }
          return;
        }
        if(probe.measureText(line + tok).width > maxW && line.trim()){ out.push(line.trim()); line = tok.trimStart(); } else line += tok;
      });
      if(line.trim()) out.push(line.trim());
      return out.length ? out : [''];
    }
    const VAL_X = PAD + LABEL_W + 18, VAL_W = W - PAD - VAL_X;
    // ---- measure ----
    let y = PAD + 100;                                                             // logo + title block
    const headerH = 150; y += headerH;
    if(val) y += 40 + 150 + 20;
    const laid = sections.map(s => ({ title: s.title, rows: s.rows.map(r => { const lines = wrapLines(r[1], '600 20px ' + FONT, VAL_W); return { label: r[0], lines, h: Math.max(1, lines.length) * 26 + 16 }; }) }));
    laid.forEach(s => { y += 58; s.rows.forEach(r => y += r.h); y += 18; });
    y += 110;
    const H = Math.ceil(y);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // ---- draw ----
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a1128'); bg.addColorStop(1, '#171040');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    // watermark (big, faint logo in the middle) + brand logo at the top
    const [logoMark, logoWide] = await Promise.all([loadImg('logo-mark.png'), loadImg('logo-header.png')]);
    if(logoMark){ const ws = Math.min(W - 160, 560); c.save(); c.globalAlpha = 0.07; c.drawImage(logoMark, (W - ws) / 2, Math.max(120, (H - ws) / 2), ws, ws); c.restore(); }
    if(logoWide){ const lh = 56, lw = logoWide.width / logoWide.height * lh; c.save(); roundRect(c, PAD, PAD - 6, lw, lh, 10); c.clip(); c.drawImage(logoWide, PAD, PAD - 6, lw, lh); c.restore(); }
    else { c.fillStyle = '#29e0e8'; c.font = '700 22px ' + FONT; c.fillText('SAKINDU TOPUP', PAD, PAD + 24); }
    c.fillStyle = '#8a9bc4'; c.font = '600 20px ' + FONT; c.textAlign = 'right'; c.fillText(title, W - PAD, PAD + 28); c.textAlign = 'left';
    let py = PAD + 76;
    // header card
    c.fillStyle = 'rgba(255,255,255,.06)'; roundRect(c, PAD, py, W - PAD * 2, headerH - 10, 22); c.fill();
    c.fillStyle = '#ffffff'; c.font = '800 40px ' + FONT; c.fillText(clip(head.name, 34), PAD + 28, py + 62);
    c.fillStyle = '#9fb0da'; c.font = '500 20px ' + FONT; c.fillText(clip(head.sub, 70), PAD + 28, py + 96);
    let cx = PAD + 28;
    head.chips.forEach(t => { c.font = '700 18px ' + FONT; const w = c.measureText(t).width + 28; c.fillStyle = 'rgba(41,224,232,.16)'; roundRect(c, cx, py + 108, w, 30, 15); c.fill(); c.fillStyle = '#7bf0f5'; c.fillText(t, cx + 14, py + 129); cx += w + 10; });
    py += headerH;
    if(val){
      py += 10;
      const g = c.createLinearGradient(PAD, py, W - PAD, py + 150); g.addColorStop(0, 'rgba(255,200,87,.22)'); g.addColorStop(1, 'rgba(124,92,255,.22)');
      c.fillStyle = g; roundRect(c, PAD, py, W - PAD * 2, 170, 22); c.fill();
      c.textAlign = 'center'; c.fillStyle = '#ffd98a'; c.font = '800 24px ' + FONT; if(val.tier) c.fillText(val.tier.toUpperCase(), W / 2, py + 40);
      c.fillStyle = '#c9d4f5'; c.font = '600 16px ' + FONT; c.fillText(val.label || 'ACCOUNT VALUE', W / 2, py + 68);
      c.fillStyle = '#ffffff'; c.font = '800 44px ' + FONT; c.fillText(val.money[0] || '—', W / 2, py + 118);
      if(val.money[1]){ c.fillStyle = '#9fb0da'; c.font = '600 22px ' + FONT; c.fillText(val.money[1], W / 2, py + 152); }
      c.textAlign = 'left'; py += 190;
    }
    laid.forEach(s => {
      c.fillStyle = '#ffffff'; c.font = '700 26px ' + FONT; c.fillText(s.title.replace(/\s*\(\d+\)\s*$/, ' ' + (s.title.match(/\(\d+\)/) || [''])[0]).trim(), PAD, py + 34);
      c.fillStyle = 'rgba(41,224,232,.5)'; c.fillRect(PAD, py + 44, 70, 3); py += 58;
      s.rows.forEach((r, i) => {
        if(i % 2 === 0){ c.fillStyle = 'rgba(255,255,255,.04)'; roundRect(c, PAD - 10, py, W - PAD * 2 + 20, r.h, 8); c.fill(); }
        c.fillStyle = '#8a9bc4'; c.font = '500 19px ' + FONT; c.fillText(clip(r.label, 30), PAD, py + 27);
        c.fillStyle = '#eaf0ff'; c.font = '600 20px ' + FONT; r.lines.forEach((ln, k) => c.fillText(ln, VAL_X, py + 27 + k * 26));
        py += r.h;
      });
      py += 18;
    });
    c.textAlign = 'center'; c.fillStyle = '#8a9bc4'; c.font = '500 20px ' + FONT; c.fillText('Check your account or top up at', W / 2, H - 58);
    c.fillStyle = '#29e0e8'; c.font = '800 26px ' + FONT; c.fillText('www.sakindu.store', W / 2, H - 24);
    cv.toBlob(blob => {
      if(!blob){ alert('Image එක හදන්න බැරි උනා.'); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `FreeFire-${FEATURE === 'value' ? 'Value' : 'Info'}-${(lkLast && lkLast.uid) || 'player'}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  }catch(e){ console.error('[lookup] image', e); alert('❌ Image එක හදන්න බැරි උනා: ' + (e.message || e)); }
  finally{ if(btn){ btn.disabled = false; btn.textContent = old; } }
  function loadImg(src){ return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  function clip(t, n){ t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
function copyLookup(btn){
  const d = lkLast; if(!d) return;
  const v = d.valuation || {};
  const lines = FEATURE === 'value'
    ? ['Free Fire Account Value', 'Name: ' + stripColors(d.name), 'UID: ' + d.uid, 'Region: ' + (d.region_name || d.region), 'Level: ' + d.level, 'Rarity: ' + (v.rarity_tier || '-'), 'Value: ' + (valueMoney(v) ? 'LKR ' + valueMoney(v).lkr.toLocaleString('en-US') + ' (' + fmtUsd(valueMoney(v).usd) + ')' : '-')]
    : ['Free Fire Player Info', 'Name: ' + stripColors(d.name), 'UID: ' + d.uid, 'Region: ' + (d.region_name || d.region), 'Level: ' + d.level, 'Likes: ' + d.likes, 'EXP: ' + d.exp,
       'BR: ' + ((d.battle_royale || {}).tier || '-') + ' (' + ((d.battle_royale || {}).points ?? '-') + ')', 'CS: ' + ((d.clash_squad || {}).tier || '-') + ' (' + ((d.clash_squad || {}).points ?? '-') + ')',
       'Guild: ' + stripColors((d.guild || {}).name || '-'), 'Created: ' + d.created_at, 'Last login: ' + d.last_login];
  lines.push(FETCHED_VIA);
  copyText(lines.join('\n'), btn);
}

/* ---------- init ---------- */
$('lookupUid').addEventListener('input', e => { const c = e.target.value.replace(/\D/g, ''); if(c !== e.target.value) e.target.value = c; });
$('lookupUid').addEventListener('keydown', e => { if(e.key === 'Enter') doLookup(); });
let lastPhone = undefined;
setInterval(() => { const s = session(); const p = s ? s.phone : null; if(p !== lastPhone){ lastPhone = p; refreshLimit(); } }, 800);
refreshLimit();
