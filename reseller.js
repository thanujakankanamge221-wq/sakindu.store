/* ===== SakinduStore — Reseller Program =====
   1) Buy a Reseller Access Key (price / days are set in Admin -> Reseller; default Rs. 500 for 30 days) from your EZ / Bank wallet.
   2) The key is generated automatically, belongs to YOU only and is never reused. Enter it to switch reseller access on until it expires.
   3) With access you can top up Free Fire (packages added by the admin) paying with Sakindu Coins (1 Coin = Rs. 1).
   Needs app.js (session, wallets, receipts) and db.js. */

const RS_DEFAULT = { keyPrice: 500, keyDays: 30, packages: [] };
let rsCfg = RS_DEFAULT, rsUser = null, rsPkgIdx = null, rsVerified = false, rsPlayer = null, rsJustBought = null;

const rsDaysLeft = until => Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000));
const rsActive = u => !!(u && u.resellerUntil && new Date(u.resellerUntil).getTime() > Date.now());
const rsDate = iso => new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

async function renderReseller(){
  const root = document.getElementById('rsRoot'); if(!root) return;
  try{ rsCfg = Object.assign({}, RS_DEFAULT, (await fsGetConfig('reseller', RS_DEFAULT)) || {}); }catch(e){}
  const s = getSession();
  const hero = `<section class="rs-hero"><div class="rs-badge">🤝 RESELLER PROGRAM</div>
    <h1>Sakindu <span>Reseller</span></h1>
    <p>Reseller Access Key එකක් අරන් Free Fire Top-ups <b>Sakindu Coins</b> වලින් (1 Coin = Rs. 1) ගන්න. Key එක දින ${rsCfg.keyDays}ක් වලංගුයි.</p></section>`;
  if(!s){
    root.innerHTML = hero + `<section class="pf-card" style="text-align:center;padding:30px 18px;">
      <div style="font-size:2.6rem;">🔐</div><h2 style="margin:8px 0 6px;">Sign In / Sign Up</h2>
      <p class="pf-muted" style="margin-bottom:16px;">Reseller Program එකට ඇතුල් වෙන්න මුලින් Login / Sign Up වෙන්න.</p>
      <button class="btn btn-primary" onclick="openAuth('login')">Sign In / Sign Up</button></section>`;
    return;
  }
  rsUser = (await fsGetUser(s.phone).catch(() => null)) || {};
  await refreshMyWallet().catch(() => {});
  renderWallet();
  if(!rsActive(rsUser)) return renderRsGate(root, hero, s);
  renderRsPanel(root, hero, s);
}

