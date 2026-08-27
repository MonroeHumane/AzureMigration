/**
 * Animal search widget - runtime (Google Sheet) search via admin-ajax.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function setPanelVisible(el, show) {
    if (!el) {
      return;
    }
    if (show) {
      el.removeAttribute('hidden');
      el.style.display = 'block';
      el.setAttribute('aria-hidden', 'false');
    } else {
      el.setAttribute('hidden', '');
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function capitalize(s) {
    if (!s) {
      return '';
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function trackSearch(cfg, filters, totalCount) {
    if (typeof window.gtag !== 'function') {
      return;
    }
    window.gtag('event', 'animal_search', {
      event_category: 'engagement',
      event_label: 'runtime',
      filters_applied: Object.keys(filters).filter(function (k) {
        return !!filters[k];
      }).length,
      results_count: totalCount,
      widget_id: cfg.widgetId,
    });
  }

  function initWidget(cfg) {
    var animalSearchWidget = document.getElementById(cfg.widgetId);
    if (!animalSearchWidget) {
      return;
    }

    var i18n = cfg.i18n || {};
    var liveApisEnabled = !!cfg.liveApisEnabled;
    var rawSource = animalSearchWidget.dataset.apiSource || 'runtime';
    var apiSource = liveApisEnabled ? rawSource : 'runtime';
    var resultsContainer = document.getElementById(cfg.widgetId + '-grid');
    var loadingElement = animalSearchWidget.querySelector('.results-loading');
    var emptyElement = animalSearchWidget.querySelector('.results-empty');
    var errorElement = animalSearchWidget.querySelector('.results-error');
    var paginationElement = document.getElementById(cfg.widgetId + '-pagination');
    var summaryEl = document.getElementById(cfg.widgetId + '-summary');
    var queryInput = document.getElementById(cfg.widgetId + '-q');
    var sortSelect = document.getElementById(cfg.widgetId + '-sort');

    setPanelVisible(emptyElement, false);
    setPanelVisible(loadingElement, false);
    setPanelVisible(errorElement, false);

    var currentPage = 1;
    var totalPages = 1;
    var currentFilters = {};
    var queryDebounceTimer = null;
    var layoutClass =
      cfg.layout === 'list' ? 'list' : cfg.layout === 'cards' ? 'cards' : 'grid';

    function getSortValue() {
      if (!sortSelect) {
        return 'name';
      }
      var v = sortSelect.value || 'name';
      return v === 'type' || v === 'breed' || v === 'name' ? v : 'name';
    }

    function setSummary(text, total) {
      if (!summaryEl) {
        return;
      }
      summaryEl.textContent = text || '';
      if (typeof total === 'number' && total > 0) {
        summaryEl.setAttribute('data-count', String(total));
        summaryEl.classList.add('has-count');
      } else {
        summaryEl.removeAttribute('data-count');
        summaryEl.classList.remove('has-count');
      }
    }

    function formatResultsSummary(total) {
      if (!total) {
        return i18n.summaryEmpty || '';
      }
      if (total === 1) {
        return i18n.summaryOne || '1 pet found';
      }
      var plural = i18n.summaryPlural || '%s pets found';
      return plural.replace('%s', String(total));
    }

    function openProfile(url, name) {
      if (window.MonroePetProfile && typeof window.MonroePetProfile.open === 'function') {
        window.MonroePetProfile.open(url, name);
        return;
      }
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }

    function bindCardInteraction(card, url, name) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'View profile for ' + (name || 'pet'));

      function activate(e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
          return;
        }
        if (e.type === 'keydown') {
          e.preventDefault();
        }
        if (e.target.closest('a, button')) {
          return;
        }
        openProfile(url, name);
      }

      card.addEventListener('click', activate);
      card.addEventListener('keydown', activate);
    }

    function addChip(row, text) {
      if (!text) {
        return;
      }
      var chip = document.createElement('span');
      chip.className = 'animal-chip';
      chip.textContent = text;
      row.appendChild(chip);
    }

    function renderRuntimeAnimalCards(animals) {
      if (!resultsContainer || !Array.isArray(animals)) {
        return;
      }

      resultsContainer.className =
        'results-grid monroe-pet-results monroe-pet-results--' + layoutClass;
      resultsContainer.id = cfg.widgetId + '-grid';

      var frag = document.createDocumentFragment();
      animals.forEach(function (a) {
        var card = document.createElement('article');
        card.className = 'animal-card animal-card--interactive';
        if (a.url) {
          card.dataset.petProfileUrl = a.url;
        }

        var imgWrap = document.createElement('div');
        imgWrap.className = 'animal-image';
        if (a.image) {
          var img = document.createElement('img');
          img.src = a.image;
          img.alt = (a.name || 'Pet') + ' photo';
          img.loading = 'lazy';
          img.decoding = 'async';
          imgWrap.appendChild(img);
        } else {
          imgWrap.classList.add('is-placeholder');
          imgWrap.setAttribute('aria-hidden', 'true');
        }

        if (a.featured || a.is_new) {
          var badge = document.createElement('span');
          badge.className =
            'monroe-pet-badge' + (a.featured ? ' monroe-pet-badge--featured' : ' monroe-pet-badge--new');
          badge.textContent = a.featured ? 'Featured' : 'New Arrival';
          imgWrap.appendChild(badge);
        }

        var info = document.createElement('div');
        info.className = 'animal-info';

        var h4 = document.createElement('h4');
        h4.className = 'animal-name';
        h4.textContent = a.name || 'Available Pet';
        info.appendChild(h4);

        if (a.breed) {
          var breed = document.createElement('p');
          breed.className = 'animal-breed';
          breed.textContent = a.breed;
          info.appendChild(breed);
        }

        var chips = document.createElement('div');
        chips.className = 'animal-chip-row';
        if (a.gender) {
          var g = a.gender.toLowerCase().trim();
          var gLabel = g === 'female' ? '♀ Female' : (g === 'male' ? '♂ Male' : capitalize(a.gender));
          addChip(chips, gLabel);
        }
        if (a.age_display || a.age) {
          addChip(chips, a.age_display || a.age);
        }
        if (a.location) {
          addChip(chips, a.location);
        }
        if (chips.childNodes.length) {
          info.appendChild(chips);
        }

        var viewBtn = document.createElement('div');
        viewBtn.className = 'animal-view-profile animal-action-btn';
        viewBtn.innerHTML = '<span>Meet ' + (a.name || 'Pet') + ' ›</span>';
        info.appendChild(viewBtn);

        card.appendChild(imgWrap);
        card.appendChild(info);
        bindCardInteraction(card, a.url, a.name);
        frag.appendChild(card);
      });

      resultsContainer.innerHTML = '';
      resultsContainer.appendChild(frag);
    }

    function updateFilters() {
      currentFilters = {};
      animalSearchWidget.querySelectorAll('.animal-filter').forEach(function (filter) {
        var key = filter.getAttribute('data-filter-key');
        if (key && filter.value) {
          currentFilters[key] = filter.value;
        }
      });
      if (queryInput && queryInput.value && queryInput.value.trim()) {
        currentFilters.q = queryInput.value.trim();
      }
    }

    function hasActiveFiltersOrQuery() {
      return Object.keys(currentFilters).some(function (k) {
        return !!currentFilters[k];
      });
    }

    function showLoading() {
      setPanelVisible(loadingElement, true);
      setPanelVisible(emptyElement, false);
      setPanelVisible(errorElement, false);
      if (resultsContainer) {
        resultsContainer.style.opacity = '0.35';
      }
    }

    function hideLoading() {
      setPanelVisible(loadingElement, false);
    }

    function showEmptyState() {
      setPanelVisible(errorElement, false);
      setPanelVisible(emptyElement, true);
      if (resultsContainer) {
        resultsContainer.style.opacity = '1';
      }
    }

    function showErrorState(message) {
      setPanelVisible(emptyElement, false);
      if (errorElement) {
        var msgEl = errorElement.querySelector('.results-error__message');
        if (msgEl) {
          msgEl.textContent = message || i18n.fetchError || '';
        }
        setPanelVisible(errorElement, true);
      } else {
        showEmptyState();
      }
      if (resultsContainer) {
        resultsContainer.style.opacity = '1';
      }
    }

    function showResults() {
      setPanelVisible(emptyElement, false);
      setPanelVisible(errorElement, false);
      if (resultsContainer) {
        resultsContainer.style.opacity = '1';
      }
    }

    function fallbackFeaturedOrEmpty() {
      if (cfg.showFeatured) {
        var featured = animalSearchWidget.querySelector('.featured-pets-section');
        if (featured && featured.innerHTML.replace(/\s/g, '').length) {
          setSummary('');
          showResults();
          return;
        }
      }
      setSummary(formatResultsSummary(0));
      showEmptyState();
    }

    function searchFromRuntime() {
      if (!cfg.ajaxUrl || !cfg.nonce) {
        hideLoading();
        fallbackFeaturedOrEmpty();
        return;
      }

      var fd = new FormData();
      fd.append('action', 'animal_search');
      fd.append('nonce', cfg.nonce);
      fd.append('api_source', 'runtime');
      fd.append('filters', JSON.stringify(currentFilters));
      fd.append('sort', getSortValue());
      fd.append('page', String(currentPage));
      fd.append('per_page', String(cfg.perPage || 12));

      fetch(cfg.ajaxUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(function (r) {
          return r.json();
        })
        .then(function (res) {
          hideLoading();
          if (!res || !res.success || !res.data) {
            setSummary('');
            fallbackFeaturedOrEmpty();
            return;
          }

          var data = res.data;
          var animals = data.animals || [];
          var fetchError = data.error || '';

          if (fetchError && animals.length === 0) {
            setSummary('');
            showErrorState(fetchError);
            if (resultsContainer) {
              resultsContainer.innerHTML = '';
            }
            if (paginationElement) {
              paginationElement.style.display = 'none';
            }
            return;
          }

          totalPages = parseInt(data.total_pages, 10) || 1;
          if (data.current_page) {
            currentPage = parseInt(data.current_page, 10);
          }

          var totalCount = parseInt(data.total_count, 10);
          if (isNaN(totalCount)) {
            totalCount = animals.length;
          }

          var hasFilters = hasActiveFiltersOrQuery();

          if (animals.length === 0) {
            if (!hasFilters && cfg.showFeatured) {
              var featuredSection = animalSearchWidget.querySelector('.featured-pets-section');
              if (featuredSection && featuredSection.innerHTML.replace(/\s/g, '').length) {
                setSummary('');
                showResults();
                if (paginationElement) {
                  paginationElement.style.display = 'none';
                }
                return;
              }
            }
            setSummary(formatResultsSummary(0));
            if (resultsContainer) {
              resultsContainer.innerHTML = '';
            }
            showEmptyState();
            if (paginationElement) {
              paginationElement.style.display = 'none';
            }
            return;
          }

          setSummary(formatResultsSummary(totalCount), totalCount);
          renderRuntimeAnimalCards(animals);
          trackSearch(cfg, currentFilters, totalCount);
          showResults();

          if (paginationElement) {
            paginationElement.style.display = totalPages > 1 ? 'flex' : 'none';
            var pi = document.getElementById(cfg.widgetId + '-pageinfo');
            if (pi) {
              pi.textContent = 'Page ' + currentPage + ' of ' + totalPages;
            }
            var pBtn = document.getElementById(cfg.widgetId + '-prev');
            var nBtn = document.getElementById(cfg.widgetId + '-next');
            if (pBtn) {
              pBtn.disabled = currentPage <= 1;
            }
            if (nBtn) {
              nBtn.disabled = currentPage >= totalPages;
            }
          }
        })
        .catch(function () {
          hideLoading();
          setSummary('');
          fallbackFeaturedOrEmpty();
        });
    }

    function performSearch() {
      updateFilters();
      showLoading();
      setSummary(i18n.summaryLoading || '');

      switch (apiSource) {
        case 'petfinder':
        case 'shelterluv':
          hideLoading();
          setSummary('');
          showEmptyState();
          break;
        case 'runtime':
        default:
          searchFromRuntime();
      }
    }

    function resetFilters() {
      animalSearchWidget.querySelectorAll('.animal-filter').forEach(function (el) {
        el.value = '';
      });
      if (queryInput) {
        queryInput.value = '';
      }
      if (sortSelect) {
        sortSelect.value = 'name';
      }
      var def = cfg.defaultAnimalType || '';
      if (def) {
        var typeSel = document.getElementById(cfg.widgetId + '-type');
        if (typeSel) {
          typeSel.value = def;
        }
      }
      currentFilters = {};
      currentPage = 1;
      performSearch();
    }

    function initAnimalSearch() {
      var searchButton = document.getElementById(cfg.widgetId + '-search');
      var resetButton = document.getElementById(cfg.widgetId + '-reset');
      var emptyReset = document.getElementById(cfg.widgetId + '-empty-reset');
      var filterSelects = animalSearchWidget.querySelectorAll('.animal-filter');
      var prevBtn = document.getElementById(cfg.widgetId + '-prev');
      var nextBtn = document.getElementById(cfg.widgetId + '-next');

      if (searchButton) {
        searchButton.addEventListener('click', function () {
          currentPage = 1;
          performSearch();
        });
      }

      if (resetButton) {
        resetButton.addEventListener('click', resetFilters);
      }

      if (emptyReset) {
        emptyReset.addEventListener('click', resetFilters);
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (currentPage > 1) {
            currentPage--;
            performSearch();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (currentPage < totalPages) {
            currentPage++;
            performSearch();
          }
        });
      }

      function scheduleDebouncedSearch() {
        if (queryDebounceTimer) {
          clearTimeout(queryDebounceTimer);
        }
        queryDebounceTimer = setTimeout(function () {
          queryDebounceTimer = null;
          currentPage = 1;
          performSearch();
        }, 320);
      }

      if (queryInput) {
        queryInput.addEventListener('input', scheduleDebouncedSearch);
        queryInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (queryDebounceTimer) {
              clearTimeout(queryDebounceTimer);
              queryDebounceTimer = null;
            }
            currentPage = 1;
            performSearch();
          }
        });
      }

      var searchSubmit = document.getElementById(cfg.widgetId + '-search-submit');
      if (searchSubmit) {
        searchSubmit.addEventListener('click', function () {
          if (queryDebounceTimer) {
            clearTimeout(queryDebounceTimer);
            queryDebounceTimer = null;
          }
          currentPage = 1;
          performSearch();
        });
      }

      filterSelects.forEach(function (select) {
        select.addEventListener('change', function () {
          currentPage = 1;
          performSearch();
        });
      });

      if (sortSelect) {
        sortSelect.addEventListener('change', function () {
          currentPage = 1;
          performSearch();
        });
      }

      var def = cfg.defaultAnimalType || '';
      if (def) {
        var typeSel = document.getElementById(cfg.widgetId + '-type');
        if (typeSel) {
          typeSel.value = def;
        }
      }

      performSearch();
    }

    initAnimalSearch();
  }

  ready(function () {
    var configs = window.monroeAnimalSearchConfigs;
    if (!configs || typeof configs !== 'object') {
      return;
    }
    Object.keys(configs).forEach(function (key) {
      initWidget(configs[key]);
    });
  });
})();
