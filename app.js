/* ===== SakinduStore app.js — Firestore-backed =====
   Pattern: each shared data type has an in-memory cache + an async refresh*Cache()
   function. Render functions read the cache (sync, fast). Writes go to Firestore
   first, then update the cache, then re-render. Requires firebase-init.js + db.js
   loaded before this file. */

/* ---------- FREE FIRE REGION AVAILABILITY ---------- */
// Only Singapore/Global has real packages & pricing set up right now — every other
// region is listed for visibility but is Coming Soon until region-specific pricing exists.
const FF_AVAILABLE_REGIONS = ['SG/MY/LK'];   // regions whose packages are built into the site
/* region picker list — `flags` are country codes (flagcdn.com), `icon` is used when there is no flag,
   `bonus` shows a flame badge on the card */
const FF_REGIONS = [
  { value:'SG/MY/LK', label:'SG/MY/LK', flags:['sg','my','lk'], recommended:true },
  { value:'50% BONUS', label:'50% Bonus', icon:'🔥', bonus:'50% BONUS', serverGroup:'SG/MY/LK' },
  { value:'Bangladesh', label:'Bangladesh', flags:['bd'] },
  { value:'Brazil', label:'Brazil', flags:['br'] },
  { value:'Europe', label:'Europe', flags:['eu'] },
  { value:'Global', label:'Global', icon:'🌐' },
  { value:'Indonesia', label:'Indonesia', flags:['id'] },
  { value:'Latin America', label:'Latin America', icon:'🌎' },
  { value:'Middle East & North Africa', label:'Middle East & North Africa', icon:'🎮' },
  { value:'Philippines', label:'Philippines', flags:['ph'] },
  { value:'Taiwan', label:'Taiwan', flags:['tw'] },
  { value:'Thailand', label:'Thailand', flags:['th'] },
  { value:'Vietnam', label:'Vietnam', flags:['vn'] }
];
/* Packages added in the admin panel (Admin -> 🔥 FF Region Packages): { regionValue: [ {id,cat,label,price,old,badge} ] } */
let ffRegionPackagesCache = {};
let ffLastRegion = null;
async function refreshFfRegionPackagesCache(){ ffRegionPackagesCache = await fsGetConfig('ffRegionPackages', {}); }
function isFFRegionAvailable(region){
  return FF_AVAILABLE_REGIONS.includes(region) || (ffRegionPackagesCache[region] || []).length > 0;
}
/* The catalog shown for the selected region: built-in packages for SG/MY/LK + anything added in admin */
function getFFPackageData(){
  const sel = document.getElementById('ffRegionSelect');
  const region = (sel && sel.value) || 'SG/MY/LK';
  const out = {};
  if(region === 'SG/MY/LK'){
    Object.keys(packageData).forEach(c => { out[c] = Object.assign({}, packageData[c], { items: packageData[c].items.slice() }); });
  }
  (ffRegionPackagesCache[region] || []).forEach(p => {
    const c = out[p.cat] || (out[p.cat] = { icon:'diamonds', iconLabel:'💎', items: [] });
    c.items.push({ label: p.label, price: Number(p.price), old: p.old ? Number(p.old) : null, badge: p.badge || '',
                   chip: String(p.label).split(' ')[0].slice(0, 6), custom: true });
  });
  return out;
}
/* called when the region changes or the admin-defined packages finish loading */
function refreshFFPackageView(resetSelection){
  if(resetSelection){ selectedPkg = null; activeCategory = 'All'; }
  const cats = Object.keys(getFFPackageData());
  if(activeCategory !== 'All' && !cats.includes(activeCategory)) activeCategory = 'All';
  renderCatTabs(); renderPackages(); updateTotalUI();
  const note = document.getElementById('ffRegionNote');
  const sel = document.getElementById('ffRegionSelect');
  if(note && sel){
    const r = FF_REGIONS.find(x => x.value === sel.value);
    note.style.display = (r && r.bonus && isFFRegionAvailable(r.value)) ? 'block' : 'none';
  }
}
function onFFRegionChange(){
  const sel = document.getElementById('ffRegionSelect');
  const msg = document.getElementById('ffRegionComingSoonMsg');
  if(!sel) return;
  const available = isFFRegionAvailable(sel.value);
  if(msg) msg.style.display = available ? 'none' : 'block';
  const uidInput = document.getElementById('uidInput');
  const verifyBtn = document.getElementById('verifyBtn');
  if(uidInput){ uidInput.disabled = !available; if(!available) uidInput.value = ''; }
  if(verifyBtn) verifyBtn.disabled = !available;
  if(!available){ uidVerified = false; const vs = document.getElementById('verifyStatus'); if(vs) vs.textContent = ''; }
  if(document.getElementById('pkgContainer')){
    const changed = sel.value !== ffLastRegion;          // keep the chosen package when the same region is just re-rendered
    ffLastRegion = sel.value;
    refreshFFPackageView(changed);
  }
}

/* ---------- E-MAIL VERIFICATION FOR MANUAL SIGN-UP ----------
   Paste your Cloudflare Worker URL (cloudflare-worker/email-verify-worker.js) here, e.g. 'https://sakindu-email.yourname.workers.dev'.
   Leave '' to switch verification OFF (sign-up works exactly as before). Google sign-ups are already verified by Google. */
const EMAIL_VERIFY_URL = '';

/* ---------- WALLETS: EZ Cash Wallet + Bank Wallet (+ Sakindu Coins for resellers) ----------
   Deposits via eZ Cash -> EZ Cash Wallet, via Bank Transfer -> Bank Wallet. Paying from the Bank Wallet adds a 1% processing charge.
   Sakindu Coins (1 Coin = Rs. 1) are a separate wallet used only in the Reseller program. */
const BANK_WALLET_FEE_RATE = 0.01;
const PAY_EZ_WALLET = 'EZ Cash Wallet';
const PAY_BANK_WALLET = 'Bank Wallet';
const PAY_COINS = 'Sakindu Coins';
function walletTypeForPay(name){ return name === PAY_BANK_WALLET ? 'bank' : (name === PAY_COINS ? 'coins' : 'ez'); }
function fmtRs(n){ n = round2(n); return 'Rs. ' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
function fmtRs2(n){ return 'Rs. ' + round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function calcCharge(price, payName){
  const fee = payName === PAY_BANK_WALLET ? round2(price * BANK_WALLET_FEE_RATE) : 0;
  return { base: price, fee, total: round2(price + fee) };
}
function walletLabel(type){ return type === 'bank' ? PAY_BANK_WALLET : (type === 'coins' ? PAY_COINS : PAY_EZ_WALLET); }

/* ---------- small helpers ---------- */
function escHtml(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getSession(){ try{ return JSON.parse(localStorage.getItem('sakindu_session') || 'null'); }catch(e){ return null; } }
/* picture -> compressed JPEG data URL. A 12MB phone photo is shrunk until it is small enough (< ~600KB) for the database.
   Rejects when the file is not a picture the browser can read (e.g. HEIC). */
function fileToDataURL(file, maxSide, quality, maxBytes){
  maxSide = maxSide || 1400; quality = quality || 0.8; maxBytes = maxBytes || 600000;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('මේ පින්තූරය කියවන්න බැහැ. PNG / JPG screenshot එකක් දාන්න.')); };
    img.onload = () => {
      try{
        let side = maxSide, q = quality, out = '';
        for(let i = 0; i < 8; i++){
          const scale = Math.min(1, side / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
          const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if(out.length <= maxBytes) break;
          if(q > 0.5) q -= 0.15; else side = Math.round(side * 0.75);
        }
        URL.revokeObjectURL(url);
        out.length > 900000 ? reject(new Error('පින්තූරය ගොඩක් විශාලයි. වෙනත් screenshot එකක් දාන්න.')) : resolve(out);
      }catch(err){ URL.revokeObjectURL(url); reject(err); }
    };
    img.src = url;
  });
}
function makeOrderNo(id){
  const d = new Date(id || Date.now());
  const p = n => String(n).padStart(2, '0');
  const rnd = Math.floor(Math.random() * 36 * 36 * 36 * 36).toString(36).toUpperCase().padStart(4, '0');
  return 'SK' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + rnd;
}

/* ---------- UID CHECKER CONFIG ---------- */
const UID_API_KEY = "YOUR_KEY";
const UID_API_URL = "https://ff.api.rauniyarmultipurpose.com.np/api.php";

/* ---------- SIDEBAR ---------- */
function openSidebar(){
  document.getElementById('sidebar').classList.add('show');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ---------- PACKAGE DATA (static catalog; prices can be overridden via Firestore) ---------- */
const packageData = {
  "Top Selling": {
    icon:"topselling", iconLabel:"👑",
    items:[
      {label:"Weekly Lite", price:130, chip:"WL", image:typeof IMG_WEEKLY_LITE!=='undefined'?IMG_WEEKLY_LITE:null},
      {label:"Weekly", price:560, chip:"W", image:typeof IMG_WEEKLY!=='undefined'?IMG_WEEKLY:null},
      {label:"Monthly", price:2750, chip:"M", image:typeof IMG_MONTHLY!=='undefined'?IMG_MONTHLY:null},
    ]
  },
  "Diamonds": {
    icon:"diamonds", iconLabel:"💎", image:typeof IMG_DIAMONDS!=='undefined'?IMG_DIAMONDS:null,
    items:[
      {label:"25 💎", price:99, chip:"25"},
      {label:"100 💎", price:335, chip:"100"},
      {label:"310 💎", price:1010, chip:"310"},
      {label:"520 💎", price:1680, chip:"520"},
      {label:"1060 💎", price:3400, chip:"1.06K"},
      {label:"2180 💎", price:6800, chip:"2.18K"},
      {label:"5600 💎", price:16700, chip:"5.6K"},
      {label:"11500 💎", price:33000, chip:"11.5K", badge:"BIG OFFER"},
    ]
  },
  "Level Up Pass": {
    icon:"levelup", iconLabel:"🚀", image:typeof IMG_LEVELUP!=='undefined'?IMG_LEVELUP:null,
    items:[
      {label:"Level Up Pass 6", price:150, chip:"6"},
      {label:"Level Up Pass 10", price:250, chip:"10"},
      {label:"Level Up Pass 15", price:250, chip:"15"},
      {label:"Level Up Pass 20", price:250, chip:"20"},
      {label:"Level Up Pass 25", price:250, chip:"25"},
      {label:"Level Up Pass 30", price:360, chip:"30"},
    ]
  }
};
const allCategories = ["All", ...Object.keys(packageData)];
let activeCategory = "All";
let selectedPkg = null;
let selectedPay = PAY_EZ_WALLET;
let uidVerified = false;
let verifiedPlayerName = "";
let verifiedLevel = null;
let verifiedPlayerRegion = "";
let uidAutoTimer = null;

function chipGradient(cat){
  return { "Top Selling":"linear-gradient(135deg,#ffb020,#ff6fa0)",
           "Diamonds":"linear-gradient(135deg,#29e0e8,#7c5cff)",
           "Level Up Pass":"linear-gradient(135deg,#3ddc84,#29e0e8)" }[cat] || "linear-gradient(135deg,#ff8a3d,#ff3d77)";
}

function renderCatTabs(){
  const el = document.getElementById('catTabs');
  if(!el) return;
  el.innerHTML = ['All', ...Object.keys(getFFPackageData())].map(cat =>
    `<div class="cat-tab ${cat===activeCategory?'active':''}" onclick="setCategory('${cat}')">${cat.toUpperCase()}</div>`
  ).join('');
}
function setCategory(cat){
  activeCategory = cat;
  renderCatTabs();
  renderPackages();
}

/* ---------- IMAGE OVERRIDES for the built-in Free Fire packages (Admin -> Package Prices -> Image) ---------- */
let ffImageOverridesCache = {};
async function refreshFfImageOverridesCache(){ ffImageOverridesCache = (await fsGetConfig('ffImageOverrides', {})) || {}; }
function ffImageOverride(cat, label){ return ffImageOverridesCache[`${cat}::${label}`] || null; }

/* ---------- PRICE OVERRIDES (Firestore config/priceOverrides) ---------- */
let priceOverridesCache = {};
async function refreshPriceOverridesCache(){
  priceOverridesCache = await fsGetConfig('priceOverrides', {});
}
function getEffectivePrice(cat, label, fallback){
  const key = `${cat}::${label}`;
  return priceOverridesCache[key] !== undefined ? priceOverridesCache[key] : fallback;
}
async function savePriceOverride(key, value){
  priceOverridesCache[key] = value;
  await fsSetConfig('priceOverrides', priceOverridesCache);
}

function renderPackages(){
  const container = document.getElementById('pkgContainer');
  if(!container) return;
  const data = getFFPackageData();
  const cats = activeCategory === "All" ? Object.keys(data) : [activeCategory];
  if(!cats.length){ container.innerHTML = ''; return; }
  container.innerHTML = cats.map(cat => `
    <div class="cat-heading"><div class="cat-icon ${data[cat].icon}">${data[cat].iconLabel}</div> ${cat.toUpperCase()}</div>
    <div class="pkg-grid">
      ${data[cat].items.map((p,i) => {
        const effPrice = p.custom ? p.price : getEffectivePrice(cat, p.label, p.price);
        const bannerSrc = ffImageOverride(cat, p.label) || p.image || data[cat].image;
        const visual = bannerSrc
          ? `<img class="pkg-banner" src="${bannerSrc}" alt="${escHtml(p.label)}" loading="lazy">`
          : `<div class="pkg-icon" style="background:${chipGradient(cat)}">${escHtml(p.chip)}</div>`;
        return `
        <div class="pkg-card" onclick="selectPkg('${cat}',${i})" id="pkg-${cat}-${i}">
          ${p.badge ? `<div class="badge">${escHtml(p.badge)}</div>` : ''}
          <div class="pkg-visual">${visual}</div>
          <div class="amt">${escHtml(p.label)}</div>
          <div class="meta">${p.old ? `<div class="old-price">Rs. ${Number(p.old).toLocaleString('en-US')}</div>` : `<div class="lbl">Free Fire</div>`}</div>
          <div class="price">Rs. ${Number(effPrice).toLocaleString('en-US')}</div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

function selectPkg(cat, index){
  const base = getFFPackageData()[cat].items[index];
  const effPrice = base.custom ? base.price : getEffectivePrice(cat, base.label, base.price);
  selectedPkg = Object.assign({}, base, { price: effPrice, cat });
  document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`pkg-${cat}-${index}`).classList.add('selected');
  updatePaymentUI();
}
function updateTotalUI(){
  const totalEl = document.getElementById('totalAmount');
  const feeEl = document.getElementById('feeLine');
  if(!totalEl) return;
  const price = selectedPkg ? selectedPkg.price : 0;
  const c = calcCharge(price, selectedPay);
  totalEl.textContent = fmtRs(c.total);
  if(feeEl){
    if(c.fee > 0){
      feeEl.style.display = 'block';
      feeEl.innerHTML = `${fmtRs(c.base)} + ${fmtRs(c.fee)} Processing Charge (1%) — Bank Wallet එකෙන් pay කරද්දී පමණයි`;
    } else { feeEl.style.display = 'none'; }
  }
}

/* ---------- REAL UID VERIFICATION ---------- */
async function verifyUID(){
  const uid = document.getElementById('uidInput').value.replace(/\D/g, '');
  const status = document.getElementById('verifyStatus');
  const btn = document.getElementById('verifyBtn');

  uidVerified = false;
  verifiedPlayerName = "";
  verifiedLevel = null;
  verifiedPlayerRegion = "";

  if(!uid){
    status.innerHTML = 'UID එකක් type කරන්න.';
    status.className = 'verify-status';
    return;
  }
  if(!/^\d{8,12}$/.test(uid)){
    status.innerHTML = '⚠️ UID එක වැරදියි. digits 8-12ක් තිබිය යුතුයි.';
    status.className = 'verify-status err';
    return;
  }

  status.innerHTML = '⏳ Checking UID...';
  status.className = 'verify-status';
  if(btn){ btn.disabled = true; }

  try{
    // Live lookup (nickname + level + region) through the player-info relay, when it is configured
    if(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL){
      const info = await lookupPlayerInfo(uid);
      if(info.ok){
        uidVerified = true;
        verifiedPlayerName = info.nickname; verifiedLevel = info.level; verifiedPlayerRegion = info.region;
        saveUid(uid);
        // The account's real server decides where the top-up goes: switch the region automatically when it differs
        const regionEl = document.getElementById('ffRegionSelect');
        let warn = '';
        const target = info.fallback ? null : PLAYER_REGION_TO_STORE[info.region];
        if(target && regionEl){
          const cur = FF_REGIONS.find(r => r.value === regionEl.value);
          if(((cur && cur.serverGroup) || regionEl.value) !== target){
            if(isFFRegionAvailable(target)){
              autoSwitchFFRegion(target);
              warn = `🔁 ඔබේ account එක <strong>${info.region}</strong> server එකේ — Region එක <strong>${target}</strong> වලට auto මාරු කළා.`;
            } else {
              uidVerified = false;
              warn = `⚠️ මේ account එක <strong>${info.region}</strong> region එකේ (${target}). දැනට SG/MY/LK region එකේ accounts වලට පමණයි top-up කරන්නේ — ${target} ළඟදීම!`;
            }
          }
        }
        status.innerHTML = info.fallback
          ? `<span class="player-name-chip">✅ UID accepted</span><div style="margin-top:8px;color:var(--muted);font-size:.85rem;">Player details auto ගන්න බැරි උනා — ඔබ type කළ UID එකම භාවිත කරනවා. නිවැරදිද බලන්න.</div>`
          : playerCardHtml(info, uid, uidVerified) + (warn ? `<div style="margin-top:8px;color:var(--gold);font-size:.9rem;">${warn}</div>` : '');
        if(uidVerified) celebrateVerified();
        status.className = 'verify-status';
      } else if(info.error === 'not_found'){
        status.innerHTML = '❌ මේ UID එක හොයාගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.';
        status.className = 'verify-status err';
      } else {
        status.innerHTML = '⚠️ Verify කරන්න බැරි උනා (සේවාව දැනට වැඩ නැහැ). තත්පර කීපයකින් නැවත "Verify" එබුවම බලන්න.';
        status.className = 'verify-status err';
      }
      return;
    }
    const url = `${UID_API_URL}?uid=${encodeURIComponent(uid)}&key=${encodeURIComponent(UID_API_KEY)}`;
    const response = await fetch(url);
    const data = await response.json();

    if(data.status){
      uidVerified = true;
      verifiedPlayerName = data.data.username;
      status.innerHTML = `<span class="player-name-chip">✅ ${data.data.username}${data.data.region ? ' · ' + data.data.region : ''}</span>`;
      status.className = 'verify-status';
    } else {
      simulateVerified(uid, status);
    }
  } catch(err){
    simulateVerified(uid, status);
  } finally {
    if(btn){ btn.disabled = false; }
  }
}
/* typing in the UID box: drop any old verification and (when the live lookup is on) verify automatically */
function onUidInput(){
  const box = document.getElementById('uidInput');
  if(box){ const clean = box.value.replace(/\D/g, ''); if(clean !== box.value) box.value = clean; }   // spaces / letters are removed as you type
  uidVerified = false; verifiedPlayerName = ""; verifiedLevel = null; verifiedPlayerRegion = "";
  const status = document.getElementById('verifyStatus'); if(status){ status.innerHTML = ''; status.className = 'verify-status'; }
  clearTimeout(uidAutoTimer);
  const uid = document.getElementById('uidInput').value.replace(/\D/g, '');
  if(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL && /^\d{8,12}$/.test(uid)){
    uidAutoTimer = setTimeout(verifyUID, 800);
  }
}
/* move the region picker to the account's real server (used after the UID lookup) */
function autoSwitchFFRegion(value){
  const sel = document.getElementById('ffRegionSelect'); if(!sel) return;
  sel.value = value;
  try{ sessionStorage.setItem('ff_region', value); }catch(e){}
  onFFRegionChange();
  if(typeof updateRegionButton === 'function') updateRegionButton();
}
function simulateVerified(uid, status){
  uidVerified = true;
  verifiedPlayerName = "";
  status.innerHTML = `<span class="player-name-chip">✅ UID Verified</span>`;
  status.className = 'verify-status';
}

/* ---------- ORDERS (Firestore 'orders' collection) ---------- */
let ordersCache = [];
async function refreshOrdersCache(){
  ordersCache = await fsGetOrders();
}
async function saveOrder(order){
  await fsAddOrder(order);
  ordersCache.unshift(order);
  renderOrders();
  if(typeof renderLeaderboard === 'function') renderLeaderboard();
}

/* Pay an order from the chosen wallet (EZ Cash Wallet / Bank Wallet [+1%] / Sakindu Coins) and save it. If saving fails the money is given back.
   Returns { order, balance }. Throws code 'insufficient' when that wallet's balance is too low. */
async function chargeWalletAndSaveOrder(baseOrder, payName, price){
  const key = currentWalletKey();
  if(!key) throw dbErr('nologin', 'Login required');
  const type = walletTypeForPay(payName);
  const ch = calcCharge(price, payName);
  const newBal = await fsAdjustWallet(key, type, -ch.total);      // atomic; throws 'insufficient'
  const order = Object.assign({}, baseOrder, {
    payment: payName, status: 'Processing', walletType: type, processingFee: ch.fee, totalCharged: ch.total,
    balanceBefore: round2(newBal + ch.total), balanceAfter: newBal
  });
  try{ await saveOrder(order); }
  catch(e){ try{ await fsAdjustWallet(key, type, ch.total); }catch(e2){ console.error('[SakinduStore] refund after failed order also failed', e2); } throw e; }
  setCachedBalance(key, type, newBal);
  return { order, balance: newBal };
}
async function showInsufficient(msgEl, type, need){
  let bal = 0;
  try{ const b = await fsGetWalletBalances(currentWalletKey()); bal = type === 'bank' ? b.bank : (type === 'coins' ? b.coins : b.ez); }catch(e){}
  const short = need ? ` (${Math.ceil(round2(need - bal)).toLocaleString('en-US')} ${type === 'coins' ? 'Coins' : 'Rs.'} ක් අඩුයි)` : '';
  const html = `❌ ${walletLabel(type)} එකේ balance එක ප්‍රමාණවත් නැහැ. Balance: ${type === 'coins' ? Math.floor(bal) + ' Coins' : fmtRs2(bal)}${short}. <a href="wallet.html${type === 'coins' ? '?target=coins' : ''}" style="color:var(--cyan);font-weight:700;">Recharge කරන්න →</a>`;
  if(msgEl){ msgEl.innerHTML = html; msgEl.className = 'verify-status err'; }
  else alert('❌ ' + walletLabel(type) + ' එකේ balance එක ප්‍රමාණවත් නැහැ. Recharge කරන්න.');
}

/* ---------- ORDER RECEIPT (shown right after an order and from Order History) ---------- */
function orderDateTime(o){
  let d = o.createdAt ? new Date(o.createdAt) : (o.id ? new Date(Number(o.id)) : null);
  if(!d || isNaN(d.getTime())) return { date: o.date || '-', time: '' };
  const p = n => String(n).padStart(2, '0');
  const h = d.getHours(), h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    date: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()),
    time: p(h12) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + ' ' + (h >= 12 ? 'PM' : 'AM')
  };
}
function receiptRowsForOrder(o){
  const dt = orderDateTime(o);
  const total = o.totalCharged != null ? o.totalCharged : o.amount;
  const rows = [
    ['Order No', '#' + (o.orderNo || o.id)],
    ['Status', o.status || 'Processing'],
    ['Date', dt.date], dt.time ? ['Time', dt.time] : null,
    o.game ? ['Game', o.game] : null,
    ['Package', o.package],
    (o.uid && o.uid !== '-' && !(o.fields && o.fields.length > 1)) ? [(o.fields && o.fields[0] ? o.fields[0].label : 'Player ID (UID)'), (o.fields && o.fields[0] ? o.fields[0].value : o.uid)] : null,
    ...((o.fields && o.fields.length > 1) ? o.fields.map(f => [f.label, f.value]) : []),
    o.player ? ['Player Name', o.player] : null,
    o.level ? ['Level', o.level] : null,
    o.region ? ['Region / Server', o.region + (o.playerRegion ? ' (account: ' + o.playerRegion + ')' : '')] : null,
    ['Payment Method', o.payment || PAY_EZ_WALLET],
    ['Price', o.walletType === 'coins' ? Math.round(o.amount) + ' Coins' : fmtRs2(o.amount)],
    (o.processingFee > 0) ? ['Processing Charge (1%)', fmtRs2(o.processingFee)] : null,
    ['Total Paid', o.walletType === 'coins' ? Math.round(total) + ' Coins' : fmtRs2(total)],
    o.balanceBefore != null ? ['Balance Before', o.walletType === 'coins' ? Math.floor(o.balanceBefore) + ' Coins' : fmtRs2(o.balanceBefore)] : null,
    o.balanceAfter != null ? ['Balance After', o.walletType === 'coins' ? Math.floor(o.balanceAfter) + ' Coins' : fmtRs2(o.balanceAfter)] : null,
    ['Customer', (o.userName ? o.userName + ' · ' : '') + (o.userPhone || '-')],
    ['Transaction ID', 'TXN-' + o.id]
  ].filter(Boolean);
  return rows;
}
function receiptText(o){
  return ['🧾 SakinduStore — Order Receipt', '------------------------------', ...receiptRowsForOrder(o).map(r => r[0] + ': ' + r[1])].join('\n');
}
function showOrderReceipt(o, justPlaced){
  let ov = document.getElementById('orderReceiptOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'orderReceiptOverlay'; ov.className = 'modal-overlay';
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
    document.body.appendChild(ov);
  }
  window.__receiptOrder = o;
  const rows = receiptRowsForOrder(o);
  const st = o.status || 'Processing';
  const stClass = st === 'Rejected' ? 'rc-bad' : (st === 'Processing' ? 'rc-wait' : 'rc-ok');
  ov.innerHTML = `
    <div class="modal receipt-modal order-receipt">
      <button class="close-x" onclick="document.getElementById('orderReceiptOverlay').classList.remove('show')">✕</button>
      <div class="rc-top">
        <div class="rc-check ${stClass}">${st === 'Rejected' ? '✕' : (st === 'Processing' ? '⏳' : '✓')}</div>
        <div class="rc-title">${justPlaced ? 'Order Placed!' : 'Order Receipt'}</div>
        <div class="rc-amount">${o.walletType === 'coins' ? Math.round(o.totalCharged != null ? o.totalCharged : o.amount) + ' Coins' : fmtRs2(o.totalCharged != null ? o.totalCharged : o.amount)}</div>
        <div class="rc-pill ${stClass}">${escHtml(st)}</div>
      </div>
      <div class="rc-tear"></div>
      <div class="rc-rows">${rows.map(r => `<div><span>${escHtml(r[0])}</span><strong>${escHtml(r[1])}</strong></div>`).join('')}</div>
      <div class="rc-tear"></div>
      <p class="rc-note">${st === 'Processing' ? '⏳ Admin ඔබේ order එක process කරලා Approve කරනකම් "Processing" status එකේ පවතී. Order History එකෙන් track කරන්න පුළුවන්.' : ''}</p>
      <div class="rc-actions">
        <button class="btn btn-ghost" onclick="copyText(receiptText(window.__receiptOrder), this)">📋 Copy</button>
        <button class="btn btn-primary" onclick="printReceipt()">🖨️ Print / Save</button>
      </div>
      <a class="btn btn-ghost btn-block" style="margin-top:10px;display:block;text-align:center;" target="_blank" rel="noopener" href="${waLink(STORE_WHATSAPP, 'Hi, Order #' + (o.orderNo || o.id) + ' (' + o.package + ') ගැන.')}">💬 Admin ට WhatsApp කරන්න</a>
    </div>`;
  ov.classList.add('show');
}
function showReceiptForOrder(orderId){
  const o = ordersCache.find(x => String(x.id) === String(orderId));
  if(o) showOrderReceipt(o, false);
}
function printReceipt(){
  const o = window.__receiptOrder; if(!o) return;
  const rows = receiptRowsForOrder(o).map(r => `<tr><td>${escHtml(r[0])}</td><td><b>${escHtml(r[1])}</b></td></tr>`).join('');
  const w = window.open('', '_blank'); if(!w){ alert('Pop-up block වෙලා. Allow කරන්න.'); return; }
  w.document.write(`<html><head><title>Receipt ${escHtml(o.orderNo || o.id)}</title><style>body{font-family:Arial,sans-serif;max-width:420px;margin:24px auto;color:#111}h2{text-align:center;margin:0 0 4px}p{text-align:center;color:#666;margin:0 0 16px}table{width:100%;border-collapse:collapse}td{padding:7px 4px;border-bottom:1px dashed #ccc;font-size:14px}td:first-child{color:#555}td:last-child{text-align:right}</style></head><body><h2>SakinduStore</h2><p>Order Receipt</p><table>${rows}</table></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

/* ---------- PLACE ORDER (Free Fire page) — Wallet Balance only ---------- */
async function placeOrder(){
  if(isCurrentGameInMaintenance()){ alert('🛠 මේ game එක දැනට Maintenance එකේ.'); return; }
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const session = getSession();
  if(!session){ alert('⚠️ Order එකක් දාන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  const regionEl = document.getElementById('ffRegionSelect');
  if(regionEl && !isFFRegionAvailable(regionEl.value)){
    alert('⚠️ මේ Region එක Coming Soon — SG/MY/LK region එකෙන් order කරන්න.');
    return;
  }
  const uid = document.getElementById('uidInput').value.replace(/\D/g, '');
  const orderMsg = document.getElementById('orderMsg');
  if(!uid){ alert('කරුණාකර UID එක type කරන්න.'); return; }
  if(!uidVerified){ alert('කරුණාකර UID එක verify කරන්න.'); return; }
  if(!selectedPkg){ alert('කරුණාකර package එකක් තෝරන්න.'); return; }

  const submitBtn = document.getElementById('placeOrderBtn') || document.querySelector('.order-panel .btn-block');
  const resetBtn = () => { if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Pay & Order'; } };
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Checking UID...'; }
  if(orderMsg){ orderMsg.innerHTML = ''; orderMsg.className = 'verify-status'; }

  try{
    // 1) the UID is ALWAYS re-checked against the live player-info API right before any money is taken
    const live = await liveVerifyBeforeOrder(uid);
    if(!live.ok){
      if(orderMsg){ orderMsg.innerHTML = live.message; orderMsg.className = 'verify-status err'; } else alert(live.message);
      resetBtn(); return;
    }
    if(live.info && !live.info.fallback){
      verifiedPlayerName = live.info.nickname; verifiedLevel = live.info.level; verifiedPlayerRegion = live.info.region;
      const target = PLAYER_REGION_TO_STORE[live.info.region];
      const cur = regionEl ? FF_REGIONS.find(r => r.value === regionEl.value) : null;
      if(target && regionEl && ((cur && cur.serverGroup) || regionEl.value) !== target){
        const m = `⚠️ මේ account එක <strong>${live.info.region}</strong> server එකේ (${target}). Region එක නිවැරදිව තෝරලා නැවත \"Verify\" කරන්න.`;
        if(orderMsg){ orderMsg.innerHTML = m; orderMsg.className = 'verify-status err'; }
        resetBtn(); return;
      }
    }
    saveUid(uid);
    if(submitBtn) submitBtn.textContent = 'Processing...';

    // 2) pay from Wallet Balance + save the order
    const id = Date.now();
    const waEl = document.getElementById('waInput');
    const baseOrder = {
      id, orderNo: makeOrderNo(id), createdAt: new Date(id).toISOString(),
      game: 'Free Fire', category: selectedPkg.cat || '',
      uid, player: verifiedPlayerName, level: verifiedLevel, playerRegion: verifiedPlayerRegion,
      package: selectedPkg.label, amount: selectedPkg.price, payment: selectedPay, date: new Date(id).toLocaleString(),
      userPhone: session.phone, userName: session.name || '', contact: waEl ? waEl.value.trim() : '',
      region: regionEl ? regionEl.value : null
    };
    try{
      const r = await chargeWalletAndSaveOrder(baseOrder, selectedPay, selectedPkg.price);
      renderWallet(); updatePaymentUI();
      if(orderMsg){ orderMsg.innerHTML = `✅ Order #${escHtml(r.order.orderNo)} place උනා — ${fmtRs2(r.order.totalCharged)} ${escHtml(r.order.payment)} එකෙන් deduct කළා.`; orderMsg.className = 'verify-status ok'; }
      showOrderReceipt(r.order, true);
    } catch(err){
      if(err && err.code === 'insufficient') await showInsufficient(orderMsg, walletTypeForPay(selectedPay), calcCharge(selectedPkg.price, selectedPay).total);
      else throw err;
    }
  } catch(err){
    console.error('[SakinduStore] placeOrder error', err);
    const m = `❌ Order එක submit කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${escHtml((err && err.message) ? err.message : err)}</span>`;
    if(orderMsg){ orderMsg.innerHTML = m; orderMsg.className = 'verify-status err'; } else alert('❌ Order එක submit කරන්න බැරි උනා.');
  } finally { resetBtn(); }
}

