/* ===== SakinduStore — Shell Topup Redeem Pin shop =====
   Uses app.js for login, wallets and the 0.75% Bank Wallet charge. */

let pinGroups = [];        // [{ shells, price, count }]
let buying = null;         // group being purchased

async function loadPinStock(){
  const grid = document.getElementById('pinGrid');
  try{
    const pins = await fsGetAvailablePins();
    const map = {};
    pins.forEach(p => {
      const k = p.shells + '|' + p.price;
      (map[k] = map[k] || { shells: p.shells, price: p.price, count: 0 }).count++;
    });
    pinGroups = Object.values(map).sort((a,b) => a.shells - b.shells);
    renderPinGrid();
  } catch(err){
    console.error('[SakinduStore] pin stock', err);
    grid.innerHTML = `<p style="color:var(--red);text-align:center;grid-column:1/-1;">Stock load කරන්න බැරි උනා.<br><small>${err.message || err}</small></p>`;
  }
}
function renderPinGrid(){
  const grid = document.getElementById('pinGrid');
  if(!pinGroups.length){
    grid.innerHTML = '<p style="color:var(--muted);text-align:center;grid-column:1/-1;">දැනට Redeem Pins stock නැහැ. WhatsApp හරහා අපෙන් අහන්න.</p>';
    return;
  }
  grid.innerHTML = pinGroups.map((g,i) => `
    <div class="pin-card">
      <div class="shell-ic">${shellLogoSvg(96)}</div>
      <h3>ShellTopUp Redeem Pin ${g.shells}</h3>
      <div class="pin-price">${Number(g.price).toFixed(2)} <small>LKR</small></div>
      <div class="stock-badge ${g.count <= 2 ? 'low' : ''}">${g.count} STOCK LEFT</div>
      <button class="btn btn-primary btn-block" onclick="openBuy(${i})">🛒 Buy Now</button>
    </div>`).join('');
}

/* ---- buy modal (pay from EZ Cash Wallet or Bank Wallet [+1%]) ---- */
function onPayChange(){ if(buying) paintBuyPay(); }
function paintBuyPay(){
  paintPayWallets('buyPayWallets', buying.price, 'buyShortHint');
  const c = calcCharge(buying.price, selectedPay);
  document.getElementById('buyTotal').textContent = fmtRs(c.total) + (c.fee > 0 ? ` (incl. ${fmtRs(c.fee)} charge)` : '');
}
function openBuy(i){
  const session = getSession();
  if(!session){ alert('⚠️ Pin එකක් මිලදී ගන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  buying = pinGroups[i];
  document.getElementById('buyTitle').textContent = `ShellTopUp Redeem Pin ${buying.shells}`;
  document.getElementById('buySub').textContent = `🐚 ${buying.shells} shells · ${fmtRs(buying.price)}`;
  document.getElementById('buyForm').style.display = 'block';
  document.getElementById('buyMsg').innerHTML = '';
  document.getElementById('buyMsg').className = 'verify-status';
  document.getElementById('buyBtn').disabled = false;
  paintBuyPay();
  refreshMyWallet().then(paintBuyPay).catch(() => {});
  document.getElementById('buyOverlay').classList.add('show');
}
function closeBuy(){ document.getElementById('buyOverlay').classList.remove('show'); }

async function confirmBuy(){
  const msg = document.getElementById('buyMsg');
  const btn = document.getElementById('buyBtn');
  const session = getSession();
  if(!session){ openAuth('login'); return; }
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const id = Date.now();
  const type = walletTypeForPay(selectedPay), ch = calcCharge(buying.price, selectedPay);
  const order = {
    id, orderNo: makeOrderNo(id), createdAt: new Date(id).toISOString(), game: 'ShellTopUp Redeem Pin',
    uid: '-', player: '', package: `ShellTopUp Redeem Pin ${buying.shells}`,
    amount: buying.price, payment: selectedPay, date: new Date(id).toLocaleString(), userPhone: session.phone, userName: session.name || '',
    region: null, walletType: type, processingFee: ch.fee, totalCharged: ch.total
  };
  const opts = { shells: buying.shells, price: buying.price, order, walletKey: session.phone, walletType: type, totalCharge: ch.total };

  btn.disabled = true; msg.className = 'verify-status'; msg.textContent = 'Processing...';
  try{
    const r = await fsBuyPin(opts);
    document.getElementById('buyForm').style.display = 'none';
    closeBuy();
    setCachedBalance(session.phone, type, opts.balanceAfter);
    renderWallet();
    const finalOrder = Object.assign({}, order, { status: 'Approved', pinCode: r.pinCode, balanceBefore: opts.balanceBefore, balanceAfter: opts.balanceAfter });
    showPinReceipt(finalOrder);
    loadPinStock();
  } catch(err){
    btn.disabled = false;
    msg.className = 'verify-status err';
    if(err.code === 'insufficient'){
      msg.innerHTML = `❌ ${selectedPay} එකේ balance එක ප්‍රමාණවත් නැහැ. <a href="wallet.html" style="color:var(--cyan);">Wallet Recharge කරන්න</a>`;
    } else if(err.code === 'soldout'){
      msg.textContent = '❌ කණගාටුයි, මේ Pin එක Sold Out වුණා.';
      loadPinStock();
    } else {
      console.error('[SakinduStore] buy pin', err);
      msg.innerHTML = `❌ Purchase එක කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${escHtml(err.message || err)}</span>`;
    }
  }
}

loadPinStock();
