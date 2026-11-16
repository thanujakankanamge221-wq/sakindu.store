/* Lightweight store-closed overlay check for pages that don't load the full app.js.
   Requires firebase-init.js + db.js loaded first. */
(async function(){
  const overlay = document.getElementById('storeLockOverlay');
  if(!overlay) return;
  try{
    const store = await fsGetConfig('store', { closed:false, announcement:'' });
    if(store.closed){
      const ic = overlay.querySelector('.lock-ic');
      if(ic && !ic.querySelector('.mt-scene')) ic.innerHTML = `<svg class="mt-scene" viewBox="0 0 300 200" aria-hidden="true">
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
      overlay.classList.add('show');
    }
  } catch(e){ console.error('store-check', e); }
})();