/* the two wallet cards (EZ Cash Wallet / Bank Wallet) used to pay — shared by the Free Fire page, generic game pages and the pin shop */
function paintPayWallets(containerId, need, shortHintId){
  const box = document.getElementById(containerId);
  if(!box) return;
  const key = currentWalletKey();
  if(!key){ box.innerHTML = '<a href="#" onclick="openAuth(\'login\');return false;" class="pay-login">Login කරලා Wallet එකෙන් pay කරන්න →</a>'; const h = document.getElementById(shortHintId); if(h) h.style.display = 'none'; return; }
  const opts = [{ name: PAY_EZ_WALLET, type: 'ez', ic: '📱', note: 'Processing charge නැහැ' }, { name: PAY_BANK_WALLET, type: 'bank', ic: '🏦', note: '+1% Processing Charge' }];
  box.innerHTML = opts.map(o => {
    const bal = getWalletBalance(key, o.type), c = calcCharge(need || 0, o.name), low = need > 0 && bal < c.total;
    return `<div class="pay-w ${selectedPay === o.name ? 'on' : ''} ${low ? 'low' : ''}" onclick="selectPay('${o.name}')">
      <div class="pw-top"><span>${o.ic} ${o.name}</span><i class="pw-dot"></i></div>
      <div class="pw-bal">${fmtRs2(bal)}</div><div class="pw-note">${o.note}${low ? ' · <b>balance මදි</b>' : ''}</div></div>`;
  }).join('');
  const hint = document.getElementById(shortHintId);
  if(hint){
    const type = walletTypeForPay(selectedPay), bal = getWalletBalance(key, type), c = calcCharge(need || 0, selectedPay);
    if(need > 0 && bal < c.total){ hint.style.display = 'block'; hint.innerHTML = `⚠️ ${selectedPay} එකේ balance එක ප්‍රමාණවත් නැහැ — Rs. ${Math.ceil(round2(c.total - bal)).toLocaleString('en-US')} ක් අඩුයි. <a href="wallet.html" style="color:var(--cyan);font-weight:700;">Recharge කරන්න →</a>`; }
    else hint.style.display = 'none';
  }
}
function updatePaymentUI(){
  updateTotalUI();
  genericSelectedPay = selectedPay;
  paintPayWallets('payWallets', selectedPkg ? selectedPkg.price : 0, 'walletShortHint');
  if(currentWalletKey()) refreshMyWallet().then(() => { paintPayWallets('payWallets', selectedPkg ? selectedPkg.price : 0, 'walletShortHint'); renderWallet(); }).catch(() => {});
}
function selectPay(name){
  if(name){ selectedPay = name; genericSelectedPay = name; }
  updatePaymentUI();
  if(typeof updateGenericPaymentUI === 'function') updateGenericPaymentUI();
  if(typeof onPayChange === 'function') onPayChange();
}

