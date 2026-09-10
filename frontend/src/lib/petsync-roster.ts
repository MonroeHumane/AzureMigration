import { fetchStaffPets } from './staff-pets';

function escapePetHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSyncLabel(isoStr?: string | null): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function setText(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function applyRosterCounts(data: {
  activeCount: number;
  archivedCount: number;
  totalCount: number;
  lastSyncTimestamp?: string | null;
  pets?: any[];
}) {
  setText('petsync-active-count-badge', String(data.activeCount));
  setText('petsync-archived-count-badge', String(data.archivedCount));
  setText('petsync-total-count-badge', String(data.totalCount));
  setText('petsync-pill-active-count', String(data.activeCount));
  setText('petsync-pill-archived-count', String(data.archivedCount));
  setText('petsync-pill-all-count', String(data.totalCount));
  setText('petsync-showing-total', String(data.totalCount));
  setText('pets-page-active-count', String(data.activeCount));

  const syncEl = document.getElementById('petsync-last-sync');
  if (syncEl) {
    syncEl.textContent = formatSyncLabel(data.lastSyncTimestamp);
    if (data.lastSyncTimestamp) syncEl.setAttribute('title', data.lastSyncTimestamp);
  }

  const pets = data.pets || [];
  const active = pets.filter((p) => !p.archived_at);
  const daysFor = (p: any) => {
    const intake = p.intake_date || p.first_seen_at;
    if (!intake) return 0;
    const t = new Date(intake).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.floor((Date.now() - t) / 86400000);
  };
  const withDays = active.map((p) => ({ ...p, days: daysFor(p) }));
  const avg = (list: Array<{ days: number }>) =>
    list.length ? Math.round(list.reduce((s, p) => s + p.days, 0) / list.length) : 0;
  const dogs = withDays.filter((p) => p.type === 'dog');
  const cats = withDays.filter((p) => p.type === 'cat');
  const longStay = withDays.filter((p) => p.days > 60);

  setText('petsync-avg-stay', withDays.length ? `${avg(withDays)}d` : '--');
  const detail = document.getElementById('petsync-avg-stay-detail');
  if (detail) detail.textContent = `Dogs ${avg(dogs)}d · cats ${avg(cats)}d`;
  setText('petsync-longstay-count', String(longStay.length));
  setText('species-count-longstay', String(longStay.length));
}

export function inflatePetRows(
  list: any[],
  tbody: HTMLElement | null,
  mobileContainer: HTMLElement | null
) {
  if (!Array.isArray(list) || list.length === 0) return;

  const tableFragment = document.createDocumentFragment();
  const mobileFragment = document.createDocumentFragment();
  const existingTablePetIds = new Set<string>();
  const existingMobilePetIds = new Set<string>();

  if (tbody) {
    tbody.querySelectorAll<HTMLElement>('.petsync-row').forEach((r) => {
      const pid = r.getAttribute('data-pet-id');
      if (pid) existingTablePetIds.add(pid);
    });
  }
  if (mobileContainer) {
    mobileContainer.querySelectorAll<HTMLElement>('.petsync-mobile-card').forEach((c) => {
      const pid = c.getAttribute('data-pet-id');
      if (pid) existingMobilePetIds.add(pid);
    });
  }

  list.forEach((pet) => {
    const petIdStr = String(pet.id);
    const isArchived = !!pet.archived_at;
    const daysAtShelter = pet.intake_date
      ? Math.floor((Date.now() - new Date(pet.intake_date).getTime()) / 86400000)
      : null;
    const photoUrl = pet.image || '/assets/recovered/images/placeholder.svg';
    const publicUrl = `/adopt/${encodeURIComponent(pet.id)}`;
    const petPointUrl = pet.url && !/authkey=/i.test(pet.url) ? pet.url : publicUrl;
    const formattedIntake = pet.intake_date
      ? new Date(pet.intake_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—';
    const statusLabel = isArchived ? 'Archived / Adopted' : escapePetHtml(pet.stage || 'Available');
    const statusClass = isArchived
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';
    const petInfoStr = JSON.stringify({
      id: pet.id,
      name: pet.name,
      type: pet.type,
      species_label: pet.species_label,
      breed: pet.breed,
      age: pet.age,
      age_display: pet.age_display,
      size: pet.size,
      color: pet.color,
      gender: pet.gender,
      location: pet.location,
      image: photoUrl,
      intake_date: pet.intake_date,
      days_at_shelter: daysAtShelter,
      description: pet.description,
    }).replace(/'/g, '&#39;');

    const safeName = escapePetHtml(pet.name);
    const safeId = escapePetHtml(pet.id);
    const safeBreed = escapePetHtml(pet.breed);
    const safeColor = escapePetHtml(pet.color);
    const safeSpecies = escapePetHtml(pet.species_label || pet.type);
    const safeAge = escapePetHtml(pet.age_display || pet.age || 'Adult');
    const safeLocation = escapePetHtml(pet.location || 'Shelter');
    const safePhoto = escapePetHtml(photoUrl);
    const safePoint = escapePetHtml(petPointUrl);
    const genderText =
      pet.gender === 'female' ? '♀ Female' : pet.gender === 'male' ? '♂ Male' : 'Unknown';
    const speciesDot =
      pet.type === 'dog' ? 'bg-amber-500' : pet.type === 'cat' ? 'bg-teal-500' : 'bg-slate-400';

    if (tbody && !existingTablePetIds.has(petIdStr)) {
      existingTablePetIds.add(petIdStr);
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 transition petsync-row';
      tr.setAttribute('data-is-archived', isArchived ? 'true' : 'false');
      tr.setAttribute('data-species', pet.type || '');
      tr.setAttribute('data-location', pet.location || '');
      tr.setAttribute(
        'data-search',
        `${pet.id} ${pet.name} ${pet.breed} ${pet.color || ''} ${pet.location || ''} ${pet.gender}`.toLowerCase()
      );
      tr.setAttribute('data-pet-id', petIdStr);
      tr.setAttribute('data-pet-name', String(pet.name || ''));
      tr.setAttribute('data-pet-breed', String(pet.breed || ''));
      tr.setAttribute('data-pet-species', String(pet.species_label || pet.type || ''));
      tr.setAttribute('data-intake-date', pet.intake_date || '');
      tr.setAttribute('data-days-at-shelter', daysAtShelter !== null ? String(daysAtShelter) : '');

      tr.innerHTML = `
        <td class="py-2 px-3">
          <div class="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative group">
            <img
              src="${safePhoto}"
              alt="${safeName}"
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-110 transition duration-200"
              data-fallback="/assets/recovered/images/placeholder.svg"
            />
          </div>
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <div class="flex items-center gap-1">
            <span class="font-mono font-bold text-slate-900">${safeId}</span>
            <button
              type="button"
              class="copy-pet-id-btn text-slate-400 hover:text-teal-700 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
              title="Copy Animal ID"
              data-copy-id="${safeId}"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
              </svg>
            </button>
          </div>
          <a
            href="${safePoint}"
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
            <span class="w-2 h-2 rounded-full ${speciesDot} inline-block mr-1"></span>
            <span class="text-sm">${safeName}</span>
          </div>
          <span class="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
            ${safeSpecies}
          </span>
        </td>
        <td class="py-2 px-3">
          <span class="text-slate-800 font-medium block truncate max-w-xs" title="${safeBreed}">
            ${safeBreed}
          </span>
          ${safeColor ? `<span class="text-[11px] text-slate-500 block">Color: ${safeColor}</span>` : ''}
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="font-medium text-slate-800 block">${genderText}</span>
          <span class="text-[11px] text-slate-500 block">${safeAge}</span>
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            ${safeLocation}
          </span>
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="text-slate-800 font-medium block">${formattedIntake}</span>
          ${daysAtShelter !== null ? `<span class="text-[10px] font-semibold text-slate-500">${daysAtShelter} days in care</span>` : ''}
        </td>
        <td class="py-2 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${statusClass} border">
            ${statusLabel}
          </span>
        </td>
        <td class="py-2 px-3 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button
              type="button"
              class="petsync-print-card-btn inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition cursor-pointer"
              data-pet-info='${petInfoStr}'
              title="Print official cage card for this animal"
            >
              Print Card
            </button>
            <a
              href="${escapePetHtml(publicUrl)}"
              target="_blank"
              class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Public ↗
            </a>
          </div>
        </td>
      `;
      tableFragment.appendChild(tr);
    }

    if (mobileContainer && !existingMobilePetIds.has(petIdStr)) {
      existingMobilePetIds.add(petIdStr);
      const card = document.createElement('div');
      card.className = 'petsync-mobile-card bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3 transition';
      card.setAttribute('data-is-archived', isArchived ? 'true' : 'false');
      card.setAttribute('data-pet-id', petIdStr);
      card.setAttribute('data-species', pet.type || '');
      card.setAttribute('data-location', pet.location || '');
      card.setAttribute(
        'data-search',
        `${pet.id} ${pet.name} ${pet.breed} ${pet.color || ''} ${pet.location || ''} ${pet.gender}`.toLowerCase()
      );
      card.setAttribute('data-days-at-shelter', daysAtShelter !== null ? String(daysAtShelter) : '');

      card.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
            <img
              src="${safePhoto}"
              alt="${safeName}"
              loading="lazy"
              class="w-full h-full object-cover"
              data-fallback="/assets/recovered/images/placeholder.svg"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h3 class="text-base font-bold text-slate-900 truncate flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${speciesDot} inline-block mr-1"></span>
                <span>${safeName}</span>
              </h3>
              <span class="font-mono font-bold text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 border border-slate-200">
                #${safeId}
                <button
                  type="button"
                  class="copy-pet-id-btn text-slate-400 hover:text-teal-700 cursor-pointer"
                  title="Copy ID"
                  data-copy-id="${safeId}"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                  </svg>
                </button>
              </span>
            </div>
            <p class="text-xs text-slate-600 truncate mt-0.5">${safeBreed}</p>
            <div class="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
              <span class="text-slate-500">${genderText}</span>
              <span class="text-slate-300">·</span>
              <span class="text-slate-500">${safeAge}</span>
              <span class="text-slate-300">·</span>
              <span class="text-slate-700 font-medium">${safeLocation}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
          <div>
            <span class="inline-flex items-center px-2 py-0.5 rounded-md font-semibold border text-[10px] ${statusClass}">
              ${statusLabel}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="petsync-print-card-btn inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition cursor-pointer"
              data-pet-info='${petInfoStr}'
            >
              Print Card
            </button>
            <a
              href="${escapePetHtml(publicUrl)}"
              target="_blank"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Public ↗
            </a>
          </div>
        </div>
      `;
      mobileFragment.appendChild(card);
    }
  });

  document.getElementById('petsync-loading-row')?.remove();
  document.getElementById('petsync-mobile-loading')?.remove();
  if (tbody) tbody.appendChild(tableFragment);
  if (mobileContainer) mobileContainer.appendChild(mobileFragment);
}

export async function loadStaffPetRoster(
  tbody: HTMLElement | null,
  mobileContainer: HTMLElement | null
): Promise<boolean> {
  const result = await fetchStaffPets();
  if (!result.ok) {
    document.getElementById('petsync-loading-row')?.remove();
    document.getElementById('petsync-mobile-loading')?.remove();
    if (tbody && !tbody.querySelector('.petsync-row')) {
      tbody.innerHTML = `<tr><td colspan="9" class="py-10 text-center text-slate-500">Could not load shelter census. Sign in again, then retry.</td></tr>`;
    }
    if (mobileContainer && !mobileContainer.querySelector('.petsync-mobile-card')) {
      mobileContainer.innerHTML = `<p class="text-center text-slate-500 py-6">Could not load shelter census.</p>`;
    }
    return false;
  }

  inflatePetRows(result.data.pets, tbody, mobileContainer);
  applyRosterCounts(result.data);
  return true;
}
