/* ===== SakinduStore — Rare UID shop =====
   Admin lists rare UIDs (Admin -> Rare UIDs). A customer pays from the EZ Cash / Bank wallet; the purchase is one atomic database
   transaction, so the moment ONE person buys a UID it becomes SOLD OUT for everybody else and belongs to that buyer only. */

let rareList = [], rareBuying = null, rareTimer = null;

async function loadRare(){
  try{ rareList = await fsGetRareUids(); }catch(e){ console.error('[SakinduStore] rare uids', e); document.getElementById('rareRoot').innerHTML = '<p style="color:var(--muted);text-align:center;padding:30px;">Rare UIDs load කරන්න බැරි උනා.</p>'; return; }
  renderRare();
}
function renderRare(){
  const root = document.getElementById('rareRoot'); if(!root) return;
  const term = (document.getElementById('rareSearch').value || '').replace(/\D/g, '');
  const sort = document.getElementById('rareSort').value;
  const match = r => !term || String(r.uid).indexOf(term) >= 0;
  const avail = rareList.filter(r => r.status === 'available' && match(r)).sort((a, b) => sort === 'asc' ? a.price - b.price : b.price - a.price);
  const sold = rareList.filter(r => r.status !== 'available' && match(r)).sort((a, b) => String(b.soldAt || '').localeCompare(String(a.soldAt || ''))).slice(0, 12);
  const card = r => {
    const isSold = r.status !== 'available';
    return `<div class="rare-card ${isSold ? 'sold' : ''}">
      ${isSold ? '<div class="rare-stamp">SOLD OUT</div>' : ''}
      ${r.label ? `<div class="rare-tag">${escHtml(r.label)}</div>` : '<div class="rare-tag ghost">&nbsp;</div>'}
      <div class="rare-uid">${escHtml(r.uid)}</div>
      <div class="rare-price">${fmtRs(r.price)}</div>
      ${isSold ? '<button class="btn btn-ghost btn-block" disabled>Sold Out</button>' : `<button class="btn btn-primary btn-block" onclick="openRareBuy('${r._id}')">🛒 Buy Now</button>`}
    </div>`;
  };
  root.innerHTML = (avail.length ? `<div class="rare-grid">${avail.map(card).join('')}</div>` : `<div class="rare-empty">${term ? 'මේ search එකට UID එකක් නැහැ.' : '💎 දැනට Rare UID නැහැ. ඉක්මනින් අලුත් ඒවා එකතු වේ!'}</div>`)
    + (sold.length ? `<h3 class="rare-sold-h">Recently Sold</h3><div class="rare-grid">${sold.map(card).join('')}</div>` : '');
}

