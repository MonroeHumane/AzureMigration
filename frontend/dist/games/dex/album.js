(function () {
	'use strict';

	var Dex = window.MonroeAdoptedex;
	if (!Dex) {
		return;
	}

	var params = Dex.getParams();
	var els = {
		title: document.getElementById('albumTitle'),
		stats: document.getElementById('albumStats'),
		live: document.getElementById('albumLive'),
		grid: document.getElementById('albumGrid'),
		error: document.getElementById('albumError'),
		packBanner: document.getElementById('albumPackBanner'),
	};

	function showError(msg) {
		if (els.error) {
			els.error.hidden = false;
			els.error.textContent = msg;
		}
	}

	function renderPackBanner(unopenedPacks) {
		if (unopenedPacks <= 0) return;

		// Prefer existing banner element; otherwise inject before grid
		var banner = els.packBanner;
		if (!banner) {
			banner = document.createElement('div');
			banner.id = 'albumPackBanner';
			if (els.grid && els.grid.parentNode) {
				els.grid.parentNode.insertBefore(banner, els.grid);
			}
		}

		var restBase = (params.dexApi || (window.location.origin + '/wp-json/monroe/v1/')).replace(/\/?$/, '/');
		// Resolve the booster URL relative to the album page
		var boosterUrl = '../booster/index.html?embed=0'
			+ '&dex_user=' + encodeURIComponent(params.dexUser)
			+ '&dex_api=' + encodeURIComponent(restBase);

		var packWord = unopenedPacks === 1 ? 'Pack' : 'Packs';
		banner.innerHTML =
			'<div class="album-pack-banner">' +
				'<div class="album-pack-banner__left">' +
					'<span class="album-pack-banner__icon">🎁</span>' +
					'<div class="album-pack-banner__text">' +
						'<strong class="album-pack-banner__count">' + unopenedPacks + ' Booster ' + packWord + ' Ready!</strong>' +
						'<span class="album-pack-banner__hint">Rip them open to discover new shelter pet cards</span>' +
					'</div>' +
				'</div>' +
				'<a class="album-pack-banner__btn" href="' + boosterUrl + '">' +
					'✨ Open ' + packWord + ' Now' +
				'</a>' +
			'</div>';
		banner.hidden = false;
	}

	function init() {
		if (!params.dexUser) {
			showError('No Adoptédex nickname was provided.');
			return;
		}
		if (!params.dexApi) {
			showError('Adoptédex API is not configured.');
			return;
		}

		if (els.live) {
			els.live.textContent = 'Loading album…';
		}

		Dex.fetchDex(params.dexApi, params.dexUser)
			.then(function (data) {
				if (els.live) {
					els.live.textContent = '';
				}
				var display = params.dexDisplay || data.display_name || params.dexUser;
				if (els.title) {
					els.title.textContent = display + '\u2019s Pet Album';
				}
				if (els.stats) {
					els.stats.textContent = Dex.formatStats(data.stats);
				}

				// Render open-packs CTA if the player has packs waiting
				var unopened = (data.stats && data.stats.unopened_packs) ? data.stats.unopened_packs : 0;
				renderPackBanner(unopened);

				var metSet = {};
				(data.met_ids || []).forEach(function (id) {
					metSet[id] = true;
				});

				var pets = (data.met || []).slice();
				pets.sort(function (a, b) {
					return String(a.name).localeCompare(String(b.name));
				});

				if (!pets.length) {
					if (els.grid) {
						els.grid.innerHTML = '<div class="adoptedex-empty-card" style="text-align:center; padding: 2.5rem 1.5rem; background: rgba(255,255,255,0.9); border-radius: 16px; border: 2px dashed rgba(44,28,25,0.15); max-width: 480px; margin: 2rem auto;"><div style="font-size: 3rem; margin-bottom: 0.75rem;">🐾</div><h3 style="font-size: 1.3rem; margin: 0 0 0.5rem; color: #133a32;">No Pets Collected Yet!</h3><p style="font-size: 0.95rem; color: #5c4d4a; line-height: 1.5; margin: 0 0 1.25rem;">You haven\'t opened any booster packs yet. Tear open your first Booster Pack to start discovering real shelter animals!</p></div>';
					}
					return;
				}

				var dexNumbers = Dex.buildDexNumberMap(data.active || []);

				Dex.renderGrid(els.grid, pets, metSet, 'collection', {
					dexNumbers: dexNumbers,
					readOnly: true,
				});
			})
			.catch(function (err) {
				showError(err && err.message ? err.message : 'Could not load album.');
				if (els.live) {
					els.live.textContent = '';
				}
			});
	}

	init();
})();

