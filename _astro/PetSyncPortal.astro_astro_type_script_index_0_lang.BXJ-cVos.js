import{n as e,t}from"./qr-code-styling.C_qVg_wM.js";import{t as n}from"./staff-pets.BFxNk9hK.js";var r=e(t(),1);function i(e){return String(e??``).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function a(e){if(!e)return`—`;let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`,hour:`numeric`,minute:`2-digit`})}function o(e,t){let n=document.getElementById(e);n&&(n.textContent=t)}function s(e){o(`petsync-active-count-badge`,String(e.activeCount)),o(`petsync-archived-count-badge`,String(e.archivedCount)),o(`petsync-total-count-badge`,String(e.totalCount)),o(`petsync-pill-active-count`,String(e.activeCount)),o(`petsync-pill-archived-count`,String(e.archivedCount)),o(`petsync-pill-all-count`,String(e.totalCount)),o(`petsync-showing-total`,String(e.totalCount)),o(`pets-page-active-count`,String(e.activeCount));let t=document.getElementById(`petsync-last-sync`),n=document.getElementById(`petsync-live-badge`);if(t&&(t.textContent=a(e.lastSyncTimestamp),e.lastSyncTimestamp&&t.setAttribute(`title`,e.lastSyncTimestamp)),n&&e.lastSyncTimestamp){let t=new Date(e.lastSyncTimestamp).getTime();(Date.now()-t)/36e5>24?(n.textContent=`STALE`,n.className=`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 mt-1`,n.setAttribute(`title`,`Last sync was over 24 hours ago. Petango might be down.`)):(n.textContent=`LIVE`,n.className=`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mt-1`)}let r=(e.pets||[]).filter(e=>!e.archived_at),i=e=>{let t=e.intake_date||e.first_seen_at;if(!t)return 0;let n=new Date(t).getTime();return Number.isNaN(n)?0:Math.floor((Date.now()-n)/864e5)},s=r.map(e=>({...e,days:i(e)})),c=e=>e.length?Math.round(e.reduce((e,t)=>e+t.days,0)/e.length):0,l=s.filter(e=>e.type===`dog`),d=s.filter(e=>e.type===`cat`),f=s.filter(e=>e.days>60);o(`petsync-avg-stay`,s.length?`${c(s)}d`:`--`);let p=document.getElementById(`petsync-avg-stay-detail`);p&&(p.textContent=`Dogs ${c(l)}d · cats ${c(d)}d`),o(`petsync-longstay-count`,String(f.length)),o(`species-count-longstay`,String(f.length)),o(`petsync-total-served`,String(e.totalCount)),o(`petsync-ytd-adoptions`,`${e.archivedCount} adopted`);let m=r.length-l.length-d.length;o(`petsync-daily-care-cost`,`$${(l.length*22+d.length*14+m*10).toLocaleString()}`),u(`echarts-dog-capacity`,l.length,50,`#f59e0b`),u(`echarts-cat-capacity`,d.length,80,`#14b8a6`)}function c(e,t,n){if(!Array.isArray(e)||e.length===0)return;let r=document.createDocumentFragment(),a=document.createDocumentFragment(),o=new Set,s=new Set;t&&t.querySelectorAll(`.petsync-row`).forEach(e=>{let t=e.getAttribute(`data-pet-id`);t&&o.add(t)}),n&&n.querySelectorAll(`.petsync-mobile-card`).forEach(e=>{let t=e.getAttribute(`data-pet-id`);t&&s.add(t)}),e.forEach(e=>{let c=String(e.id),l=!!e.archived_at,u=e.intake_date?Math.floor((Date.now()-new Date(e.intake_date).getTime())/864e5):null,d=e.image||`/assets/recovered/images/placeholder.svg`,f=`/adopt/${encodeURIComponent(e.id)}`,p=e.url&&!/authkey=/i.test(e.url)?e.url:f,m=e.intake_date?new Date(e.intake_date).toLocaleDateString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`}):`—`,h=l?`Archived / Adopted`:i(e.stage||`Available`),g=l?`bg-purple-100 text-purple-800 border-purple-200`:`bg-emerald-100 text-emerald-800 border-emerald-200`,_=JSON.stringify({id:e.id,name:e.name,type:e.type,species_label:e.species_label,breed:e.breed,age:e.age,age_display:e.age_display,size:e.size,color:e.color,gender:e.gender,location:e.location,image:d,intake_date:e.intake_date,days_at_shelter:u,description:e.description}).replace(/'/g,`&#39;`),v=i(e.name),y=i(e.id),b=i(e.breed),x=i(e.color),S=i(e.species_label||e.type),C=i(e.age_display||e.age||`Adult`),w=i(e.location||`Shelter`),T=i(d),E=i(p),D=e.gender===`female`?`♀ Female`:e.gender===`male`?`♂ Male`:`Unknown`,O=e.type===`dog`?`bg-amber-500`:e.type===`cat`?`bg-teal-500`:`bg-slate-400`;if(t&&!o.has(c)){o.add(c);let t=document.createElement(`tr`);t.className=`hover:bg-slate-50/80 transition petsync-row`,t.setAttribute(`data-is-archived`,l?`true`:`false`),t.setAttribute(`data-species`,e.type||``),t.setAttribute(`data-location`,e.location||``),t.setAttribute(`data-search`,`${e.id} ${e.name} ${e.breed} ${e.color||``} ${e.location||``} ${e.gender}`.toLowerCase()),t.setAttribute(`data-pet-id`,c),t.setAttribute(`data-pet-name`,String(e.name||``)),t.setAttribute(`data-pet-breed`,String(e.breed||``)),t.setAttribute(`data-pet-species`,String(e.species_label||e.type||``)),t.setAttribute(`data-intake-date`,e.intake_date||``),t.setAttribute(`data-days-at-shelter`,u===null?``:String(u)),t.innerHTML=`
        <td class="py-2 px-3">
          <div class="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative group">
            <img
              src="${T}"
              alt="${v}"
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-110 transition duration-200"
              data-fallback="/assets/recovered/images/placeholder.svg"
            />
          </div>
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <div class="flex items-center gap-1">
            <span class="font-mono font-bold text-slate-900">${y}</span>
            <button
              type="button"
              class="copy-pet-id-btn text-slate-400 hover:text-teal-700 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Copy Animal ID"
              data-copy-id="${y}"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
              </svg>
            </button>
          </div>
          <a
            href="${E}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-700 hover:text-teal-900 hover:underline mt-0.5"
            title="Open official PetPoint WebServices details popup"
          >
            Open PetPoint ↗
          </a>
        </td>
        <td class="py-2 px-3">
          <div class="font-bold text-slate-900 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full ${O} inline-block mr-1"></span>
            <span class="text-sm">${v}</span>
          </div>
          <span class="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
            ${S}
          </span>
        </td>
        <td class="py-2 px-3">
          <span class="text-slate-800 font-medium block truncate max-w-xs" title="${b}">
            ${b}
          </span>
          ${x?`<span class="text-[11px] text-slate-500 block">Color: ${x}</span>`:``}
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="font-medium text-slate-800 block">${D}</span>
          <span class="text-[11px] text-slate-500 block">${C}</span>
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            ${w}
          </span>
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="text-slate-800 font-medium block">${m}</span>
          ${u===null?``:`<span class="text-[10px] font-semibold text-slate-500">${u} days in care</span>`}
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${g} border">
            ${h}
          </span>
        </td>
        <td class="py-2 px-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button
              type="button"
              class="petsync-print-card-btn inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition cursor-pointer"
              data-pet-info='${_}'
              title="Print official cage card for this animal"
            >
              Print Card
            </button>
            <a
              href="${i(f)}"
              target="_blank"
              class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Public ↗
            </a>
          </div>
        </td>
      `,r.appendChild(t)}if(n&&!s.has(c)){s.add(c);let t=document.createElement(`div`);t.className=`petsync-mobile-card bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3 transition`,t.setAttribute(`data-is-archived`,l?`true`:`false`),t.setAttribute(`data-pet-id`,c),t.setAttribute(`data-species`,e.type||``),t.setAttribute(`data-location`,e.location||``),t.setAttribute(`data-search`,`${e.id} ${e.name} ${e.breed} ${e.color||``} ${e.location||``} ${e.gender}`.toLowerCase()),t.setAttribute(`data-days-at-shelter`,u===null?``:String(u)),t.innerHTML=`
        <div class="flex items-start gap-3">
          <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
            <img
              src="${T}"
              alt="${v}"
              loading="lazy"
              class="w-full h-full object-cover"
              data-fallback="/assets/recovered/images/placeholder.svg"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h3 class="text-base font-bold text-slate-900 truncate flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${O} inline-block mr-1"></span>
                <span>${v}</span>
              </h3>
              <span class="font-mono font-bold text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 border border-slate-200">
                #${y}
                <button
                  type="button"
                  class="copy-pet-id-btn text-slate-400 hover:text-teal-700 cursor-pointer"
                  title="Copy ID"
                  data-copy-id="${y}"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                  </svg>
                </button>
              </span>
            </div>
            <p class="text-xs text-slate-600 truncate mt-0.5">${b}</p>
            <div class="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
              <span class="text-slate-500">${D}</span>
              <span class="text-slate-300">·</span>
              <span class="text-slate-500">${C}</span>
              <span class="text-slate-300">·</span>
              <span class="text-slate-700 font-medium">${w}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
          <div>
            <span class="inline-flex items-center px-2 py-0.5 rounded-md font-semibold border text-[10px] ${g}">
              ${h}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="petsync-print-card-btn inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition cursor-pointer"
              data-pet-info='${_}'
            >
              Print Card
            </button>
            <a
              href="${i(f)}"
              target="_blank"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Public ↗
            </a>
          </div>
        </div>
      `,a.appendChild(t)}}),document.getElementById(`petsync-loading-row`)?.remove(),document.getElementById(`petsync-mobile-loading`)?.remove(),t&&t.appendChild(r),n&&n.appendChild(a)}async function l(e,t){let r=await n();return r.ok?(c(r.data.pets,e,t),s(r.data),!0):(document.getElementById(`petsync-loading-row`)?.remove(),document.getElementById(`petsync-mobile-loading`)?.remove(),e&&!e.querySelector(`.petsync-row`)&&(e.innerHTML=`<tr><td colspan="9" class="py-10 text-center text-slate-500">Could not load shelter census. Sign in again, then retry.</td></tr>`),t&&!t.querySelector(`.petsync-mobile-card`)&&(t.innerHTML=`<p class="text-center text-slate-500 py-6">Could not load shelter census.</p>`),!1)}function u(e,t,n,r){let i=document.getElementById(e);if(!i)return;let a=Math.min(100,Math.max(0,Math.round(t/n*100))),o=a>=90?`Near Capacity`:a>=70?`High`:a>=40?`Optimal`:`Low`,s=a>=90?`text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800`:a>=70?`text-amber-800 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800`:`text-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800`,c=Math.PI*54,l=c*(1-a/100);i.innerHTML=`
    <div class="flex flex-col items-center justify-center w-full h-full pt-1 pb-1">
      <div class="relative flex items-center justify-center">
        <svg viewBox="0 0 140 85" class="w-36 h-22">
          <!-- Background track -->
          <path
            d="M 16 75 A 54 54 0 0 1 124 75"
            fill="none"
            stroke="currentColor"
            stroke-width="12"
            stroke-linecap="round"
            class="text-slate-100 dark:text-slate-800"
          />
          <!-- Progress arc -->
          <path
            d="M 16 75 A 54 54 0 0 1 124 75"
            fill="none"
            stroke="${r}"
            stroke-width="12"
            stroke-linecap="round"
            stroke-dasharray="${c.toFixed(1)}"
            stroke-dashoffset="${l.toFixed(1)}"
            style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);"
          />
        </svg>
        <div class="absolute bottom-1 flex flex-col items-center">
          <span class="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white leading-none">${a}%</span>
          <span class="text-[10px] text-slate-400 mt-0.5">${t} / ${n} kennels</span>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${s}">
          ${o}
        </span>
      </div>
    </div>
  `}function d(){let e=document.getElementById(`petsync-portal-root`);if(!e||e.__petsync_initialized)return;e.__petsync_initialized=!0,e.addEventListener(`error`,e=>{let t=e.target;if(t&&t.tagName===`IMG`&&t.hasAttribute(`data-fallback`)){let e=t.getAttribute(`data-fallback`);t.removeAttribute(`data-fallback`),e&&(t.src=e)}},!0);let t=e.querySelectorAll(`.petsync-status-pill`),n=e.querySelectorAll(`.petsync-species-btn`),i=e.querySelector(`#petsync-search-input`),a=e.querySelector(`#petsync-location-filter`),o=e.querySelector(`#petsync-duration-filter`),s=e.querySelector(`#petsync-reset-btn`),c=e.querySelector(`#export-csv-btn`),u=e.querySelector(`#petsync-filtered-count`),d=e.querySelector(`#petsync-empty-state`),f=e.querySelector(`#petsync-tbody`),p=e.querySelector(`#petsync-mobile-container`),m=`active`,h=``,g=``,_=``,v=``,y=!1;async function b(){y||(y=!0,await l(f,p)||(y=!1))}let x=()=>{let t=0,n=0,r=0,i=0,a=0,o=new Set;(f?f.querySelectorAll(`.petsync-row`):e.querySelectorAll(`tr.petsync-row`)).forEach(e=>{let s=e.getAttribute(`data-pet-id`);if(s){if(o.has(s))return;o.add(s)}let c=e.getAttribute(`data-is-archived`)===`true`,l=!0;if(m===`active`?l=!c:m===`archived`&&(l=c),l){t++;let o=(e.getAttribute(`data-species`)||``).toLowerCase(),s=e.getAttribute(`data-days-at-shelter`),c=s?parseInt(s,10):null;c!==null&&c>60&&a++,o===`dog`?n++:o===`cat`?r++:i++}});let s=e.querySelector(`#species-count-all`),c=e.querySelector(`#species-count-dog`),l=e.querySelector(`#species-count-cat`),u=e.querySelector(`#species-count-other`),d=e.querySelector(`#species-count-longstay`);s&&(s.textContent=String(t)),c&&(c.textContent=String(n)),l&&(l.textContent=String(r)),u&&(u.textContent=String(i)),d&&(d.textContent=String(a))},S=()=>{let t=0,n=0;e.querySelectorAll(`.petsync-row, .petsync-mobile-card`).forEach(e=>{let r=e.getAttribute(`data-is-archived`)===`true`,i=e.getAttribute(`data-species`)||``,a=e.getAttribute(`data-location`)||``,o=e.getAttribute(`data-search`)||``,s=e.getAttribute(`data-days-at-shelter`),c=s?parseInt(s,10):null,l=!0;m===`active`?l=!r:m===`archived`&&(l=r);let u=!0;h===`longstay`?u=c!==null&&c>60:h&&(u=i===h);let d=!0;g===`foster`?d=a.toLowerCase().includes(`foster`):g===`shelter`&&(d=!a.toLowerCase().includes(`foster`));let f=!0;_&&c!==null?_===`new`?f=c<=14:_===`standard`?f=c>14&&c<=60:_===`long`?f=c>60&&c<=180:_===`urgent`&&(f=c>180):_&&c===null&&(f=!1);let p=!0;v.trim()&&(p=o.includes(v.toLowerCase().trim())),l&&u&&d&&f&&p?(e.style.display=``,e.classList.contains(`petsync-row`)?t++:n++):e.style.display=`none`});let r=t>0?t:n;u&&(u.textContent=r.toString()),d&&(r===0?d.classList.remove(`hidden`):d.classList.add(`hidden`)),x()};n.forEach(e=>{e.addEventListener(`click`,()=>{h=e.getAttribute(`data-species-pill`)||``,n.forEach(e=>{e.classList.remove(`active`,`bg-[#173a39]`,`text-white`),e.classList.add(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`)}),e.classList.add(`active`,`bg-[#173a39]`,`text-white`),e.classList.remove(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`),S()})}),t.forEach(e=>{e.addEventListener(`click`,()=>{let n=e.getAttribute(`data-status-filter`)||`active`;m=n,t.forEach(e=>{e.classList.remove(`active`,`bg-[#173a39]`,`text-white`),e.classList.add(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`)}),e.classList.add(`active`,`bg-[#173a39]`,`text-white`),e.classList.remove(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`),(n===`archived`||n===`all`)&&b(),S()})}),i&&i.addEventListener(`input`,e=>{v=e.target.value,v.trim().length>1&&b(),S()}),a&&a.addEventListener(`change`,e=>{g=e.target.value,S()}),o&&o.addEventListener(`change`,e=>{_=e.target.value,S()}),s&&s.addEventListener(`click`,()=>{m=`active`,h=``,g=``,_=``,v=``,i&&(i.value=``),a&&(a.value=``),o&&(o.value=``),n.forEach(e=>{(e.getAttribute(`data-species-pill`)||``)===``?(e.classList.add(`active`,`bg-[#173a39]`,`text-white`),e.classList.remove(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`)):(e.classList.remove(`active`,`bg-[#173a39]`,`text-white`),e.classList.add(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`))}),t.forEach(e=>{e.getAttribute(`data-status-filter`)===`active`?(e.classList.add(`active`,`bg-[#173a39]`,`text-white`),e.classList.remove(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`)):(e.classList.remove(`active`,`bg-[#173a39]`,`text-white`),e.classList.add(`bg-white dark:bg-[#0b2420]/85`,`text-slate-700 dark:text-slate-200`,`border`,`border-slate-200 dark:border-teal-800/80`))}),S()}),c&&c.addEventListener(`click`,()=>{b(),S();let t=e.querySelectorAll(`.petsync-row`),n=Array.from(t).filter(e=>e.style.display!==`none`),r=[[`Pet ID`,`Name`,`Species`,`Breed`,`Location`,`Intake Date`,`Days in Care`,`Status`].join(`,`)],i=new Set;n.forEach(e=>{let t=e.getAttribute(`data-pet-id`)||``;if(t&&i.has(t))return;t&&i.add(t);let n=`"${t}"`,a=`"${e.getAttribute(`data-pet-name`)||``}"`,o=`"${e.getAttribute(`data-pet-species`)||``}"`,s=`"${(e.getAttribute(`data-pet-breed`)||``).replace(/"/g,`""`)}"`,c=`"${e.getAttribute(`data-location`)||``}"`,l=`"${e.getAttribute(`data-intake-date`)||``}"`,u=`"${e.getAttribute(`data-days-at-shelter`)||``}"`,d=e.getAttribute(`data-is-archived`)===`true`?`"Archived"`:`"Active"`;r.push([n,a,o,s,c,l,u,d].join(`,`))});let a=new Blob([r.join(`
`)],{type:`text/csv;charset=utf-8;`}),o=URL.createObjectURL(a),s=document.createElement(`a`);s.href=o,s.download=`monroe-petsync-roster-${new Date().toISOString().slice(0,10)}.csv`,s.click(),URL.revokeObjectURL(o)});let C=document.getElementById(`kennel-card-modal`),w=document.getElementById(`close-card-modal-btn`),T=document.getElementById(`trigger-print-btn`);w&&C&&(w.addEventListener(`click`,()=>C.classList.add(`hidden`)),C.addEventListener(`click`,e=>{e.target===C&&C.classList.add(`hidden`)})),T&&T.addEventListener(`click`,()=>window.print()),e.addEventListener(`click`,e=>{let t=e.target.closest(`.petsync-print-card-btn`);if(!t)return;e.stopPropagation();let n=t.getAttribute(`data-pet-info`);if(n)try{let e=JSON.parse(n),t=document.getElementById(`card-pet-photo`);t&&(t.src=e.image||`/assets/recovered/images/placeholder.svg`);let i=document.getElementById(`card-pet-id`);i&&(i.textContent=e.id||`00000000`);let a=document.getElementById(`card-pet-name`);a&&(a.textContent=e.name||`Friend`);let o=document.getElementById(`card-pet-gender-age`);o&&(o.textContent=`${e.gender===`female`?`Female`:e.gender===`male`?`Male`:`Unknown`} · ${e.age_display||e.age||`Adult`}`);let s=document.getElementById(`card-pet-breed`);s&&(s.textContent=`${e.breed||`Mixed`} (${e.type||`Animal`})`);let c=document.getElementById(`card-pet-size`);c&&(c.textContent=e.size?e.size[0].toUpperCase()+e.size.slice(1):`Medium`);let l=document.getElementById(`card-pet-color`);l&&(l.textContent=e.color||`Standard`);let u=document.getElementById(`card-pet-intake`);if(u){let t=e.days_at_shelter!==null&&e.days_at_shelter!==void 0?`${e.days_at_shelter}d`:``;u.textContent=`${e.intake_date?new Date(e.intake_date).toLocaleDateString(`en-US`,{month:`short`,day:`numeric`,year:`numeric`}):`Recent`} ${t?`(${t})`:``}`}let d=document.getElementById(`card-kennel-location`);d&&(d.textContent=`Location: ${e.location||`Main Kennel`}`);let f=document.getElementById(`card-pet-notes`);f&&(f.textContent=e.description||`Sweet, friendly companion ready for a forever home. Sociable and walked daily by volunteers.`);let p=document.getElementById(`card-direct-url`),m=`https://monroe-humane.org/adopt/${e.id}`;p&&(p.textContent=m);let h=document.getElementById(`card-qr-container`);h&&(h.innerHTML=``,new r.default({width:120,height:120,type:`svg`,data:m,margin:4,qrOptions:{errorCorrectionLevel:`H`},dotsOptions:{type:`rounded`,color:`#0f766e`},cornersSquareOptions:{type:`extra-rounded`,color:`#0f766e`},backgroundOptions:{color:`#ffffff`}}).append(h)),C&&C.classList.remove(`hidden`)}catch(e){console.error(`Failed to prepare kennel card:`,e)}}),e.addEventListener(`click`,e=>{let t=e.target?.closest(`.copy-pet-id-btn`);if(!t)return;let n=t.getAttribute(`data-copy-id`);n&&navigator.clipboard.writeText(n).then(()=>{let e=t.innerHTML;t.innerHTML=`<span class="text-emerald-700 font-bold text-[9px]">✓</span>`,setTimeout(()=>{t.innerHTML=e},1200)})}),(async()=>{await b(),S()})()}document.addEventListener(`astro:page-load`,d);