/* ---------- buy ---------- */
function onPayChange(){ if(rareBuying) paintRareBuy(); }
function paintRareBuy(){
  paintPayWallets('rarePayWallets', rareBuying.price, 'rareShort');
  const c = calcCharge(rareBuying.price, selectedPay);
  const t = document.getElementById('rareTotal'); if(t) t.textContent = fmtRs(c.total) + (c.fee > 0 ? ` (incl. ${fmtRs(c.fee)} charge)` : '');
}
function openRareBuy(docId){
  const s = getSession();
  if(!s){ alert('⚠️ මිලදී ගන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  const r = rareList.find(x => x._id === docId); if(!r) return;
  rareBuying = r;
  let ov = document.getElementById('rareBuyOverlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'rareBuyOverlay'; ov.className = 'modal-overlay';
    ov.addEventListener('click', e => { if(e.target === ov) closeRareBuy(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="modal" style="max-width:430px;max-height:92vh;overflow-y:auto;">
    <button class="close-x" onclick="closeRareBuy()">✕</button>
    <h3>💎 Buy Rare UID</h3>
    <div class="rare-uid" style="text-align:center;margin:10px 0 2px;font-size:1.9rem;">${escHtml(r.uid)}</div>
    ${r.label ? `<div style="text-align:center;"><span class="rare-tag">${escHtml(r.label)}</span></div>` : ''}
    <div class="rare-price" style="text-align:center;margin:6px 0 14px;">${fmtRs(r.price)}</div>
    <input type="tel" id="rareContact" inputmode="numeric" placeholder="ඔබේ WhatsApp Number *" value="${escHtml((usersCache[s.phone] || {}).phone || s.phone || '')}">
    <div class="step-label" style="margin-top:12px;"><div class="step-num">💳</div><h3>PAY FROM</h3></div>
    <div class="pay-wallets" id="rarePayWallets"></div>
    <div class="wb-short" id="rareShort" style="display:none;margin-top:10px;"></div>
    <div class="order-total"><div>Total</div><div class="amount" id="rareTotal"></div></div>
    <button class="btn btn-primary btn-block" id="rareBuyBtn" onclick="confirmRareBuy()">Confirm &amp; Pay</button>
    <div id="rareMsg" class="verify-status" style="margin-top:10px;"></div>
    <p class="pf-muted" style="margin-top:10px;line-height:1.6;">මිලදී ගත් පසු මේ UID එක ඔබට පමණක් අයිති වී අනිත් අයට Sold Out වේ. Admin ඔබට WhatsApp එකෙන් සම්බන්ධ වේ.</p></div>`;
  ov.classList.add('show');
  paintRareBuy();
  refreshMyWallet().then(() => { if(rareBuying) paintRareBuy(); }).catch(() => {});
}
function closeRareBuy(){ const ov = document.getElementById('rareBuyOverlay'); if(ov) ov.classList.remove('show'); rareBuying = null; }

async function confirmRareBuy(){
  const s = getSession(); if(!s) return openAuth('login');
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත.'); return; }
  const msg = document.getElementById('rareMsg'), btn = document.getElementById('rareBuyBtn');
  const contact = (document.getElementById('rareContact').value || '').replace(/[\s-]/g, '');
  if(!/^\+?\d{9,13}$/.test(contact)){ msg.textContent = '⚠️ නිවැරදි WhatsApp Number එකක් දාන්න.'; msg.className = 'verify-status err'; return; }
  const r = rareBuying, type = walletTypeForPay(selectedPay), ch = calcCharge(r.price, selectedPay), id = Date.now();
  const order = { id, orderNo: makeOrderNo(id), createdAt: new Date(id).toISOString(), game: 'Rare UID', uid: r.uid, player: '',
    package: `Rare UID ${r.uid}`, amount: r.price, payment: selectedPay, date: new Date(id).toLocaleString(), userPhone: s.phone, userName: s.name || '',
    contact, region: null, walletType: type, processingFee: ch.fee, totalCharged: ch.total, status: 'Processing' };
  btn.disabled = true; msg.className = 'verify-status'; msg.textContent = 'Processing...';
  try{
    const res = await fsBuyRareUid({ docId: r._id, price: r.price, walletKey: s.phone, walletType: type, totalCharge: ch.total, order });
    setCachedBalance(s.phone, type, res.balanceAfter); renderWallet();
    ordersCache.unshift(res.order);
    closeRareBuy();
    showOrderReceipt(res.order, true);
    loadRare();
  }catch(e){
    btn.disabled = false; msg.className = 'verify-status err';
    if(e.code === 'taken'){ msg.textContent = '❌ කණගාටුයි, මේ UID එක දැන්ම වෙන කෙනෙක් මිලදී ගත්තා (Sold Out).'; loadRare(); }
    else if(e.code === 'pricechanged'){ msg.textContent = '⚠️ මිල වෙනස් වෙලා. පිටුව refresh කරලා නැවත try කරන්න.'; loadRare(); }
    else if(e.code === 'insufficient') await showInsufficient(msg, type, ch.total);
    else { console.error('[SakinduStore] rare buy', e); msg.textContent = '❌ ' + (e.message || e); }
  }
}

loadRare();
rareTimer = setInterval(() => { if(!rareBuying && !document.hidden) loadRare(); }, 20000);   // another buyer's purchase shows up as SOLD OUT within seconds