/* ---------- PIN RECEIPT (shown after a Redeem Pin purchase and from Order History) ---------- */
function showPinReceipt(o){
  // o = the order document (with pinCode). Same receipt layout as every other order, plus the Redeem Pin.
  let ov = document.getElementById('pinReceiptOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'pinReceiptOverlay'; ov.className = 'modal-overlay';
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
    document.body.appendChild(ov);
  }
  window.__receiptOrder = o;
  const rows = receiptRowsForOrder(o);
  const text = receiptText(o) + '\nRedeem Pin: ' + o.pinCode;
  ov.innerHTML = `
    <div class="modal receipt-modal order-receipt">
      <button class="close-x" onclick="document.getElementById('pinReceiptOverlay').classList.remove('show')">✕</button>
      <div class="rc-top"><div class="rc-check rc-ok">✓</div><div class="rc-title">Payment Receipt</div>
        <div class="rc-amount">${fmtRs2(o.totalCharged != null ? o.totalCharged : o.amount)}</div><div class="rc-pill rc-ok">${escHtml(o.status || 'Approved')}</div></div>
      <div class="rc-tear"></div>
      <div class="rc-rows">${rows.map(r => `<div><span>${escHtml(r[0])}</span><strong>${escHtml(r[1])}</strong></div>`).join('')}</div>
      <div class="rc-tear"></div>
      <div class="receipt-code-label">YOUR REDEEM PIN <small>(valid for ONE use only)</small></div>
      <div class="receipt-code" id="receiptCode">${escHtml(o.pinCode)}</div>
      <button class="btn btn-primary btn-block" onclick="copyText('${escHtml(o.pinCode)}', this)">📋 Copy Code</button>
      <a class="btn btn-ghost btn-block" style="margin-top:10px;display:block;text-align:center;white-space:normal;line-height:1.4;" href="shelltopup.html">🐚 Shell Topup එකේ Redeem කරන්න →</a>
      <div class="rc-actions" style="margin-top:10px;">
        <button class="btn btn-ghost" onclick="copyText(${JSON.stringify(text).replace(/"/g, '&quot;')}, this)">Copy receipt</button>
        <button class="btn btn-ghost" onclick="printReceipt()">🖨️ Print / Save</button>
      </div>
      <p class="receipt-note">⚠️ මේ Code එක කාටවත් share කරන්න එපා. එක වරක් Redeem කළාම නැවත භාවිත කළ නොහැක.</p>
    </div>`;
  ov.classList.add('show');
}
function showPinReceiptForOrder(orderId){
  const o = ordersCache.find(x => String(x.id) === String(orderId));
  if(!o || !o.pinCode) return;
  showPinReceipt(o);
}
function copyText(text, btn){
  const done = () => { if(btn){ const t = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(()=>{ btn.textContent = t; }, 1500); } };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, ()=>{ prompt('Copy:', text); }); }
  else { prompt('Copy:', text); }
}
function renderOrders(){
  const list = document.getElementById('orderList');
  if(!list) return;

  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(session && window.__bgReady === false){ list.innerHTML = '<div class="empty-state">⏳ Orders load වෙනවා...</div>'; return; }
  if(!session){
    list.innerHTML = '<div class="empty-state">ඔබේ orders බලන්න <a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);">Login</a> වෙන්න.</div>';
    return;
  }

  const myOrders = ordersCache.filter(o => o.userPhone === session.phone);
  if(myOrders.length === 0){
    list.innerHTML = '<div class="empty-state">තවම orders කිසිවක් නැහැ. Top-up එකක් කරලා බලන්න!</div>';
    return;
  }
  list.innerHTML = myOrders.map(o => {
    const dt = orderDateTime(o);
    return `
    <div class="order-row">
      <div>
        <div><strong>${escHtml(o.package)}</strong>${o.uid && o.uid !== '-' ? ' — UID: ' + escHtml(o.uid) : ''}${o.player ? ' (' + escHtml(o.player) + ')' : ''}${o.region ? ' · ' + escHtml(o.region) : ''}</div>
        <div class="oid">#${escHtml(o.orderNo || o.id)} · ${escHtml(dt.date)}${dt.time ? ' ' + escHtml(dt.time) : ''} · ${escHtml(o.payment || PAY_EZ_WALLET)}</div>
        ${o.pinCode ? `<div class="pin-reveal">🔑 Redeem Pin: <strong>${escHtml(o.pinCode)}</strong> <button class="btn btn-ghost btn-sm" onclick="copyText('${escHtml(o.pinCode)}', this)">Copy</button></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:flex-end;">
        <div style="color:var(--gold);font-weight:700;">${o.walletType === 'coins' ? Math.round(o.amount).toLocaleString('en-US') + ' Coins' : 'Rs. ' + Number(o.amount).toLocaleString('en-US')}</div>
        <div class="status-pill ${o.status==='Processing'?'status-pending':(o.status==='Rejected'?'status-rejected':'status-done')}">${escHtml(o.status)}</div>
        <div class="order-actions">
          <button class="btn btn-primary btn-sm" onclick="${o.pinCode ? `showPinReceiptForOrder(${o.id})` : `showReceiptForOrder(${o.id})`}">🧾 Receipt</button>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(STORE_WHATSAPP, `Hi, Order #${o.orderNo || o.id} (${o.package}${o.uid && o.uid !== '-' ? ', UID ' + o.uid : ''}) ගැන.`)}">💬 Admin</a>
          ${canBuyAgain(o) ? `<a class="btn btn-ghost btn-sm" href="free-fire.html?uid=${encodeURIComponent(o.uid)}&pkg=${encodeURIComponent(o.package)}">🔁 Buy again</a>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- WhatsApp helpers ---------- */
const STORE_WHATSAPP = '94760627795';
function waNumber(phone){
  const d = String(phone || '').replace(/\D/g, '');
  if(d.startsWith('94')) return d;
  if(d.startsWith('0')) return '94' + d.slice(1);
  return d;
}
function waLink(phone, text){ return 'https://wa.me/' + waNumber(phone) + '?text=' + encodeURIComponent(text); }
/* Free Fire orders can be repeated with one tap (same UID + same package) */
function canBuyAgain(o){
  if(!o.region || !o.uid || o.uid === '-' || o.pinDocId) return false;
  return Object.keys(packageData).some(c => packageData[c].items.some(p => p.label === o.package))
      || Object.values(ffRegionPackagesCache).some(list => (list || []).some(p => p.label === o.package));
}

/* ---------- Saved Player IDs (this device) ---------- */
function getSavedUids(){ try{ return JSON.parse(localStorage.getItem('ff_saved_uids') || '[]'); }catch(e){ return []; } }
function saveUid(uid, name){
  if(!/^\d{8,12}$/.test(uid)) return;
  const list = getSavedUids().filter(x => x.uid !== uid);
  list.unshift({ uid });                       // only the number is remembered on this device — player info is always fetched live
  try{ localStorage.setItem('ff_saved_uids', JSON.stringify(list.slice(0, 5))); }catch(e){}
  renderSavedUids();
}
function removeSavedUid(uid){
  try{ localStorage.setItem('ff_saved_uids', JSON.stringify(getSavedUids().filter(x => x.uid !== uid))); }catch(e){}
  renderSavedUids();
}
function useSavedUid(uid){
  const input = document.getElementById('uidInput'); if(!input) return;
  input.value = uid; onUidInput();
  if(!(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL)) verifyUID();
}
function renderSavedUids(){
  const box = document.getElementById('savedUids'); if(!box) return;
  const list = getSavedUids();
  box.innerHTML = list.length
    ? '<span class="saved-label">Saved IDs:</span> ' + list.map(x => `<span class="saved-chip"><button type="button" onclick="useSavedUid('${x.uid}')">${x.uid}</button><i onclick="removeSavedUid('${x.uid}')" title="Remove">✕</i></span>`).join('')
    : '';
}
/* /free-fire.html?uid=...&pkg=...  (from "Buy again") — fill the UID and pick the package */
let buyAgainDone = false;
function applyBuyAgainParams(){
  if(buyAgainDone || !document.getElementById('pkgContainer')) return;
  const regionSel = document.getElementById('ffRegionSelect');
  if(!regionSel || !regionSel.options.length) return;        // region picker not ready yet — it calls us again when it is
  const q = new URLSearchParams(location.search);
  const uid = q.get('uid'), pkg = q.get('pkg');
  if(!uid && !pkg) { buyAgainDone = true; return; }
  buyAgainDone = true;
  if(uid){ const input = document.getElementById('uidInput'); if(input){ input.value = uid; onUidInput(); if(!(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL)) verifyUID(); } }
  if(pkg){
    const data = getFFPackageData();
    for(const cat of Object.keys(data)){
      const idx = data[cat].items.findIndex(p => p.label === pkg);
      if(idx >= 0){ selectPkg(cat, idx); const el = document.getElementById(`pkg-${cat}-${idx}`); if(el) el.scrollIntoView({ block:'center' }); break; }
    }
  }
}

/* ---------- WALLET (Firestore 'wallets' collection, doc ID = phone or 'guest') ---------- */
let walletsCache = {};       // EZ Cash / Redeem Wallet balances  { phone: number }
let bankWalletsCache = {};   // Bank Wallet balances              { phone: number }
let coinWalletsCache = {};   // Sakindu Coins balances            { phone: number }
async function refreshWalletsCache(){
  const all = await fsGetAllWalletDocs();
  walletsCache = {}; bankWalletsCache = {}; coinWalletsCache = {};
  Object.keys(all).forEach(k => { walletsCache[k] = all[k].ez; bankWalletsCache[k] = all[k].bank; coinWalletsCache[k] = all[k].coins || 0; });
}
async function refreshMyWallet(){
  const k = currentWalletKey(); if(!k) return;
  const b = await fsGetWalletBalances(k);
  walletsCache[k] = b.ez; bankWalletsCache[k] = b.bank; coinWalletsCache[k] = b.coins || 0;
}
function setCachedBalance(key, type, value){
  if(type === 'bank') bankWalletsCache[key] = value; else if(type === 'coins') coinWalletsCache[key] = value; else walletsCache[key] = value;
}
function currentWalletKey(){
  // Every wallet action requires login, so this only ever resolves to a real account's phone number.
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  return session ? session.phone : null;
}
function getWalletBalance(key, type){
  const k = key || currentWalletKey();
  if(!k) return 0;
  if(type === 'bank') return bankWalletsCache[k] || 0;
  if(type === 'coins') return coinWalletsCache[k] || 0;
  return walletsCache[k] || 0;                      // default / 'ez'
}
async function creditUserWallet(key, amount, type){
  const newBal = await fsAdjustWallet(key, type || 'ez', amount);
  setCachedBalance(key, type || 'ez', newBal);
  return newBal;
}
function renderWallet(){
  const session = getSession();
  const set = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
  if(session){
    const ez = getWalletBalance(session.phone, 'ez'), bank = getWalletBalance(session.phone, 'bank'), coins = getWalletBalance(session.phone, 'coins');
    set('walletBalanceEz', fmtRs2(ez)); set('walletBalanceBank', fmtRs2(bank)); set('walletBalanceCoins', Math.floor(coins).toLocaleString('en-US') + ' Coins');
    set('walletEzAmt', fmtRs2(ez).replace('Rs. ', '')); set('walletBankAmt', fmtRs2(bank).replace('Rs. ', ''));
    set('profileWalletEz', fmtRs2(ez)); set('profileWalletBank', fmtRs2(bank));
  }
  renderHeaderWallets();
}
/* both wallets with their balances, top-right corner of the header on every page */
function renderHeaderWallets(){
  const header = document.querySelector('header');
  if(!header) return;
  let box = document.getElementById('hdrWallets');
  const session = getSession();
  if(!session){ if(box) box.style.display = 'none'; return; }
  if(!box){
    box = document.createElement('a'); box.id = 'hdrWallets'; box.className = 'hdr-wallets'; box.href = 'wallet.html';
    const ham = header.querySelector('.hamburger');
    if(ham) header.insertBefore(box, ham); else header.appendChild(box);
  }
  const short = n => { n = round2(n); return n >= 100000 ? Math.round(n / 1000) + 'k' : (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2)); };
  box.style.display = 'flex';
  box.innerHTML = `<span class="hw ez" title="EZ Cash Wallet"><i>EZ</i>${short(getWalletBalance(session.phone, 'ez'))}</span><span class="hw bank" title="Bank Wallet"><i>BANK</i>${short(getWalletBalance(session.phone, 'bank'))}</span>`;
}

/* ---------- WALLET RECHARGE (deposit form) ---------- */
const MIN_DEPOSIT = 100;
const AGENT_DEPOSIT_FEE = 20;                       // deducted when the money was sent through a shop / agent / reload machine
const HOW_TO_DEPOSIT_VIDEO_URL = '';                // paste the "How to Deposit & Top-Up" YouTube link here (empty = hidden)
const DEPOSIT_QUICK = [200, 500, 1000, 2000, 5000];
let depMethod = null;                               // 'ez' | 'bank'
let depTarget = (function(){ try{ return new URLSearchParams(location.search).get('target') === 'coins' ? 'coins' : 'main'; }catch(e){ return 'main'; } })();   // 'coins' = recharging Sakindu Coins (reseller)
let depSource = 'own';                              // eZ Cash only: 'own' | 'agent'
let depProof = 'ref';                               // eZ Cash only: 'ref' | 'slip'
let depTime = { h: 12, m: 0, ap: 'AM' };
let depSlipFile = null;
const p2 = n => String(n).padStart(2, '0');

function openDeposit(method){
  if(!getSession()){ openAuth('login'); return; }
  depMethod = method; depSource = 'own'; depProof = 'ref'; depSlipFile = null;
  document.getElementById('wlMethods').style.display = 'none';
  document.getElementById('wlDeposit').style.display = 'block';
  const isEz = method === 'ez';
  document.getElementById('wlDepBadge').innerHTML = isEz ? '<span class="wl-logo ez">eZ <i>Cash</i></span> Deposit' : '<span class="wl-logo bank">🏦</span> Bank Transfer Deposit';
  document.getElementById('wlEzOnly').style.display = isEz ? 'block' : 'none';
  document.getElementById('wlBankOnly').style.display = isEz ? 'none' : 'block';
  document.getElementById('depAmount').value = '';
  document.getElementById('depRef').value = '';
  document.getElementById('depStatus').textContent = ''; document.getElementById('depStatus').className = 'verify-status';
  setDepSource('own'); setDepProof('ref'); setDepNow(); renderDepQuick(); renderSlipLabel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function closeDeposit(){
  document.getElementById('wlDeposit').style.display = 'none';
  document.getElementById('wlMethods').style.display = 'block';
  depMethod = null;
}
function renderDepQuick(){
  const cur = parseInt(document.getElementById('depAmount').value, 10);
  document.getElementById('depQuick').innerHTML = '<span class="wl-ql">Quick Select:</span>' +
    DEPOSIT_QUICK.map(v => `<button type="button" class="wl-chip ${cur === v ? 'on' : ''}" onclick="setDepAmount(${v})">Rs.${v.toLocaleString('en-US')}</button>`).join('');
}
function setDepAmount(v){ document.getElementById('depAmount').value = v; renderDepQuick(); }
function setDepSource(s){
  depSource = s;
  document.querySelectorAll('#wlSource .wl-opt').forEach(el => el.classList.toggle('on', el.dataset.v === s));
}
function setDepProof(p){
  depProof = p;
  document.querySelectorAll('#wlProofTabs button').forEach(el => el.classList.toggle('on', el.dataset.v === p));
  document.getElementById('wlProofRef').style.display = p === 'ref' ? 'block' : 'none';
  document.getElementById('wlProofSlip').style.display = p === 'slip' ? 'block' : 'none';
}
function buildTimeSelects(){
  const hs = document.getElementById('depHour'), ms = document.getElementById('depMin');
  if(!hs || hs.options.length) return;
  for(let h = 1; h <= 12; h++) hs.add(new Option(p2(h), h));
  for(let m = 0; m < 60; m++) ms.add(new Option(p2(m), m));
}
function renderDepTime(){
  buildTimeSelects();
  document.getElementById('depHour').value = depTime.h; document.getElementById('depMin').value = depTime.m;
  document.querySelectorAll('#depAmPm button').forEach(b => b.classList.toggle('on', b.dataset.v === depTime.ap));
  document.getElementById('depTimeShow').textContent = p2(depTime.h) + ':' + p2(depTime.m) + ' ' + depTime.ap;
}
function setDepNow(){
  const d = new Date(); const h = d.getHours();
  depTime = { h: h % 12 === 0 ? 12 : h % 12, m: d.getMinutes(), ap: h >= 12 ? 'PM' : 'AM' };
  renderDepTime();
}
function onDepTimeChange(){
  depTime.h = parseInt(document.getElementById('depHour').value, 10);
  depTime.m = parseInt(document.getElementById('depMin').value, 10);
  renderDepTime();
}
function setDepAmPm(v){ depTime.ap = v; renderDepTime(); }
function onSlipPicked(input){
  const f = input.files && input.files[0];
  const st = document.getElementById('depStatus');
  if(f && f.size > 12 * 1024 * 1024){ st.textContent = '⚠️ File එක 12MB ට වඩා විශාලයි.'; st.className = 'verify-status err'; input.value = ''; depSlipFile = null; renderSlipLabel(); return; }
  if(f && f.type && f.type.indexOf('image/') !== 0){ st.textContent = '⚠️ පින්තූරයක් (screenshot / photo) පමණයි දාන්න පුළුවන්.'; st.className = 'verify-status err'; input.value = ''; depSlipFile = null; renderSlipLabel(); return; }
  st.textContent = ''; depSlipFile = f || null; renderSlipLabel();
}
function renderSlipLabel(){
  const isEz = depMethod === 'ez';
  const txt = depSlipFile ? '✅ ' + depSlipFile.name : (isEz ? 'Click to select eZ Cash Deposit Slip / Receipt Photo' : 'Click to select Bank Deposit Slip / Transfer Screenshot');
  ['depSlipLabel', 'depSlipLabelBank'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = txt; });
}
async function submitDeposit(){
  const session = getSession();
  const st = document.getElementById('depStatus');
  const fail = m => { st.innerHTML = m; st.className = 'verify-status err'; };
  if(!session){ openAuth('login'); return; }
  const amount = parseInt(document.getElementById('depAmount').value, 10);
  if(!amount || amount < MIN_DEPOSIT){ return fail(`⚠️ අවම Deposit එක Rs. ${MIN_DEPOSIT}යි.`); }
  const isEz = depMethod === 'ez';
  const useSlip = !isEz || depProof === 'slip';
  let reference = '';
  if(useSlip){
    if(!depSlipFile) return fail('⚠️ Deposit Slip / Receipt එක select කරන්න.');
  } else {
    reference = document.getElementById('depRef').value.replace(/\s/g, '');
    if(reference.length < 6) return fail('⚠️ නිවැරදි Reference Number එක දාන්න.');
  }
  const btn = document.getElementById('depSubmitBtn');
  btn.disabled = true; btn.textContent = 'Submitting...'; st.textContent = ''; st.className = 'verify-status';
  try{
    if(reference && await fsWalletReferenceExists(reference)) { btn.disabled = false; btn.textContent = 'SUBMIT DEPOSIT REQUEST'; return fail('❌ මේ Reference Number එක කලින් submit කරලා තියෙනවා.'); }
    const id = Date.now();
    const fee = (isEz && depSource === 'agent') ? AGENT_DEPOSIT_FEE : 0;
    const req = {
      id, phone: session.phone, name: session.name, amount, agentFee: fee, creditAmount: Math.max(0, amount - fee),
      method: isEz ? 'Ez Cash' : 'Bank Transfer', walletType: depTarget === 'coins' ? 'coins' : (isEz ? 'ez' : 'bank'),
      source: isEz ? (depSource === 'agent' ? 'Shop / Agent' : 'Own eZ Cash') : 'Bank',
      proofType: useSlip ? 'slip' : 'reference',
      status: 'Pending', date: new Date(id).toLocaleString(), createdAt: new Date(id).toISOString()
    };
    if(reference){ req.reference = reference; req.paymentTime = p2(depTime.h) + ':' + p2(depTime.m) + ' ' + depTime.ap; }
    if(useSlip){ req.receipt = await fileToDataURL(depSlipFile); req.receiptName = depSlipFile.name; }
    await fsAddWalletRequest(req);
    st.innerHTML = depTarget === 'coins' ? `✅ Request එක submit උනා! Admin verify කළාම <strong>${Math.floor(req.creditAmount)} Sakindu Coins</strong> ඔබේ account එකට add වේ.` : `✅ Deposit request එක submit උනා! Admin verify කළාම <strong>${fmtRs2(req.creditAmount)}</strong> ඔබේ ${walletLabel(req.walletType)} එකට add වේ.`;
    st.className = 'verify-status ok';
    depSlipFile = null; document.getElementById('depAmount').value = ''; document.getElementById('depRef').value = '';
    ['depSlipFile', 'depSlipFileBank'].forEach(i => { const e = document.getElementById(i); if(e) e.value = ''; });
    renderSlipLabel(); renderDepQuick();
    renderRechargeHistory();
  } catch(err){
    console.error('[SakinduStore] deposit request error', err);
    const perm = err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
    fail(`❌ Request එක submit කරන්න බැරි උනා.<br><span style="font-size:.78rem;opacity:.85;">${perm ? 'Database permission error (Firestore rules). Admin ට කියන්න.' : escHtml(err.message || err)}${err && err.code ? ' [' + escHtml(err.code) + ']' : ''}</span>`);
  } finally { btn.disabled = false; btn.textContent = 'SUBMIT DEPOSIT REQUEST'; }
}

/* ---------- REDEEM CODES (Firestore config/redeemCodes) ---------- */
const defaultRedeemCodes = {
  "SAKINDU100": { amount: 100, category: "normal", maxUses: 0, usedCount: 0 },
  "FREEFIRE50": { amount: 50, category: "normal", maxUses: 0, usedCount: 0 },
  "WELCOME200": { amount: 200, category: "giveaway", maxUses: 30, usedCount: 0 },
};
const REDEEM_DAILY_LIMITS = { giveaway: 1, normal: 10 };
let redeemCodesCache = {};
async function refreshRedeemCodesCache(){
  redeemCodesCache = await fsGetConfig('redeemCodes', defaultRedeemCodes);
}
function todayStr(){
  return new Date().toISOString().slice(0,10); // YYYY-MM-DD
}
async function redeemCode(){
  try{ await (window.__bgLoad || Promise.resolve()); }catch(e){}
  const code = document.getElementById('redeemInput').value.trim().toUpperCase();
  const status = document.getElementById('redeemStatus');
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ status.textContent = '⚠️ Redeem කරන්න කලින් Login / Sign Up වෙන්න ඕන.'; status.className = 'verify-status'; openAuth('login'); return; }
  if(!code){ status.textContent = 'Code එකක් type කරන්න.'; status.className='verify-status'; return; }

  if(!redeemCodesCache[code]){
    // not an admin code -> maybe a personal referral wallet code (REF-XXXX-XXXX)
    try{
      const r = await fsRedeemPointCode(code, session.phone);
      if(r){
        setCachedBalance(session.phone, 'ez', r.balance); renderWallet();
        status.textContent = `✅ Rs. ${r.amount.toLocaleString('en-US')} ඔබේ EZ Cash Wallet එකට add උනා!`; status.className = 'verify-status ok';
        document.getElementById('redeemInput').value = ''; return;
      }
    }catch(e){
      status.textContent = e.code === 'used' ? '⚠️ මේ code එක කලින් redeem කරලා තියෙනවා.' : (e.code === 'notowner' ? '❌ මේ code එක ඔබේ account එකට අයිති නැහැ.' : '❌ ' + (e.message || e));
      status.className = 'verify-status err'; return;
    }
  }
  const entry = redeemCodesCache[code];
  if(!entry){ status.textContent = '❌ Invalid redeem code.'; status.className = 'verify-status'; return; }

  const key = currentWalletKey();
  try{
    const wdoc = await fsGetWalletDoc(key);
    const redeemedList = wdoc.redeemedCodes || [];
    if(redeemedList.includes(code)){
      status.textContent = '⚠️ මේ code එක කලින් redeem කරලා තියෙනවා.';
      status.className = 'verify-status';
      return;
    }
    if(entry.maxUses && entry.usedCount >= entry.maxUses){
      status.textContent = '⚠️ මේ code එකේ use limit එක ඉවරයි.';
      status.className = 'verify-status';
      return;
    }
    const category = entry.category || 'normal';
    const limit = REDEEM_DAILY_LIMITS[category] || REDEEM_DAILY_LIMITS.normal;
    const today = todayStr();
    const dateField = category === 'giveaway' ? 'redeemGiveawayDate' : 'redeemNormalDate';
    const countField = category === 'giveaway' ? 'redeemGiveawayCount' : 'redeemNormalCount';
    const usedToday = (wdoc[dateField] === today) ? (wdoc[countField] || 0) : 0;
    if(usedToday >= limit && !(await isUnlimitedAccount(session.phone))){
      status.textContent = category === 'giveaway'
        ? '⚠️ දවසකට Giveaway code 1ක් විතරයි redeem කරන්න පුළුවන් — හෙට try කරන්න.'
        : `⚠️ දවසකට Normal codes ${limit}ක් redeem කරලා ඉවරයි — හෙට try කරන්න.`;
      status.className = 'verify-status';
      return;
    }

    await creditUserWallet(key, entry.amount);
    await fsMergeWalletDoc(key, {
      redeemedCodes: [...redeemedList, code],
      [dateField]: today,
      [countField]: usedToday + 1
    });
    entry.usedCount = (entry.usedCount || 0) + 1;
    await fsSetConfig('redeemCodes', redeemCodesCache);

    status.textContent = `✅ Rs. ${entry.amount} ඔබේ EZ Cash / Redeem Wallet එකට add උනා!`;
    status.className = 'verify-status ok';
    renderWallet();
  } catch(err){
    console.error('[SakinduStore] redeemCode error', err);
    status.innerHTML = `❌ Redeem කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
    status.className = 'verify-status err';
  }
}

/* ---------- DEPOSIT HISTORY (customer's own requests) ---------- */
async function renderRechargeHistory(){
  const list = document.getElementById('rechargeHistoryList');
  if(!list) return;
  const session = getSession();
  if(!session){
    list.innerHTML = '<div class="wl-empty">Deposit history බලන්න <a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);">Login</a> වෙන්න.</div>';
    return;
  }
  try{
    const mine = await fsGetMyWalletRequests(session.phone);
    if(mine.length === 0){
      list.innerHTML = '<div class="wl-empty">No deposits found. Add credits to your wallet using the form above.</div>';
      return;
    }
    list.innerHTML = mine.map(r => {
      const cls = r.status === 'Pending' ? 'status-pending' : (r.status === 'Rejected' ? 'status-rejected' : 'status-done');
      return `
      <div class="wl-hist">
        <div>
          <div class="wl-hist-top"><strong>${escHtml(r.method || 'Deposit')} → ${escHtml(walletLabel(r.walletType || 'ez'))}</strong>${r.source && r.source !== 'Bank' ? `<small> · ${escHtml(r.source)}</small>` : ''}</div>
          <div class="wl-hist-sub">${escHtml(r.date || '')}${r.reference ? ' · Ref: ' + escHtml(r.reference) : ''}${r.paymentTime ? ' · ' + escHtml(r.paymentTime) : ''}</div>
          ${r.agentFee ? `<div class="wl-hist-sub">Agent fee −${fmtRs(r.agentFee)} → credit ${fmtRs2(r.creditAmount)}</div>` : ''}
        </div>
        <div style="text-align:right;"><div class="wl-hist-amt">${fmtRs2(r.amount)}</div><div class="status-pill ${cls}">${escHtml(r.status)}</div></div>
      </div>`;
    }).join('');
  } catch(err){
    console.error('[SakinduStore] deposit history error', err);
    list.innerHTML = `<div class="wl-empty">History load කරන්න බැරි උනා.</div>`;
  }
}

/* ---------- TOP SPENDER LEADERBOARD ---------- */
function renderLeaderboard(){
  const el = document.getElementById('leaderboardList');
  if(!el) return;
  if(window.__bgReady === false){ el.innerHTML = '<div class="empty-state">⏳ Loading...</div>'; return; }

  const totals = {};
  ordersCache.forEach(o => {
    if(!o.userPhone) return;
    totals[o.userPhone] = (totals[o.userPhone] || 0) + o.amount;
  });

  const ranked = Object.keys(totals)
    .filter(phone => usersCache[phone])
    .map(phone => ({ phone, name: usersCache[phone].name, avatar: usersCache[phone].avatar, total: totals[phone] }))
    .sort((a,b) => b.total - a.total)
    .slice(0, 10);

  if(ranked.length === 0){
    el.innerHTML = '<div class="empty-state">තවම Top Spenders කිසිවක් නැහැ — Login කරලා top-up කරපු පළවෙනි කෙනා වෙන්න!</div>';
    return;
  }

  el.innerHTML = ranked.map((r, i) => {
    const rankClass = i===0 ? 'rank1' : i===1 ? 'rank2' : i===2 ? 'rank3' : '';
    const avatarHtml = isImgToken(r.avatar)
      ? `<img class="lb-avatar" data-img-token="${r.avatar}" alt="${r.name}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">`
      : r.avatar
      ? `<img class="lb-avatar" src="${r.avatar}" alt="${r.name}">`
      : `<div class="lb-avatar">${r.name.charAt(0).toUpperCase()}</div>`;
    return `
      <div class="lb-row ${rankClass}">
        <div class="lb-rank">${i+1}</div>
        ${avatarHtml}
        <div class="lb-name">${r.name}</div>
        <div class="lb-amount">Rs. ${r.total}</div>
      </div>`;
  }).join('');
  // profile pictures live in the images database — fill them in for the (max 10) rows shown
  el.querySelectorAll('img[data-img-token]').forEach(async img => {
    try{ const u = await fsLoadImage(img.getAttribute('data-img-token')); if(u) img.src = u; }catch(e){}
  });
}

/* ---------- CUSTOMER REVIEWS (Firestore config/reviews) ---------- */
const defaultReviews = [
  {name:"Lakmal Perera", loc:"Colombo, Sri Lanka", stars:5, text:"Super fast delivery, UID verify එක instant. Highly recommend!", seed:true},
  {name:"Nimasha K.", loc:"Kandy, Sri Lanka", stars:4, text:"Good rates and friendly WhatsApp support.", seed:true},
];
let reviewsCache = [];
async function refreshReviewsCache(){
  reviewsCache = await fsGetConfig('reviews', defaultReviews);
}
function renderReviews(){
  const el = document.getElementById('reviewScroll');
  if(!el) return;
  if(window.__bgReady === false) return;           // reviews are still loading in the background
  const reviews = reviewsCache.slice().reverse();
  el.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-head">
        <div class="review-avatar">${r.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="review-name">${r.name}</div>
          <div class="review-loc">📍 ${r.loc}</div>
        </div>
      </div>
      <div class="review-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div>
      <div class="review-text">"${r.text}"</div>
      <div class="review-foot">
        <span class="review-new-tag">${r.seed ? '✅ Verified Buyer' : '🆕 New Review'}</span>
      </div>
    </div>
  `).join('');
}
let pickedStars = 5;
function openReviewModal(){
  pickedStars = 5;
  renderStarPicker();
  document.getElementById('reviewOverlay').classList.add('show');
}
function closeReviewModal(){ document.getElementById('reviewOverlay').classList.remove('show'); }
function renderStarPicker(){
  const el = document.getElementById('starPicker');
  el.innerHTML = [1,2,3,4,5].map(n => `<span class="${n<=pickedStars?'active':''}" onclick="setStars(${n})">★</span>`).join('');
}
function setStars(n){ pickedStars = n; renderStarPicker(); }
async function submitReview(){
  const name = document.getElementById('reviewName').value.trim();
  const loc = document.getElementById('reviewLoc').value.trim();
  const text = document.getElementById('reviewText').value.trim();
  const msg = document.getElementById('reviewMsg');
  if(!name || !text){ msg.textContent = 'Name සහ review එක type කරන්න.'; msg.className = 'verify-status'; return; }
  reviewsCache.push({name, loc: loc || "Sri Lanka", stars: pickedStars, text, seed:false});
  await fsSetConfig('reviews', reviewsCache);
  closeReviewModal();
  document.getElementById('reviewName').value='';
  document.getElementById('reviewLoc').value='';
  document.getElementById('reviewText').value='';
  renderReviews();
}

/* ---------- AUTH (Firestore 'users' collection, doc ID = phone) ---------- */
let usersCache = {};
async function refreshUsersCache(){
  usersCache = await fsGetUsers();
}
let authMode = 'login';
/* The login / sign-up modal used to exist only on index.html, so openAuth() crashed on every other page.
   It is now injected on demand so it works everywhere (wallet page, game pages, pin shop...). */
function ensureAuthModal(){
  if(document.getElementById('authOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="modal-overlay" id="authOverlay">
  <div class="modal">
    <button class="close-x" onclick="closeAuth()">✕</button>
    <h3 id="authTitle">Login</h3>
    <p class="modal-sub" id="authSub">ඔබේ account එකට login වෙන්න</p>
    <input type="text" id="authName" placeholder="Name" style="display:none;">
    <div id="authAvatarRow" style="display:none;text-align:center;margin-bottom:14px;">
      <div id="authAvatarPreview" style="width:70px;height:70px;border-radius:50%;background:var(--bg-panel-2);border:1px solid var(--line);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;overflow:hidden;">👤</div>
      <input type="file" id="authAvatarFile" accept="image/*" style="display:none;" onchange="previewAuthAvatar()">
      <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('authAvatarFile').click()">📷 Profile Image (optional)</button>
    </div>
    <input type="email" id="authEmail" placeholder="Email Address" style="display:none;">
    <input type="text" id="authPhone" placeholder="Phone Number">
    <input type="password" id="authPass" placeholder="Password">
    <label id="authAgeRow" class="age-check" style="display:none;"><input type="checkbox" id="authAge"> <span>මම අවුරුදු 18ට වඩා වැඩියි (18+). Top-up කරන්න පුළුවන් අවුරුදු 18ට වැඩි අයට පමණයි.</span></label>
    <div id="authVerifyBox" style="display:none;">
      <input type="text" id="authCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6-digit code" style="text-align:center;letter-spacing:8px;font-size:1.3rem;font-weight:700;" oninput="this.value=this.value.replace(/\\D/g,'')">
      <div style="text-align:center;margin:-4px 0 10px;"><button type="button" class="btn btn-ghost btn-sm" id="authResendBtn" onclick="resendEmailCode()">Resend code</button></div>
    </div>
    <button class="btn btn-primary btn-block" id="authContinueBtn" onclick="submitAuth()">Continue</button>
    <div id="authGoogleBox"><div class="auth-or"><span>or</span></div>
    <button type="button" class="btn-google" onclick="googleAuth()"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continue with Google</button></div>
    <div id="authMsg" class="verify-status"></div>
    <div class="modal-switch" id="authSwitch">Account එකක් නැද්ද? <a href="#" onclick="toggleAuthMode();return false;">Sign Up</a></div>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}
function openAuth(mode){
  ensureAuthModal();
  authMode = mode;
  updateAuthModalUI();
  document.getElementById('authOverlay').classList.add('show');
}
function closeAuth(){ document.getElementById('authOverlay').classList.remove('show'); }
function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  updateAuthModalUI();
}
let pendingAvatar = null;
function previewAuthAvatar(){
  const file = document.getElementById('authAvatarFile').files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    pendingAvatar = e.target.result;
    document.getElementById('authAvatarPreview').innerHTML = `<img src="${pendingAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}
function updateAuthModalUI(){
  const vb = document.getElementById('authVerifyBox'); if(vb) vb.style.display = authMode === 'verify' ? 'block' : 'none';
  const cb = document.getElementById('authContinueBtn'); if(cb) cb.textContent = authMode === 'verify' ? 'Verify & Create Account' : 'Continue';
  if(authMode === 'verify'){
    document.getElementById('authTitle').textContent = 'Verify your email';
    document.getElementById('authSub').textContent = (pendingSignup ? pendingSignup.email : '') + ' වෙත යැවූ 6-digit code එක ඇතුළත් කරන්න';
    ['authName','authEmail','authPass','authPhone'].forEach(i => { const e = document.getElementById(i); if(e) e.style.display = 'none'; });
    ['authAvatarRow','authAgeRow'].forEach(i => { const e = document.getElementById(i); if(e) e.style.display = 'none'; });
    document.getElementById('authGoogleBox').style.display = 'none';
    document.getElementById('authSwitch').innerHTML = `<a href="#" onclick="authMode='signup';pendingSignup=null;updateAuthModalUI();return false;">← Back</a>`;
    return;
  }
  const ph = document.getElementById('authPhone'); if(ph) ph.style.display = 'block';
  if(authMode === 'google'){
    document.getElementById('authTitle').textContent = 'Almost done!';
    document.getElementById('authSub').textContent = (pendingGoogle ? pendingGoogle.email + ' — ' : '') + 'ඔබේ Phone Number එක දාලා account එක complete කරන්න';
    ['authName','authEmail','authPass'].forEach(i => { const e = document.getElementById(i); if(e) e.style.display = 'none'; });
    const av = document.getElementById('authAvatarRow'); if(av) av.style.display = 'none';
    const ar = document.getElementById('authAgeRow'); if(ar) ar.style.display = 'flex';
    document.getElementById('authGoogleBox').style.display = 'none';
    document.getElementById('authPhone').style.display = 'block';
    document.getElementById('authSwitch').innerHTML = `<a href="#" onclick="authMode='login';pendingGoogle=null;updateAuthModalUI();return false;">← Back</a>`;
    document.getElementById('authMsg').textContent = '';
    return;
  }
  ['authPass'].forEach(i => { const e = document.getElementById(i); if(e) e.style.display = 'block'; });
  const gb = document.getElementById('authGoogleBox'); if(gb) gb.style.display = 'block';
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'Login' : 'Sign Up';
  document.getElementById('authSub').textContent = isLogin ? 'ඔබේ account එකට login වෙන්න' : 'අලුත් account එකක් සාදන්න';
  document.getElementById('authName').style.display = isLogin ? 'none' : 'block';
  const emailEl = document.getElementById('authEmail');
  if(emailEl) emailEl.style.display = isLogin ? 'none' : 'block';
  const avatarRow = document.getElementById('authAvatarRow');
  if(avatarRow) avatarRow.style.display = isLogin ? 'none' : 'block';
  const ageRow = document.getElementById('authAgeRow');
  if(ageRow) ageRow.style.display = isLogin ? 'none' : 'flex';
  if(!isLogin){ pendingAvatar = null; const prev = document.getElementById('authAvatarPreview'); if(prev) prev.innerHTML = '👤'; }
  document.getElementById('authSwitch').innerHTML = isLogin
    ? `Account එකක් නැද්ද? <a href="#" onclick="toggleAuthMode();return false;">Sign Up</a>`
    : `Account එකක් තියෙනවද? <a href="#" onclick="toggleAuthMode();return false;">Login</a>`;
  document.getElementById('authMsg').textContent = '';
}

async function submitAuth(){
  if(authMode === 'google'){ return finishGoogleSignup(); }
  if(authMode === 'verify'){ return verifyEmailCode(); }
  const phone = document.getElementById('authPhone').value.trim();
  const pass = document.getElementById('authPass').value.trim();
  const name = document.getElementById('authName').value.trim();
  const emailEl = document.getElementById('authEmail');
  const email = emailEl ? emailEl.value.trim() : '';
  const msg = document.getElementById('authMsg');
  if(!phone || !pass){ msg.textContent = 'කරුණාකර සියලු fields පුරවන්න.'; msg.className='verify-status'; return; }
  if(authMode === 'signup' && !email){ msg.textContent = 'Email address එකක් දාන්න.'; msg.className='verify-status'; return; }
  if(authMode === 'signup' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = '⚠️ Valid email address එකක් දාන්න.'; msg.className='verify-status'; return; }
  const ageEl = document.getElementById('authAge');
  if(authMode === 'signup' && ageEl && !ageEl.checked){ msg.textContent = '⚠️ SakinduStore භාවිතා කළ හැක්කේ අවුරුදු 18ට වැඩි අයට පමණයි — 18+ බව confirm කරන්න.'; msg.className='verify-status'; return; }

  const submitBtn = document.querySelector('#authOverlay .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Please wait...'; }
  msg.textContent = '';
  msg.className = 'verify-status';

  try{
    const existing = await fsGetUser(phone);
    if(authMode === 'signup'){
      if(existing){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className='verify-status'; return; }
      const data = { phone, name: name || 'Player', email, pass, avatar: pendingAvatar || null };
      if(EMAIL_VERIFY_URL){                                   // e-mail a code first; the account is created after it is entered
        const sent = await sendEmailCode(email, msg);
        if(!sent) return;
        pendingSignup = data; authMode = 'verify'; updateAuthModalUI();
        startResendTimer(45);
        msg.textContent = '📧 Code එක email එකට යැව්වා (spam folder එකත් බලන්න).'; msg.className = 'verify-status ok';
        return;
      }
      await createSignupAccount(data);
    } else {
      if(!existing || existing.pass !== pass){
        msg.textContent = '❌ Phone number හෝ password වැරදියි.'; msg.className='verify-status';
        return;
      }
      usersCache[phone] = existing;
      await loginSession(phone, existing.name);
    }
  } catch(err){
    console.error('[SakinduStore] auth error', err);
    msg.innerHTML = `❌ Server එකට connect වෙන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
    msg.className = 'verify-status err';
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = authMode === 'verify' ? 'Verify & Create Account' : 'Continue'; }
  }
}
/* ---------- GOOGLE SIGN-IN / SIGN-UP ----------
   Uses Firebase Authentication (loaded on demand). Existing customers are matched by Google uid or e-mail and simply logged in;
   brand-new Google users only have to add their phone number (accounts are keyed by phone) and confirm 18+. */
let pendingGoogle = null;
function loadScriptOnce(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector('script[data-src="' + src + '"]')) return resolve();
    const s = document.createElement('script'); s.src = src; s.dataset.src = src;
    s.onload = resolve; s.onerror = () => reject(new Error('Google Sign-In script load වුණේ නැහැ'));
    document.head.appendChild(s);
  });
}
async function googleAuth(){
  const msg = document.getElementById('authMsg');
  msg.className = 'verify-status'; msg.textContent = 'Google වලට connect වෙනවා...';
  try{
    await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js');
    const auth = firebase.auth();
    const res = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    const gu = res.user;
    try{ await auth.signOut(); }catch(e){}                       // the store keeps its own session
    const email = (gu.email || '').trim();
    if(!email){ msg.textContent = '❌ Google account එකේ email එකක් නැහැ.'; msg.className = 'verify-status err'; return; }
    const found = await fsFindUserByGoogle(gu.uid, email);
    if(found){
      if(!found.googleUid){ try{ await fsMergeUser(found.phone, { googleUid: gu.uid }); }catch(e){} }
      usersCache[found.phone] = Object.assign({}, found, { googleUid: gu.uid });
      await loginSession(found.phone, found.name || gu.displayName || 'Player');
      return;
    }
    // new customer -> ask for the phone number only
    pendingGoogle = { uid: gu.uid, email, name: gu.displayName || 'Player', photo: gu.photoURL || null };
    authMode = 'google';
    updateAuthModalUI();
  }catch(err){
    console.error('[SakinduStore] google auth', err);
    const c = err && err.code;
    msg.className = 'verify-status err';
    msg.textContent = c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' ? 'Google sign-in එක cancel කළා.'
      : c === 'auth/unauthorized-domain' ? '❌ මේ domain එක Firebase → Authentication → Authorized domains වලට add කරලා නැහැ.'
      : c === 'auth/operation-not-allowed' ? '❌ Firebase Console එකේ Google sign-in provider එක enable කරලා නැහැ.'
      : c === 'auth/popup-blocked' ? '❌ Pop-up block වෙලා. Allow කරලා නැවත try කරන්න.'
      : '❌ Google sign-in අසාර්ථකයි: ' + ((err && err.message) || err);
  }
}
async function finishGoogleSignup(){
  const msg = document.getElementById('authMsg');
  const phone = document.getElementById('authPhone').value.replace(/[\s-]/g, '');
  const ageEl = document.getElementById('authAge');
  if(!/^\d{9,12}$/.test(phone)){ msg.textContent = '⚠️ නිවැරදි Phone Number එකක් දාන්න.'; msg.className = 'verify-status err'; return; }
  if(ageEl && !ageEl.checked){ msg.textContent = '⚠️ 18+ බව confirm කරන්න.'; msg.className = 'verify-status err'; return; }
  const btn = document.getElementById('authContinueBtn'); btn.disabled = true; btn.textContent = 'Please wait...';
  try{
    if(await fsGetUser(phone)){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා. වෙනත් number එකක් දාන්න.'; msg.className = 'verify-status err'; return; }
    const userData = { name: pendingGoogle.name, email: pendingGoogle.email, pass: '', googleUid: pendingGoogle.uid, avatar: pendingGoogle.photo, ageConfirmed18: true, createdAt: new Date().toISOString() };
    await fsSetUser(phone, userData);
    usersCache[phone] = userData; pendingGoogle = null;
    await loginSession(phone, userData.name);
  }catch(err){ msg.textContent = '❌ ' + ((err && err.message) || err); msg.className = 'verify-status err'; }
  finally{ btn.disabled = false; btn.textContent = 'Continue'; }
}
/* ---------- sign-up e-mail verification (client side) ---------- */
let pendingSignup = null, emailCodeProof = null, resendTimer = null;
async function createSignupAccount(d){
  const userData = { name: d.name, email: d.email, pass: d.pass, avatar: d.avatar || null, ageConfirmed18: true, createdAt: new Date().toISOString() };
  if(EMAIL_VERIFY_URL) userData.emailVerified = true;
  await fsSetUser(d.phone, userData);
  usersCache[d.phone] = userData; pendingSignup = null; emailCodeProof = null;
  await loginSession(d.phone, userData.name);
}
async function sendEmailCode(email, msgEl){
  try{
    const r = await fetch(EMAIL_VERIFY_URL.replace(/\/$/, '') + '/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    if(j.ok){ emailCodeProof = { exp: j.exp, sig: j.sig }; return true; }
    msgEl.className = 'verify-status err';
    msgEl.textContent = j.error === 'wait' ? `⏳ තත්පර ${j.retryIn || 45} කින් නැවත try කරන්න.`
      : j.error === 'rate_limited' ? '⚠️ ගොඩක් requests. පැයකට පස්සේ try කරන්න.'
      : j.error === 'bad_email' ? '⚠️ Valid email address එකක් දාන්න.'
      : '❌ Verification email එක යවන්න බැරි උනා. පසුව try කරන්න.';
  }catch(e){ msgEl.className = 'verify-status err'; msgEl.textContent = '❌ Verification server එකට connect වෙන්න බැරි උනා.'; }
  return false;
}
function startResendTimer(sec){
  const b = document.getElementById('authResendBtn'); if(!b) return;
  clearInterval(resendTimer); let left = sec; b.disabled = true; b.textContent = `Resend in ${left}s`;
  resendTimer = setInterval(() => { left--; if(left <= 0){ clearInterval(resendTimer); b.disabled = false; b.textContent = 'Resend code'; } else b.textContent = `Resend in ${left}s`; }, 1000);
}
async function resendEmailCode(){
  if(!pendingSignup) return;
  const msg = document.getElementById('authMsg');
  if(await sendEmailCode(pendingSignup.email, msg)){ startResendTimer(45); msg.textContent = '📧 අලුත් code එකක් යැව්වා.'; msg.className = 'verify-status ok'; }
}
async function verifyEmailCode(){
  const msg = document.getElementById('authMsg'), btn = document.getElementById('authContinueBtn');
  const code = document.getElementById('authCode').value.replace(/\D/g, '');
  if(code.length !== 6){ msg.textContent = '⚠️ 6-digit code එක දාන්න.'; msg.className = 'verify-status err'; return; }
  if(!pendingSignup || !emailCodeProof){ authMode = 'signup'; updateAuthModalUI(); return; }
  btn.disabled = true; btn.textContent = 'Checking...';
  try{
    const r = await fetch(EMAIL_VERIFY_URL.replace(/\/$/, '') + '/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingSignup.email, code, exp: emailCodeProof.exp, sig: emailCodeProof.sig }) });
    const j = await r.json().catch(() => ({}));
    if(!j.ok){
      msg.className = 'verify-status err';
      msg.textContent = j.error === 'expired' ? '⌛ Code එක expire වෙලා. "Resend code" ඔබන්න.' : j.error === 'too_many' ? '⚠️ වැරදි උත්සාහ වැඩියි. අලුත් code එකක් ඉල්ලන්න.' : '❌ Code එක වැරදියි.';
      return;
    }
    const existing = await fsGetUser(pendingSignup.phone);
    if(existing){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className = 'verify-status err'; return; }
    await createSignupAccount(pendingSignup);
  }catch(e){ msg.className = 'verify-status err'; msg.textContent = '❌ ' + ((e && e.message) || e); }
  finally{ btn.disabled = false; btn.textContent = authMode === 'verify' ? 'Verify & Create Account' : 'Continue'; }
}
function deviceInfo(){
  let id = null;
  try{ id = localStorage.getItem('sk_device_id'); if(!id){ id = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('sk_device_id', id); } }catch(e){ id = 'unknown'; }
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : 'Browser';
  return { id, name: os + ' · ' + br };
}
async function registerLoginDevice(phone){
  try{
    const me = deviceInfo();
    const u = await fsGetUser(phone);
    const list = ((u && u.devices) || []).filter(x => x.id !== me.id);
    list.unshift({ id: me.id, name: me.name, lastLogin: new Date().toISOString() });
    await fsMergeUser(phone, { devices: list.slice(0, 8) });
  }catch(e){ console.error('[SakinduStore] device log', e); }
}
async function loginSession(phone, name){
  localStorage.setItem('sakindu_session', JSON.stringify({phone, name}));
  closeAuth();
  refreshAuthUI();
  registerLoginDevice(phone);
  await refreshMyWallet();
  renderWallet();
  renderLeaderboard();
  if(typeof onProfileLogin === 'function') onProfileLogin();
}
function logoutUser(){
  localStorage.removeItem('sakindu_session');
  refreshAuthUI();
  renderWallet();
  if(typeof renderProfile === 'function') renderProfile();
  if(typeof renderReseller === 'function') renderReseller();
}
function refreshAuthUI(){
  const session = getSession();
  try{ renderHeaderWallets(); }catch(e){}
  const navLink = document.getElementById('navAuthLink');
  const sideLink = document.getElementById('sidebarAuthLink');
  const sideLogout = document.getElementById('sidebarLogout');
  if(session){
    if(navLink){ navLink.textContent = '👤 ' + session.name; navLink.href = 'profile.html'; navLink.onclick = null; }
    if(sideLink){ sideLink.innerHTML = `<span class="ic">👤</span> ${escHtml(session.name)} · Profile`; sideLink.href = 'profile.html'; sideLink.onclick = null; }
    if(sideLogout){ sideLogout.style.display = 'flex'; }
  } else {
    if(navLink){ navLink.textContent = 'Login'; navLink.href = '#'; navLink.onclick = (e)=>{e.preventDefault(); openAuth('login');}; }
    if(sideLink){ sideLink.innerHTML = '<span class="ic">👤</span> Login / Profile'; sideLink.href = '#'; sideLink.onclick = (e)=>{e.preventDefault(); closeSidebar(); openAuth('login');}; }
    if(sideLogout){ sideLogout.style.display = 'none'; }
  }
}

/* ---------- GAMES CATALOG (Firestore config/games) ---------- */
const defaultGames = [
  {slug:'free-fire', name:'FREE FIRE', desc:'Diamonds, Weekly/Monthly Membership, Level Up Pass — multiple regions', status:'active', imgVar:'IMG_FREEFIRE', link:'free-fire.html', region:'12 Regions'},
  {slug:'shelltopup-free-fire', name:'Shelltopup Free Fire', desc:'Pay with Shells — Diamonds, Memberships, Level Up Pass', status:'active', imgVar:'IMG_FREEFIRE', link:'shelltopup.html', region:'Shell Topup'},
  {slug:'codm', name:'CALL OF DUTY MOBILE', desc:'CP top-up coming soon', status:'coming-soon', imgVar:'IMG_CODM', link:'codm.html', region:'2 Regions'},
  {slug:'bloodstrike', name:'BLOOD STRIKE', desc:'Gold top-up coming soon', status:'coming-soon', imgVar:'IMG_BLOODSTRIKE', link:'bloodstrike.html', region:'Global'},
  {slug:'ff-likes', name:'FF Profile Likes', desc:'Free Fire profile likes boost', status:'coming-soon', imgVar:'IMG_FFLIKES', link:'ff-likes.html', ffVerify:true},
  {slug:'delta-force-pc', name:'Delta Force (PC)', desc:'', status:'coming-soon', imgVar:'IMG_DELTAFORCE', link:'delta-force-pc.html', region:'Global'},
  {slug:'minecraft', name:'Minecraft', desc:'', status:'coming-soon', imgVar:'IMG_MINECRAFT', link:'minecraft.html'},
  {slug:'mobile-legends', name:'Mobile Legend', desc:'', status:'coming-soon', imgVar:'IMG_MOBILELEGENDS', link:'mobile-legends.html', region:'9 Regions', fieldType:'dual', field1Label:'User ID', field2Label:'Zone ID'},
  {slug:'where-winds-meet', name:'Where Winds Meet', desc:'', status:'coming-soon', imgVar:'IMG_WHEREWINDSMEET', link:'where-winds-meet.html', region:'Global'},
  {slug:'pubgm', name:'PUBG Mobile', desc:'', status:'coming-soon', imgVar:'IMG_PUBGM', link:'pubgm.html', region:'Global'},
  {slug:'valorant-sg-pc', name:'Valorant SG (PC)', desc:'', status:'coming-soon', imgVar:'IMG_VALORANT', link:'valorant-sg-pc.html', region:'7 Regions'},
  {slug:'garena-undown', name:'Garena Undown', desc:'', status:'coming-soon', imgVar:'IMG_GARENAUNDYING', link:'garena-undown.html', region:'Global'},
  {slug:'honor-of-kings', name:'Honor Of King', desc:'', status:'coming-soon', imgVar:'IMG_HONOROFKINGS', link:'honor-of-kings.html', region:'Global'},
  {slug:'asphalt9', name:'Asphalt 9 (Android)', desc:'', status:'coming-soon', imgVar:'IMG_ASPHALT9', link:'asphalt9.html', region:'Global'},
  {slug:'farlight84', name:'Farlight84', desc:'', status:'coming-soon', imgVar:'IMG_FARLIGHT84', link:'farlight84.html', region:'Global'},
  {slug:'8-ball-pool', name:'8 Ball Pool', desc:'', status:'coming-soon', imgVar:'IMG_8BALLPOOL', link:'8-ball-pool.html', region:'Global'},
  {slug:'state-of-survival', name:'State Of Survival', desc:'', status:'coming-soon', imgVar:'IMG_STATEOFSURVIVAL', link:'state-of-survival.html', region:'Global'},
  {slug:'whiteout-survival', name:'Whiteout Survival', desc:'', status:'coming-soon', imgVar:'IMG_WHITEOUTSURVIVAL', link:'whiteout-survival.html', region:'Global'},
  {slug:'teen-patti-gold', name:'Teen Patti Gold', desc:'', status:'coming-soon', imgVar:'IMG_TEENPATTIGOLD', link:'teen-patti-gold.html', region:'Global'},
  {slug:'garena-my-shells', name:'Garena MY Shells', desc:'', status:'coming-soon', imgVar:'IMG_GARENASHELLS', link:'garena-my-shells.html', fieldType:'email'},
  {slug:'arena-breakout', name:'Arena Breakout', desc:'', status:'coming-soon', imgVar:'IMG_ARENABREAKOUT', link:'arena-breakout.html', region:'Global'},
  {slug:'rainbow-six-mobile', name:'Rainbow Six Mobile', desc:'', status:'coming-soon', link:'rainbow-six-mobile.html', region:'Global'},
  {slug:'clash-of-clans', name:'Clash Of Clans', desc:'', status:'coming-soon', imgVar:'IMG_CLASHOFCLANS', link:'clash-of-clans.html'},
  {slug:'genshin-impact', name:'Genshin Impact', desc:'', status:'coming-soon', link:'genshin-impact.html', region:'2 Regions'},
  {slug:'honkai-impact-3rd', name:'Honkai Impact 3rd', desc:'', status:'coming-soon', link:'honkai-impact-3rd.html', region:'Global'},
  {slug:'honkai-star-rail', name:'Honkai Star Rail', desc:'', status:'coming-soon', link:'honkai-star-rail.html', region:'Global'},
  {slug:'zenless-zone-zero', name:'Zenless Zone Zero', desc:'', status:'coming-soon', link:'zenless-zone-zero.html', region:'Global'},
  {slug:'mobile-legends-adventure', name:'Mobile Legends Adventure', desc:'', status:'coming-soon', link:'mobile-legends-adventure.html'},
  {slug:'league-of-legends-pc', name:'League of Legends PC', desc:'', status:'coming-soon', link:'league-of-legends-pc.html', region:'4 Regions'},
  {slug:'league-of-legends-wild-rift', name:'League of Legends Wild Rift', desc:'', status:'coming-soon', link:'league-of-legends-wild-rift.html', region:'4 Regions'},
  {slug:'teamfight-tactics', name:'Teamfight Tactics', desc:'', status:'coming-soon', link:'teamfight-tactics.html', region:'4 Regions'},
  {slug:'identity-v', name:'Identity V', desc:'', status:'coming-soon', link:'identity-v.html', region:'Global'},
  {slug:'tower-of-fantasy', name:'Tower of Fantasy', desc:'', status:'coming-soon', link:'tower-of-fantasy.html', region:'Global'},
  {slug:'wuthering-waves', name:'Wuthering Waves', desc:'', status:'coming-soon', link:'wuthering-waves.html', region:'Global'},
  {slug:'stumble-guys', name:'Stumble Guys', desc:'', status:'coming-soon', link:'stumble-guys.html', region:'Global'},
  {slug:'pokemon-unite', name:'Pokemon Unite', desc:'', status:'coming-soon', link:'pokemon-unite.html', region:'4 Regions'},
  {slug:'punishing-gray-raven', name:'Punishing: Gray Raven', desc:'', status:'coming-soon', link:'punishing-gray-raven.html', region:'Global'},
  {slug:'ragnarok-m-classic', name:'Ragnarok M Classic', desc:'', status:'coming-soon', link:'ragnarok-m-classic.html', region:'Global'},
  {slug:'ragnarok-origin', name:'Ragnarok Origin', desc:'', status:'coming-soon', link:'ragnarok-origin.html', region:'Global'},
  {slug:'maplestory-m', name:'MapleStory M', desc:'', status:'coming-soon', link:'maplestory-m.html', region:'Global'},
  {slug:'lineage-w', name:'Lineage W', desc:'', status:'coming-soon', link:'lineage-w.html', region:'Global'},
  {slug:'afk-journey', name:'AFK Journey', desc:'', status:'coming-soon', link:'afk-journey.html', region:'Global'},
  {slug:'ea-sports-fc-mobile', name:'EA Sports FC Mobile', desc:'', status:'coming-soon', link:'ea-sports-fc-mobile.html', region:'3 Regions'},
  {slug:'growtopia', name:'Growtopia', desc:'', status:'coming-soon', link:'growtopia.html', region:'Global'},
  {slug:'eggy-party', name:'Eggy Party', desc:'', status:'coming-soon', link:'eggy-party.html', region:'Global'},
  {slug:'marvel-rivals', name:'Marvel Rivals', desc:'', status:'coming-soon', link:'marvel-rivals.html', region:'Global'},
  {slug:'mecha-break', name:'Mecha Break', desc:'', status:'coming-soon', link:'mecha-break.html', region:'Global'},
  {slug:'once-human', name:'Once Human', desc:'', status:'coming-soon', link:'once-human.html', region:'Global'},
  {slug:'roblox', name:'Roblox', desc:'', status:'coming-soon', imgVar:'IMG_ROBLOX', link:'roblox.html', region:'Global'},
  {slug:'modern-strike-online', name:'Modern Strike Online', desc:'', status:'coming-soon', link:'modern-strike-online.html', region:'Global'},
  {slug:'modern-warships-naval-battle', name:'Modern Warships: Naval Battle', desc:'', status:'coming-soon', link:'modern-warships-naval-battle.html', region:'Global'},
  {slug:'mongil-star-dive', name:'Mongil Star Dive', desc:'', status:'coming-soon', link:'mongil-star-dive.html', region:'Global'},
  {slug:'monster-hunter-outlanders', name:'Monster Hunter Outlanders', desc:'', status:'coming-soon', imgVar:'IMG_MONSTERHUNTER', link:'monster-hunter-outlanders.html', region:'Malaysia'},
  {slug:'moonlight-blade-m', name:'Moonlight Blade M', desc:'', status:'coming-soon', link:'moonlight-blade-m.html', region:'Global'},
  {slug:'my-singing-monsters', name:'My Singing Monsters', desc:'', status:'coming-soon', link:'my-singing-monsters.html', region:'Global'},
  {slug:'neverness-to-everness', name:'Neverness to Everness', desc:'', status:'coming-soon', link:'neverness-to-everness.html', region:'Global'},
  {slug:'one-punch-man-the-strongest', name:'One Punch Man: The Strongest', desc:'', status:'coming-soon', link:'one-punch-man-the-strongest.html', region:'Southeast Asia'},
  {slug:'onmyoji-arena', name:'Onmyoji Arena', desc:'', status:'coming-soon', link:'onmyoji-arena.html', region:'Global'},
  {slug:'overmortal-idle', name:'Overmortal Idle', desc:'', status:'coming-soon', link:'overmortal-idle.html', region:'2 Regions'},
  {slug:'oxide-survival-island', name:'Oxide: Survival Island', desc:'', status:'coming-soon', link:'oxide-survival-island.html', region:'Global'},
  {slug:'pago-live', name:'Pago Live', desc:'', status:'coming-soon', link:'pago-live.html', region:'Global'},
  {slug:'path-to-nowhere', name:'Path to Nowhere', desc:'', status:'coming-soon', link:'path-to-nowhere.html', region:'Global'},
  {slug:'pixel-gun-3d', name:'Pixel Gun 3D', desc:'', status:'coming-soon', link:'pixel-gun-3d.html', region:'Global'},
  {slug:'poppo-live', name:'Poppo Live', desc:'', status:'coming-soon', link:'poppo-live.html', region:'Global'},
  {slug:'poppo-live-2', name:'Poppo Live 2', desc:'', status:'coming-soon', link:'poppo-live-2.html', region:'Global'},
  {slug:'project-entropy', name:'Project Entropy', desc:'', status:'coming-soon', link:'project-entropy.html', region:'Global'},
  {slug:'puzzles-and-survival', name:'Puzzles and Survival', desc:'', status:'coming-soon', link:'puzzles-and-survival.html', region:'Global'},
  {slug:'racing-master', name:'Racing Master', desc:'', status:'coming-soon', link:'racing-master.html', region:'Southeast Asia'},
  {slug:'racing-master-latam', name:'Racing Master LATAM', desc:'', status:'coming-soon', link:'racing-master-latam.html', region:'Latin America'},
  {slug:'ace-racer', name:'Ace Racer', desc:'', status:'coming-soon', link:'ace-racer.html', region:'2 Regions'},
  {slug:'acecraft', name:'Acecraft', desc:'', status:'coming-soon', link:'acecraft.html', region:'Global'},
  {slug:'age-of-empires-mobile', name:'Age of Empires Mobile', desc:'', status:'coming-soon', link:'age-of-empires-mobile.html', region:'Global'},
  {slug:'aniimo', name:'Aniimo', desc:'', status:'coming-soon', link:'aniimo.html', region:'Global'},
  {slug:'arena-of-valor-rov', name:'Arena of Valor / RoV', desc:'', status:'coming-soon', link:'arena-of-valor-rov.html', region:'Thailand'},
  {slug:'arknight-endfield', name:'Arknight: Endfield', desc:'', status:'coming-soon', link:'arknight-endfield.html', region:'Global'},
  {slug:'astra-knights-of-veda', name:'Astra: Knights of Veda', desc:'', status:'coming-soon', link:'astra-knights-of-veda.html', region:'Global'},
  {slug:'astral-guardians-cyber-fate', name:'Astral Guardians: Cyber Fate', desc:'', status:'coming-soon', link:'astral-guardians-cyber-fate.html', region:'Global'},
  {slug:'azur-lane', name:'Azur Lane', desc:'', status:'coming-soon', link:'azur-lane.html', region:'Global'},
  {slug:'bleach-soul-resonance', name:'Bleach Soul Resonance', desc:'', status:'coming-soon', link:'bleach-soul-resonance.html', region:'2 Regions'},
  {slug:'be-the-king', name:'Be The King', desc:'', status:'coming-soon', link:'be-the-king.html', region:'3 Regions'},
  {slug:'bigo-live', name:'Bigo Live', desc:'', status:'coming-soon', link:'bigo-live.html', region:'Global'},
  {slug:'black-clover-m-asia', name:'Black Clover M Asia', desc:'', status:'coming-soon', link:'black-clover-m-asia.html', region:'Global'},
  {slug:'blockman-go', name:'Blockman Go', desc:'', status:'coming-soon', link:'blockman-go.html', region:'Global'},
  {slug:'cats-crash-arena-turbo-stars', name:'Cats: Crash Arena Turbo Stars', desc:'', status:'coming-soon', link:'cats-crash-arena-turbo-stars.html', region:'Global'},
  {slug:'chamet', name:'Chamet', desc:'', status:'coming-soon', link:'chamet.html', region:'Global'},
  {slug:'civilization-eras-allies', name:'Civilization: Eras & Allies', desc:'', status:'coming-soon', link:'civilization-eras-allies.html', region:'Global'},
  {slug:'cooking-adventure', name:'Cooking Adventure', desc:'', status:'coming-soon', link:'cooking-adventure.html', region:'Global'},
  {slug:'crossfire-legend', name:'Crossfire: Legend', desc:'', status:'coming-soon', link:'crossfire-legend.html', region:'Global'},
  {slug:'crossout-mobile', name:'Crossout Mobile', desc:'', status:'coming-soon', link:'crossout-mobile.html', region:'Global'},
  {slug:'crystal-of-atlan', name:'Crystal of Atlan', desc:'', status:'coming-soon', link:'crystal-of-atlan.html', region:'Global'},
  {slug:'delta-force-garena', name:'Delta Force Garena', desc:'', status:'coming-soon', link:'delta-force-garena.html', region:'2 Regions'},
  {slug:'destiny-rising', name:'Destiny: Rising', desc:'', status:'coming-soon', link:'destiny-rising.html', region:'Global'},
  {slug:'dragon-nest-m-classic', name:'Dragon Nest M: Classic', desc:'', status:'coming-soon', link:'dragon-nest-m-classic.html', region:'Southeast Asia'},
  {slug:'dragon-raja', name:'Dragon Raja', desc:'', status:'coming-soon', link:'dragon-raja.html', region:'2 Regions'},
  {slug:'dragonheir-silent-gods', name:'Dragonheir: Silent Gods', desc:'', status:'coming-soon', link:'dragonheir-silent-gods.html', region:'Global'},
  {slug:'duet-night-abyss', name:'Duet Night Abyss', desc:'', status:'coming-soon', link:'duet-night-abyss.html', region:'Global'},
  {slug:'dunk-city-dynasty', name:'Dunk City Dynasty', desc:'', status:'coming-soon', link:'dunk-city-dynasty.html', region:'Philippines'},
  {slug:'dynasty-heroes-legend-samkok', name:'Dynasty Heroes: Legend Samkok', desc:'', status:'coming-soon', link:'dynasty-heroes-legend-samkok.html', region:'Global'},
  {slug:'echocalypse-scarlet-covenant', name:'Echocalypse: Scarlet Covenant', desc:'', status:'coming-soon', link:'echocalypse-scarlet-covenant.html', region:'Global'},
  {slug:'enhypen', name:'Enhypen', desc:'', status:'coming-soon', link:'enhypen.html', region:'Global'},
  {slug:'etheria-restart', name:'Etheria Restart', desc:'', status:'coming-soon', link:'etheria-restart.html', region:'Global'},
  {slug:'eve-echoes', name:'EVE Echoes', desc:'', status:'coming-soon', link:'eve-echoes.html', region:'Global'},
  {slug:'football-master-2', name:'Football Master 2', desc:'', status:'coming-soon', link:'football-master-2.html', region:'Global'},
  {slug:'last-hunter-k-seoul', name:'Last Hunter K: Seoul', desc:'', status:'coming-soon', link:'last-hunter-k-seoul.html', region:'Global'},
  {slug:'life-makeover', name:'Life Makeover', desc:'', status:'coming-soon', link:'life-makeover.html', region:'Global'},
  {slug:'lifeafter', name:'LifeAfter', desc:'', status:'coming-soon', link:'lifeafter.html', region:'Global'},
  {slug:'light-of-thel-new-era', name:'Light of Thel: New Era', desc:'', status:'coming-soon', link:'light-of-thel-new-era.html', region:'Global'},
  {slug:'likee', name:'Likee', desc:'', status:'coming-soon', link:'likee.html', region:'Global'},
  {slug:'lita', name:'Lita', desc:'', status:'coming-soon', link:'lita.html', region:'Global'},
  {slug:'livu', name:'LivU', desc:'', status:'coming-soon', link:'livu.html', region:'Global'},
  {slug:'love-nikki', name:'Love Nikki', desc:'', status:'coming-soon', link:'love-nikki.html', region:'Global'},
  {slug:'love-and-deepspace', name:'Love and Deepspace', desc:'', status:'coming-soon', link:'love-and-deepspace.html', region:'Global'},
  {slug:'mu-origin-2', name:'MU Origin 2', desc:'', status:'coming-soon', link:'mu-origin-2.html', region:'Global'},
  {slug:'mu-origin-3', name:'MU Origin 3', desc:'', status:'coming-soon', link:'mu-origin-3.html', region:'Southeast Asia'},
  {slug:'magic-chess', name:'Magic Chess', desc:'', status:'coming-soon', link:'magic-chess.html', region:'6 Regions'},
  {slug:'marvel-duel', name:'Marvel Duel', desc:'', status:'coming-soon', link:'marvel-duel.html', region:'Global'},
  {slug:'marvel-mystic-mayhem', name:'Marvel Mystic Mayhem', desc:'', status:'coming-soon', link:'marvel-mystic-mayhem.html', region:'Global'},
  {slug:'metal-slug-awakening', name:'Metal Slug: Awakening', desc:'', status:'coming-soon', link:'metal-slug-awakening.html', region:'Global'},
  {slug:'mico-live', name:'Mico Live', desc:'', status:'coming-soon', link:'mico-live.html', region:'Global'},
  {slug:'mobile-legend-2', name:'Mobile Legend 2', desc:'', status:'coming-soon', link:'mobile-legend-2.html', region:'Malaysia'},
  {slug:'mobile-legend-special', name:'Mobile Legend Special', desc:'', status:'coming-soon', link:'mobile-legend-special.html', region:'Malaysia'},
  {slug:'ragnarok-idle-adventure', name:'Ragnarok Idle Adventure', desc:'', status:'coming-soon', link:'ragnarok-idle-adventure.html', region:'Global'},
  {slug:'ragnarok-x-next-generation', name:'Ragnarok X: Next Generation', desc:'', status:'coming-soon', link:'ragnarok-x-next-generation.html', region:'Global'},
  {slug:'rememento-white-shadows', name:'Rememento: White Shadows', desc:'', status:'coming-soon', link:'rememento-white-shadows.html', region:'Global'},
  {slug:'revelation-infinite-journey', name:'Revelation: Infinite Journey', desc:'', status:'coming-soon', link:'revelation-infinite-journey.html', region:'Global'},
  {slug:'rotaeno', name:'Rotaeno', desc:'', status:'coming-soon', link:'rotaeno.html', region:'Global'},
  {slug:'saint-seiya-awakening', name:'Saint Seiya Awakening', desc:'', status:'coming-soon', link:'saint-seiya-awakening.html', region:'Southeast Asia'},
  {slug:'shining-nikki', name:'Shining Nikki', desc:'', status:'coming-soon', link:'shining-nikki.html', region:'Global'},
  {slug:'silver-and-blood', name:'Silver and Blood', desc:'', status:'coming-soon', link:'silver-and-blood.html', region:'Global'},
  {slug:'sky-children-of-the-light', name:'Sky Children of the Light', desc:'', status:'coming-soon', link:'sky-children-of-the-light.html', region:'Global'},
  {slug:'snowbreak-containment-zone', name:'Snowbreak: Containment Zone', desc:'', status:'coming-soon', link:'snowbreak-containment-zone.html', region:'Global'},
  {slug:'soul-land-new-world', name:'Soul Land: New World', desc:'', status:'coming-soon', link:'soul-land-new-world.html', region:'Global'},
  {slug:'soulchill', name:'Soulchill', desc:'', status:'coming-soon', link:'soulchill.html', region:'Global'},
  {slug:'spring-valley-farm-adventure', name:'Spring Valley: Farm Adventure', desc:'', status:'coming-soon', link:'spring-valley-farm-adventure.html', region:'Global'},
  {slug:'star-resonance', name:'Star Resonance', desc:'', status:'coming-soon', link:'star-resonance.html', region:'Global'},
  {slug:'starfall-fantasy-neverland', name:'Starfall Fantasy: Neverland', desc:'', status:'coming-soon', link:'starfall-fantasy-neverland.html', region:'Southeast Asia'},
  {slug:'starmaker', name:'Starmaker', desc:'', status:'coming-soon', link:'starmaker.html', region:'Global'},
  {slug:'stella-sora', name:'Stella Sora', desc:'', status:'coming-soon', link:'stella-sora.html', region:'Global'},
  {slug:'stormshot', name:'Stormshot', desc:'', status:'coming-soon', link:'stormshot.html', region:'Global'},
  {slug:'super-sus', name:'Super Sus', desc:'', status:'coming-soon', link:'super-sus.html', region:'Global'},
  {slug:'gangstar-mirage-city', name:'Gangstar Mirage City', desc:'', status:'coming-soon', link:'gangstar-mirage-city.html', region:'Global'},
  {slug:'garena-delta-force', name:'Garena Delta Force', desc:'', status:'coming-soon', link:'garena-delta-force.html', region:'Latin America'},
  {slug:'ghost-story-love-destiny', name:'Ghost Story: Love Destiny', desc:'', status:'coming-soon', link:'ghost-story-love-destiny.html', region:'Global'},
  {slug:'goddess-of-victory-nikke', name:'Goddess of Victory: Nikke', desc:'', status:'coming-soon', link:'goddess-of-victory-nikke.html', region:'Global'},
  {slug:'golden-spatula', name:'Golden Spatula', desc:'', status:'coming-soon', link:'golden-spatula.html', region:'Global'},
  {slug:'hago', name:'Hago', desc:'', status:'coming-soon', link:'hago.html', region:'Global'},
  {slug:'haikyu-fly-high', name:'Haikyu Fly High', desc:'', status:'coming-soon', imgVar:'IMG_HAIKYU', link:'haikyu-fly-high.html', region:'Garena MY UID'},
  {slug:'harry-potter-magic-awakened', name:'Harry Potter Magic Awakened', desc:'', status:'coming-soon', link:'harry-potter-magic-awakened.html', region:'2 Regions'},
  {slug:'hatsune-miku', name:'Hatsune Miku', desc:'', status:'coming-soon', link:'hatsune-miku.html', region:'Global'},
  {slug:'heartopia', name:'Heartopia', desc:'', status:'coming-soon', link:'heartopia.html', region:'Global'},
  {slug:'heaven-burns-red', name:'Heaven Burns Red', desc:'', status:'coming-soon', link:'heaven-burns-red.html', region:'Global'},
  {slug:'hero-clash', name:'Hero Clash', desc:'', status:'coming-soon', link:'hero-clash.html', region:'Global'},
  {slug:'higgs-games-island', name:'Higgs Games Island', desc:'', status:'coming-soon', link:'higgs-games-island.html', region:'Global'},
  {slug:'king-of-avalon', name:'King of Avalon', desc:'', status:'coming-soon', link:'king-of-avalon.html', region:'2 Regions'},
  {slug:'kings-choice', name:'Kings Choice', desc:'', status:'coming-soon', link:'kings-choice.html', region:'Southeast Asia'},
  {slug:'kingshot', name:'Kingshot', desc:'', status:'coming-soon', link:'kingshot.html', region:'Global'},
  {slug:'kurokos-basketball-sr', name:'Kurokos Basketball SR', desc:'', status:'coming-soon', link:'kurokos-basketball-sr.html', region:'Southeast Asia'},
  {slug:'sword-of-justice', name:'Sword of Justice', desc:'', status:'coming-soon', link:'sword-of-justice.html', region:'3 Regions'},
  {slug:'t3-arena', name:'T3 Arena', desc:'', status:'coming-soon', link:'t3-arena.html', region:'Global'},
  {slug:'tarisland', name:'Tarisland', desc:'', status:'coming-soon', link:'tarisland.html', region:'Asia'},
  {slug:'the-ants', name:'The Ants', desc:'', status:'coming-soon', link:'the-ants.html', region:'Global'},
  {slug:'the-division-resurgence', name:'The Division Resurgence', desc:'', status:'coming-soon', link:'the-division-resurgence.html', region:'Global'},
  {slug:'tiktok-douyin-diamonds', name:'TikTok Douyin Diamonds', desc:'', status:'coming-soon', link:'tiktok-douyin-diamonds.html', region:'China'},
  {slug:'tom-and-jerry-chase', name:'Tom and Jerry: Chase', desc:'', status:'coming-soon', link:'tom-and-jerry-chase.html', region:'2 Regions'},
  {slug:'tomb-busters', name:'Tomb Busters', desc:'', status:'coming-soon', link:'tomb-busters.html', region:'Global'},
  {slug:'warspear', name:'Warspear', desc:'', status:'coming-soon', link:'warspear.html', region:'Global'},
  {slug:'watcher-of-realms', name:'Watcher of Realms', desc:'', status:'coming-soon', link:'watcher-of-realms.html', region:'Global'},
  {slug:'zepeto', name:'Zepeto', desc:'', status:'coming-soon', link:'zepeto.html', region:'Global'},
  {slug:'zing-card', name:'Zing Card', desc:'', status:'coming-soon', link:'zing-card.html', region:'Global'},
  {slug:'rare-uid', name:'Rare UID', desc:'Premium rare Free Fire UID numbers', status:'coming-soon', hidden:true, link:'rare-uid.html'},
];
let gamesCache = [];
async function refreshGamesCache(){
  gamesCache = await fsGetConfig('games', defaultGames);
}
async function saveGames(games){
  gamesCache = games;
  await fsSetConfig('games', games);
}
function getGames(){ return gamesCache; }
function gameImageSrc(g){
  if(g.image) return g.image;
  let v = g.imgVar;
  if(!v){ const d = defaultGames.find(x => x.slug === g.slug); if(d) v = d.imgVar; }
  if(v && typeof window[v] !== 'undefined') return window[v];
  return null;
}
function renderGamesGrid(limit){
  const el = document.getElementById('gamesGrid');
  if(!el) return;
  let sorted = gamesCache.filter(g => !g.hidden).sort((a,b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    return aActive - bActive;
  });
  if(limit) sorted = sorted.slice(0, limit);
  el.innerHTML = sorted.map(g => {
    const img = gameImageSrc(g);
    const visual = img ? `<img src="${img}" alt="${g.name}">` : `<div class="ph">🎮</div>`;
    const isActive = g.status === 'active';
    const pill = isActive && g.maintenance
      ? `<div class="game-status-pill maint"><span class="dot"></span> 🛠 MAINTENANCE</div>`
      : (isActive
        ? `<div class="game-status-pill"><span class="dot"></span> ACTIVE</div>`
        : `<div class="game-status-pill soon"><span class="dot"></span> COMING SOON</div>`);
    return `
      <a class="game-card" href="${g.link || ('game.html?slug=' + encodeURIComponent(g.slug))}">
        <div class="game-card-img-wrap">
          ${visual}
          ${pill}
        </div>
        <h3>${g.name}</h3>
        ${g.region ? `<div class="game-region">📍 ${g.region}</div>` : ''}
      </a>`;
  }).join('');
}

/* ---------- GENERIC GAME ORDER PAGE (for admin-managed games beyond Free Fire) ---------- */
let currentGenericGame = null;
let selectedGenericPkg = null;
let genericSelectedPay = PAY_EZ_WALLET;

function renderGenericGamePage(){
  // Resolve the game's slug either from a per-file PAGE_SLUG constant (dedicated
  // pages) or from ?slug= in the URL (the generic game.html fallback page —
  // this lets admin-added games work instantly without needing a new file).
  const slug = (typeof PAGE_SLUG !== 'undefined') ? PAGE_SLUG : new URLSearchParams(location.search).get('slug');
  if(!slug) return;
  const game = gamesCache.find(g => g.slug === slug);
  const root = document.getElementById('gamePageRoot');
  if(!root){ return; }
  if(!game){
    root.innerHTML = '<div class="stub-wrap"><p style="color:var(--muted);">Game එක හම්බුනේ නැහැ.</p><a href="games.html" class="btn btn-primary">← Games ටිකට return වෙන්න</a></div>';
    return;
  }
  currentGenericGame = game;

  const iconEl = document.getElementById('gamePageIcon');
  const titleEl = document.getElementById('gamePageTitle');
  const descEl = document.getElementById('gamePageDesc');
  const img = gameImageSrc(game);
  if(iconEl){ if(img){ iconEl.src = img; iconEl.style.display = 'block'; } else { iconEl.style.display = 'none'; } }
  if(titleEl) titleEl.textContent = game.name;
  if(descEl) descEl.innerHTML = (game.desc || '') + (game.region ? `<br><span style="color:var(--cyan);font-size:.85rem;">📍 ${game.region}</span>` : '');

  if(game.status === 'active' && game.packages && game.packages.length){
    const slots = (game.fields || []).filter(f => f && f.label);          // Admin "Input Slots 1-6"
    const custom = slots.length > 0;
    const regions = (game.regions || []).filter(r => r && r.name);        // Admin "Regions (20 boxes)"
    genRegionIdx = null; genIdsSet = false;
    const isEmail = !custom && game.fieldType === 'email';
    const isDual = !custom && game.fieldType === 'dual';
    const fieldLabel = custom ? slots.map(f => f.label.toUpperCase()).join(' / ') : (isEmail ? 'EMAIL ADDRESS (DELIVERY)' : (isDual ? (game.field1Label||'USER ID') + ' / ' + (game.field2Label||'ZONE ID') : 'PLAYER ID / UID'));
    const fieldPlaceholder = isEmail ? 'Email Address (delivery මේ email එකටයි) *' : 'Player ID / UID *';
    const fieldType = isEmail ? 'email' : 'text';
    const needVerify = gameNeedsFFVerify(game) && (custom ? slots.length === 1 : (!isEmail && !isDual));
    const slotInput = (f, k) => `<div class="gen-slot"><label>${escHtml(f.label)} <i>*</i></label><input type="${/e-?mail/i.test(f.label) ? 'email' : 'text'}" id="genUidInput${k ? k + 1 : ''}" placeholder="${escHtml(f.example ? 'e.g. ' + f.example : f.label)}" autocomplete="off"></div>`;
    const idFieldHtml = needVerify
      ? `<div class="field-row"><input type="text" id="genUidInput" inputmode="numeric" placeholder="${escHtml(custom && slots[0].example ? 'e.g. ' + slots[0].example : 'Free Fire Player ID (UID) *')}" oninput="onGenUidInput()"><button class="btn btn-primary" type="button" id="genVerifyBtn" onclick="verifyGenericUid()">Verify</button></div>
         <div id="genVerifyStatus" class="verify-status"></div>`
      : custom
      ? slots.map(slotInput).join('')
      : isDual
      ? `<div class="field-row">
           <input type="text" id="genUidInput" placeholder="${game.field1Label || 'User ID'} *">
           <input type="text" id="genUidInput2" placeholder="${game.field2Label || 'Zone ID'} *">
         </div>`
      : `<div class="field-row"><input type="${fieldType}" id="genUidInput" placeholder="${fieldPlaceholder}"></div>`;
    const stepOff = regions.length ? 1 : 0;
    const regionHtml = regions.length ? `
        <div class="step-label"><div class="step-num">1</div><h3>SELECT REGION</h3></div>
        <div class="gen-region-grid" id="genRegionGrid">${regions.map((r, i) => `
          <div class="region-card" id="genreg-${i}" onclick="selectGenRegion(${i})">
            <div class="r-flags">${genRegionFlags(r)}</div>
            <div class="r-name">${escHtml(r.name)}</div>
          </div>`).join('')}</div>
        <div style="height:20px;"></div>` : '';
    root.innerHTML = `
      <div class="order-panel">
        ${regionHtml}
        <div class="step-label"><div class="step-num">${1 + stepOff}</div><h3>${escHtml(fieldLabel)}</h3></div>
        ${idFieldHtml}
        ${needVerify ? '' : `<div class="gen-set-row"><button type="button" class="btn btn-primary" id="genSetBtn" onclick="toggleGenericSet()">Set</button><div id="genSetStatus" class="verify-status"></div></div>`}

        <div class="step-label" style="margin-top:20px;"><div class="step-num">${2 + stepOff}</div><h3>SELECT PACKAGE</h3></div>
        <div class="pkg-grid" id="genPkgContainer"></div>

        <div class="step-label" style="margin-top:26px;"><div class="step-num">${3 + stepOff}</div><h3>PAYMENT WALLET</h3></div>
        <div class="pay-wallets" id="genPayWallets"></div>
        <div class="wb-short" id="genWalletShortHint" style="display:none;margin-top:10px;"></div>
        <div class="wb-note">Order එක Wallet එකෙන් පමණක් pay කළ හැක. Confirm කළාම amount එක deduct වී, Admin Approve කරනකම් Processing එකේ පවතී.</div>
        <div class="order-total"><div>Total Amount</div><div class="amount" id="genTotalAmount">Rs. 0</div></div>

        <button class="btn btn-primary btn-block" style="margin-top:20px;" id="placeGenericBtn" onclick="placeGenericOrder()">Pay &amp; Order</button>
        <div id="genOrderMsg" class="verify-status" style="text-align:center;margin-top:10px;"></div>
      </div>`;
    renderGenericPackages(); updateGenericPaymentUI();
  } else {
    root.innerHTML = `
      <div class="stub-wrap">
        <p style="color:var(--muted);margin-bottom:22px;">මේ game එකේ top-up service එක ළඟදීම SakinduStore එකට එනවා. ඉවසීමෙන් සිටින්න!</p>
        <a href="index.html#games" class="btn btn-primary">← Games ටිකට return වෙන්න</a>
      </div>`;
  }
}
/* ---------- "Set" button for games without live UID verification ---------- */
let genIdsSet = false;
function genIdInputs(){ return Array.from(document.querySelectorAll('#gamePageRoot input[id^="genUidInput"]')); }
function validateGenericIds(){
  const g = currentGenericGame; if(!g) return 'Game එක load වෙලා නැහැ.';
  const slots = (g.fields || []).filter(f => f && f.label);
  const val = id => ((document.getElementById(id) || {}).value || '').trim();
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(slots.length){
    for(let k = 0; k < slots.length; k++){
      const v = val('genUidInput' + (k ? k + 1 : ''));
      if(!v) return '⚠️ ' + slots[k].label + ' එක දාන්න.';
      if(v.length > 60) return '⚠️ ' + slots[k].label + ' අකුරු 60ට වඩා වැඩියි.';
      if(/e-?mail/i.test(slots[k].label) && !emailOk(v)) return '⚠️ Valid email address එකක් දාන්න.';
    }
    return '';
  }
  const v1 = val('genUidInput');
  if(g.fieldType === 'email'){ if(!v1) return '⚠️ Email Address එක දාන්න.'; if(!emailOk(v1)) return '⚠️ Valid email address එකක් දාන්න.'; return ''; }
  if(!v1) return '⚠️ ' + (g.fieldType === 'dual' ? (g.field1Label || 'User ID') : 'Player ID / UID') + ' එක දාන්න.';
  if(v1.length > 30) return '⚠️ Player ID / UID එක characters 1-30 අතර තිබිය යුතුයි.';
  if(g.fieldType === 'dual' && !val('genUidInput2')) return '⚠️ ' + (g.field2Label || 'Zone ID') + ' එක දාන්න.';
  return '';
}
function toggleGenericSet(){
  const st = document.getElementById('genSetStatus'), btn = document.getElementById('genSetBtn'), inputs = genIdInputs();
  if(genIdsSet){                                           // "Change" -> unlock the fields again
    genIdsSet = false; inputs.forEach(i => { i.readOnly = false; i.classList.remove('set-ok'); });
    btn.textContent = 'Set'; st.className = 'verify-status'; st.textContent = ''; return;
  }
  const err = validateGenericIds();
  if(err){ st.className = 'verify-status err'; st.textContent = err; return; }
  genIdsSet = true; inputs.forEach(i => { i.readOnly = true; i.classList.add('set-ok'); });
  btn.textContent = '✏️ Change';
  st.className = 'verify-status ok'; st.innerHTML = '<span class="set-pop">✅</span> <strong>Set Successfully</strong>';
  if(typeof celebrateVerified === 'function') celebrateVerified();
}

/* ---------- Admin-defined regions on a game page ---------- */
let genRegionIdx = null;
function genRegionFlags(r){
  const codes = String(r.flags || '').split(',').map(c => c.trim()).filter(Boolean);
  if(!codes.length) return '<span class="r-icon">🌍</span>';
  return codes.map(c => `<img src="https://flagcdn.com/w80/${escHtml(c)}.png" alt="${escHtml(c.toUpperCase())}" loading="lazy" onerror="this.outerHTML='<span class=r-icon>🌍</span>'">`).join('');
}
function selectGenRegion(i){
  genRegionIdx = i;
  document.querySelectorAll('#genRegionGrid .region-card').forEach((el, k) => el.classList.toggle('on', k === i));
}
/* ---------- Free Fire account check on pages like "FF Profile Likes" (shows name + likes) ---------- */
let genVerified = false, genPlayer = null, genAutoTimer = null;
function gameNeedsFFVerify(g){ return !!(g && (g.ffVerify || g.slug === 'ff-likes')); }
function onGenUidInput(){
  const box = document.getElementById('genUidInput');
  if(box){ const clean = box.value.replace(/\D/g, ''); if(clean !== box.value) box.value = clean; }
  genVerified = false; genPlayer = null;
  const st = document.getElementById('genVerifyStatus'); if(st){ st.innerHTML = ''; st.className = 'verify-status'; }
  clearTimeout(genAutoTimer);
  if(box && typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL && /^\d{8,12}$/.test(box.value)) genAutoTimer = setTimeout(verifyGenericUid, 800);
}
async function verifyGenericUid(){
  const box = document.getElementById('genUidInput'), st = document.getElementById('genVerifyStatus'), btn = document.getElementById('genVerifyBtn');
  if(!box || !st) return;
  const uid = box.value.replace(/\D/g, '');
  genVerified = false; genPlayer = null;
  if(!/^\d{8,12}$/.test(uid)){ st.innerHTML = '⚠️ UID එක වැරදියි. ඉලක්කම් 8-12ක් තිබිය යුතුයි.'; st.className = 'verify-status err'; return; }
  if(typeof lookupPlayerInfo === 'undefined' || !PLAYER_INFO_URL){
    genVerified = true; st.innerHTML = '✅ UID accepted'; st.className = 'verify-status ok'; return;
  }
  if(btn) btn.disabled = true;
  st.innerHTML = '⏳ Checking account...'; st.className = 'verify-status';
  const info = await lookupPlayerInfo(uid);
  if(btn) btn.disabled = false;
  if(box.value.replace(/\D/g, '') !== uid) return;            // UID edited while checking
  if(info.ok && !info.fallback){
    genVerified = true; genPlayer = info; saveUid(uid);
    st.className = 'verify-status';
    st.innerHTML = playerCardHtml(info, uid, true) + (info.likes != null ? `<div class="pv-likes">❤️ ${Number(info.likes).toLocaleString()} <small>Likes</small></div>` : '');
    celebrateVerified();
  } else if(info.ok){
    genVerified = true; genPlayer = null;
    st.innerHTML = '✅ UID accepted — Player details auto ගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.'; st.className = 'verify-status ok';
  } else {
    st.innerHTML = info.error === 'not_found' ? '❌ මේ UID එක හොයාගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.' : '⚠️ Verify කරන්න බැරි උනා. ටිකකින් නැවත try කරන්න.';
    st.className = 'verify-status err';
  }
}
function renderGenericPackages(){
  const container = document.getElementById('genPkgContainer');
  if(!container || !currentGenericGame) return;
  container.innerHTML = currentGenericGame.packages.map((p,i) => `
    <div class="pkg-card" onclick="selectGenericPkg(${i})" id="genpkg-${i}">
      <div class="pkg-visual">${p.image ? `<img class="pkg-banner" src="${p.image}" alt="${escHtml(p.label)}" loading="lazy">` : `<div class="pkg-icon" style="background:linear-gradient(135deg,#29e0e8,#7c5cff)">${escHtml(String(p.label).split(' ')[0].slice(0, 6))}</div>`}</div>
      <div class="amt">${escHtml(p.label)}</div>
      <div class="meta"><div class="lbl">${escHtml(currentGenericGame.name)}</div></div>
      <div class="price">Rs. ${Number(p.price).toLocaleString('en-US')}</div>
    </div>`).join('');
}
function selectGenericPkg(i){
  selectedGenericPkg = currentGenericGame.packages[i];
  document.querySelectorAll('#gamePageRoot .pkg-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById(`genpkg-${i}`).classList.add('selected');
  updateGenericPaymentUI();
}
function updateGenericTotalUI(){
  const totalEl = document.getElementById('genTotalAmount');
  const feeEl = document.getElementById('genFeeLine');
  if(!totalEl) return;
  const c = calcCharge(selectedGenericPkg ? selectedGenericPkg.price : 0, genericSelectedPay);
  totalEl.textContent = fmtRs(c.total);
  if(feeEl){
    if(c.fee > 0){
      feeEl.style.display = 'block';
      feeEl.innerHTML = `${fmtRs(c.base)} + ${fmtRs(c.fee)} Processing Charge (1%) — Bank Wallet එකෙන් pay කරද්දී පමණයි`;
    } else { feeEl.style.display = 'none'; }
  }
}
function updateGenericPaymentUI(){
  updateGenericTotalUI();
  paintPayWallets('genPayWallets', selectedGenericPkg ? selectedGenericPkg.price : 0, 'genWalletShortHint');
  if(currentWalletKey()) refreshMyWallet().then(() => { paintPayWallets('genPayWallets', selectedGenericPkg ? selectedGenericPkg.price : 0, 'genWalletShortHint'); renderWallet(); }).catch(() => {});
}
function selectGenericPay(name){ if(name) selectPay(name); else updateGenericPaymentUI(); }

async function placeGenericOrder(){
  if(isCurrentGameInMaintenance()){ alert('🛠 මේ game එක දැනට Maintenance එකේ.'); return; }
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const genSession = getSession();
  if(!genSession){ alert('⚠️ Order එකක් දාන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  const slots = (currentGenericGame.fields || []).filter(f => f && f.label);
  const custom = slots.length > 0;
  const regions = (currentGenericGame.regions || []).filter(r => r && r.name);
  const orderMsg = document.getElementById('genOrderMsg');
  if(regions.length && genRegionIdx == null){ alert('කරුණාකර Region එකක් තෝරන්න.'); return; }
  const regionName = regions.length ? regions[genRegionIdx].name : null;
  let uid = '', fieldsOut = null;
  const isEmail = !custom && currentGenericGame.fieldType === 'email';
  const isDual = !custom && currentGenericGame.fieldType === 'dual';
  if(custom){
    const vals = slots.map((f, k) => (document.getElementById('genUidInput' + (k ? k + 1 : '')).value || '').trim());
    for(let k = 0; k < slots.length; k++){
      if(!vals[k]){ alert(slots[k].label + ' එක දාන්න.'); return; }
      if(vals[k].length > 60){ alert('⚠️ ' + slots[k].label + ' අකුරු 60ට වඩා වැඩියි.'); return; }
      if(/e-?mail/i.test(slots[k].label) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals[k])){ alert('⚠️ Valid email address එකක් දාන්න.'); return; }
    }
    fieldsOut = slots.map((f, k) => ({ label: f.label, value: vals[k] }));
    uid = vals.length > 1 ? `${vals[0]} (${fieldsOut.slice(1).map(x => x.label + ': ' + x.value).join(', ')})` : vals[0];
  } else {
    uid = document.getElementById('genUidInput').value.trim();
    const uid2El = document.getElementById('genUidInput2');
    const uid2 = uid2El ? uid2El.value.trim() : '';
    if(!uid){ alert(isEmail ? 'Email Address එක දාන්න.' : (isDual ? (currentGenericGame.field1Label||'User ID') + ' එක දාන්න.' : 'Player ID / UID එක දාන්න.')); return; }
    if(isDual && !uid2){ alert((currentGenericGame.field2Label||'Zone ID') + ' එක දාන්න.'); return; }
    if(isEmail){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid)){ alert('⚠️ Valid email address එකක් දාන්න.'); return; }
    } else if(uid.length < 1 || uid.length > 30){ alert('⚠️ Player ID / UID එක characters 1-30 අතර තිබිය යුතුයි.'); return; }
    if(isDual){ uid = `${uid} (${currentGenericGame.field2Label||'Zone'}: ${uid2})`; }
  }
  if(!selectedGenericPkg){ alert('Package එකක් තෝරන්න.'); return; }
  const needVerify = gameNeedsFFVerify(currentGenericGame) && (custom ? slots.length === 1 : (!isEmail && !isDual));
  if(needVerify && !genVerified){ alert('කරුණාකර Player ID (UID) එක verify කරන්න.'); return; }
  if(!needVerify && !genIdsSet){ alert('කරුණාකර ID එක දාලා "Set" button එක ඔබන්න.'); return; }
  if(needVerify) uid = uid.replace(/\D/g, '');

  const submitBtn = document.getElementById('placeGenericBtn') || document.querySelector('#gamePageRoot .btn-block');
  const resetBtn = () => { if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Pay & Order'; } };
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = needVerify ? 'Checking UID...' : 'Processing...'; }
  orderMsg.innerHTML = ''; orderMsg.className = 'verify-status';

  try{
    // Free Fire style IDs are re-checked against the live API right before the money is taken
    if(needVerify){
      const live = await liveVerifyBeforeOrder(uid);
      if(!live.ok){ orderMsg.innerHTML = live.message; orderMsg.className = 'verify-status err'; resetBtn(); return; }
      genPlayer = (live.info && !live.info.fallback) ? live.info : null;
      if(submitBtn) submitBtn.textContent = 'Processing...';
    }
    const id = Date.now();
    const baseOrder = {
      id, orderNo: makeOrderNo(id), createdAt: new Date(id).toISOString(), game: currentGenericGame.name,
      uid, player: genPlayer ? genPlayer.nickname : '',
      level: genPlayer ? genPlayer.level : null, playerRegion: genPlayer ? genPlayer.region : '', likesBefore: genPlayer ? genPlayer.likes : null,
      package: `${currentGenericGame.name} — ${selectedGenericPkg.label}`,
      amount: selectedGenericPkg.price, payment: selectedPay, date: new Date(id).toLocaleString(),
      userPhone: genSession.phone, userName: genSession.name || '',
      region: regionName
    };
    if(fieldsOut) baseOrder.fields = fieldsOut;
    try{
      const r = await chargeWalletAndSaveOrder(baseOrder, selectedPay, selectedGenericPkg.price);
      renderWallet(); updateGenericPaymentUI();
      orderMsg.innerHTML = `✅ Order #${escHtml(r.order.orderNo)} place උනා — ${fmtRs2(r.order.totalCharged)} ${escHtml(r.order.payment)} එකෙන් deduct කළා.`;
      orderMsg.className = 'verify-status ok';
      showOrderReceipt(r.order, true);
    } catch(err){
      if(err && err.code === 'insufficient'){ await showInsufficient(orderMsg, walletTypeForPay(selectedPay), calcCharge(selectedGenericPkg.price, selectedPay).total); }
      else { throw err; }
    }
  } catch(err){
    console.error('[SakinduStore] placeGenericOrder error', err);
    orderMsg.innerHTML = `❌ Order එක submit කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${escHtml((err && err.message) ? err.message : err)}</span>`;
    orderMsg.className = 'verify-status err';
  } finally { resetBtn(); }
}

/* ---------- STORE OPEN/CLOSED — FULL-SCREEN LOCK (Firestore config/store) ---------- */
let storeCache = { closed:false, announcement:'' };
async function refreshStoreCache(){
  storeCache = await fsGetConfig('store', { closed:false, announcement:'' });
}
function isStoreClosed(){
  return !!storeCache.closed;
}
const MAINTENANCE_SCENE = `<svg class="mt-scene" viewBox="0 0 300 200" aria-hidden="true">
<defs>
  <radialGradient id="gG" cx=".32" cy=".28" r=".95"><stop offset="0" stop-color="#fff0b8"/><stop offset=".32" stop-color="#ffc83d"/><stop offset=".72" stop-color="#d98310"/><stop offset="1" stop-color="#7a4300"/></radialGradient>
  <radialGradient id="gH" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#e59a1c"/><stop offset="1" stop-color="#6e3b00"/></radialGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a300f"/><stop offset=".35" stop-color="#d9955a"/><stop offset=".6" stop-color="#b8743a"/><stop offset="1" stop-color="#52290c"/></linearGradient>
  <linearGradient id="mFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f9ff"/><stop offset=".45" stop-color="#aab5d1"/><stop offset="1" stop-color="#66719a"/></linearGradient>
  <linearGradient id="mTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cdd7ee"/></linearGradient>
  <linearGradient id="mSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f8bad"/><stop offset="1" stop-color="#434d72"/></linearGradient>
  <linearGradient id="blade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c3cde6"/><stop offset=".75" stop-color="#7a87aa"/><stop offset="1" stop-color="#4b5679"/></linearGradient>
  <filter id="mtBlur" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="mtGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
</defs>
<ellipse class="mt-shadow" cx="150" cy="188" rx="118" ry="8" fill="#000" opacity=".42" filter="url(#mtBlur)"/>

<g class="mt-gear">
  <path d="M192.8 87.6 L202.9 88.9 L202.9 95.1 L192.8 96.4 L190.5 106.6 L199.0 112.2 L196.3 117.7 L186.6 114.5 L180.1 122.7 L185.4 131.4 L180.6 135.3 L173.2 128.2 L163.8 132.7 L164.8 142.9 L158.8 144.3 L155.2 134.7 L144.8 134.7 L141.2 144.3 L135.2 142.9 L136.2 132.7 L126.8 128.2 L119.4 135.3 L114.6 131.4 L119.9 122.7 L113.4 114.5 L103.7 117.7 L101.0 112.2 L109.5 106.6 L107.2 96.4 L97.1 95.1 L97.1 88.9 L107.2 87.6 L109.5 77.4 L101.0 71.8 L103.7 66.3 L113.4 69.5 L119.9 61.3 L114.6 52.6 L119.4 48.7 L126.8 55.8 L136.2 51.3 L135.2 41.1 L141.2 39.7 L144.8 49.3 L155.2 49.3 L158.8 39.7 L164.8 41.1 L163.8 51.3 L173.2 55.8 L180.6 48.7 L185.4 52.6 L180.1 61.3 L186.6 69.5 L196.3 66.3 L199.0 71.8 L190.5 77.4Z" fill="#5b3200" transform="translate(2.5 3.5)" opacity=".55"/>
  <path d="M192.8 87.6 L202.9 88.9 L202.9 95.1 L192.8 96.4 L190.5 106.6 L199.0 112.2 L196.3 117.7 L186.6 114.5 L180.1 122.7 L185.4 131.4 L180.6 135.3 L173.2 128.2 L163.8 132.7 L164.8 142.9 L158.8 144.3 L155.2 134.7 L144.8 134.7 L141.2 144.3 L135.2 142.9 L136.2 132.7 L126.8 128.2 L119.4 135.3 L114.6 131.4 L119.9 122.7 L113.4 114.5 L103.7 117.7 L101.0 112.2 L109.5 106.6 L107.2 96.4 L97.1 95.1 L97.1 88.9 L107.2 87.6 L109.5 77.4 L101.0 71.8 L103.7 66.3 L113.4 69.5 L119.9 61.3 L114.6 52.6 L119.4 48.7 L126.8 55.8 L136.2 51.3 L135.2 41.1 L141.2 39.7 L144.8 49.3 L155.2 49.3 L158.8 39.7 L164.8 41.1 L163.8 51.3 L173.2 55.8 L180.6 48.7 L185.4 52.6 L180.1 61.3 L186.6 69.5 L196.3 66.3 L199.0 71.8 L190.5 77.4Z" fill="url(#gG)" fill-rule="evenodd" stroke="#8a4f00" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M192.8 87.6 L202.9 88.9 L202.9 95.1 L192.8 96.4 L190.5 106.6 L199.0 112.2 L196.3 117.7 L186.6 114.5 L180.1 122.7 L185.4 131.4 L180.6 135.3 L173.2 128.2 L163.8 132.7 L164.8 142.9 L158.8 144.3 L155.2 134.7 L144.8 134.7 L141.2 144.3 L135.2 142.9 L136.2 132.7 L126.8 128.2 L119.4 135.3 L114.6 131.4 L119.9 122.7 L113.4 114.5 L103.7 117.7 L101.0 112.2 L109.5 106.6 L107.2 96.4 L97.1 95.1 L97.1 88.9 L107.2 87.6 L109.5 77.4 L101.0 71.8 L103.7 66.3 L113.4 69.5 L119.9 61.3 L114.6 52.6 L119.4 48.7 L126.8 55.8 L136.2 51.3 L135.2 41.1 L141.2 39.7 L144.8 49.3 L155.2 49.3 L158.8 39.7 L164.8 41.1 L163.8 51.3 L173.2 55.8 L180.6 48.7 L185.4 52.6 L180.1 61.3 L186.6 69.5 L196.3 66.3 L199.0 71.8 L190.5 77.4Z" fill="none" stroke="rgba(255,248,210,.75)" stroke-width="1.1" stroke-dasharray="70 400" stroke-linejoin="round"/>
  <circle cx="150" cy="92" r="33" fill="none" stroke="#a65f00" stroke-width="3"/>
  <circle cx="150" cy="92" r="31" fill="none" stroke="rgba(255,240,180,.6)" stroke-width="1"/>
  <circle cx="150" cy="92" r="19" fill="#201300" stroke="#7a4300" stroke-width="2.5"/>
  <circle cx="150" cy="92" r="17" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="3"/>
  <circle cx="150" cy="92" r="9" fill="url(#gH)" stroke="#5c3200" stroke-width="1.5"/>
  <ellipse cx="144" cy="86" rx="3.5" ry="2.2" fill="#fff" opacity=".7"/>
  <path d="M120 70 A36 36 0 0 1 150 56" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/>
</g>

<!-- HAMMER (3D block head) -->
<g class="mt-hammer">
  <rect x="53" y="76" width="14" height="112" rx="6" fill="url(#wood)" stroke="#3d1e07" stroke-width="1.2"/>
  <path d="M55 96 H65 M55 112 H65 M55 130 H65 M55 150 H65" stroke="rgba(60,28,6,.45)" stroke-width="1.2"/>
  <rect x="52" y="168" width="16" height="22" rx="7" fill="#2a2f40" stroke="#14172a" stroke-width="1"/>
  <polygon points="28,47 41,35 107,35 94,47" fill="url(#mTop)" stroke="#5a6690" stroke-width="1"/>
  <polygon points="94,47 107,35 107,69 94,81" fill="url(#mSide)" stroke="#39425f" stroke-width="1"/>
  <rect x="28" y="47" width="66" height="34" rx="3" fill="url(#mFront)" stroke="#5a6690" stroke-width="1.2"/>
  <rect x="31" y="50" width="60" height="4" rx="2" fill="#fff" opacity=".6"/>
  <rect x="28" y="47" width="9" height="34" rx="3" fill="#4d5880" opacity=".35"/>
  <rect x="85" y="47" width="9" height="34" rx="3" fill="#4d5880" opacity=".35"/>
  <rect x="49" y="78" width="22" height="9" rx="2" fill="#6a7498" stroke="#39425f"/>
</g>

<!-- SICKLE (curved steel blade) -->
<g class="mt-sickle">
  <rect x="233" y="86" width="14" height="102" rx="6" fill="url(#wood)" stroke="#3d1e07" stroke-width="1.2"/>
  <path d="M235 110 H245 M235 128 H245 M235 146 H245 M235 164 H245" stroke="rgba(60,28,6,.45)" stroke-width="1.2"/>
  <rect x="232" y="168" width="16" height="22" rx="7" fill="#2a2f40" stroke="#14172a" stroke-width="1"/>
  <rect x="230" y="78" width="20" height="14" rx="3" fill="url(#mSide)" stroke="#39425f" stroke-width="1.2"/>
  <path d="M244 84 C 252 30, 196 4, 164 44 C 160 50, 166 54, 172 50 C 194 36, 226 52, 232 84 Z" fill="url(#blade)" stroke="#4b5679" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M170 50 C 196 38, 224 54, 231 82" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".95"/>
  <path d="M246 80 C 252 36, 206 12, 172 40" fill="none" stroke="rgba(40,50,90,.55)" stroke-width="2.4" stroke-linecap="round"/>
</g>

<!-- impact sparks -->
<g class="mt-spark mt-spark-l" filter="url(#mtGlow)"><circle cx="106" cy="66" r="3.2" fill="#fff6c2"/><circle cx="112" cy="56" r="2" fill="#ffd45a"/><circle cx="114" cy="74" r="2.2" fill="#ffb02e"/><circle cx="104" cy="80" r="1.6" fill="#fff"/></g>
<g class="mt-spark mt-spark-r" filter="url(#mtGlow)"><circle cx="196" cy="62" r="3.2" fill="#fff6c2"/><circle cx="190" cy="52" r="2" fill="#ffd45a"/><circle cx="188" cy="72" r="2.2" fill="#ffb02e"/><circle cx="198" cy="78" r="1.6" fill="#fff"/></g>
</svg>`;
function upgradeLockIcon(){
  document.querySelectorAll('.store-lock-overlay .lock-ic').forEach(el => { if(!el.querySelector('.mt-scene')) el.innerHTML = '<img class="lock-logo" src="logo-header.png" alt="Sakindu Topup" style="display:block;margin:0 auto 12px;">' + MAINTENANCE_SCENE; });
}
/* ---------- per-tool maintenance (FF UID Info / FF Account Value) — switchable in Admin -> Store Status ---------- */
const TOOL_PAGES = {
  'ff-player-info':   { key: 'uidInfo',      title: 'FF UID Info' },
  'ff-account-value': { key: 'accountValue', title: 'FF Account Value' }
};
const TOOL_MAINT_DEFAULT = { uidInfo: true, accountValue: true };      // ON until an admin switches it OFF
function isToolInMaintenance(key){
  const m = (storeCache && storeCache.maint) || {};
  return Object.prototype.hasOwnProperty.call(m, key) ? !!m[key] : !!TOOL_MAINT_DEFAULT[key];
}
async function setToolMaintenance(key, on){
  storeCache.maint = Object.assign({}, storeCache.maint || {}, { [key]: !!on });
  await fsSetConfig('store', storeCache);
}
function currentToolPage(){
  const slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  return TOOL_PAGES[slug] || null;
}
/* the game this page belongs to (dedicated page constant, ?slug=, or the Free Fire page) */
function currentGameOfPage(){
  let slug = (typeof PAGE_SLUG !== 'undefined') ? PAGE_SLUG : new URLSearchParams(location.search).get('slug');
  if(!slug && document.getElementById('ffRegionSelect')) slug = 'free-fire';
  return slug ? (gamesCache.find(g => g.slug === slug) || null) : null;
}
function isCurrentGameInMaintenance(){ const g = currentGameOfPage(); return !!(g && g.status === 'active' && g.maintenance); }
function applyToolBadges(){
  document.querySelectorAll('.premium-card').forEach(c => {
    const o = c.getAttribute('onclick') || '';
    const slug = Object.keys(TOOL_PAGES).find(s => o.indexOf(s + '.html') >= 0);
    if(!slug) return;
    const on = isToolInMaintenance(TOOL_PAGES[slug].key);
    const old = c.querySelector('.mt-badge'); if(old) old.remove();
    c.classList.toggle('in-maint', on);
    if(on){ const b = document.createElement('span'); b.className = 'mt-badge'; b.textContent = '🛠 Maintenance'; c.appendChild(b); }
  });
}
function renderStoreLock(){
  upgradeLockIcon();
  const el = document.getElementById('storeLockOverlay');
  applyToolBadges();
  if(!el) return;
  const tool = currentToolPage();
  const toolMaint = !!(tool && isToolInMaintenance(tool.key));
  const game = currentGameOfPage();
  const gameMaint = !!(game && game.status === 'active' && game.maintenance);
  const title = toolMaint ? tool.title : (gameMaint ? game.name : '');
  if((toolMaint || gameMaint) && !isStoreClosed() && !el.dataset.toolText){
    el.dataset.toolText = '1';
    const h = el.querySelector('h1'), p = el.querySelector('p'), a = el.querySelector('a.btn');
    if(h) h.textContent = title + ' — Maintenance';
    if(p) p.textContent = 'මේ service එක දැනට නඩත්තු කටයුතු සඳහා තාවකාලිකව වසා ඇත. ඉක්මනින්ම නැවත ලබාගත හැකි වෙයි. ස්තූතියි!';
    if(a){ const home = document.createElement('a'); home.href = 'index.html'; home.className = 'btn btn-ghost'; home.style.marginTop = '10px'; home.textContent = '← Home'; a.insertAdjacentElement('afterend', home); }
  }
  el.classList.toggle('show', isStoreClosed() || toolMaint || gameMaint);
}
async function setStoreClosed(closed){
  storeCache.closed = closed;
  await fsSetConfig('store', storeCache);
}

/* ---------- ACCOUNT STORE (admin-manageable account listings) ---------- */
let accountsCache = [];
async function refreshAccountsCache(){ accountsCache = await fsGetConfig('accounts', []); }
async function saveAccounts(accounts){ accountsCache = accounts; await fsSetConfig('accounts', accounts); }
function accountSwapImage(cardIndex, imgIndex){
  const imgs = accountsCache[cardIndex].images || (accountsCache[cardIndex].image ? [accountsCache[cardIndex].image] : []);
  const mainEl = document.getElementById(`acctMainImg-${cardIndex}`);
  if(mainEl && imgs[imgIndex]) mainEl.src = imgs[imgIndex];
  document.querySelectorAll(`.acct-thumb-${cardIndex}`).forEach((t,i) => t.classList.toggle('active', i===imgIndex));
}
function renderAccountsGrid(containerId, limit){
  const el = document.getElementById(containerId);
  if(!el) return;
  let accounts = accountsCache;
  const indices = accounts.map((_,i)=>i);
  let list = accounts.map((a,i) => ({a, i}));
  if(limit) list = list.slice(0, limit);
  if(list.length === 0){ el.innerHTML = '<div class="empty-state">තවම accounts කිසිවක් listed නැහැ.</div>'; return; }
  el.innerHTML = list.map(({a,i}) => {
    const waMsg = encodeURIComponent(`Hi, I'm interested in this account: ${a.title} (Rs. ${a.price})`);
    const imgs = a.images && a.images.length ? a.images : (a.image ? [a.image] : []);
    const mainImg = imgs[0]
      ? `<img src="${imgs[0]}" alt="${a.title}" class="catalog-img" id="acctMainImg-${i}">`
      : '<div class="catalog-img ph">🎮</div>';
    const thumbs = imgs.length > 1 ? `
      <div class="acct-thumb-row">
        ${imgs.map((img,idx) => `<img src="${img}" class="acct-thumb acct-thumb-${i} ${idx===0?'active':''}" onclick="accountSwapImage(${i},${idx})">`).join('')}
      </div>` : '';
    return `
    <div class="catalog-card">
      ${mainImg}
      ${thumbs}
      <div class="catalog-body">
        <h3>${a.title}</h3>
        <p class="catalog-desc">${a.description||''}</p>
        <div class="catalog-chip gold">Rs. ${a.price}</div>
        <a href="https://wa.me/94760627795?text=${waMsg}" target="_blank" class="btn btn-primary btn-block" style="margin-top:12px;">📩 Contact to Buy</a>
      </div>
    </div>`;
  }).join('');
}

/* ---------- AD BANNERS (admin-manageable, image + redirect link) ---------- */
let adBannersCache = [];
async function refreshAdBannersCache(){ adBannersCache = await fsGetConfig('adBanners', []); }
async function saveAdBanners(banners){ adBannersCache = banners; await fsSetConfig('adBanners', banners); }
function renderAdBanners(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(adBannersCache.length === 0){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = adBannersCache.map(b => `
    <a href="${b.link||'#'}" target="_blank" class="ad-banner-item">
      <img src="${b.image}" alt="Ad">
    </a>`).join('');
}

/* ---------- EVENT BANNERS (admin-manageable portfolio of past/example banner designs) ---------- */
let eventBannersCache = [];
async function refreshEventBannersCache(){ eventBannersCache = await fsGetConfig('eventBanners', []); }
async function saveEventBanners(banners){ eventBannersCache = banners; await fsSetConfig('eventBanners', banners); }
function renderEventBannersGrid(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(eventBannersCache.length === 0){ el.innerHTML = '<div class="empty-state">තවම banners කිසිවක් නැහැ.</div>'; return; }
  el.innerHTML = eventBannersCache.map(b => `
    <div class="catalog-card">
      ${b.image ? `<img src="${b.image}" alt="${b.name}" class="catalog-img">` : '<div class="catalog-img ph">🖼️</div>'}
      <div class="catalog-body">
        <h3>${b.name}</h3>
        ${b.date ? `<div class="catalog-chip" style="margin-top:6px;">${b.date}</div>` : ''}
      </div>
    </div>`).join('');
}

/* ---------- UPCOMING EVENT (Firestore config/upcomingEvent) ---------- */
let eventCache = null;
async function refreshEventCache(){
  eventCache = await fsGetConfig('upcomingEvent', null);
}
async function setUpcomingEvent(data){
  eventCache = data;
  await fsSetConfig('upcomingEvent', data);
}
async function clearUpcomingEvent(){
  eventCache = null;
  await fsSetConfig('upcomingEvent', null);
}
function renderUpcomingEvent(){
  const section = document.getElementById('eventSection');
  if(!section) return;
  if(!eventCache || !eventCache.name){
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  const imgEl = document.getElementById('eventImage');
  const nameEl = document.getElementById('eventName');
  const dateEl = document.getElementById('eventDate');
  if(imgEl){
    if(eventCache.image){ imgEl.src = eventCache.image; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
  }
  if(nameEl) nameEl.textContent = eventCache.name;
  if(dateEl) dateEl.textContent = eventCache.date || '';
}

/* ---------- ANNOUNCEMENT STRIP ---------- */
function renderAnnouncement(){
  const el = document.getElementById('announceStrip');
  if(!el) return;
  const msg = storeCache.announcement || '';
  if(msg){
    el.textContent = '📢 ' + msg;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}
async function setAnnouncement(text){
  storeCache.announcement = text;
  await fsSetConfig('store', storeCache);
}

/* ---------- GLOBAL LOADING OVERLAY (rotating diamond) ---------- */
/* 3D spinning diamond (pure CSS 3D — two pyramids of 4 faces each) */
function gem3dHtml(){
  /* faceted diamond (SVG) — facets shimmer one after another, a glint sweeps across, sparkles twinkle */
  return `<div class="gem-wrap"><span class="gem-ring"></span><span class="gem-ring r2"></span>
  <svg class="gem-svg" viewBox="0 0 120 108" aria-hidden="true">
    <defs>
      <linearGradient id="gmA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9ffff"/><stop offset="1" stop-color="#5fe3ff"/></linearGradient>
      <linearGradient id="gmB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9af0ff"/><stop offset="1" stop-color="#2f9bff"/></linearGradient>
      <linearGradient id="gmC" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6ff"/><stop offset="1" stop-color="#6a5cff"/></linearGradient>
      <linearGradient id="gmD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3bb7ff"/><stop offset="1" stop-color="#3a2fd0"/></linearGradient>
      <linearGradient id="gmE" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58c8ff"/><stop offset="1" stop-color="#7c5cff"/></linearGradient>
      <linearGradient id="gmS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="gmClip"><path d="M30 8H90L116 38L60 104L4 38Z"/></clipPath>
    </defs>
    <g stroke="rgba(255,255,255,.55)" stroke-width=".8" stroke-linejoin="round">
      <polygon class="f f1" fill="url(#gmC)" points="4,38 30,8 36,38"/>
      <polygon class="f f2" fill="url(#gmA)" points="30,8 60,8 36,38"/>
      <polygon class="f f3" fill="url(#gmB)" points="60,8 36,38 84,38"/>
      <polygon class="f f4" fill="url(#gmA)" points="60,8 90,8 84,38"/>
      <polygon class="f f5" fill="url(#gmC)" points="90,8 84,38 116,38"/>
      <polygon class="f f6" fill="url(#gmE)" points="4,38 36,38 60,104"/>
      <polygon class="f f7" fill="url(#gmB)" points="36,38 60,38 60,104"/>
      <polygon class="f f8" fill="url(#gmD)" points="60,38 84,38 60,104"/>
      <polygon class="f f9" fill="url(#gmE)" points="84,38 116,38 60,104"/>
    </g>
    <g clip-path="url(#gmClip)"><rect class="sweep" x="-30" y="-10" width="34" height="130" fill="url(#gmS)" transform="skewX(-20)"/></g>
  </svg>
  <i class="gem-spark s1"></i><i class="gem-spark s2"></i><i class="gem-spark s3"></i></div>`;
}
function showGlobalLoader(){
  if(document.getElementById('globalLoader')) return;
  const el = document.createElement('div');
  el.id = 'globalLoader';
  el.className = 'global-loader';
  el.innerHTML = gem3dHtml() + '<img class="loader-logo" src="logo-header.png" alt="Sakindu Topup"><div class="loader-text">Loading</div>';
  if(document.body){ document.body.appendChild(el); }
  else { document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el)); }
}
function hideGlobalLoader(){
  const el = document.getElementById('globalLoader');
  if(!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 350);
}

/* ---------- AI HELP BOT (rule-based FAQ assistant, injected on every page) ---------- */
const AI_BOT_FAQ = [
  { kw:['uid','verify','player id','id check'], a:'Free Fire Top Up page එකේ UID එක type කරලා "Verify" click කරන්න. Real player name එක visible උනොත් correct UID එක — Order කරන්න කලින් double-check කරන්න!' },
  { kw:['price','ගාන','cost','rate','diamond price'], a:'Package prices ටික Free Fire Top Up page එකේ Diamonds/Top Selling/Level Up Pass tabs වල තියෙනවා. Prices වෙනස් වෙන්න පුළුවන් — latest ගාන site එකේ බලන්න.' },
  { kw:['wallet','recharge','balance','add money','fund'], a:'Wallet page එකට ගිහින් eZ Cash හෝ Bank Transfer තෝරලා, මුදල + Reference Number/වේලාව (හෝ Slip එක) දාලා "Submit Deposit Request" කරන්න. Admin Approve කළාම ඒ ගාන Wallet එකට add වෙනවා.' },
  { kw:['order','status','track','processing','pending'], a:'ඔබේ Orders ටික බලන්න Home page එකේ "My Orders" section එකට යන්න (Login වෙලා ඉන්න ඕන). "Processing" කියන්නේ Admin review කරමින් කියන එකයි, Approve උනාම diamonds release වෙනවා.' },
  { kw:['payment','bank','ez cash','ezcash','pay'], a:'Orders හැම එකක්ම pay කරන්නේ Wallet Balance එකෙන් විතරයි. Wallet එක recharge කරන්න Wallet page එකට යන්න (eZ Cash / Bank Transfer).' },
  { kw:['reject','rejected','declined'], a:'Order එකක් Reject උනා නම්, ඒකට හේතුව (වැරදි receipt/payment issue) WhatsApp එකෙන් අහන්න — Admin ට clarify කරන්න පුළුවන්.' },
  { kw:['refund','cancel'], a:'Refund/Cancellation Policy සම්පූර්ණයෙන් බලන්න Footer එකේ "Refund & Cancellation Policy" link එකෙන්.' },
  { kw:['login','sign up','signup','register','account'], a:'Login/Sign Up Home page එකේ උඩින් "Login" button එකෙන් කරන්න පුළුවන්. Order/Wallet features ඔක්කොටම Login අනිවාර්යයි.' },
  { kw:['contact','support','admin','whatsapp','talk'], a:'Direct support සඳහා WhatsApp එකෙන් 076 062 7795 අමතන්න — Chat bubble එකේ 💬 icon එකෙන්ම යන්න පුළුවන්.' },
];
function aiBotFindAnswer(msg){
  const lower = msg.toLowerCase();
  for(const entry of AI_BOT_FAQ){
    if(entry.kw.some(k => lower.includes(k))) return entry.a;
  }
  return 'මට ඒක clear විදිහට answer කරන්න බැහැ 🙏 — WhatsApp එකෙන් (076 062 7795) අපේ team එකට directly අහන්න, ඉක්මනින් reply කරයි!';
}
function injectAIBot(){
  if(document.getElementById('aiBotFloat')) return;

  const float = document.createElement('div');
  float.id = 'aiBotFloat';
  float.className = 'ai-bot-float';
  float.innerHTML = '🤖';
  float.onclick = toggleAIBotPanel;

  const panel = document.createElement('div');
  panel.id = 'aiBotPanel';
  panel.className = 'ai-bot-panel';
  panel.innerHTML = `
    <div class="ai-bot-header">
      <span>🤖 SakinduStore Help</span>
      <button onclick="toggleAIBotPanel()" class="ai-bot-close">✕</button>
    </div>
    <div class="ai-bot-messages" id="aiBotMessages">
      <div class="ai-bot-msg bot">👋 ආයුබෝවන්! UID verify, Wallet, Orders, Payment methods ගැන අහන්න. මොකක් හරි type කරන්න!</div>
    </div>
    <div class="ai-bot-input-row">
      <input type="text" id="aiBotInput" placeholder="ප්‍රශ්නයක් type කරන්න..." onkeydown="if(event.key==='Enter')sendAIBotMessage();">
      <button onclick="sendAIBotMessage()">➤</button>
    </div>`;

  document.body.appendChild(float);
  document.body.appendChild(panel);
}
function toggleAIBotPanel(){
  const panel = document.getElementById('aiBotPanel');
  if(panel) panel.classList.toggle('show');
}
function sendAIBotMessage(){
  const input = document.getElementById('aiBotInput');
  const msgBox = document.getElementById('aiBotMessages');
  const text = input.value.trim();
  if(!text) return;
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-bot-msg user';
  userMsg.textContent = text;
  msgBox.appendChild(userMsg);
  input.value = '';

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-bot-msg bot';
    botMsg.textContent = aiBotFindAnswer(text);
    msgBox.appendChild(botMsg);
    msgBox.scrollTop = msgBox.scrollHeight;
  }, 400);
  msgBox.scrollTop = msgBox.scrollHeight;
}

/* ---------- MAINTAINING MODAL (for not-yet-ready features) ---------- */
function showMaintaining(name){
  const overlay = document.getElementById('maintainOverlay');
  if(!overlay) return;
  document.getElementById('maintainTitle').textContent = name + ' — Under Maintenance';
  overlay.classList.add('show');
}
function closeMaintaining(){
  const overlay = document.getElementById('maintainOverlay');
  if(overlay) overlay.classList.remove('show');
}

/* ---------- WIRE UP INLINE IMAGES (if present on this page) ---------- */
function wireGameIcons(){
  const map = { icFreeFire:'IMG_FREEFIRE', icCodm:'IMG_CODM', icBloodstrike:'IMG_BLOODSTRIKE' };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    const varName = map[id];
    if(el && typeof window[varName] !== 'undefined'){ el.src = window[varName]; }
  });
}

