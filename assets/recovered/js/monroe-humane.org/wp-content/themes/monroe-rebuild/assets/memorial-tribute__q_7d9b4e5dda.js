/**
 * Memorials & tributes (/memorial/) - search + A-Z jump.
 *
 * Progressive enhancement only. The honor roll is fully rendered server-side;
 * this file reveals the toolbar and filters what is already on the page. If it
 * never runs, every name is still listed and readable.
 */
(function () {
    'use strict';

    var board = document.querySelector('.monroe-memorial-tribute-page');
    if (!board) {
        return;
    }

    var toolbar = board.querySelector('[data-tribute-toolbar]');
    var input = board.querySelector('[data-tribute-search]');
    var searchWrap = board.querySelector('[data-tribute-search-wrap]');
    var clearBtn = board.querySelector('[data-tribute-clear]');
    var countEl = board.querySelector('[data-tribute-count]');
    var noResults = board.querySelector('[data-tribute-noresults]');
    var azrail = board.querySelector('[data-tribute-azrail]');
    var sections = Array.prototype.slice.call(board.querySelectorAll('[data-tribute-section]'));
    var cards = Array.prototype.slice.call(board.querySelectorAll('.monroe-tribute-plaque'));

    if (!toolbar || !input || cards.length === 0) {
        return;
    }

    var total = cards.length;

    // Toolbar is markup-hidden until we know scripting works.
    toolbar.hidden = false;

    var strings = (window.monroeTributeL10n && typeof window.monroeTributeL10n === 'object')
        ? window.monroeTributeL10n
        : {};
    var showingAll = strings.showingAll || 'Showing all %d tributes';
    var showingSome = strings.showingSome || 'Showing %1$d of %2$d tributes';

    function format(template, values) {
        return template
            .replace('%1$d', values[0])
            .replace('%2$d', values[1])
            .replace('%d', values[0]);
    }

    /**
     * Letter dividers only make sense while the full list is showing; hide any
     * whose following run of cards is now entirely filtered out.
     */
    function syncLetterDividers(grid) {
        var node = grid.firstElementChild;
        var pending = null;
        var pendingHasVisible = false;

        while (node) {
            if (node.classList.contains('monroe-tribute-letter')) {
                if (pending) {
                    pending.hidden = !pendingHasVisible;
                }
                pending = node;
                pendingHasVisible = false;
            } else if (!node.hidden) {
                pendingHasVisible = true;
            }
            node = node.nextElementSibling;
        }

        if (pending) {
            pending.hidden = !pendingHasVisible;
        }
    }

    function applyFilter() {
        var query = input.value.trim().toLowerCase();
        var shown = 0;

        cards.forEach(function (card) {
            var name = card.getAttribute('data-tribute-name') || '';
            var hit = query === '' || name.indexOf(query) !== -1;
            card.hidden = !hit;
            if (hit) {
                shown += 1;
            }
        });

        sections.forEach(function (section) {
            var grid = section.querySelector('.monroe-tribute-grid');
            if (grid) {
                syncLetterDividers(grid);
            }

            var anyVisible = section.querySelector('.monroe-tribute-plaque:not([hidden])');
            section.hidden = !anyVisible;
        });

        if (noResults) {
            noResults.hidden = shown !== 0;
        }

        if (countEl) {
            countEl.textContent = query === ''
                ? format(showingAll, [total, total])
                : format(showingSome, [shown, total]);
        }

        if (searchWrap) {
            searchWrap.classList.toggle('is-filled', query !== '');
        }

        if (azrail) {
            azrail.classList.toggle('is-muted', query !== '');
        }
    }

    input.addEventListener('input', applyFilter);

    // Enter would submit an ancestor form on some themes; nothing to submit here.
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
        if (event.key === 'Escape' && input.value !== '') {
            event.preventDefault();
            input.value = '';
            applyFilter();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            input.value = '';
            applyFilter();
            input.focus();
        });
    }

    if (azrail) {
        azrail.addEventListener('click', function (event) {
            var btn = event.target.closest('[data-tribute-jump]');
            if (!btn) {
                return;
            }

            var letter = btn.getAttribute('data-tribute-jump');
            var target = document.getElementById('monroe-tribute-letter-' + letter);
            if (!target || target.hidden) {
                return;
            }

            var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({
                block: 'start',
                behavior: reduceMotion ? 'auto' : 'smooth'
            });
        });
    }

    applyFilter();
}());