/* ---------- no access yet: buy a key / enter a key ---------- */
async function renderRsGate(root, hero, s){
  const keys = await fsGetMyResellerKeys(s.phone).catch(() => []);
  const expired = rsUser.resellerUntil && !rsActive(rsUser);
  root.innerHTML = hero + `
    ${expired ? `<div class="rs-note warn">⌛ ඔබේ Reseller access එක ${escHtml(rsDate(rsUser.resellerUntil))} දිනට expire වුණා. අලුත් Key එකක් මිලදී ගන්න.</div>` : ''}
    ${rsJustBought ? `<section class="pf-card rs-keybox"><h3>🎉 Your Reseller Access Key</h3>
      <div class="pf-code">${escHtml(rsJustBought.key)}</div>
      <p class="pf-muted" style="text-align:center;">දින ${rsJustBought.days}ක් වලංගුයි · ${escHtml(rsDate(rsJustBought.expiresAt))} දක්වා · ඔබේ account එකට පමණයි</p>
      <div class="rc-actions"><button class="btn btn-ghost" onclick="copyText('${escHtml(rsJustBought.key)}', this)">📋 Copy</button>
      <button class="btn btn-primary" onclick="rsActivate('${escHtml(rsJustBought.key)}')">⚡ Activate now</button></div></section>` : ''}
    <section class="pf-card">
      <div class="rs-price"><div><div class="pf-muted">Reseller Access Key</div><div class="rs-big">${fmtRs(rsCfg.keyPrice)}</div></div><div class="rs-days">${rsCfg.keyDays} days</div></div>
      <ul class="rs-list"><li>Free Fire Top-ups — Sakindu Coins වලින් pay කරන්න</li><li>Key එක ඔබට පමණක් — දින ${rsCfg.keyDays}කට පස්සේ අලුත් Key එකක් ගන්න ඕන</li><li>Key එක Buy කළ ගමන් auto generate වේ</li></ul>
      <div class="step-label" style="margin-top:14px;"><div class="step-num">💳</div><h3>PAY FROM</h3></div>
      <div class="pay-wallets" id="rsPayWallets"></div>
      <div class="wb-short" id="rsShort" style="display:none;margin-top:10px;"></div>
      <div class="order-total"><div>Total</div><div class="amount" id="rsTotal"></div></div>
      <button class="btn btn-primary btn-block" id="rsBuyBtn" onclick="rsBuyKey()">🔑 Reseller Access Key Buy</button>
      <div id="rsMsg" class="verify-status" style="margin-top:10px;"></div>
    </section>
    <section class="pf-card">
      <h3 style="margin-bottom:8px;">Key එකක් තියෙනවද?</h3>
      <div class="field-row"><input type="text" id="rsKeyInput" placeholder="RSK-XXXX-XXXX-XXXX" autocapitalize="characters"><button class="btn btn-primary" onclick="rsActivate()">Activate</button></div>
      <div id="rsActMsg" class="verify-status" style="margin-top:10px;"></div>
      ${keys.length ? `<div class="pf-muted" style="margin:14px 0 6px;">ඔබේ Keys</div>` + keys.map(k => `<div class="pf-dev"><div class="m">🔑</div><div style="flex:1;min-width:0;"><b style="font-family:monospace;">${escHtml(k.key)}</b><div class="pf-muted">${escHtml(rsDate(k.createdAt))} → ${escHtml(rsDate(k.expiresAt))} · ${new Date(k.expiresAt) < new Date() ? 'Expired' : (k.activated ? 'Activated' : 'Not activated')}</div></div>${new Date(k.expiresAt) > new Date() && !k.activated ? `<button class="btn btn-ghost btn-sm" onclick="rsActivate('${escHtml(k.key)}')">Activate</button>` : ''}</div>`).join('') : ''}
    </section>`;
  rsPaintKeyPay();
}
function onPayChange(){ if(document.getElementById('rsPayWallets')) rsPaintKeyPay(); }
function rsPaintKeyPay(){
  paintPayWallets('rsPayWallets', rsCfg.keyPrice, 'rsShort');
  const c = calcCharge(rsCfg.keyPrice, selectedPay);
  const t = document.getElementById('rsTotal'); if(t) t.textContent = fmtRs(c.total) + (c.fee > 0 ? ` (incl. ${fmtRs(c.fee)} charge)` : '');
}
async function rsBuyKey(){
  const s = getSession(); if(!s) return openAuth('login');
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත.'); return; }
  const msg = document.getElementById('rsMsg'), btn = document.getElementById('rsBuyBtn');
  const type = walletTypeForPay(selectedPay), ch = calcCharge(rsCfg.keyPrice, selectedPay);
  btn.disabled = true; msg.className = 'verify-status'; msg.textContent = 'Processing...';
  try{
    const rec = await fsBuyResellerKey(s.phone, type, ch.total, rsCfg.keyPrice, rsCfg.keyDays);
    setCachedBalance(s.phone, type, rec.balanceAfter); renderWallet();
    const id = Date.now();
    const order = { id, orderNo: makeOrderNo(id), createdAt: new Date(id).toISOString(), game: 'Reseller Program', uid: '-', player: '',
      package: `Reseller Access Key (${rec.days} days)`, amount: rsCfg.keyPrice, payment: selectedPay, date: new Date(id).toLocaleString(),
      userPhone: s.phone, userName: s.name || '', region: null, walletType: type, processingFee: ch.fee, totalCharged: ch.total,
      balanceBefore: round2(rec.balanceAfter + ch.total), balanceAfter: rec.balanceAfter, status: 'Approved', accessKey: rec.key };
    try{ await saveOrder(order); }catch(e){ console.error('[SakinduStore] key order record', e); }
    rsJustBought = rec;
    await renderReseller();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }catch(e){
    btn.disabled = false;
    if(e.code === 'insufficient') await showInsufficient(msg, type, ch.total);
    else { msg.className = 'verify-status err'; msg.textContent = '❌ ' + (e.message || e); }
  }
}
async function rsActivate(key){
  const s = getSession(); if(!s) return;
  const inp = document.getElementById('rsKeyInput');
  key = (key || (inp ? inp.value : '')).trim().toUpperCase();
  const msg = document.getElementById('rsActMsg') || document.getElementById('rsMsg');
  if(!key){ if(msg){ msg.textContent = 'Key එක type කරන්න.'; msg.className = 'verify-status err'; } return; }
  try{
    await fsActivateResellerKey(s.phone, key);
    rsJustBought = null;
    await renderReseller();
  }catch(e){
    if(msg){ msg.className = 'verify-status err'; msg.textContent = e.code === 'badkey' ? '❌ Key එක වැරදියි.' : e.code === 'notowner' ? '❌ මේ Key එක ඔබේ account එකට අයිති නැහැ.' : e.code === 'expired' ? '⌛ මේ Key එක expire වෙලා.' : '❌ ' + (e.message || e); }
  }
}

