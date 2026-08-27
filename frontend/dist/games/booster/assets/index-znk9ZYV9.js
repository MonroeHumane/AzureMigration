var k=Object.defineProperty;var C=(n,e,t)=>e in n?k(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var i=(n,e,t)=>C(n,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();const y={standard:{tier:"standard",title:"Standard Paws Pack",subtitle:"1 Adoptable Shelter Companion",cardCount:1,themeColor:"#134e4a",accentColor:"#2dd4bf",glowColor:"rgba(45, 212, 191, 0.4)",badge:"Daily Drop"},duo:{tier:"duo",title:"Shelter Duo Pack",subtitle:"2 Cards with Boosted Rare Odds",cardCount:2,themeColor:"#7c2d12",accentColor:"#fb923c",glowColor:"rgba(251, 146, 60, 0.45)",badge:"Arcade Reward"},deluxe:{tier:"deluxe",title:"Alumni Deluxe Pack",subtitle:"3 Cards • 1 Guaranteed Foil Legend",cardCount:3,themeColor:"#1e1b4b",accentColor:"#a855f7",glowColor:"rgba(168, 85, 247, 0.5)",badge:"Special Edition"}};class x{constructor(){i(this,"ctx",null);i(this,"isMuted",!1);try{this.isMuted=localStorage.getItem("monroe_booster_muted")==="1"}catch{this.isMuted=!1}}getContext(){if(!this.ctx){const e=window.AudioContext||window.webkitAudioContext;e&&(this.ctx=new e)}return this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume().catch(()=>{}),this.ctx}setMuted(e){this.isMuted=e;try{localStorage.setItem("monroe_booster_muted",e?"1":"0")}catch{}}getMuted(){return this.isMuted}playFoilCrinkle(e=.5){if(this.isMuted)return;const t=this.getContext();if(!t)return;const a=Math.floor(t.sampleRate*.05),r=t.createBuffer(1,a,t.sampleRate),s=r.getChannelData(0);for(let d=0;d<a;d++)s[d]=(Math.random()*2-1)*Math.exp(-d/(a*.4));const o=t.createBufferSource();o.buffer=r;const c=t.createBiquadFilter();c.type="bandpass",c.frequency.setValueAtTime(1200+e*2400,t.currentTime),c.Q.setValueAtTime(4,t.currentTime);const l=t.createGain();l.gain.setValueAtTime(.08+e*.15,t.currentTime),l.gain.exponentialRampToValueAtTime(.001,t.currentTime+.05),o.connect(c),c.connect(l),l.connect(t.destination),o.start()}playRipTear(){if(this.isMuted)return;const e=this.getContext();if(!e)return;const t=.28,a=Math.floor(e.sampleRate*t),r=e.createBuffer(1,a,e.sampleRate),s=r.getChannelData(0);for(let d=0;d<a;d++){const u=d/a,m=Math.sin(u*Math.PI)*(1-u*.5);s[d]=(Math.random()*2-1)*m}const o=e.createBufferSource();o.buffer=r;const c=e.createBiquadFilter();c.type="bandpass",c.frequency.setValueAtTime(3200,e.currentTime),c.frequency.exponentialRampToValueAtTime(800,e.currentTime+t),c.Q.setValueAtTime(3.5,e.currentTime);const l=e.createGain();l.gain.setValueAtTime(.25,e.currentTime),l.gain.exponentialRampToValueAtTime(.001,e.currentTime+t),o.connect(c),c.connect(l),l.connect(e.destination),o.start()}playCardWhoosh(){if(this.isMuted)return;const e=this.getContext();if(!e)return;const t=e.createOscillator(),a=e.createGain();t.type="sine",t.frequency.setValueAtTime(450,e.currentTime),t.frequency.exponentialRampToValueAtTime(140,e.currentTime+.16),a.gain.setValueAtTime(.12,e.currentTime),a.gain.exponentialRampToValueAtTime(.001,e.currentTime+.16),t.connect(a),a.connect(e.destination),t.start(),t.stop(e.currentTime+.16)}playFanfare(e=!1){if(this.isMuted)return;const t=this.getContext();if(!t)return;(e?[523.25,659.25,783.99,1046.5,1318.51,1567.98]:[440,554.37,659.25,880]).forEach((r,s)=>{const o=t.currentTime+s*.07,c=t.createOscillator(),l=t.createGain();c.type=e?"triangle":"sine",c.frequency.setValueAtTime(r,o),l.gain.setValueAtTime(.14,o),l.gain.exponentialRampToValueAtTime(.001,o+.35),c.connect(l),l.connect(t.destination),c.start(o),c.stop(o+.35)})}}const p=new x;class w{constructor(e){i(this,"container");i(this,"topEl");i(this,"bodyEl");i(this,"onTearProgress");i(this,"onTearComplete");i(this,"isDragging",!1);i(this,"startX",0);i(this,"currentX",0);i(this,"packWidth",290);i(this,"isTorn",!1);i(this,"hasMovedFar",!1);this.container=e.container,this.topEl=e.topElement,this.bodyEl=e.bodyElement,this.onTearProgress=e.onTearProgress,this.onTearComplete=e.onTearComplete,this.bindEvents()}triggerAutoTear(){if(this.isTorn)return;this.isDragging=!1;let e=0;const t=setInterval(()=>{e+=.15,this.updateTearVisuals(Math.min(1,e)),p.playFoilCrinkle(.6),e>=1&&(clearInterval(t),this.completeTear())},30)}bindEvents(){(this.container.querySelector(".tear-canvas-layer")||this.container).addEventListener("pointerdown",this.handlePointerDown.bind(this)),window.addEventListener("pointermove",this.handlePointerMove.bind(this)),window.addEventListener("pointerup",this.handlePointerUp.bind(this)),window.addEventListener("pointercancel",this.handlePointerUp.bind(this));const t=this.container.querySelector(".tear-prompt-badge");t&&t.addEventListener("click",a=>{a.stopPropagation(),this.triggerAutoTear()})}handlePointerDown(e){if(this.isTorn)return;const t=this.container.getBoundingClientRect();this.packWidth=t.width||290,this.startX=e.clientX,this.currentX=e.clientX,this.isDragging=!0,this.hasMovedFar=!1,p.playFoilCrinkle(.3)}handlePointerMove(e){if(!this.isDragging||this.isTorn)return;const t=Math.max(0,e.clientX-this.startX),a=Math.min(1,t/(this.packWidth*.72)),r=Math.abs(e.clientX-this.currentX)/15;this.currentX=e.clientX,t>20&&(this.hasMovedFar=!0),r>.1&&(p.playFoilCrinkle(Math.min(1,r)),this.spawnFoilScraps(e.clientX,e.clientY)),this.updateTearVisuals(a),this.onTearProgress&&this.onTearProgress(a),a>=.92&&this.completeTear()}handlePointerUp(){if(!(!this.isDragging||this.isTorn)){if(this.isDragging=!1,!this.hasMovedFar){this.triggerAutoTear();return}this.resetTearVisuals()}}updateTearVisuals(e){const t=e*26,a=e*-14,r=Math.min(100,Math.round(e*100));this.topEl.style.transform=`rotateZ(${t*.5}deg) rotateX(${t}deg) translateY(${a}px)`,this.topEl.style.transformOrigin="0% 100%",this.topEl.style.clipPath=`polygon(0 0, 100% 0, 100% 100%, ${r}% 100%, 0 ${Math.max(0,100-e*40)}%)`}resetTearVisuals(){this.topEl.style.transition="transform 0.3s ease, clip-path 0.3s ease",this.topEl.style.transform="none",this.topEl.style.clipPath="none",setTimeout(()=>{this.topEl.style.transition=""},300)}spawnFoilScraps(e,t){const a=document.createElement("div");a.className="scrap-particle",a.style.left=`${e}px`,a.style.top=`${t}px`,a.style.width=`${Math.random()*6+3}px`,a.style.height=`${Math.random()*6+3}px`,a.style.background=["#2dd4bf","#fb923c","#f59e0b","#ffffff","#e76f51"][Math.floor(Math.random()*5)],a.style.transform=`rotate(${Math.random()*360}deg)`,a.style.opacity="1",a.style.transition="all 0.4s ease-out",document.body.appendChild(a),requestAnimationFrame(()=>{a.style.transform=`translate(${(Math.random()-.5)*60}px, ${Math.random()*40+20}px) rotate(${Math.random()*720}deg)`,a.style.opacity="0"}),setTimeout(()=>a.remove(),400)}completeTear(){this.isTorn||(this.isTorn=!0,this.isDragging=!1,p.playRipTear(),this.topEl.style.transition="all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",this.topEl.style.transform="translateY(-120px) rotateZ(35deg) rotateX(45deg) scale(0.85)",this.topEl.style.opacity="0",this.bodyEl.style.transition="all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",this.bodyEl.style.transform="translateY(160px) scale(0.95)",this.bodyEl.style.opacity="0.3",setTimeout(()=>{this.onTearComplete()},450))}}class T{constructor(e,t){i(this,"container");i(this,"tier");i(this,"onTearComplete");i(this,"tearEngine",null);this.tier=e,this.onTearComplete=t,this.container=document.createElement("div"),this.container.className="pack-wrapper-3d",this.render()}getElement(){return this.container}setTier(e){this.tier=e,this.render()}ripOpen(){this.tearEngine&&this.tearEngine.triggerAutoTear()}render(){const e=y[this.tier];this.container.style.setProperty("--pack-glow",e.glowColor);const t="/assets/recovered/images/lirp.cdn-website.com/77cfa591/dms3rep/multi/opt/a93f9c_be31971351e8408cb8178224c57b9477-mv2-b3da8eac-1920w.webp",a=this.tier==="deluxe"?"👑":this.tier==="duo"?"🐾":"🐱";this.container.innerHTML=`
      <!-- Top Flap (Tears away) -->
      <div class="foil-pack-top" style="background: ${e.themeColor};">
        <div class="crimped-ridge"></div>
        <div class="foil-sheen"></div>
      </div>

      <!-- Tear Line Perforation -->
      <div class="tear-perforation">
        <div class="tear-line-dash"></div>
      </div>
      <div class="tear-prompt-badge" role="button" tabindex="0" title="Click or swipe to tear open">
        <span>✂️</span>
        <span>Swipe to Tear</span>
      </div>

      <!-- Main Pack Body -->
      <div class="foil-pack-body" style="background: ${e.themeColor};">
        <div class="foil-sheen"></div>
        <div class="pack-art-content">
          <img class="pack-shelter-logo" src="${t}" alt="Humane Society of Monroe County" onerror="this.style.display='none'">
          <div class="pack-tier-badge" style="border-color: ${e.accentColor}; color: ${e.accentColor};">${e.badge}</div>
          <div class="pack-hero-icon">${a}</div>
          <div class="pack-hero-title">${e.title}</div>
          <div class="pack-card-count">${e.cardCount} ${e.cardCount===1?"Pet Card":"Pet Cards"} Inside</div>
        </div>
        <div class="crimped-ridge crimped-bottom"></div>
      </div>

      <!-- Transparent Touch/Gesture Rip Overlay Layer -->
      <div class="tear-canvas-layer" title="Swipe across to tear open!"></div>
    `;const r=this.container.querySelector(".foil-pack-top"),s=this.container.querySelector(".foil-pack-body");this.tearEngine=new w({container:this.container,topElement:r,bodyElement:s,onTearComplete:()=>{this.onTearComplete()}})}}class P{constructor(e,t){i(this,"card");i(this,"container");i(this,"isFlipped",!1);i(this,"onRevealedCallback");this.card=e,this.onRevealedCallback=t?.onRevealed,this.container=document.createElement("div"),this.container.className="card-3d-wrapper",this.render(),this.bind3DTilt(),t?.autoFlip&&setTimeout(()=>{this.flipToFront()},250)}getElement(){return this.container}getIsFlipped(){return this.isFlipped}flipToFront(){this.isFlipped||(this.isFlipped=!0,p.playCardWhoosh(),(this.card.rarity==="alumni"||this.card.rarity==="golden_senior"||this.card.rarity==="longtimer")&&setTimeout(()=>{p.playFanfare(this.card.rarity==="alumni")},250),this.container.classList.add("is-flipped"),this.onRevealedCallback&&this.onRevealedCallback())}toggleFlip(){this.isFlipped?(this.isFlipped=!1,p.playCardWhoosh(),this.container.classList.remove("is-flipped")):this.flipToFront()}render(){const e=this.card.foil!=="none"?`foil-${this.card.foil}`:"",t=this.card.species==="cat"?"🐱 Cat":this.card.species==="dog"?"🐕 Dog":"🐾 Pet",a={common:"🐾 Rescue Pet",tiny_wonder:"🍼 Tiny Wonder",longtimer:"⭐ Shelter Champion",golden_senior:"👑 Golden Senior",alumni:"💖 Happy Alumni"},r=this.card.rarity==="alumni"?"aura-alumni":this.card.rarity==="golden_senior"?"aura-gold":this.card.rarity==="longtimer"?"aura-cosmos":this.card.rarity==="tiny_wonder"?"aura-aurora":"aura-common",s=(this.card.ageText||"").replace(/\bmonths?\b/gi,"mo").replace(/\byears?\b/gi,"yr"),o=this.card.personalityTraits[0]||"",c=(this.card.location||"Shelter").replace(/Foster Care/gi,"Foster").replace(/Adopted Alumni/gi,"Alumni");this.container.innerHTML=`
      <div class="card-flipper ${r}">
        <!-- 🐾 OFFICIAL HUMANE SOCIETY OF MONROE COUNTY COLLECTIBLE CARD BACK -->
        <div class="card-face card-back" title="Click or tap to reveal card">
          <div class="card-back-foil"></div>
          <div class="card-back-glare"></div>

          <div class="card-back-ornate-art">
            <svg class="card-back-svg" viewBox="0 0 320 495" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="cardBackBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0a2922" />
                  <stop offset="35%" stop-color="#134e4a" />
                  <stop offset="70%" stop-color="#0f3d32" />
                  <stop offset="100%" stop-color="#061c17" />
                </linearGradient>
                <radialGradient id="cardBackGlow" cx="50%" cy="48%" r="48%">
                  <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.3" />
                  <stop offset="45%" stop-color="#134e4a" stop-opacity="0.15" />
                  <stop offset="100%" stop-color="#061c17" stop-opacity="0" />
                </radialGradient>
                <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#fef08a" />
                  <stop offset="25%" stop-color="#ffb347" />
                  <stop offset="50%" stop-color="#d97706" />
                  <stop offset="75%" stop-color="#fef08a" />
                  <stop offset="100%" stop-color="#b45309" />
                </linearGradient>
                <linearGradient id="medallionRim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#fffbeb" />
                  <stop offset="30%" stop-color="#fbbf24" />
                  <stop offset="70%" stop-color="#d97706" />
                  <stop offset="100%" stop-color="#78350f" />
                </linearGradient>
                <linearGradient id="pawFillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#2dd4bf" />
                  <stop offset="100%" stop-color="#10b981" />
                </linearGradient>
                <!-- Authentic Sketched Hatch Pattern for Monroe Logo Paw -->
                <pattern id="monroePawHatch" width="8" height="8" patternTransform="rotate(42)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#10b981" stroke-width="2.6" stroke-linecap="round" />
                  <line x1="4" y1="0" x2="4" y2="8" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" />
                </pattern>
                <pattern id="bgPawWatermark" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M12 18c0-3 3-5 6-4s5 4 4 7-4 5-7 4-3-4-3-7zm16-2c-1-3 2-6 5-5s5 3 4 7-3 5-6 4-3-3-3-6zm-10 14c-1-4 3-8 8-7s8 4 7 9-4 8-9 7-6-5-6-9z" fill="rgba(255,255,255,0.03)" />
                </pattern>
              </defs>

              <!-- Base Card Background -->
              <rect x="0" y="0" width="320" height="495" rx="20" fill="url(#cardBackBg)" />
              <rect x="0" y="0" width="320" height="495" rx="20" fill="url(#bgPawWatermark)" />

              <!-- Outer Double Gold Foil Borders & Corner Filigree -->
              <rect x="7" y="7" width="306" height="481" rx="16" stroke="url(#goldBorder)" stroke-width="2.5" fill="none" />
              <rect x="12" y="12" width="296" height="471" rx="13" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1" fill="none" />
              <rect x="16" y="16" width="288" height="463" rx="10" stroke="url(#goldBorder)" stroke-width="1" stroke-dasharray="8 4" fill="none" />

              <!-- Corner Ornaments -->
              <g stroke="url(#goldBorder)" stroke-width="1.5" fill="none">
                <path d="M 22,34 L 22,22 L 34,22" />
                <path d="M 298,34 L 298,22 L 286,22" />
                <path d="M 22,461 L 22,473 L 34,473" />
                <path d="M 298,461 L 298,473 L 286,473" />
                <circle cx="28" cy="28" r="2.5" fill="#fbbf24" stroke="none" />
                <circle cx="292" cy="28" r="2.5" fill="#fbbf24" stroke="none" />
                <circle cx="28" cy="467" r="2.5" fill="#fbbf24" stroke="none" />
                <circle cx="292" cy="467" r="2.5" fill="#fbbf24" stroke="none" />
              </g>

              <!-- Radial Energy Center Glow -->
              <circle cx="160" cy="235" r="140" fill="url(#cardBackGlow)" />

              <!-- Top Header Ribbon -->
              <g transform="translate(160, 52)">
                <path d="M -115,0 Q 0,-6 115,0 Q 0,6 -115,0 Z" fill="#0f3d32" stroke="url(#goldBorder)" stroke-width="1.2" />
                <text x="0" y="4" text-anchor="middle" fill="#fef08a" font-size="10.5" font-weight="900" letter-spacing="3">HUMANE SOCIETY</text>
                <text x="0" y="19" text-anchor="middle" fill="#5eead4" font-size="8.5" font-weight="800" letter-spacing="2">OF MONROE COUNTY</text>
              </g>

              <!-- ========================================================= -->
              <!-- 🐾 OFFICIAL MONROE SKETCHED PAW MEDALLION                 -->
              <!-- ========================================================= -->
              <g transform="translate(160, 232)">
                <!-- Medallion Outer Raised Gold Bezel -->
                <circle cx="0" cy="0" r="92" fill="url(#medallionRim)" stroke="#ffffff" stroke-width="1.5" />
                <circle cx="0" cy="0" r="88" fill="#08201a" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <circle cx="0" cy="0" r="83" fill="#0f3d32" />
                <circle cx="0" cy="0" r="80" stroke="url(#goldBorder)" stroke-width="1" stroke-dasharray="3 3" fill="none" opacity="0.8" />
                <circle cx="0" cy="0" r="76" fill="#fdfbf7" />

                <!-- Sketched Circle Boundary (Matches authentic logo ring) -->
                <g stroke="#007a3d" fill="none">
                  <path d="M 0,-64 C 36,-64 64,-36 64,0 C 64,36 36,64 0,64 C -36,64 -64,36 -64,0 C -64,-36 -36,-64 0,-64 Z" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="90 8 45 6 120 10" />
                  <path d="M -2,-62 C 34,-62 62,-34 62,0 C 62,34 34,62 -2,62 C -38,62 -62,34 -62,0 C -62,-34 -38,-62 -2,-62 Z" stroke-width="1.5" opacity="0.6" stroke-dasharray="60 12 80 8" />
                </g>

                <!-- Sketched Paw Print (Authentic Hatched Strokes) -->
                <!-- Outer Left Toe -->
                <g transform="translate(-30, -22) rotate(-24)">
                  <ellipse cx="0" cy="0" rx="9" ry="15" fill="#007a3d" />
                  <g stroke="#fdfbf7" stroke-width="1.6" stroke-linecap="round">
                    <line x1="-6" y1="-8" x2="6" y2="-4" />
                    <line x1="-7" y1="-3" x2="7" y2="1" />
                    <line x1="-7" y1="2" x2="7" y2="6" />
                    <line x1="-5" y1="7" x2="5" y2="11" />
                  </g>
                </g>

                <!-- Inner Left Toe -->
                <g transform="translate(-11, -38) rotate(-8)">
                  <ellipse cx="0" cy="0" rx="10" ry="17" fill="#007a3d" />
                  <g stroke="#fdfbf7" stroke-width="1.8" stroke-linecap="round">
                    <line x1="-7" y1="-10" x2="7" y2="-6" />
                    <line x1="-8" y1="-5" x2="8" y2="-1" />
                    <line x1="-8" y1="0" x2="8" y2="4" />
                    <line x1="-8" y1="5" x2="8" y2="9" />
                    <line x1="-6" y1="10" x2="6" y2="13" />
                  </g>
                </g>

                <!-- Inner Right Toe -->
                <g transform="translate(14, -36) rotate(10)">
                  <ellipse cx="0" cy="0" rx="10" ry="17" fill="#007a3d" />
                  <g stroke="#fdfbf7" stroke-width="1.8" stroke-linecap="round">
                    <line x1="-7" y1="-10" x2="7" y2="-6" />
                    <line x1="-8" y1="-5" x2="8" y2="-1" />
                    <line x1="-8" y1="0" x2="8" y2="4" />
                    <line x1="-8" y1="5" x2="8" y2="9" />
                    <line x1="-6" y1="10" x2="6" y2="13" />
                  </g>
                </g>

                <!-- Outer Right Toe -->
                <g transform="translate(32, -18) rotate(26)">
                  <ellipse cx="0" cy="0" rx="8.5" ry="14.5" fill="#007a3d" />
                  <g stroke="#fdfbf7" stroke-width="1.6" stroke-linecap="round">
                    <line x1="-6" y1="-8" x2="6" y2="-4" />
                    <line x1="-6" y1="-3" x2="6" y2="1" />
                    <line x1="-6" y1="2" x2="6" y2="6" />
                    <line x1="-5" y1="7" x2="5" y2="10" />
                  </g>
                </g>

                <!-- Main Heel Pad (Curved sketched pad) -->
                <g transform="translate(0, 16)">
                  <path d="M -24,8 C -26,-2 -16,-14 -1,-14 C 14,-14 24,-2 22,8 C 20,20 10,27 -1,27 C -12,27 -22,20 -24,8 Z" fill="#007a3d" />
                  <g stroke="#fdfbf7" stroke-width="2" stroke-linecap="round">
                    <line x1="-16" y1="-7" x2="14" y2="-2" />
                    <line x1="-19" y1="-2" x2="17" y2="3" />
                    <line x1="-20" y1="3" x2="18" y2="8" />
                    <line x1="-18" y1="8" x2="16" y2="13" />
                    <line x1="-15" y1="13" x2="13" y2="18" />
                    <line x1="-10" y1="18" x2="8" y2="22" />
                  </g>
                </g>
              </g>

            </svg>
          </div>

          <div class="card-back-tap-pill">
            <span class="pill-sparkle">✨</span>
            <span class="pill-text">TAP TO REVEAL</span>
            <span class="pill-sparkle">✨</span>
          </div>
        </div>

        <!-- 🎴 CLEAN, BEAUTIFUL, BALANCED TCG CARD FRONT -->
        <div class="card-face card-front">
          <div class="humane-card ${e}" data-card-id="${this.card.id}">

            <!-- Dynamic Foil & Glare Layers -->
            <div class="card-foil-layer"></div>
            <div class="card-glare"></div>

            <!-- 1. Top Header Bar -->
            <div class="card-header-bar">
              <div class="card-title-group">
                <span class="card-dex-badge">${this.card.dexNumber}</span>
                <span class="card-pet-title">${this.card.name}</span>
              </div>
              <div class="card-header-right">
                <span class="card-species-tag">${t}</span>
              </div>
            </div>

            <!-- 2. Hero Pet Photo Window -->
            <div class="card-hero-window">
              <img class="card-hero-img" src="${this.card.photoUrl}" alt="${this.card.name}" loading="eager" onerror="this.src='https://placehold.co/500x500/fdfbf7/134e4a?text=${encodeURIComponent(this.card.name)}'">
              
              <!-- Floating Rarity Badge -->
              <div class="card-rarity-floating-pill">
                ${a[this.card.rarity]||"🐾 Shelter Pet"}
              </div>
            </div>

            <!-- 3. Bio & Trait Section (Clean 2-Row Layout, No Truncation) -->
            <div class="card-bio-section">
              <div class="bio-row-primary">
                <span class="bio-breed-text" title="${this.card.breed}">🧬 ${this.card.breed}</span>
                <span class="bio-age-badge">🎂 ${s}</span>
              </div>
              <div class="bio-row-secondary">
                <span class="bio-trait-badge">✨ ${o||"Sweet Companion"}</span>
                <span class="bio-location-badge">🏠 ${c}</span>
              </div>
            </div>

            <!-- 4. Signature Ability Card -->
            <div class="card-ability-card">
              <div class="card-ability-header">
                <span class="ability-name">${this.card.signatureMove.icon} ${this.card.signatureMove.name}</span>
                <span class="ability-energy">${this.card.signatureMove.energyCost}</span>
              </div>
              <p class="ability-effect">${this.card.signatureMove.effect}</p>
            </div>

            <!-- 5. Sleek RPG Attributes Row -->
            <div class="card-stats-row">
              <div class="stat-pill">
                <span class="stat-icon">⚡</span>
                <span class="stat-num">${this.card.stats.energy}</span>
                <span class="stat-label">Energy</span>
              </div>
              <div class="stat-pill">
                <span class="stat-icon">💖</span>
                <span class="stat-num">${this.card.stats.cuddle}</span>
                <span class="stat-label">Cuddle</span>
              </div>
              <div class="stat-pill">
                <span class="stat-icon">⭐</span>
                <span class="stat-num">${this.card.stats.loyalty}</span>
                <span class="stat-label">Loyalty</span>
              </div>
            </div>

            <!-- 6. Footer: Adoption Action & ID -->
            <div class="card-footer-action">
              ${this.card.isAdopted?`
                <div class="adopted-celebration-pill">
                  <span>💖</span> <span>Found Forever Home!</span>
                </div>
              `:`
                <a class="card-adopt-pill-btn" href="${this.card.adoptionUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">
                  <span>🐾 Meet & Adopt ${this.card.name} ›</span>
                </a>
              `}
              <span class="card-id-caption">${this.card.shelterStamp}</span>
            </div>
          </div>
        </div>
      </div>
    `,this.container.addEventListener("click",()=>{this.isFlipped||this.flipToFront()})}bind3DTilt(){const e=this.container,t=r=>{const s=e.getBoundingClientRect(),o=r.clientX-s.left,c=r.clientY-s.top,l=Math.min(1,Math.max(0,o/s.width)),d=Math.min(1,Math.max(0,c/s.height)),u=(.5-d)*18,m=(l-.5)*18,g=Math.atan2(c-s.height/2,o-s.width/2)*180/Math.PI+180;e.style.setProperty("--pointer-x",`${(l*100).toFixed(1)}%`),e.style.setProperty("--pointer-y",`${(d*100).toFixed(1)}%`),e.style.setProperty("--pointer-deg",`${g.toFixed(1)}deg`),e.style.setProperty("--rotate-x",`${u.toFixed(2)}deg`),e.style.setProperty("--rotate-y",`${m.toFixed(2)}deg`)},a=()=>{e.style.setProperty("--rotate-x","0deg"),e.style.setProperty("--rotate-y","0deg"),e.style.setProperty("--pointer-x","50%"),e.style.setProperty("--pointer-y","50%"),e.style.setProperty("--pointer-deg","135deg")};e.addEventListener("pointermove",t),e.addEventListener("pointerleave",a)}}class S{constructor(e,t){i(this,"cards");i(this,"currentIndex",0);i(this,"container");i(this,"onAllRevealed");i(this,"currentCardComponent",null);this.cards=e,this.onAllRevealed=t,this.container=document.createElement("div"),this.container.className="card-stack-stage",this.render(),this.bindKeyboard()}getElement(){return this.container}bindKeyboard(){window.addEventListener("keydown",e=>{e.key==="ArrowRight"?this.handleNext():e.key==="ArrowLeft"?this.handlePrev():(e.key===" "||e.key==="Enter")&&(this.currentCardComponent&&!this.currentCardComponent.getIsFlipped()?this.currentCardComponent.flipToFront():this.handleNext())})}render(){const e=this.cards.length>1;this.container.innerHTML=`
      <div class="card-stack-viewport">
        <!-- Top Status Indicator -->
        <div class="card-stack-header">
          <div class="card-counter-badge">
            <span class="badge-icon">🎴</span>
            <span class="counter-text">Card 1 of ${this.cards.length}</span>
          </div>
        </div>

        <!-- 3D Card Host -->
        <div class="card-deck-host"></div>
        
        <!-- Navigation Controls (Only shown for multi-card packs) -->
        <div class="card-stack-footer">
          ${e?`
            <div class="stack-nav-row">
              <button class="btn-nav btn-prev-card" title="Previous Card (←)" disabled>
                <span>‹</span>
                <span>Prev</span>
              </button>

              <div class="stack-pagination">
                ${this.cards.map((s,o)=>`<button class="page-dot ${o===0?"active":""}" data-index="${o}" title="View Card ${o+1}"></button>`).join("")}
              </div>

              <button class="btn-nav btn-next-card" title="Next Card (→)">
                <span>Next</span>
                <span>›</span>
              </button>
            </div>
          `:""}

          <!-- Single Streamlined Primary Action Button -->
          <div class="stack-quick-action">
            <button class="btn-primary btn-action-main">
              <span>✨ Tap Card to Reveal!</span>
            </button>
          </div>
        </div>
      </div>
    `,this.showCurrentCard();const t=this.container.querySelector(".btn-prev-card"),a=this.container.querySelector(".btn-next-card"),r=this.container.querySelector(".btn-action-main");t&&t.addEventListener("click",this.handlePrev.bind(this)),a&&a.addEventListener("click",this.handleNext.bind(this)),r&&r.addEventListener("click",this.handleMainAction.bind(this)),this.container.querySelectorAll(".page-dot").forEach(s=>{s.addEventListener("click",()=>{const o=parseInt(s.getAttribute("data-index")||"0",10);o!==this.currentIndex&&(this.currentIndex=o,this.showCurrentCard())})})}showCurrentCard(){const e=this.container.querySelector(".card-deck-host");e.innerHTML="";const t=this.cards[this.currentIndex];this.currentCardComponent=new P(t,{autoFlip:!1,onRevealed:()=>{this.updateNavButtons()}});const a=this.currentCardComponent.getElement();a.style.animation="cardPopUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",e.appendChild(a),this.updateNavButtons()}updateNavButtons(){const e=this.container.querySelector(".counter-text");e&&(e.textContent=`Card ${this.currentIndex+1} of ${this.cards.length}`),this.container.querySelectorAll(".page-dot").forEach((l,d)=>{l.classList.toggle("active",d===this.currentIndex)});const a=this.container.querySelector(".btn-prev-card");a&&(a.disabled=this.currentIndex===0);const r=this.container.querySelector(".btn-next-card"),s=this.currentIndex===this.cards.length-1;r&&(r.innerHTML=s?"<span>Finish</span> <span>✓</span>":"<span>Next</span> <span>›</span>");const o=this.container.querySelector(".btn-action-main"),c=this.currentCardComponent?this.currentCardComponent.getIsFlipped():!1;o&&(c?s?(o.innerHTML="<span>🎉 View Pack Summary ➔</span>",o.classList.add("btn-ready-next")):(o.innerHTML=`<span>Next Card (${this.currentIndex+2}/${this.cards.length}) ➔</span>`,o.classList.add("btn-ready-next")):(o.innerHTML="<span>✨ Tap Card to Reveal!</span>",o.classList.remove("btn-ready-next")))}handleMainAction(){this.currentCardComponent&&!this.currentCardComponent.getIsFlipped()?this.currentCardComponent.flipToFront():this.handleNext()}handlePrev(){this.currentIndex>0&&(p.playCardWhoosh(),this.currentIndex--,this.showCurrentCard())}handleNext(){if(this.currentCardComponent&&!this.currentCardComponent.getIsFlipped()){this.currentCardComponent.flipToFront();return}this.currentIndex<this.cards.length-1?(this.currentIndex++,this.showCurrentCard()):this.onAllRevealed()}}class M{constructor(e,t){i(this,"currentTier");i(this,"onSelect");i(this,"container");this.currentTier=e,this.onSelect=t,this.container=document.createElement("div"),this.container.className="pack-selector-bar",this.render()}getElement(){return this.container}render(){const e=["standard","duo","deluxe"];this.container.innerHTML=`
      <div class="tier-pill-group">
        ${e.map(a=>{const r=y[a];return`
            <button class="tier-pill-btn ${a===this.currentTier?"active":""}" data-tier="${a}">
              <span class="tier-pill-name">${r.title}</span>
              <span class="tier-pill-count">${r.cardCount} ${r.cardCount===1?"Card":"Cards"}</span>
            </button>
          `}).join("")}
      </div>
    `,this.container.querySelectorAll(".tier-pill-btn").forEach(a=>{a.addEventListener("click",()=>{const r=a.getAttribute("data-tier");r&&r!==this.currentTier&&(this.currentTier=r,this.render(),this.onSelect(r))})})}}class A{constructor(){i(this,"currentUserSlug","");i(this,"displayName","");i(this,"unopenedPacks",0);i(this,"coinBalance",0);i(this,"restBase","");i(this,"onProfileListeners",[]);this.initUser()}initUser(){try{const e=new URLSearchParams(window.location.search),t=e.get("dex_user")||e.get("user")||e.get("album");t?this.currentUserSlug=t.trim().toLowerCase():this.currentUserSlug=(localStorage.getItem("monroeDexUser")||"").trim().toLowerCase();const a=e.get("dex_display")||e.get("display");this.displayName=a||localStorage.getItem("monroeDexDisplay")||this.currentUserSlug||"Player";const r=e.get("dex_api")||e.get("api");this.restBase=(r||window.location.origin+"/wp-json/monroe/v1/").replace(/\/?$/,"/")}catch{this.currentUserSlug="",this.displayName="Player",this.restBase=(window.location.origin+"/wp-json/monroe/v1/").replace(/\/?$/,"/")}}async connect(){if(!this.currentUserSlug)return!1;try{const e=await fetch(`${this.restBase}adoptedex/${encodeURIComponent(this.currentUserSlug)}`,{credentials:"same-origin"});if(e.ok){const t=await e.json();return t&&t.stats&&(this.unopenedPacks=parseInt(t.stats.unopened_packs||0,10),this.coinBalance=parseInt(t.stats.coin_balance||0,10)),t&&t.display_name&&(this.displayName=t.display_name),this.notifyListeners(),!0}}catch(e){console.warn("[Booster] Could not fetch profile from DB:",e)}return!1}getCurrentUser(){return this.currentUserSlug}getDisplayName(){return this.displayName}getUnopenedPacks(){return this.unopenedPacks}getCoinBalance(){return this.coinBalance}getRestBase(){return this.restBase}onProfileUpdated(e){this.onProfileListeners.push(e),e(this.unopenedPacks,this.displayName)}notifyListeners(){this.onProfileListeners.forEach(e=>e(this.unopenedPacks,this.displayName))}async openPack(e="standard"){if(!this.currentUserSlug)throw new Error("No Adoptédex profile is set.");const t=await fetch(`${this.restBase}adoptedex/${encodeURIComponent(this.currentUserSlug)}/packs/open`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({tier:e})}),a=await t.json().catch(()=>null);if(!t.ok||!a||!a.ok){const s=a&&a.message||`Pack open failed (${t.status})`;throw new Error(s)}this.unopenedPacks=parseInt(a.unopened_packs,10)||0,this.coinBalance=parseInt(a.coin_balance,10)||0,this.notifyListeners();const r=(a.cards||[]).map(s=>s.id);try{const s=JSON.parse(localStorage.getItem("monroe_discovered_pets")||"[]"),o=new Set([...s,...r]);localStorage.setItem("monroe_discovered_pets",JSON.stringify(Array.from(o)))}catch{}return window.dispatchEvent(new CustomEvent("monroe-adoptedex-updated",{detail:{petIds:r,user:this.currentUserSlug}})),{ok:!0,tier:a.tier||e,cards:a.cards||[],alreadyOwned:a.already_owned||[],packRarity:a.pack_rarity||"common",packRarityLabel:a.pack_rarity_label||"Common Pack",coinsAwarded:parseInt(a.coins_awarded,10)||0,coinBalance:this.coinBalance,unopenedPacks:this.unopenedPacks,totalPacksOpened:parseInt(a.total_packs_opened,10)||0}}}const h=new A,b={common:{label:"Common Pack",className:"pack-rarity-common"},uncommon:{label:"Uncommon Pack",className:"pack-rarity-uncommon"},rare:{label:"Rare Pack",className:"pack-rarity-rare"}};class E{constructor(e,t,a,r,s){i(this,"cards");i(this,"coinsAwarded");i(this,"packRarity");i(this,"packRarityLabel");i(this,"onOpenAnother");i(this,"container");this.cards=e,this.coinsAwarded=t,this.packRarity=a,this.packRarityLabel=r,this.onOpenAnother=s,this.container=document.createElement("div"),this.container.className="summary-modal-overlay",this.render()}getElement(){return this.container}render(){const e=h.getCurrentUser()||"Player",t=h.getDisplayName()||e,a=h.getRestBase(),r=`../dex/album.html?embed=1&dex_user=${encodeURIComponent(e)}&dex_display=${encodeURIComponent(t)}&dex_api=${encodeURIComponent(a)}`,s=h.getUnopenedPacks(),o=b[this.packRarity]||b.common,c=this.packRarityLabel||o.label;this.container.innerHTML=`
      <div class="summary-modal-card">
        <div class="summary-modal-header">
          <div class="summary-celebration-badge">🎉 Pack Complete!</div>
          <div class="summary-pack-rarity-badge ${o.className}">${c}</div>
          <h2>New Companions Discovered!</h2>
          <p>Saved <strong>${this.cards.length} new ${this.cards.length===1?"pet card":"pet cards"}</strong> to your Adoptédex album.</p>
          ${this.coinsAwarded>0?`
            <p class="summary-coins-awarded">🪙 +${this.coinsAwarded} coin${this.coinsAwarded===1?"":"s"}! <span class="summary-coins-balance">(${h.getCoinBalance()} total)</span></p>
          `:""}
        </div>

        <div class="summary-card-grid">
          ${this.cards.map(d=>`
            <div class="summary-card-thumb" title="${d.name} - ${d.breed}">
              <div class="summary-thumb-photo-wrap">
                <img src="${d.photoUrl}" alt="${d.name}" onerror="this.src='https://placehold.co/140x140/fdfbf7/134e4a?text=${encodeURIComponent(d.name)}'">
              </div>
              <div class="summary-thumb-info">
                <div class="summary-thumb-name">${d.name}</div>
                <div class="summary-thumb-rarity">${d.rarityLabel}</div>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="summary-modal-actions">
          ${s>0?`
            <button class="btn-primary btn-open-more">
              <span>✨ Open Another Pack (${s} left)</span>
            </button>
          `:`
            <button class="btn-primary btn-play-match" onclick="if (window.parent && window.parent !== window) { window.parent.location.href='/games/?game=match'; } else { window.location.href='/games/?game=match'; }">
              <span>🧩 Play Pet Match to Earn More Packs!</span>
            </button>
          `}
          <a class="btn-secondary-link" href="${r}" target="_self">
            <span>📖 View My Pet Album</span>
          </a>
        </div>
      </div>
    `;const l=this.container.querySelector(".btn-open-more");l&&l.addEventListener("click",()=>{this.container.remove(),this.onOpenAnother()})}}function L(n,e){if(e)switch(e){case"alumni":return{rarity:"alumni",foil:"prism",label:"Adopted Alumni"};case"golden_senior":return{rarity:"golden_senior",foil:"gold",label:"Golden Senior (7+ Yrs)"};case"longtimer":return{rarity:"longtimer",foil:"cosmos",label:"Shelter Champion"};case"tiny_wonder":return{rarity:"tiny_wonder",foil:"aurora",label:"Tiny Wonder (<6 Mos)"};default:return{rarity:"common",foil:"none",label:"Shelter Companion"}}if(n.isArchived)return{rarity:"alumni",foil:"prism",label:"Adopted Alumni"};const t=n.age.toLowerCase(),a=t.includes("month")&&!t.includes("year"),r=t.match(/(\d+)\s*year/);if((r?parseInt(r[1],10):a?0:2)>=7)return{rarity:"golden_senior",foil:"gold",label:"Golden Senior"};if(a){const c=t.match(/(\d+)\s*month/);if((c?parseInt(c[1],10):2)<=6)return{rarity:"tiny_wonder",foil:"aurora",label:"Tiny Wonder"}}return parseInt(n.id.replace(/\D/g,""),10)<6e7?{rarity:"longtimer",foil:"cosmos",label:"Shelter Champion"}:{rarity:"common",foil:"none",label:"Shelter Companion"}}function $(n,e){let t=0;for(let f=0;f<n.id.length;f++)t=(t<<5)-t+n.id.charCodeAt(f),t|=0;const a=Math.abs(t)%25,r=n.age.toLowerCase(),s=r.includes("month")&&!r.includes("year"),o=r.match(/(\d+)\s*year/),c=o?parseInt(o[1],10):2;let l=s?92+a%8:Math.max(35,88-c*6+a%10),d=n.location==="Foster Care"?95:70+a%25,u=s?95:Math.max(40,85-c*4+a%15),m=e==="longtimer"?100:e==="golden_senior"?98:75+a%20;return n.species.toLowerCase()==="cat"&&(d=Math.min(100,d+5)),{energy:Math.min(100,Math.max(20,Math.round(l))),cuddle:Math.min(100,Math.max(20,Math.round(d))),playful:Math.min(100,Math.max(20,Math.round(u))),loyalty:Math.min(100,Math.max(20,Math.round(m)))}}function R(n,e){const t=n.species.toLowerCase()==="cat";return e==="alumni"?{name:"Forever Home Glow",icon:"💖",energyCost:"💖 💖 💖",effect:"Fills the room with endless joy and unlocks unforgettable alumni memories."}:e==="golden_senior"?{name:"Gentle Soul Radiance",icon:"👑",energyCost:"⭐ ⭐",effect:"Bestows a sense of utter peacefulness, granting maximum cuddle priority."}:e==="tiny_wonder"?t?{name:"Pounce of Curiosity",icon:"🐾",energyCost:"⚡",effect:"Darts across the room chasing phantom dust motes with 200% agility."}:{name:"Puppy Eyes Beam",icon:"✨",energyCost:"⚡",effect:"Instantly disarms all human skepticism, securing extra belly rubs."}:e==="longtimer"?{name:"Shelter Champion Bond",icon:"🛡️",energyCost:"🛡️ ⭐",effect:"Guarantees unyielding lifelong loyalty and warm welcoming greetings."}:t?{name:"Purr Motor Surge",icon:"😻",energyCost:"🐾",effect:"Emits a soothing 45 Hz frequency that eases human stress instantly."}:{name:"Tail Wiggle Storm",icon:"🐕",energyCost:"🐾",effect:"Wags tail at lightning speed, spreading enthusiasm throughout the shelter."}}function B(n,e){const t=n.species.toLowerCase()==="cat";let a=["Affectionate","Curious"],r=t?"Feather Teaser":"Tennis Ball";return e==="tiny_wonder"?(a=t?["Playful Sprite","Purr Machine","Adventurer"]:["Bouncy Pup","Nap Champion","Curious"],r=t?"Crinkle Ball":"Squeaky Plush"):e==="golden_senior"?(a=["Wise Soul","Gentle Giant","Lap Enthusiast"],r="Orthopedic Sunbed"):e==="longtimer"?(a=["Staff Favorite","Steadfast Friend","Super Loyal"],r="Peanut Butter KONG"):e==="alumni"?(a=["Living the Dream","Loved Forever","VIP Alum"],r="Forever Family Couch"):a=t?["Sunbeam Lounger","Cuddle Bug"]:["Walk Enthusiast","Treat Connoisseur"],{traits:a,favoriteItem:r}}function F(n,e){const t=n.species.toLowerCase()==="cat";return e==="alumni"?`${n.name} found their forever family and lives happily today. Remembered fondly at Monroe Humane Society for bringing joy to everyone they met!`:e==="golden_senior"?"A wise and gentle companion who has perfected the art of afternoon naps and affectionate greetings. Deserves a warm, loving retirement home!":e==="tiny_wonder"?t?"A curious little explorer who pounces on feather toys and purrs vigorously the moment you pick them up.":"An energetic bundle of joy with bouncy steps and a tail that never stops wagging!":e==="longtimer"?"A loyal shelter champion beloved by all the staff and volunteers. Ready to bring endless unconditional love to their forever human.":t?`A friendly ${n.breed} with a gentle disposition, perfect for warm sunbeams and quiet evenings.`:`A bright, companionable ${n.breed} with plenty of spirit, eager for fun outdoor walks and belly rubs.`}function I(n,e,t){const{rarity:a,foil:r,label:s}=L(n,t),o=$(n,a),c=F(n,a),l=R(n,a),{traits:d,favoriteItem:u}=B(n,a),m="#"+String(e).padStart(3,"0"),f=`HSMC ID #${n.id} • Monroe Co.`,v=`https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails2.aspx?id=${n.id}&css=&authkey=40fm1dbi1t4267edhjlafrfmbgfqfvmi0vjjm3iori7pxqk8xp&PopUp=true`;return{dexNumber:m,id:n.id,name:n.name,species:n.species.toLowerCase()==="cat"?"cat":n.species.toLowerCase()==="dog"?"dog":"other",breed:n.breed,gender:n.gender,ageText:n.age,location:n.location,photoUrl:n.photoUrl,rarity:a,foil:r,rarityLabel:s,petBio:c,signatureMove:l,personalityTraits:d,favoriteItem:u,shelterStamp:f,stats:o,isAdopted:n.isArchived,adoptionUrl:v}}async function N(){try{const n=window.location.origin+"/wp-json/monroe/v1/",e=await fetch(`${n}pack-tiers`);if(!e.ok)return;const t=await e.json();Object.keys(y).forEach(a=>{typeof t[a]=="number"&&t[a]>0&&(y[a].cardCount=t[a])})}catch{}}function O(n,e){const t={id:n.id,name:n.name,species:n.type||"Dog",breed:n.breed||"Mixed Breed",gender:n.gender||"Unknown",age:n.age||"2 years",location:"",photoUrl:n.file||"",isArchived:n.archived};return I(t,e+1,n.rarity)}class U{constructor(){i(this,"appRoot");i(this,"currentTier","standard");i(this,"boosterPack",null);i(this,"packSelector",null);i(this,"cardStack",null);i(this,"currentCards",[]);i(this,"currentCoinsAwarded",0);i(this,"currentPackRarityLabel","Common Pack");i(this,"currentPackRarity","common");i(this,"isTearingOrRevealing",!1);this.appRoot=document.getElementById("app"),this.parseQueryParams(),this.init(),this.bindGlobalKeyboard()}parseQueryParams(){try{const e=new URLSearchParams(window.location.search),t=e.get("pack")||e.get("tier");(t==="duo"||t==="deluxe"||t==="standard")&&(this.currentTier=t);const a=e.get("cards");a==="3"&&(this.currentTier="deluxe"),a==="2"&&(this.currentTier="duo"),a==="1"&&(this.currentTier="standard")}catch{}}init(){this.renderHeader(),this.renderStage(),h.connect().catch(()=>{}),N().then(()=>{this.isTearingOrRevealing||this.renderStage()})}bindGlobalKeyboard(){window.addEventListener("keydown",e=>{if(e.key==="m"||e.key==="M"){const t=!p.getMuted();p.setMuted(t);const a=document.querySelector(".sound-icon");a&&(a.textContent=t?"🔇":"🔊")}this.isTearingOrRevealing||(e.key==="1"&&this.switchTier("standard"),e.key==="2"&&this.switchTier("duo"),e.key==="3"&&this.switchTier("deluxe"),(e.key===" "||e.key==="Enter")&&this.boosterPack&&this.boosterPack.ripOpen())})}switchTier(e){this.currentTier=e,this.boosterPack&&this.boosterPack.setTier(e),this.packSelector&&this.renderStage()}renderHeader(){const e=document.createElement("header");e.className="booster-header";const t="/assets/recovered/images/lirp.cdn-website.com/77cfa591/dms3rep/multi/opt/a93f9c_be31971351e8408cb8178224c57b9477-mv2-b3da8eac-1920w.webp",a=p.getMuted();e.innerHTML=`
      <div class="booster-logo-container">
        <img class="booster-logo-img" src="${t}" alt="Humane Society of Monroe County" onerror="this.style.display='none'">
        <div class="booster-brand-text">
          <span class="booster-brand-title">Humane Packs</span>
          <span class="booster-brand-subtitle">Adoptédex Collector</span>
        </div>
      </div>

      <div class="header-controls">
        <div class="booster-player-badge" data-booster-player-badge>
          <span class="player-icon">🐾</span>
          <span class="player-name" data-player-name>${h.getDisplayName()}</span>
          <span class="pack-count-pill">🎁 <strong data-unopened-count>${h.getUnopenedPacks()}</strong> Packs</span>
        </div>
        <button class="btn-icon btn-sound-toggle" title="Toggle Sound (Press M)" aria-label="Toggle Sound">
          <span class="sound-icon">${a?"🔇":"🔊"}</span>
        </button>
      </div>
    `;const r=e.querySelector("[data-player-name]"),s=e.querySelector("[data-unopened-count]");h.onProfileUpdated((l,d)=>{r&&(r.textContent=d),s&&(s.textContent=String(l))});const o=e.querySelector(".btn-sound-toggle"),c=e.querySelector(".sound-icon");o.addEventListener("click",()=>{const l=!p.getMuted();p.setMuted(l),c.textContent=l?"🔇":"🔊"}),this.appRoot.appendChild(e)}renderStage(){this.isTearingOrRevealing=!1;const e=this.appRoot.querySelector(".booster-stage");e&&e.remove();const t=this.appRoot.querySelector(".pack-selector-bar");t&&t.remove();const a=document.createElement("main");a.className="booster-stage",this.boosterPack=new T(this.currentTier,()=>{this.handlePackTorn()}),a.appendChild(this.boosterPack.getElement()),this.appRoot.appendChild(a),this.packSelector=new M(this.currentTier,r=>{this.currentTier=r,this.boosterPack&&this.boosterPack.setTier(r)}),this.appRoot.appendChild(this.packSelector.getElement())}async handlePackTorn(){this.isTearingOrRevealing=!0;const e=this.appRoot.querySelector(".pack-selector-bar");e&&(e.style.display="none"),this.showRevealLoading();let t;try{t=await h.openPack(this.currentTier)}catch(a){console.error("[Booster] openPack failed:",a),this.showPackOpenError(a instanceof Error?a.message:"Could not open pack.");return}this.currentCards=t.cards.map((a,r)=>O(a,r)),this.currentCoinsAwarded=t.coinsAwarded,this.currentPackRarity=t.packRarity,this.currentPackRarityLabel=t.packRarityLabel,setTimeout(()=>{const a=this.appRoot.querySelector(".booster-stage");a&&(a.innerHTML="",this.cardStack=new S(this.currentCards,()=>{this.handleAllRevealed()}),a.appendChild(this.cardStack.getElement()))},600)}showRevealLoading(){const e=this.appRoot.querySelector(".booster-stage");if(!e)return;const t=document.createElement("div");t.className="pack-reveal-loading",t.innerHTML='<div class="pack-reveal-spinner"></div><p>Opening pack…</p>',e.appendChild(t)}showPackOpenError(e){this.isTearingOrRevealing=!1;const t=this.appRoot.querySelector(".booster-stage");t&&(t.innerHTML=`
        <div class="pack-open-error" role="alert">
          <p>⚠️ ${e}</p>
          <button class="btn-primary btn-pack-error-back">Back</button>
        </div>
      `,t.querySelector(".btn-pack-error-back")?.addEventListener("click",()=>this.resetToStage()));const a=this.appRoot.querySelector(".pack-selector-bar");a&&(a.style.display="")}handleAllRevealed(){const e=new E(this.currentCards,this.currentCoinsAwarded,this.currentPackRarity,this.currentPackRarityLabel,()=>this.resetToStage());this.appRoot.appendChild(e.getElement())}resetToStage(){this.renderStage()}}document.addEventListener("DOMContentLoaded",()=>{new U});
