(function () {
	'use strict';

	var Dex = window.MonroeAdoptedex;
	if (!Dex) {
		return;
	}

	var params = Dex.getParams();
	var searchTimer = null;
	var state = {
		data: null,
		tab: 'collection',
		search: '',
	};

	var els = {
		stats: document.getElementById('dexStats'),
		live: document.getElementById('dexLive'),
		grid: document.getElementById('dexGrid'),
		error: document.getElementById('dexError'),
		meetBtn: document.getElementById('dexMeet'),
		search: document.getElementById('dexSearch'),
		tabs: document.querySelectorAll('.adoptedex-tab'),
	};

	function showError(msg) {
		if (els.error) {
			els.error.hidden = false;
			els.error.textContent = msg;
		}
	}

	function metSetFromData(data) {
		var set = {};
		(data.met_ids || []).forEach(function (id) {
			set[id] = true;
		});
		return set;
	}

	function shouldShowPet(pet, met) {
		if (pet.archived && !met) {
			return false;
		}
		return true;
	}

	function petsForTab(data, tab) {
		var metSet = metSetFromData(data);
		if (tab === 'collection') {
			return (data.met || []).filter(function (p) {
				return metSet[p.id] && !p.archived;
			});
		}
		if (tab === 'past') {
			return (data.met || []).filter(function (p) {
				return metSet[p.id] && p.archived;
			});
		}
		return (data.active || []).filter(function (p) {
			return shouldShowPet(p, metSet[p.id]);
		});
	}

	function filterPets(pets) {
		var query = (state.search || '').trim().toLowerCase();
		if (!query) {
			return pets;
		}
		return pets.filter(function (pet) {
			var haystack = [
				pet.name,
				pet.breed,
				pet.type,
				pet.age,
				pet.gender,
			].filter(Boolean).join(' ').toLowerCase();
			return haystack.indexOf(query) >= 0;
		});
	}

	function getMatchLaunchUrl() {
		var urlParams = new URLSearchParams(window.location.search);
		var matchUrl = (urlParams.get('match_url') || '').trim();
		if (!matchUrl) {
			return '';
		}
		if (!params.dexUser) {
			return matchUrl;
		}
		var sep = matchUrl.indexOf('?') >= 0 ? '&' : '?';
		var out = matchUrl + sep + 'dex_user=' + encodeURIComponent(params.dexUser);
		if (params.dexDisplay) {
			out += '&dex_display=' + encodeURIComponent(params.dexDisplay);
		}
		if (params.dexApi) {
			out += '&dex_api=' + encodeURIComponent(params.dexApi);
		}
		return out;
	}

	function openMatchGame() {
		if (window.parent && window.parent !== window) {
			window.parent.postMessage({
				type: 'monroe-humane-games-open',
				gameId: 'match',
			}, window.location.origin);
			return;
		}
		var url = getMatchLaunchUrl();
		if (url) {
			window.location.href = url;
			return;
		}
		if (els.live) {
			els.live.textContent = 'Open Pet Match from the Games page to meet someone new.';
		}
	}

	function registerPet(pet) {
		if (!pet || !params.dexUser) {
			return;
		}
		if (els.live) {
			els.live.textContent = 'Saving…';
		}
		Dex.discoverPet(params.dexApi, params.dexUser, pet.id, 'dex')
			.then(function () {
				return loadDex();
			})
			.then(function () {
				if (els.live) {
					els.live.textContent = (pet.name || 'Pet') + ' added to your album!';
				}
			})
			.catch(function () {
				if (els.live) {
					els.live.textContent = 'Could not save - try again.';
				}
			});
	}

	function render() {
		if (!state.data || !els.grid) {
			return;
		}
		var metSet = metSetFromData(state.data);
		var pets = filterPets(petsForTab(state.data, state.tab));
		var dexNumbers = Dex.buildDexNumberMap(state.data.active || []);
		var mode = state.tab === 'available' ? 'available' : (state.tab === 'past' ? 'past' : 'collection');

		if (state.search && !pets.length) {
			els.grid.innerHTML = '<p class="adoptedex-empty">No pets match your search in this tab.</p>';
			return;
		}

		Dex.renderGrid(els.grid, pets, metSet, mode, {
			dexNumbers: dexNumbers,
			onRegister: registerPet,
		});
	}

	function loadDex() {
		if (!params.dexUser || !params.dexApi) {
			showError('Missing nickname or API. Open Adoptédex from the Games page.');
			return Promise.reject();
		}
		if (els.live && !state.data) {
			els.live.textContent = 'Loading your Adoptédex…';
		}
		return Dex.fetchDex(params.dexApi, params.dexUser).then(function (data) {
			state.data = data;
			if (els.stats) {
				els.stats.textContent = Dex.formatStats(data.stats);
			}
			render();
		});
	}

	if (els.meetBtn) {
		els.meetBtn.addEventListener('click', openMatchGame);
	}

	if (els.search) {
		els.search.addEventListener('input', function () {
			window.clearTimeout(searchTimer);
			searchTimer = window.setTimeout(function () {
				state.search = els.search.value || '';
				render();
			}, 180);
		});
	}

	els.tabs.forEach(function (tabBtn) {
		tabBtn.addEventListener('click', function () {
			state.tab = tabBtn.getAttribute('data-tab') || 'collection';
			if (els.live) {
				els.live.textContent = '';
			}
			els.tabs.forEach(function (b) { b.classList.remove('is-active'); });
			tabBtn.classList.add('is-active');
			render();
		});
	});

	loadDex().catch(function (err) {
		if (err) {
			showError(err.message || 'Could not load Adoptédex.');
		}
	});
})();