/* ---------- reseller panel: Sakindu Coins + Free Fire top-ups ---------- */
function renderRsPanel(root, hero, s){
  const coins = Math.floor(getWalletBalance(s.phone, 'coins'));
  const pk = (rsCfg.packages || []).filter(p => p && p.label && Number(p.coins) > 0);
  rsPkgIdx = null; rsVerified = false; rsPlayer = null;
  root.innerHTML = hero + `
    <div class="rs-note ok">✅ Reseller access active — ${escHtml(rsDate(rsUser.resellerUntil))} දක්වා (දින ${rsDaysLeft(rsUser.resellerUntil)}ක් ඉතිරියි)</div>
    <section class="pf-card rs-coins">
      <div><div class="pf-muted">🪙 Sakindu Coins</div><div class="rs-big" id="rsCoinBal">${coins.toLocaleString('en-US')}</div><div class="pf-muted">1 Coin = Rs. 1</div></div>
      <a class="btn btn-primary" href="wallet.html?target=coins">＋ Recharge Coins</a>
    </section>
    <section class="pf-card order-panel" style="padding:20px;">
      <div class="step-label"><div class="step-num">1</div><h3>FREE FIRE PLAYER ID</h3></div>
      <div class="field-row"><input type="text" id="rsUid" inputmode="numeric" placeholder="Free Fire UID *" oninput="rsUidChanged()"><button class="btn btn-primary" id="rsVerifyBtn" onclick="rsVerify()">Verify</button></div>
      <div id="rsVerifyMsg" class="verify-status"></div>
      <div class="step-label" style="margin-top:18px;"><div class="step-num">2</div><h3>SELECT PACKAGE</h3></div>
      ${pk.length ? `<div class="pkg-grid">${pk.map((p, i) => `
        <div class="pkg-card" id="rspkg-${i}" onclick="rsSelectPkg(${i})">
          <div class="pkg-visual">${p.image ? `<img class="pkg-banner" src="${p.image}" alt="${escHtml(p.label)}" loading="lazy">` : `<div class="pkg-icon" style="background:linear-gradient(135deg,#29e0e8,#7c5cff)">${escHtml(p.chip || '💎')}</div>`}</div>
          <div class="amt">${escHtml(p.label)}</div><div class="meta"><div class="lbl">Free Fire</div></div>
          <div class="price">${Math.round(p.coins).toLocaleString('en-US')} Coins</div></div>`).join('')}</div>`
        : `<div class="pf-muted" style="padding:14px 0;">Packages ඉක්මනින් add කරනවා. 🙏</div>`}
      <div class="order-total" style="margin-top:16px;"><div>Total</div><div class="amount" id="rsPkgTotal">0 Coins</div></div>
      <button class="btn btn-primary btn-block" id="rsOrderBtn" onclick="rsPlaceOrder()">🪙 Pay with Sakindu Coins</button>
      <div id="rsOrderMsg" class="verify-status" style="margin-top:10px;"></div>
    </section>
    <section class="pf-card"><h3 style="margin-bottom:8px;">My Reseller Orders</h3><div id="rsOrders"></div></section>`;
  rsRenderOrders(s);
  if(window.__bgLoad) window.__bgLoad.then(() => rsRenderOrders(s));
}
function rsRenderOrders(s){
  const el = document.getElementById('rsOrders'); if(!el) return;
  if(window.__bgReady === false){ el.innerHTML = '<div class="pf-muted">⏳ Loading...</div>'; return; }
  const mine = ordersCache.filter(o => o.userPhone === s.phone && o.walletType === 'coins');
  el.innerHTML = mine.length ? mine.map(o => `<div class="wl-hist"><div><div class="wl-hist-top"><strong>${escHtml(o.package)}</strong></div>
    <div class="wl-hist-sub">UID ${escHtml(o.uid)}${o.player ? ' · ' + escHtml(o.player) : ''} · #${escHtml(o.orderNo || o.id)}</div></div>
    <div style="text-align:right;"><div class="wl-hist-amt">${Math.round(o.amount).toLocaleString('en-US')} Coins</div><div class="status-pill ${o.status === 'Processing' ? 'status-pending' : (o.status === 'Rejected' ? 'status-rejected' : 'status-done')}">${escHtml(o.status)}</div>
    <div><button class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="showReceiptForOrder(${o.id})">🧾 Receipt</button></div></div></div>`).join('') : '<div class="pf-muted">තවම orders නැහැ.</div>';
}
function rsUidChanged(){ rsVerified = false; rsPlayer = null; const m = document.getElementById('rsVerifyMsg'); if(m){ m.textContent = ''; m.className = 'verify-status'; } }
async function rsVerify(){
  const uid = document.getElementById('rsUid').value.replace(/\D/g, '');
  const m = document.getElementById('rsVerifyMsg'), b = document.getElementById('rsVerifyBtn');
  if(!/^\d{8,12}$/.test(uid)){ m.textContent = '⚠️ නිවැරදි UID එකක් දාන්න.'; m.className = 'verify-status err'; return; }
  b.disabled = true; m.textContent = 'Checking...'; m.className = 'verify-status';
  const r = await liveVerifyBeforeOrder(uid);
  b.disabled = false;
  if(!r.ok){ m.innerHTML = r.message; m.className = 'verify-status err'; return; }
  rsVerified = true; rsPlayer = r.info && !r.info.fallback ? r.info : null;
  m.innerHTML = rsPlayer ? playerCardHtml(rsPlayer, uid, true) : '✅ UID accepted';
  if(rsPlayer) celebrateVerified();
  m.className = 'verify-status';
}
function rsSelectPkg(i){
  rsPkgIdx = i;
  document.querySelectorAll('#rsRoot .pkg-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('rspkg-' + i).classList.add('selected');
  const p = (rsCfg.packages || []).filter(x => x && x.label && Number(x.coins) > 0)[i];
  document.getElementById('rsPkgTotal').textContent = Math.round(p.coins).toLocaleString('en-US') + ' Coins';
}
async function rsPlaceOrder(){
  const s = getSession(); if(!s) return openAuth('login');
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත.'); return; }
  const msg = document.getElementById('rsOrderMsg'), btn = document.getElementById('rsOrderBtn');
  const fail = t => { msg.innerHTML = t; msg.className = 'verify-status err'; };
  const pk = (rsCfg.packages || []).filter(x => x && x.label && Number(x.coins) > 0);
  const uid = document.getElementById('rsUid').value.replace(/\D/g, '');
  if(!uid || !rsVerified) return fail('⚠️ UID එක Verify කරන්න.');
  if(rsPkgIdx == null) return fail('⚠️ Package එකක් තෝරන්න.');
  btn.disabled = true; msg.className = 'verify-status'; msg.textContent = 'Checking access...';
  try{
    const u = await fsGetUser(s.phone);                                            // access must still be valid right now
    if(!rsActive(u)){ rsUser = u || {}; btn.disabled = false; return renderReseller(); }
    const live = await liveVerifyBeforeOrder(uid);                                 // UID is re-checked on the live API before any coins are taken
    if(!live.ok){ btn.disabled = false; return fail(live.message); }
    const p = pk[rsPkgIdx], id = Date.now(), info = live.info && !live.info.fallback ? live.info : null;
    const base = { id, orderNo: makeOrderNo(id), createdAt: new Date(id).toISOString(), game: 'Free Fire (Reseller)', category: 'reseller',
      uid, player: info ? info.nickname : '', level: info ? info.level : null, playerRegion: info ? info.region : '',
      package: p.label, amount: Number(p.coins), payment: PAY_COINS, date: new Date(id).toLocaleString(), userPhone: s.phone, userName: s.name || '', region: null };
    const r = await chargeWalletAndSaveOrder(base, PAY_COINS, Number(p.coins));
    renderWallet();
    document.getElementById('rsCoinBal').textContent = Math.floor(r.balance).toLocaleString('en-US');
    msg.innerHTML = `✅ Order #${escHtml(r.order.orderNo)} place උනා — ${Math.round(r.order.totalCharged)} Coins deduct කළා.`; msg.className = 'verify-status ok';
    rsRenderOrders(s);
    showOrderReceipt(r.order, true);
  }catch(e){
    if(e.code === 'insufficient') await showInsufficient(msg, 'coins', Number((pk[rsPkgIdx] || {}).coins));
    else fail('❌ ' + escHtml((e && e.message) || e));
  }
  btn.disabled = false;
}
function onProfileLogin(){ renderReseller(); }
