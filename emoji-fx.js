/* Animates EVERY emoji on the page. Emoji characters in text are wrapped in <span class="emo e-..."> (different movement per emoji),
   and anything added later (cards, messages, modals) is wrapped automatically. Skip an area with data-noemo. */
(function(){
  if(window.__emojiFx) return; window.__emojiFx = true;
  var RE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;
  var SKIP_TAGS = { SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, SELECT:1, OPTION:1, CODE:1, PRE:1, TITLE:1, NOSCRIPT:1, SVG:1 };
  var PLAIN = '✕✓✔✖✗✘➜➡⬅⬆⬇★☆↗↘';                                         // UI glyphs that must stay still
  var MAP = { '✅':'pop','✔':'pop','💎':'shine','💠':'shine','🔥':'flame','⚡':'zap','🪙':'flip','💰':'flip','❤':'beat','💖':'beat','🩷':'beat','⭐':'twinkle','🌟':'twinkle','✨':'twinkle','🎉':'wobble','🎁':'wobble','🛠':'wobble','🔨':'wobble',
    '⚙':'spin','⏳':'flip','⌛':'flip','🕒':'tick','🕘':'tick','⏱':'tick','🔑':'sway','🛒':'sway','📱':'wobble','🏦':'bob','🔍':'bob','🏆':'bob','🐚':'bob','🤝':'wobble','🥉':'bob','🥈':'bob','🥇':'bob','🔐':'wobble','📋':'bob','🧾':'bob','⚠':'pulse','❌':'pulse','💬':'bob','👤':'bob' };
  var CYCLE = ['bob','sway','pulse','wobble'];
  var n = 0;
  function variant(ch){
    var key = Array.from(ch.replace(/\uFE0F/g, ''))[0];
    return MAP[key] || CYCLE[(n++) % CYCLE.length];
  }
  function okNode(t){
    for(var p = t.parentNode; p && p !== document.body; p = p.parentNode){
      if(p.nodeType !== 1) continue;
      if(SKIP_TAGS[p.nodeName.toUpperCase()] || (p.classList && p.classList.contains('emo')) || (p.hasAttribute && p.hasAttribute('data-noemo')) || p.isContentEditable) return false;
    }
    return true;
  }
  function wrapText(t){
    var txt = t.nodeValue; RE.lastIndex = 0;
    if(!RE.test(txt)) return;
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), last = 0, m, changed = false;
    while((m = RE.exec(txt))){
      var ch = m[0];
      if(PLAIN.indexOf(Array.from(ch)[0]) >= 0 || ch.codePointAt(0) < 0x2300) continue;           // © ® arrows and math signs are not emoji
      if(m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      var s = document.createElement('span');
      s.className = 'emo e-' + variant(ch); s.textContent = ch; s.style.animationDelay = (-Math.random() * 2.4).toFixed(2) + 's';
      frag.appendChild(s); last = m.index + ch.length; changed = true;
    }
    if(!changed) return;
    if(last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    t.parentNode.replaceChild(frag, t);
  }
  function scan(root){
    if(!root) return;
    if(root.nodeType === 3){ if(okNode(root)) wrapText(root); return; }
    if(root.nodeType !== 1 || SKIP_TAGS[root.nodeName.toUpperCase()] || root.hasAttribute('data-noemo')) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], x;
    while((x = w.nextNode())) list.push(x);
    list.forEach(function(t){ if(t.parentNode && okNode(t)) wrapText(t); });
  }
  var queue = [], scheduled = false;
  function flush(){ scheduled = false; var q = queue; queue = []; q.forEach(scan); }
  function start(){
    scan(document.body);
    new MutationObserver(function(muts){
      muts.forEach(function(m){ m.addedNodes && m.addedNodes.forEach(function(nd){ if(nd.nodeType === 1 || nd.nodeType === 3) queue.push(nd); }); });
      if(queue.length && !scheduled){ scheduled = true; (window.requestAnimationFrame || setTimeout)(flush); }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