/* ---------- INIT ---------- */
async function safeRefresh(fn, label){
  try{ await fn(); }
  catch(e){ console.error('[SakinduStore] failed to load', label, e); }
}
async function initApp(){
  showGlobalLoader();
  wireGameIcons();
  renderCatTabs();
  const isAdminPage = /admin/i.test(location.pathname);
  try{
    /* PHASE 1 — only what is needed to draw the page (small config documents + this customer's own wallet) */
    const phase1 = [
      safeRefresh(refreshGamesCache, 'games'),
      safeRefresh(refreshStoreCache, 'store'),
      safeRefresh(refreshPriceOverridesCache, 'priceOverrides'),
      safeRefresh(refreshFfImageOverridesCache, 'ffImageOverrides'),
      safeRefresh(refreshFfRegionPackagesCache, 'ffRegionPackages'),
      safeRefresh(refreshEventCache, 'upcomingEvent'),
      safeRefresh(refreshAccountsCache, 'accounts'),
      safeRefresh(refreshAdBannersCache, 'adBanners'),
      safeRefresh(refreshEventBannersCache, 'eventBanners'),
      safeRefresh(refreshMyWallet, 'myWallet')
    ];
    /* the admin panel keeps loading everything up-front (it relies on the full lists) */
    if(isAdminPage) phase1.push(
      safeRefresh(refreshRedeemCodesCache, 'redeemCodes'), safeRefresh(refreshReviewsCache, 'reviews'),
      safeRefresh(refreshOrdersCache, 'orders'), safeRefresh(refreshUsersCache, 'users'), safeRefresh(refreshWalletsCache, 'wallets'));
    await Promise.all(phase1);
    window.__bgReady = isAdminPage;
    renderGamesGrid(typeof GAMES_HOME_LIMIT !== 'undefined' ? GAMES_HOME_LIMIT : undefined);
    renderUpcomingEvent();
    renderGenericGamePage();
    renderStoreLock();
    renderAnnouncement();
    if(document.getElementById('ffRegionSelect')){
      onFFRegionChange();
      renderSavedUids(); applyBuyAgainParams();
      if(typeof renderRegionGrid === 'function' && document.getElementById('regionOverlay').classList.contains('show')) renderRegionGrid();
    } else { renderPackages(); }
    renderWallet();
    renderRechargeHistory();
    renderAccountsGrid('accountsGrid');
    renderAccountsGrid('accountsGridHome', 3);
    renderAdBanners('adBannerStrip');
    renderEventBannersGrid('eventBannersGrid');
    refreshAuthUI();
    updatePaymentUI();
    renderOrders(); renderLeaderboard(); renderReviews();
    if(typeof renderProfile === 'function') renderProfile();
    if(typeof renderReseller === 'function') renderReseller();
    injectAIBot();
  } finally {
    hideGlobalLoader();
  }
  /* PHASE 2 — the big lists (all orders / users / reviews / codes) load quietly in the background, then fill in */
  if(!isAdminPage){
    window.__bgLoad = Promise.all([
      safeRefresh(refreshRedeemCodesCache, 'redeemCodes'), safeRefresh(refreshReviewsCache, 'reviews'),
      safeRefresh(refreshOrdersCache, 'orders'), safeRefresh(refreshUsersCache, 'users')
    ]).then(() => {
      window.__bgReady = true;
      renderOrders(); renderLeaderboard(); renderReviews(); updatePaymentUI();
      if(typeof renderProfile === 'function') renderProfile();
      if(typeof rsRenderOrders === 'function' && getSession()) rsRenderOrders(getSession());
      if(document.getElementById('ffRegionSelect') && typeof applyBuyAgainParams === 'function'){ try{ applyBuyAgainParams(); }catch(e){} }
    });
  }
}
initApp();


/* every emoji on every page is animated (emoji-fx.js) */
(function(){ try{ var s = document.createElement('script'); s.src = 'emoji-fx.js'; s.defer = true; document.head.appendChild(s); }catch(e){} })();


/* ---------- Dark / Light theme toggle ---------- */
function applyTheme(t){
  if(t === 'light') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
  try{ localStorage.setItem('sk_theme', t); }catch(e){}
  const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', t === 'light' ? '#f2f5fc' : '#070b18');
  document.querySelectorAll('.theme-toggle').forEach(b => { b.textContent = t === 'light' ? '🌙' : '☀️'; b.title = t === 'light' ? 'Dark mode' : 'Light mode'; });
}
function toggleTheme(){ applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); }
(function(){
  function mount(){
    if(document.querySelector('.theme-toggle')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'theme-toggle'; b.setAttribute('aria-label', 'Toggle dark / light mode'); b.onclick = toggleTheme;
    const header = document.querySelector('header'), ham = header && header.querySelector('.hamburger'), wal = document.getElementById('hdrWallets');
    if(header){ const anchor = wal || ham; if(anchor) header.insertBefore(b, anchor); else header.appendChild(b); }
    else { b.classList.add('floating'); document.body.appendChild(b); }
    applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
