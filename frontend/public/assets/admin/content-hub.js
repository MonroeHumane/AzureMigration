(function () {
  'use strict';

  var cfg = window.monroeContentHub;
  var root = document.getElementById('monroe-content-hub-app');
  if (!root || !cfg || typeof wp === 'undefined' || !wp.apiFetch) {
    return;
  }

  wp.apiFetch.use(function (options, next) {
    options.headers = Object.assign({}, options.headers || {}, {
      'X-WP-Nonce': cfg.nonce
    });
    return next(options);
  });

  function api(path, opts) {
    opts = opts || {};
    opts.path = '/monroe/v1' + path;
    return wp.apiFetch(opts);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderLoadingState() {
    return (
      '<div class="mch-loading"><span class="mch-loading__spinner" aria-hidden="true"></span><p>' +
      esc(cfg.i18n.loading) +
      '</p></div>'
    );
  }

  function bodyEditorId(index) {
    return 'mch-letter-body-' + index;
  }

  function getBodyEditorSettings() {
    return {
      tinymce: {
        wpautop: true,
        toolbar1: 'bold,italic,link,unlink,bullist,numlist,undo,redo',
        toolbar2: '',
        height: 160
      },
      quicktags: true,
      mediaButtons: false
    };
  }

  function destroyBodyEditors() {
    if (!wp.editor || !wp.editor.remove) {
      return;
    }
    root.querySelectorAll('[data-block-field="body"]').forEach(function (el) {
      if (el.id) {
        wp.editor.remove(el.id);
      }
    });
  }

  function populateBodyTextareas() {
    var d = state.newsletterDraft;
    if (!d || !d.blocks) {
      return;
    }
    d.blocks.forEach(function (block, i) {
      if (block.type === 'list') {
        return;
      }
      var el = root.querySelector('#' + bodyEditorId(i));
      if (el) {
        el.value = block.body || '';
      }
    });
  }

  function initBodyEditors() {
    if (state.tab !== 'newsletter' || !wp.editor || !wp.editor.initialize) {
      return;
    }
    root.querySelectorAll('[data-block-field="body"]').forEach(function (el) {
      if (!el.id) {
        return;
      }
      wp.editor.initialize(el.id, getBodyEditorSettings());
    });
  }

  function getBodyFieldValue(index) {
    var id = bodyEditorId(index);
    if (wp.editor && wp.editor.save) {
      wp.editor.save(id);
    }
    if (typeof tinymce !== 'undefined') {
      var ed = tinymce.get(id);
      if (ed) {
        return ed.getContent();
      }
    }
    var el = root.querySelector('#' + id);
    return el ? el.value : '';
  }

  var state = {
    tab: cfg.staffMode ? 'home' : 'event_flyers',
    flyers: [],
    newsletters: [],
    memorials: [],
    accomplishmentsYears: {},
    activeFlyerId: null,
    activeNewsletterId: null,
    activeMemorialId: null,
    flyerDraft: null,
    newsletterDraft: null,
    memorialDraft: null,
    migrationStatus: null,
    homepageHealth: null,
    calendarPreviewHtml: '',
    navConfig: null,
    membershipConfig: null,
    artworkContestFlyers: null,
    memorialFilter: '',
    flyerFilter: '',
    newsletterFilter: ''
  };

  var blockDragIndex = null;
  var mchToastEl = null;
  var mchToastTimer = null;

  /* A toast that lives outside #monroe-content-hub-app instead of a
     banner rendered inside it: root.innerHTML gets replaced on every
     render(), and most save flows call setStatus() then chain into
     .then(render) once a follow-up load resolves - an in-root banner
     was being wiped out by that render() before there was any
     guarantee it had been seen, and even when it survived a beat it
     sat at the very top of the panel, off-screen on a long scrolled
     form or after tapping Save in the mobile sticky action bar. */
  function getStatusEl() {
    if (mchToastEl && document.body.contains(mchToastEl)) {
      return mchToastEl;
    }
    mchToastEl = document.createElement('div');
    mchToastEl.className = 'mch-toast';
    mchToastEl.setAttribute('role', 'status');
    mchToastEl.hidden = true;
    document.body.appendChild(mchToastEl);
    return mchToastEl;
  }

  function setStatus(msg, ok) {
    var el = getStatusEl();
    window.clearTimeout(mchToastTimer);
    if (!msg) {
      el.hidden = true;
      return;
    }
    el.textContent = msg;
    el.className = 'mch-toast ' + (ok ? 'mch-toast--ok' : 'mch-toast--err');
    el.hidden = false;
    if (msg !== cfg.i18n.loading) {
      mchToastTimer = window.setTimeout(function () {
        el.hidden = true;
      }, 3200);
    }
  }

  /* Used for "Trashed - Undo" instead of a native confirm() dialog: the
     trash itself already happened (it's a soft wp_trash_post(), safely
     recoverable), so this is just a chance to reverse it, not a gate
     before it. Longer timeout than a plain confirmation since reading
     + deciding to click Undo takes more than a glance. */
  function setStatusWithAction(msg, actionLabel, actionCallback) {
    var el = getStatusEl();
    window.clearTimeout(mchToastTimer);
    el.className = 'mch-toast mch-toast--ok mch-toast--action';
    el.innerHTML =
      '<span class="mch-toast__msg"></span>' +
      '<button type="button" class="mch-toast__action"></button>';
    el.querySelector('.mch-toast__msg').textContent = msg;
    var actionBtn = el.querySelector('.mch-toast__action');
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', function () {
      window.clearTimeout(mchToastTimer);
      el.hidden = true;
      actionCallback();
    });
    el.hidden = false;
    mchToastTimer = window.setTimeout(function () {
      el.hidden = true;
    }, 6000);
  }

  function emptyMemorial() {
    return {
      id: null,
      title: '',
      status: 'draft',
      line: 'in_memory',
      variant: 'default',
      year: ''
    };
  }

  function emptyFlyer() {
    return {
      id: null,
      title: '',
      status: 'draft',
      menu_order: 0,
      event_date: '',
      link: '',
      excerpt: '',
      thumbnail_id: null,
      thumbnail_url: null
    };
  }

  function emptyNewsletter() {
    return {
      id: null,
      title: '',
      status: 'draft',
      featured: false,
      hero_eyebrow: 'PO Box 1457 • Monroe, MI',
      hero_title: '',
      heading: 'Monroe Humane Society Newsletter',
      byline: '',
      blocks: [],
      gallery_ids: [],
      gallery: [],
      issue_date: '',
      thumbnail_id: null,
      thumbnail_url: null
    };
  }

  function ensureNewsletterGallery(d) {
    if (d.gallery && d.gallery.length) {
      d.gallery_ids = d.gallery.map(function (g) {
        return g.id;
      });
      return;
    }
    d.gallery = (d.gallery_ids || []).map(function (id) {
      return { id: id, url: '', alt: '' };
    });
  }

  function loadMigrationStatus() {
    return api('/newsletters/migration-status').then(function (status) {
      state.migrationStatus = status;
    });
  }

  function loadHomepageHealth() {
    return api('/homepage-health').then(function (health) {
      state.homepageHealth = health;
    });
  }

  function loadAccomplishments() {
    return api('/accomplishments').then(function (data) {
      state.accomplishmentsYears = data && data.years ? data.years : {};
    });
  }

  function emptyNavItem() {
    return { label: '', url: '/', external: false, children: [] };
  }

  function loadNavigation() {
    return api('/navigation')
      .then(function (data) {
        state.navConfig = data || null;
      })
      .catch(function () {
        state.navConfig = null;
      });
  }

  function navPresetOptionsHtml(selectedUrl) {
    var presets = (state.navConfig && state.navConfig.presets) || [];
    var html = '<option value="">' + esc(cfg.i18n.labelNavPreset) + '</option>';
    presets.forEach(function (group) {
      html += '<optgroup label="' + esc(group.group || '') + '">';
      (group.items || []).forEach(function (item) {
        var url = item.url || '';
        html +=
          '<option value="' +
          esc(url) +
          '"' +
          (url === selectedUrl ? ' selected' : '') +
          '>' +
          esc(item.label || url) +
          '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  function renderNavLinkFields(prefix, item) {
    item = item || emptyNavItem();
    var url = item.url || '/';
    return (
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelNavItem) +
      '</span><input type="text" class="regular-text" data-nav-field="label" data-nav-prefix="' +
      esc(prefix) +
      '" value="' +
      esc(item.label || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelNavPreset) +
      '</span><select class="mch-nav-preset" data-nav-prefix="' +
      esc(prefix) +
      '">' +
      navPresetOptionsHtml(url) +
      '</select></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelNavUrl) +
      '</span><input type="text" class="large-text code" data-nav-field="url" data-nav-prefix="' +
      esc(prefix) +
      '" value="' +
      esc(url) +
      '" placeholder="/page/ or /#Section or https://…" /></label>' +
      '<label class="mch-field mch-field--checkbox"><input type="checkbox" data-nav-field="external" data-nav-prefix="' +
      esc(prefix) +
      '"' +
      (item.external ? ' checked' : '') +
      ' /> ' +
      esc(cfg.i18n.labelNavExternal) +
      '</label>'
    );
  }

  function renderNavChildRow(topIndex, childIndex, child) {
    var prefix = 'top-' + topIndex + '-child-' + childIndex;
    return (
      '<div class="mch-nav-child" data-nav-top-index="' +
      topIndex +
      '" data-nav-child-index="' +
      childIndex +
      '">' +
      '<div class="mch-nav-child__actions">' +
      '<button type="button" class="button button-small" data-action="nav-child-up" data-nav-top-index="' +
      topIndex +
      '" data-nav-child-index="' +
      childIndex +
      '" title="' +
      esc(cfg.i18n.moveUp) +
      '">↑</button>' +
      '<button type="button" class="button button-small" data-action="nav-child-down" data-nav-top-index="' +
      topIndex +
      '" data-nav-child-index="' +
      childIndex +
      '" title="' +
      esc(cfg.i18n.moveDown) +
      '">↓</button>' +
      '<button type="button" class="button button-small button-link-delete" data-action="nav-remove-child" data-nav-top-index="' +
      topIndex +
      '" data-nav-child-index="' +
      childIndex +
      '">' +
      esc(cfg.i18n.removeNavChild) +
      '</button></div>' +
      renderNavLinkFields(prefix, child) +
      '</div>'
    );
  }

  function renderNavTopItem(topIndex, item) {
    item = item || emptyNavItem();
    var children = item.children || [];
    var prefix = 'top-' + topIndex;
    var childHtml = children
      .map(function (child, childIndex) {
        return renderNavChildRow(topIndex, childIndex, child);
      })
      .join('');

    return (
      '<section class="mch-nav-section" data-nav-top-index="' +
      topIndex +
      '">' +
      '<div class="mch-nav-section__head">' +
      '<h3 class="mch-nav-section__title">' +
      esc(item.label || cfg.i18n.labelNavItem + ' ' + (topIndex + 1)) +
      '</h3>' +
      '<div class="mch-nav-section__actions">' +
      '<button type="button" class="button button-small" data-action="nav-top-up" data-nav-top-index="' +
      topIndex +
      '" title="' +
      esc(cfg.i18n.moveUp) +
      '">↑</button>' +
      '<button type="button" class="button button-small" data-action="nav-top-down" data-nav-top-index="' +
      topIndex +
      '" title="' +
      esc(cfg.i18n.moveDown) +
      '">↓</button>' +
      '<button type="button" class="button button-small button-link-delete" data-action="nav-remove-top" data-nav-top-index="' +
      topIndex +
      '">' +
      esc(cfg.i18n.removeNavSection) +
      '</button></div></div>' +
      renderNavLinkFields(prefix, item) +
      '<div class="mch-nav-children">' +
      '<h4>' +
      esc(cfg.i18n.navDropdownLinks) +
      '</h4>' +
      childHtml +
      '<p><button type="button" class="button" data-action="nav-add-child" data-nav-top-index="' +
      topIndex +
      '">' +
      esc(cfg.i18n.addNavChild) +
      '</button></p></div></section>'
    );
  }

  function renderNavCtaRow(key, label) {
    var cta = (state.navConfig && state.navConfig.cta && state.navConfig.cta[key]) || {
      label: '',
      url: '/',
      external: false
    };
    var prefix = 'cta-' + key;
    return (
      '<div class="mch-nav-cta" data-nav-cta="' +
      key +
      '"><h4>' +
      esc(label) +
      '</h4>' +
      renderNavLinkFields(prefix, cta) +
      '</div>'
    );
  }

  function syncNavFromForm() {
    if (!state.navConfig) {
      state.navConfig = { items: [], cta: {} };
    }

    function readFields(prefix) {
      var row = { label: '', url: '/', external: false };
      root.querySelectorAll('[data-nav-prefix="' + prefix + '"]').forEach(function (el) {
        var field = el.getAttribute('data-nav-field');
        if (field === 'label') {
          row.label = el.value;
        } else if (field === 'url') {
          row.url = el.value;
        } else if (field === 'external') {
          row.external = el.checked;
        }
      });
      return row;
    }

    var items = [];
    root.querySelectorAll('.mch-nav-section').forEach(function (section) {
      var topIndex = section.getAttribute('data-nav-top-index');
      var prefix = 'top-' + topIndex;
      var item = readFields(prefix);
      item.children = [];
      section.querySelectorAll('.mch-nav-child').forEach(function (childEl) {
        var childIndex = childEl.getAttribute('data-nav-child-index');
        item.children.push(readFields('top-' + topIndex + '-child-' + childIndex));
      });
      items.push(item);
    });
    state.navConfig.items = items;

    var cta = {};
    ['membership', 'donate', 'call', 'application'].forEach(function (key) {
      cta[key] = readFields('cta-' + key);
    });
    state.navConfig.cta = cta;
  }

  function saveNavigation() {
    syncNavFromForm();
    setStatus(cfg.i18n.loading, true);
    return api('/navigation', {
      method: 'PUT',
      data: {
        items: state.navConfig.items,
        cta: state.navConfig.cta
      }
    })
      .then(function (res) {
        state.navConfig = res;
        setStatus(cfg.i18n.saved, true);
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function resetNavigation() {
    if (!window.confirm(cfg.i18n.resetNavConfirm)) {
      return Promise.resolve();
    }
    setStatus(cfg.i18n.loading, true);
    return api('/navigation/reset', { method: 'POST' })
      .then(function (res) {
        state.navConfig = res;
        setStatus(cfg.i18n.saved, true);
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function renderNavigationEditor() {
    if (!state.navConfig) {
      return renderLoadingState();
    }

    var items = state.navConfig.items || [];
    if (!items.length) {
      items = [emptyNavItem()];
      state.navConfig.items = items;
    }

    var sections = items
      .map(function (item, index) {
        return renderNavTopItem(index, item);
      })
      .join('');

    var statusNote = state.navConfig.is_custom
      ? cfg.i18n.navUsingCustom
      : cfg.i18n.navUsingDefault;

    return (
      '<div class="mch-panel mch-panel--wide mch-nav-editor">' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionNavHint) +
      '</p>' +
      '<p class="description">' +
      esc(statusNote) +
      '</p>' +
      '<div class="mch-nav-sections">' +
      sections +
      '</div>' +
      '<p class="mch-nav-toolbar">' +
      '<button type="button" class="button" data-action="nav-add-top">' +
      esc(cfg.i18n.addNavSection) +
      '</button></p>' +
      '<h3 class="mch-nav-cta-heading">' +
      esc(cfg.i18n.sectionNavCtaHint) +
      '</h3>' +
      '<div class="mch-nav-cta-grid">' +
      renderNavCtaRow('membership', cfg.i18n.navCtaMembership) +
      renderNavCtaRow('donate', cfg.i18n.navCtaDonate) +
      renderNavCtaRow('call', cfg.i18n.navCtaCall) +
      renderNavCtaRow('application', cfg.i18n.navCtaApplication) +
      '</div>' +
      '<p class="mch-nav-actions">' +
      '<button type="button" class="button button-primary" data-action="save-nav">' +
      esc(cfg.i18n.save) +
      '</button> ' +
      '<button type="button" class="button" data-action="reset-nav">' +
      esc(cfg.i18n.resetNavDefault) +
      '</button> ' +
      '<a class="button" href="' +
      esc(cfg.homeUrl) +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.previewNav) +
      '</a></p></div>'
    );
  }

  function bindNavEditorEvents() {
    root.querySelectorAll('.mch-nav-preset').forEach(function (select) {
      select.addEventListener('change', function () {
        if (!select.value) {
          return;
        }
        var prefix = select.getAttribute('data-nav-prefix');
        var urlInput = root.querySelector('[data-nav-field="url"][data-nav-prefix="' + prefix + '"]');
        if (urlInput) {
          urlInput.value = select.value;
        }
      });
    });

    var saveNav = root.querySelector('[data-action="save-nav"]');
    if (saveNav) {
      saveNav.addEventListener('click', function () {
        saveNavigation().then(render);
      });
    }

    var resetNav = root.querySelector('[data-action="reset-nav"]');
    if (resetNav) {
      resetNav.addEventListener('click', function () {
        resetNavigation().then(render);
      });
    }

    var addTop = root.querySelector('[data-action="nav-add-top"]');
    if (addTop) {
      addTop.addEventListener('click', function () {
        syncNavFromForm();
        state.navConfig.items.push(emptyNavItem());
        render();
      });
    }

    root.querySelectorAll('[data-action="nav-remove-top"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var index = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        state.navConfig.items.splice(index, 1);
        if (!state.navConfig.items.length) {
          state.navConfig.items.push(emptyNavItem());
        }
        render();
      });
    });

    root.querySelectorAll('[data-action="nav-top-up"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var index = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        if (index <= 0) {
          return;
        }
        var items = state.navConfig.items;
        var tmp = items[index - 1];
        items[index - 1] = items[index];
        items[index] = tmp;
        render();
      });
    });

    root.querySelectorAll('[data-action="nav-top-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var index = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        var items = state.navConfig.items;
        if (index >= items.length - 1) {
          return;
        }
        var tmp = items[index + 1];
        items[index + 1] = items[index];
        items[index] = tmp;
        render();
      });
    });

    root.querySelectorAll('[data-action="nav-add-child"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var index = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        if (!state.navConfig.items[index].children) {
          state.navConfig.items[index].children = [];
        }
        state.navConfig.items[index].children.push(emptyNavItem());
        render();
      });
    });

    root.querySelectorAll('[data-action="nav-remove-child"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var topIndex = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        var childIndex = parseInt(btn.getAttribute('data-nav-child-index'), 10);
        state.navConfig.items[topIndex].children.splice(childIndex, 1);
        render();
      });
    });

    root.querySelectorAll('[data-action="nav-child-up"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var topIndex = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        var childIndex = parseInt(btn.getAttribute('data-nav-child-index'), 10);
        var children = state.navConfig.items[topIndex].children || [];
        if (childIndex <= 0) {
          return;
        }
        var tmp = children[childIndex - 1];
        children[childIndex - 1] = children[childIndex];
        children[childIndex] = tmp;
        render();
      });
    });

    root.querySelectorAll('[data-action="nav-child-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNavFromForm();
        var topIndex = parseInt(btn.getAttribute('data-nav-top-index'), 10);
        var childIndex = parseInt(btn.getAttribute('data-nav-child-index'), 10);
        var children = state.navConfig.items[topIndex].children || [];
        if (childIndex >= children.length - 1) {
          return;
        }
        var tmp = children[childIndex + 1];
        children[childIndex + 1] = children[childIndex];
        children[childIndex] = tmp;
        render();
      });
    });
  }

  function emptyMembershipTier() {
    return { slug: '', name: '', price: 0, featured: false, perks: [] };
  }

  function loadMembership() {
    return api('/membership')
      .then(function (data) {
        state.membershipConfig = data || null;
      })
      .catch(function () {
        state.membershipConfig = null;
      });
  }

  function emptyArtworkContestFlyers() {
    return {
      enabled: true,
      slots: [
        { image_id: null, image_url: '', link: '', alt: '' },
        { image_id: null, image_url: '', link: '', alt: '' }
      ]
    };
  }

  function loadArtworkContestFlyers() {
    return api('/artwork-contest/flyers')
      .then(function (data) {
        state.artworkContestFlyers = data || emptyArtworkContestFlyers();
      })
      .catch(function () {
        state.artworkContestFlyers = emptyArtworkContestFlyers();
      });
  }

  function syncArtworkContestFlyersFromForm() {
    var c = state.artworkContestFlyers;
    if (!c) {
      return;
    }
    var enabledEl = root.querySelector('[data-ac-flyers="enabled"]');
    if (enabledEl) {
      c.enabled = !!enabledEl.checked;
    }
    (c.slots || []).forEach(function (slot, index) {
      root.querySelectorAll('[data-ac-slot="' + index + '"][data-ac-field]').forEach(function (el) {
        slot[el.getAttribute('data-ac-field')] = el.value;
      });
    });
  }

  function saveArtworkContestFlyers() {
    syncArtworkContestFlyersFromForm();
    return api('/artwork-contest/flyers', {
      method: 'PUT',
      data: state.artworkContestFlyers
    }).then(function (data) {
      state.artworkContestFlyers = data;
    });
  }

  function renderArtworkContestFlyerSlot(index, slot) {
    slot = slot || { image_id: null, image_url: '', link: '', alt: '' };
    var hasImage = !!(slot.image_id || slot.image_url);
    var preview = hasImage && slot.image_url
      ? '<div class="mch-image-pick is-selected"><img class="mch-thumb-preview" src="' +
        esc(slot.image_url) +
        '" alt=""><p class="mch-image-pick__status">' +
        esc(cfg.i18n.imageSelected) +
        '</p></div>'
      : '<p class="mch-image-pick__empty">' + esc(cfg.i18n.noImageSelected) + '</p>';
    var removeBtn = hasImage
      ? '<button type="button" class="button" data-action="ac-flyer-remove" data-ac-slot="' +
        index +
        '">' +
        esc(cfg.i18n.removeImage) +
        '</button>'
      : '';
    return (
      '<section class="mch-section mch-artwork-contest-flyer-slot" data-ac-slot-wrap="' +
      index +
      '">' +
      '<h3 class="mch-section__title">' +
      esc((cfg.i18n.artworkContestFlyerSlot || 'Flyer') + ' ' + (index + 1)) +
      '</h3>' +
      '<div class="mch-field">' +
      preview +
      '<p><button type="button" class="button" data-action="ac-flyer-pick" data-ac-slot="' +
      index +
      '">' +
      esc(hasImage ? cfg.i18n.changeImage : cfg.i18n.chooseImage) +
      '</button> ' +
      removeBtn +
      '</p></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelFlyerAlt || 'Alt text') +
      '</label><input type="text" data-ac-slot="' +
      index +
      '" data-ac-field="alt" value="' +
      esc(slot.alt || '') +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelEventLink) +
      '</label><input type="url" data-ac-slot="' +
      index +
      '" data-ac-field="link" value="' +
      esc(slot.link || '') +
      '" placeholder="https://"></div>' +
      '</section>'
    );
  }

  function renderArtworkContestFlyersEditor() {
    var c = state.artworkContestFlyers || emptyArtworkContestFlyers();
    var slots = (c.slots || []).slice(0, 2);
    while (slots.length < 2) {
      slots.push({ image_id: null, image_url: '', link: '', alt: '' });
    }
    var previewUrl = c.preview_url || '/';
    return (
      '<div class="mch-artwork-contest-flyers-editor">' +
      '<section class="mch-section">' +
      '<h3 class="mch-section__title">' +
      esc(cfg.i18n.artworkContestFlyers || 'Artwork contest flyers') +
      '</h3>' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionArtworkContestFlyersHint || '') +
      '</p>' +
      '<p class="mch-section__hint mch-section__hint--note"><a href="' +
      esc(previewUrl) +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.previewArtworkContest || 'Preview contest page') +
      '</a></p>' +
      '<label class="mch-field mch-field--checkbox"><input type="checkbox" data-ac-flyers="enabled"' +
      (c.enabled ? ' checked' : '') +
      '> ' +
      esc(cfg.i18n.artworkContestFlyersEnabled || 'Show floating flyers on desktop') +
      '</label>' +
      '</section>' +
      renderArtworkContestFlyerSlot(0, slots[0]) +
      renderArtworkContestFlyerSlot(1, slots[1]) +
      '<p class="mch-actions">' +
      '<button type="button" class="button button-primary" data-action="save-ac-flyers">' +
      esc(cfg.i18n.save) +
      '</button> ' +
      '<button type="button" class="button" data-action="reset-ac-flyers">' +
      esc(cfg.i18n.resetArtworkContestFlyers || 'Reset to defaults') +
      '</button></p></div>'
    );
  }

  function bindArtworkContestFlyersEvents() {
    var saveBtn = root.querySelector('[data-action="save-ac-flyers"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        setStatus(cfg.i18n.loading, true);
        saveArtworkContestFlyers()
          .then(function () {
            setStatus(cfg.i18n.saved, true);
            render({ skipSync: true });
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var resetBtn = root.querySelector('[data-action="reset-ac-flyers"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!window.confirm(cfg.i18n.resetArtworkContestFlyersConfirm || 'Reset contest flyers to defaults?')) {
          return;
        }
        setStatus(cfg.i18n.loading, true);
        api('/artwork-contest/flyers/reset', { method: 'POST' })
          .then(function (data) {
            state.artworkContestFlyers = data;
            setStatus(cfg.i18n.saved, true);
            render({ skipSync: true });
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    root.querySelectorAll('[data-action="ac-flyer-pick"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var index = parseInt(btn.getAttribute('data-ac-slot'), 10);
        pickMedia(cfg.i18n.chooseImage).then(function (picked) {
          if (!picked || !picked.id) {
            return;
          }
          syncArtworkContestFlyersFromForm();
          if (!state.artworkContestFlyers) {
            state.artworkContestFlyers = emptyArtworkContestFlyers();
          }
          return finishMediaPick(picked).then(function (resolved) {
            if (!resolved || !state.artworkContestFlyers) {
              return;
            }
            if (!state.artworkContestFlyers.slots[index]) {
              state.artworkContestFlyers.slots[index] = { image_id: null, image_url: '', link: '', alt: '' };
            }
            state.artworkContestFlyers.slots[index].image_id = resolved.id;
            state.artworkContestFlyers.slots[index].image_url = resolved.url || '';
            setStatus(cfg.i18n.imageSelected, true);
            render({ skipSync: true });
          });
        });
      });
    });

    root.querySelectorAll('[data-action="ac-flyer-remove"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var index = parseInt(btn.getAttribute('data-ac-slot'), 10);
        syncArtworkContestFlyersFromForm();
        if (!state.artworkContestFlyers || !state.artworkContestFlyers.slots[index]) {
          return;
        }
        state.artworkContestFlyers.slots[index].image_id = null;
        state.artworkContestFlyers.slots[index].image_url = '';
        render({ skipSync: true });
      });
    });
  }

  function perksToText(perks) {
    return (perks || []).join('\n');
  }

  function perksFromText(text) {
    return String(text || '')
      .split(/\r\n|\r|\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(function (line) {
        return line !== '';
      });
  }

  function renderMembershipTier(index, tier) {
    tier = tier || emptyMembershipTier();
    return (
      '<section class="mch-membership-tier" data-membership-tier="' +
      index +
      '">' +
      '<div class="mch-nav-section__head">' +
      '<h3 class="mch-nav-section__title">' +
      esc(tier.name || cfg.i18n.membershipTierLabel + ' ' + (index + 1)) +
      '</h3>' +
      '<div class="mch-nav-section__actions">' +
      '<button type="button" class="button button-small" data-action="membership-tier-up" data-membership-tier="' +
      index +
      '">↑</button>' +
      '<button type="button" class="button button-small" data-action="membership-tier-down" data-membership-tier="' +
      index +
      '">↓</button>' +
      '<button type="button" class="button button-small button-link-delete" data-action="membership-tier-remove" data-membership-tier="' +
      index +
      '">' +
      esc(cfg.i18n.removeTier) +
      '</button></div></div>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelTierName) +
      '</span><input type="text" class="regular-text" data-membership-field="name" data-membership-tier="' +
      index +
      '" value="' +
      esc(tier.name || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelTierPrice) +
      '</span><input type="number" min="0" step="1" class="small-text" data-membership-field="price" data-membership-tier="' +
      index +
      '" value="' +
      esc(tier.price || 0) +
      '" /></label>' +
      '<label class="mch-field mch-field--checkbox"><input type="checkbox" data-membership-field="featured" data-membership-tier="' +
      index +
      '"' +
      (tier.featured ? ' checked' : '') +
      ' /> ' +
      esc(cfg.i18n.labelTierFeatured) +
      '</label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelTierPerks) +
      '</span><textarea rows="4" class="large-text" data-membership-field="perks" data-membership-tier="' +
      index +
      '" placeholder="' +
      esc(cfg.i18n.labelTierPerksHint) +
      '">' +
      esc(perksToText(tier.perks)) +
      '</textarea></label></section>'
    );
  }

  function renderMembershipBenefit(index, benefit) {
    benefit = benefit || { title: '', body: '' };
    return (
      '<div class="mch-membership-benefit" data-membership-benefit="' +
      index +
      '">' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelBenefitTitle) +
      '</span><input type="text" class="regular-text" data-membership-benefit-field="title" data-membership-benefit="' +
      index +
      '" value="' +
      esc(benefit.title || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelBenefitBody) +
      '</span><textarea rows="2" class="large-text" data-membership-benefit-field="body" data-membership-benefit="' +
      index +
      '">' +
      esc(benefit.body || '') +
      '</textarea></label></div>'
    );
  }

  function syncMembershipFromForm() {
    if (!state.membershipConfig) {
      state.membershipConfig = {};
    }
    var c = state.membershipConfig;
    var joinEl = root.querySelector('[data-membership-root="join_url"]');
    var buttonEl = root.querySelector('[data-membership-root="button_label"]');
    var underConstructionEl = root.querySelector('[data-membership-root="under_construction"]');
    var underConstructionMessageEl = root.querySelector('[data-membership-root="under_construction_message"]');
    c.join_url = joinEl ? joinEl.value : c.join_url || '';
    c.button_label = buttonEl ? buttonEl.value : c.button_label || 'Join';
    c.under_construction = underConstructionEl ? underConstructionEl.checked : !!c.under_construction;
    c.under_construction_message = underConstructionMessageEl
      ? underConstructionMessageEl.value
      : c.under_construction_message || '';

    c.plans = c.plans || {};
    root.querySelectorAll('[data-membership-plans-field]').forEach(function (el) {
      c.plans[el.getAttribute('data-membership-plans-field')] = el.value;
    });
    var syncPageIntroEl = root.querySelector('[data-membership-sync="sync_page_intro"]');
    c.plans.sync_page_intro = syncPageIntroEl ? syncPageIntroEl.checked : c.plans.sync_page_intro !== false;
    if (c.plans.sync_page_intro) {
      c.plans.page_intro = c.plans.intro || '';
    }

    var syncHeroEl = root.querySelector('[data-membership-sync="sync_hero_with_intro"]');
    if (!c.page) {
      c.page = {};
    }
    c.page.sync_hero_with_intro = syncHeroEl ? syncHeroEl.checked : !!c.page.sync_hero_with_intro;

    c.tiers = [];
    root.querySelectorAll('.mch-membership-tier').forEach(function (section) {
      var index = section.getAttribute('data-membership-tier');
      var tier = emptyMembershipTier();
      root.querySelectorAll('[data-membership-tier="' + index + '"][data-membership-field]').forEach(function (el) {
        var field = el.getAttribute('data-membership-field');
        if (field === 'name') {
          tier.name = el.value;
        } else if (field === 'price') {
          tier.price = parseInt(el.value, 10) || 0;
        } else if (field === 'featured') {
          tier.featured = el.checked;
        } else if (field === 'perks') {
          tier.perks = perksFromText(el.value);
        }
      });
      tier.slug = tier.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      c.tiers.push(tier);
    });

    var featuredIndex = -1;
    c.tiers.forEach(function (tier, i) {
      if (tier.featured) {
        if (featuredIndex >= 0) {
          tier.featured = false;
        } else {
          featuredIndex = i;
        }
      }
    });

    c.page = c.page || {};
    root.querySelectorAll('[data-membership-page-field]').forEach(function (el) {
      var field = el.getAttribute('data-membership-page-field');
      if (field === 'how_steps') {
        c.page.how_steps = perksFromText(el.value);
      } else {
        c.page[field] = el.value;
      }
    });
    if (c.page.sync_hero_with_intro) {
      c.page.hero_lead = c.plans.intro || '';
    }

    c.page.benefits = [];
    root.querySelectorAll('.mch-membership-benefit').forEach(function (row) {
      var index = row.getAttribute('data-membership-benefit');
      var benefit = { title: '', body: '' };
      root.querySelectorAll('[data-membership-benefit="' + index + '"][data-membership-benefit-field]').forEach(function (el) {
        benefit[el.getAttribute('data-membership-benefit-field')] = el.value;
      });
      if (benefit.title !== '' || benefit.body !== '') {
        c.page.benefits.push(benefit);
      }
    });
  }

  function saveMembership() {
    syncMembershipFromForm();
    setStatus(cfg.i18n.loading, true);
    return api('/membership', {
      method: 'PUT',
      data: state.membershipConfig
    })
      .then(function (res) {
        state.membershipConfig = res;
        setStatus(cfg.i18n.saved, true);
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function syncMembershipNow() {
    syncMembershipFromForm();
    setStatus(cfg.i18n.loading, true);
    return api('/membership/sync', {
      method: 'POST',
      data: { include_hero: true }
    })
      .then(function (res) {
        state.membershipConfig = res;
        setStatus(cfg.i18n.membershipSynced, true);
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function resetMembership() {
    if (!window.confirm(cfg.i18n.resetMembershipConfirm)) {
      return Promise.resolve();
    }
    setStatus(cfg.i18n.loading, true);
    return api('/membership/reset', { method: 'POST' })
      .then(function (res) {
        state.membershipConfig = res;
        setStatus(cfg.i18n.saved, true);
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function renderMembershipEditor() {
    if (!state.membershipConfig) {
      return renderLoadingState();
    }

    var c = state.membershipConfig;
    var tiers = c.tiers && c.tiers.length ? c.tiers : [emptyMembershipTier()];
    var plans = c.plans || {};
    var page = c.page || {};
    var benefits = page.benefits && page.benefits.length ? page.benefits : [{ title: '', body: '' }];
    var syncPageIntro = plans.sync_page_intro !== false;
    var syncHeroIntro = !!page.sync_hero_with_intro;
    var syncStatus = c.sync_status || {};
    var underConstruction = !!c.under_construction;
    var underConstructionMessage =
      c.under_construction_message ||
      'Membership plans are being updated. Please check back soon.';

    var tierHtml = tiers
      .map(function (tier, index) {
        return renderMembershipTier(index, tier);
      })
      .join('');

    var benefitHtml = benefits
      .map(function (benefit, index) {
        return renderMembershipBenefit(index, benefit);
      })
      .join('');

    var statusNote = c.is_custom ? cfg.i18n.membershipUsingCustom : cfg.i18n.membershipUsingDefault;
    var driftNote = '';
    if (!syncPageIntro && !syncStatus.page_intro_matches) {
      driftNote =
        '<div class="mch-notice mch-notice--warn" role="status"><p>' +
        esc(cfg.i18n.membershipIntroDrift) +
        ' <button type="button" class="button button-secondary" data-action="membership-sync-now">' +
        esc(cfg.i18n.membershipSyncNow) +
        '</button></p></div>';
    }

    var pageIntroField =
      '<label class="mch-field' +
      (syncPageIntro ? ' is-disabled' : '') +
      '"><span class="mch-field__label">' +
      esc(cfg.i18n.labelPageIntro) +
      '</span><textarea rows="2" class="large-text" data-membership-plans-field="page_intro"' +
      (syncPageIntro ? ' disabled' : '') +
      '>' +
      esc(plans.page_intro || '') +
      '</textarea>' +
      (syncPageIntro ? '<span class="description">' + esc(cfg.i18n.membershipPageIntroSynced) + '</span>' : '') +
      '</label>';

    var heroLeadField =
      '<label class="mch-field' +
      (syncHeroIntro ? ' is-disabled' : '') +
      '"><span class="mch-field__label">' +
      esc(cfg.i18n.labelHeroLead) +
      '</span><textarea rows="2" class="large-text" data-membership-page-field="hero_lead"' +
      (syncHeroIntro ? ' disabled' : '') +
      '>' +
      esc(page.hero_lead || '') +
      '</textarea>' +
      (syncHeroIntro ? '<span class="description">' + esc(cfg.i18n.membershipHeroIntroSynced) + '</span>' : '') +
      '</label>';

    var constructionPanel =
      '<section class="mch-membership-construction' +
      (underConstruction ? ' is-active' : '') +
      '">' +
      '<h3 class="mch-nav-section__title">' +
      esc(cfg.i18n.membershipUnderConstructionHeading || 'Public visibility') +
      '</h3>' +
      '<label class="mch-field mch-field--checkbox"><input type="checkbox" data-membership-root="under_construction"' +
      (underConstruction ? ' checked' : '') +
      ' /> ' +
      esc(cfg.i18n.membershipUnderConstructionToggle || 'Show under construction on public site') +
      '</label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.membershipUnderConstructionMessage || 'Under construction message') +
      '</span><textarea rows="3" class="large-text" data-membership-root="under_construction_message">' +
      esc(underConstructionMessage) +
      '</textarea></label>' +
      (underConstruction
        ? '<p class="description mch-membership-construction__status">' +
          esc(
            cfg.i18n.membershipUnderConstructionActive ||
              'Visitors see this message instead of tier cards on the homepage and /membership/ plans section.'
          ) +
          '</p>'
        : '') +
      '</section>';

    return (
      '<div class="mch-panel mch-panel--wide mch-membership-editor">' +
      constructionPanel +
      driftNote +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionMembershipHint) +
      '</p>' +
      '<p class="description">' +
      esc(statusNote) +
      '</p>' +
      '<h3>' +
      esc(cfg.i18n.sectionMembershipShared) +
      '</h3>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelJoinUrl) +
      '</span><input type="url" class="large-text code" data-membership-root="join_url" value="' +
      esc(c.join_url || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelJoinButton) +
      '</span><input type="text" class="regular-text" data-membership-root="button_label" value="' +
      esc(c.button_label || 'Join') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelSectionLabel) +
      '</span><input type="text" class="regular-text" data-membership-plans-field="section_label" value="' +
      esc(plans.section_label || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelPlansHeading) +
      '</span><input type="text" class="regular-text" data-membership-plans-field="heading" value="' +
      esc(plans.heading || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelHomeIntro) +
      '</span><textarea rows="2" class="large-text" data-membership-plans-field="intro">' +
      esc(plans.intro || '') +
      '</textarea></label>' +
      '<div class="mch-membership-sync">' +
      '<label class="mch-field mch-field--checkbox"><input type="checkbox" data-membership-sync="sync_page_intro"' +
      (syncPageIntro ? ' checked' : '') +
      ' /> ' +
      esc(cfg.i18n.membershipSyncPageIntro) +
      '</label>' +
      pageIntroField +
      '<p class="description">' +
      esc(cfg.i18n.membershipTiersSharedNote) +
      '</p></div>' +
      '<h3>' +
      esc(cfg.i18n.sectionMembershipTiers) +
      '</h3>' +
      (underConstruction
        ? '<p class="description mch-membership-tiers__note">' +
          esc(
            cfg.i18n.membershipTiersHiddenNote ||
              'Tier cards are hidden while under construction is on. Saved tiers return when you turn this off.'
          ) +
          '</p>'
        : '') +
      '<div class="mch-membership-tiers' +
      (underConstruction ? ' is-muted' : '') +
      '">' +
      tierHtml +
      '</div>' +
      '<p><button type="button" class="button" data-action="membership-tier-add">' +
      esc(cfg.i18n.addTier) +
      '</button></p>' +
      '<h3>' +
      esc(cfg.i18n.sectionMembershipPage) +
      '</h3>' +
      '<p class="description">' +
      esc(cfg.i18n.sectionMembershipPageHint) +
      '</p>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelHeroEyebrow) +
      '</span><input type="text" class="regular-text" data-membership-page-field="hero_eyebrow" value="' +
      esc(page.hero_eyebrow || '') +
      '" /></label>' +
      '<label class="mch-field mch-field--checkbox"><input type="checkbox" data-membership-sync="sync_hero_with_intro"' +
      (syncHeroIntro ? ' checked' : '') +
      ' /> ' +
      esc(cfg.i18n.membershipSyncHeroIntro) +
      '</label>' +
      heroLeadField +
      '<div class="mch-membership-benefits">' +
      benefitHtml +
      '</div>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelHowHeading) +
      '</span><input type="text" class="regular-text" data-membership-page-field="how_heading" value="' +
      esc(page.how_heading || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelHowSteps) +
      '</span><textarea rows="4" class="large-text" data-membership-page-field="how_steps" placeholder="' +
      esc(cfg.i18n.labelTierPerksHint) +
      '">' +
      esc(perksToText(page.how_steps)) +
      '</textarea></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelCtaHeading) +
      '</span><input type="text" class="regular-text" data-membership-page-field="cta_heading" value="' +
      esc(page.cta_heading || '') +
      '" /></label>' +
      '<label class="mch-field"><span class="mch-field__label">' +
      esc(cfg.i18n.labelCtaBody) +
      '</span><textarea rows="2" class="large-text" data-membership-page-field="cta_body">' +
      esc(page.cta_body || '') +
      '</textarea></label>' +
      '<p class="mch-nav-actions">' +
      '<button type="button" class="button button-primary" data-action="save-membership">' +
      esc(cfg.i18n.save) +
      '</button> ' +
      '<button type="button" class="button" data-action="membership-sync-now">' +
      esc(cfg.i18n.membershipSyncNow) +
      '</button> ' +
      '<button type="button" class="button" data-action="reset-membership">' +
      esc(cfg.i18n.resetMembershipDefault) +
      '</button> ' +
      '<a class="button" href="' +
      esc(cfg.homeUrl + '#Membership') +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.previewMembershipHome) +
      '</a> ' +
      '<a class="button" href="' +
      esc((cfg.membershipUrl || cfg.homeUrl) + '') +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.previewMembershipPage) +
      '</a></p></div>'
    );
  }

  function bindMembershipEditorEvents() {
    var saveBtn = root.querySelector('[data-action="save-membership"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveMembership().then(render);
      });
    }

    var resetBtn = root.querySelector('[data-action="reset-membership"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetMembership().then(render);
      });
    }

    root.querySelectorAll('[data-action="membership-sync-now"]').forEach(function (syncBtn) {
      syncBtn.addEventListener('click', function () {
        syncMembershipNow().then(render);
      });
    });

    root.querySelectorAll('[data-membership-sync="sync_page_intro"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        syncMembershipFromForm();
        render();
      });
    });

    root.querySelectorAll('[data-membership-sync="sync_hero_with_intro"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        syncMembershipFromForm();
        render();
      });
    });

    root.querySelectorAll('[data-membership-root="under_construction"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        syncMembershipFromForm();
        render();
      });
    });

    var addTier = root.querySelector('[data-action="membership-tier-add"]');
    if (addTier) {
      addTier.addEventListener('click', function () {
        syncMembershipFromForm();
        state.membershipConfig.tiers.push(emptyMembershipTier());
        render();
      });
    }

    root.querySelectorAll('[data-action="membership-tier-remove"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncMembershipFromForm();
        var index = parseInt(btn.getAttribute('data-membership-tier'), 10);
        state.membershipConfig.tiers.splice(index, 1);
        if (!state.membershipConfig.tiers.length) {
          state.membershipConfig.tiers.push(emptyMembershipTier());
        }
        render();
      });
    });

    root.querySelectorAll('[data-action="membership-tier-up"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncMembershipFromForm();
        var index = parseInt(btn.getAttribute('data-membership-tier'), 10);
        var tiers = state.membershipConfig.tiers;
        if (index <= 0) {
          return;
        }
        var tmp = tiers[index - 1];
        tiers[index - 1] = tiers[index];
        tiers[index] = tmp;
        render();
      });
    });

    root.querySelectorAll('[data-action="membership-tier-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncMembershipFromForm();
        var index = parseInt(btn.getAttribute('data-membership-tier'), 10);
        var tiers = state.membershipConfig.tiers;
        if (index >= tiers.length - 1) {
          return;
        }
        var tmp = tiers[index + 1];
        tiers[index + 1] = tiers[index];
        tiers[index] = tmp;
        render();
      });
    });

    root.querySelectorAll('[data-membership-field="featured"]').forEach(function (checkbox) {
      checkbox.addEventListener('change', function () {
        if (!checkbox.checked) {
          return;
        }
        root.querySelectorAll('[data-membership-field="featured"]').forEach(function (other) {
          if (other !== checkbox) {
            other.checked = false;
          }
        });
      });
    });
  }

  function loadFlyers() {
    return api('/event-flyers').then(function (items) {
      state.flyers = items || [];
    });
  }

  function loadMemorials() {
    return api('/memorial-tributes').then(function (items) {
      state.memorials = items || [];
    });
  }

  function loadCalendarPreview() {
    return api('/event-flyers/calendar-preview')
      .then(function (res) {
        state.calendarPreviewHtml = res && res.html ? res.html : '';
      })
      .catch(function () {
        state.calendarPreviewHtml = '';
      });
  }

  function loadNewsletters() {
    return api('/newsletters').then(function (items) {
      state.newsletters = items || [];
    });
  }

  function attachmentPreviewUrl(att) {
    if (!att) {
      return '';
    }
    if (att.url) {
      return att.url;
    }
    var sizes = att.sizes || {};
    if (sizes.medium && sizes.medium.url) {
      return sizes.medium.url;
    }
    if (sizes.large && sizes.large.url) {
      return sizes.large.url;
    }
    if (sizes.full && sizes.full.url) {
      return sizes.full.url;
    }
    if (sizes.thumbnail && sizes.thumbnail.url) {
      return sizes.thumbnail.url;
    }
    return '';
  }

  function pickFromMediaFrame(frame) {
    var selection = frame.state().get('selection');
    if (!selection || !selection.length) {
      return null;
    }
    var att = selection.first().toJSON();
    return {
      id: att.id,
      url: attachmentPreviewUrl(att)
    };
  }

  function finishMediaPick(picked) {
    if (!picked || !picked.id) {
      return Promise.resolve(null);
    }
    if (picked.url) {
      return Promise.resolve(picked);
    }
    if (!wp.media || !wp.media.attachment) {
      return Promise.resolve(picked);
    }
    return wp.media
      .attachment(picked.id)
      .fetch()
      .then(function () {
        var att = wp.media.attachment(picked.id).toJSON();
        picked.url = attachmentPreviewUrl(att);
        return picked;
      })
      .catch(function () {
        return picked;
      });
  }

  function pickMedia(title) {
    return new Promise(function (resolve) {
      if (!wp || !wp.media) {
        setStatus(cfg.i18n.mediaUnavailable, false);
        resolve(null);
        return;
      }
      var frame = wp.media({
        title: title || cfg.i18n.chooseImage,
        button: { text: cfg.i18n.useImage || 'Use image' },
        multiple: false,
        library: { type: 'image' }
      });
      frame.on('select', function () {
        finishMediaPick(pickFromMediaFrame(frame)).then(resolve);
      });
      frame.open();
    });
  }

  function pickGallery() {
    return new Promise(function (resolve) {
      if (!wp || !wp.media) {
        setStatus(cfg.i18n.mediaUnavailable, false);
        resolve(null);
        return;
      }
      var frame = wp.media({
        title: cfg.i18n.gallery,
        button: { text: cfg.i18n.addToGallery || 'Add to gallery' },
        multiple: true,
        library: { type: 'image' }
      });
      frame.on('select', function () {
        var items = frame.state().get('selection').map(function (m) {
          var att = m.toJSON();
          return {
            id: att.id,
            url: attachmentPreviewUrl(att),
            alt: att.alt || att.title || ''
          };
        });
        resolve(items.length ? items : null);
      });
      frame.open();
    });
  }

  function applyFlyerImagePick(picked) {
    if (!picked || !picked.id) {
      return Promise.resolve();
    }
    syncFlyerFromForm();
    if (!state.flyerDraft) {
      state.flyerDraft = emptyFlyer();
    }
    return finishMediaPick(picked).then(function (resolved) {
      if (!resolved) {
        return;
      }
      state.flyerDraft.thumbnail_id = resolved.id;
      state.flyerDraft.thumbnail_url = resolved.url || '';
      setStatus(cfg.i18n.imageSelected, true);
      refreshFlyerEditorPanel();
    });
  }

  function refreshFlyerEditorPanel() {
    var editor = root.querySelector('[data-editor="flyer"]');
    if (!editor) {
      render();
      return;
    }
    editor.innerHTML = renderFlyerEditor();
    bindFlyerEditorEvents();
  }

  function refreshCalendarPreviewPanel() {
    var preview = root.querySelector('[data-calendar-preview]');
    if (!preview) {
      return;
    }
    preview.innerHTML = renderCalendarPreviewHtml();
    bindCalendarEvents();
  }

  function saveFlyer(publish) {
    var d = state.flyerDraft;
    if (!d) return Promise.resolve();
    d.status = publish ? 'publish' : d.status || 'draft';
    var req = d.id
      ? api('/event-flyers/' + d.id, { method: 'PATCH', data: d })
      : api('/event-flyers', { method: 'POST', data: d });
    return req.then(function (saved) {
      state.flyerDraft = saved;
      state.activeFlyerId = saved.id;
      setStatus(cfg.i18n.saved, true);
      return loadFlyers().then(loadCalendarPreview);
    });
  }

  function saveMemorial(publish) {
    var d = state.memorialDraft;
    if (!d) return Promise.resolve();
    d.status = publish ? 'publish' : d.status || 'draft';
    var req = d.id
      ? api('/memorial-tributes/' + d.id, { method: 'PATCH', data: d })
      : api('/memorial-tributes', { method: 'POST', data: d });
    return req.then(function (saved) {
      state.memorialDraft = saved;
      state.activeMemorialId = saved.id;
      setStatus(cfg.i18n.saved, true);
      return loadMemorials();
    });
  }

  function saveNewsletter(publish, feature) {
    var d = state.newsletterDraft;
    if (!d) return Promise.resolve();
    d.status = publish ? 'publish' : d.status || 'draft';
    ensureNewsletterGallery(d);
    var payload = Object.assign({}, d);
    if (feature) {
      payload.featured = true;
    }
    var req = d.id
      ? api('/newsletters/' + d.id, { method: 'PATCH', data: payload })
      : api('/newsletters', { method: 'POST', data: payload });
    return req.then(function (saved) {
      state.newsletterDraft = saved;
      ensureNewsletterGallery(state.newsletterDraft);
      state.activeNewsletterId = saved.id;
      setStatus(cfg.i18n.saved, true);
      return loadNewsletters().then(function () {
        if (feature) {
          return loadHomepageHealth();
        }
      });
    });
  }

  function reorderFlyers(newOrder) {
    setStatus(cfg.i18n.loading, true);
    return api('/event-flyers/reorder', { method: 'POST', data: { order: newOrder } })
      .then(function (items) {
        state.flyers = items || [];
        setStatus(cfg.i18n.saved, true);
        return loadCalendarPreview();
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function moveFlyer(id, direction) {
    var ids = state.flyers.map(function (f) {
      return f.id;
    });
    var idx = ids.indexOf(id);
    if (idx < 0) return;
    var swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= ids.length) return;
    var tmp = ids[idx];
    ids[idx] = ids[swap];
    ids[swap] = tmp;
    return reorderFlyers(ids).then(render);
  }

  function moveNewsletterBlock(fromIndex, toIndex) {
    var d = state.newsletterDraft;
    if (!d || !d.blocks || fromIndex === toIndex) {
      return;
    }
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= d.blocks.length ||
      toIndex >= d.blocks.length
    ) {
      return;
    }
    syncNewsFromForm();
    var item = d.blocks.splice(fromIndex, 1)[0];
    d.blocks.splice(toIndex, 0, item);
    render({ skipSync: true });
  }

  function bindBlockDragDrop() {
    var wrap = root.querySelector('[data-blocks-wrap]');
    if (!wrap) {
      return;
    }

    wrap.querySelectorAll('.mch-block').forEach(function (blockEl) {
      blockEl.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        blockEl.classList.add('is-drag-over');
      });
      blockEl.addEventListener('dragleave', function () {
        blockEl.classList.remove('is-drag-over');
      });
      blockEl.addEventListener('drop', function (e) {
        e.preventDefault();
        blockEl.classList.remove('is-drag-over');
        if (blockDragIndex === null) {
          return;
        }
        var toIndex = parseInt(blockEl.getAttribute('data-block'), 10);
        if (Number.isNaN(toIndex)) {
          return;
        }
        moveNewsletterBlock(blockDragIndex, toIndex);
        blockDragIndex = null;
      });
    });

    wrap.querySelectorAll('[data-block-drag]').forEach(function (handle) {
      handle.addEventListener('dragstart', function (e) {
        var blockEl = handle.closest('.mch-block');
        if (!blockEl) {
          return;
        }
        blockDragIndex = parseInt(blockEl.getAttribute('data-block'), 10);
        if (Number.isNaN(blockDragIndex)) {
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(blockDragIndex));
        blockEl.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', function () {
        blockDragIndex = null;
        wrap.querySelectorAll('.mch-block').forEach(function (el) {
          el.classList.remove('is-dragging', 'is-drag-over');
        });
      });
    });
  }

  function renderImageField(d, pickAction, removeAction) {
    var hasImage = !!d.thumbnail_id;
    var preview;
    if (hasImage && d.thumbnail_url) {
      preview =
        '<div class="mch-image-pick is-selected">' +
        '<img class="mch-thumb-preview" src="' +
        esc(d.thumbnail_url) +
        '" alt="">' +
        '<p class="mch-image-pick__status">' +
        esc(cfg.i18n.imageSelected) +
        '</p></div>';
    } else if (hasImage) {
      preview =
        '<div class="mch-image-pick is-selected mch-image-pick--no-preview">' +
        '<p class="mch-image-pick__status">' +
        esc(cfg.i18n.imageSelected) +
        '</p></div>';
    } else {
      preview = '<p class="mch-image-pick__empty">' + esc(cfg.i18n.noImageSelected) + '</p>';
    }
    var removeBtn = hasImage
      ? '<button type="button" class="button" data-action="' +
        removeAction +
        '">' +
        esc(cfg.i18n.removeImage) +
        '</button>'
      : '';
    return (
      '<div class="mch-image-pick-wrap" data-image-picker>' +
      preview +
      '<div class="mch-image-pick__actions">' +
      '<button type="button" class="button" data-action="' +
      pickAction +
      '">' +
      esc(hasImage ? cfg.i18n.changeImage : cfg.i18n.chooseImage) +
      '</button>' +
      removeBtn +
      '</div></div>'
    );
  }

  function memorialChoiceOptions(choices, selected) {
    var html = '';
    Object.keys(choices || {}).forEach(function (key) {
      html +=
        '<option value="' +
        esc(key) +
        '"' +
        (key === selected ? ' selected' : '') +
        '>' +
        esc(choices[key]) +
        '</option>';
    });
    return html;
  }

  function renderListFilterInput(key, value, placeholder) {
    return (
      '<div class="mch-list-filter">' +
      '<input type="search" class="mch-list-filter__input" data-list-filter="' +
      esc(key) +
      '" value="' +
      esc(value || '') +
      '" placeholder="' +
      esc(placeholder) +
      '" aria-label="' +
      esc(placeholder) +
      '"></div>'
    );
  }

  function mchFilterByTitle(items, filterValue) {
    var q = (filterValue || '').trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter(function (item) {
      return (item.title || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderMemorialList() {
    if (!state.memorials.length) {
      return '<li class="mch-list__empty">No tributes yet - add your first one above.</li>';
    }
    var visible = mchFilterByTitle(state.memorials, state.memorialFilter);
    if (!visible.length) {
      return '<li class="mch-list__empty">No tributes match your search.</li>';
    }
    return visible
      .map(function (m) {
        var badge = m.status !== 'publish' ? ' <span class="mch-badge">' + esc(cfg.i18n.draft) + '</span>' : '';
        return (
          '<li class="mch-list__item"><button type="button" class="mch-list__btn' +
          (state.activeMemorialId === m.id ? ' is-active' : '') +
          '" data-memorial-id="' +
          m.id +
          '">' +
          esc(m.title || 'Untitled') +
          badge +
          '</button></li>'
        );
      })
      .join('');
  }

  function renderMemorialEditor() {
    var d = state.memorialDraft || emptyMemorial();
    var lineChoices = cfg.memorialLineChoices || {};
    var variantChoices = cfg.memorialVariantChoices || {};
    var memorialUrl = cfg.memorialUrl || cfg.homeUrl + 'memorial/';
    var trashBtn = d.id
      ? '<button type="button" class="button button-link-delete" data-action="trash-memorial">' +
        esc(cfg.i18n.trash) +
        '</button>'
      : '';
    return (
      '<section class="mch-section">' +
      '<h3 class="mch-section__title">' +
      esc(cfg.i18n.memorials || 'Memorial tributes') +
      '</h3>' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionMemorialHint || '') +
      '</p>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelMemorialName || 'Person\'s name') +
      '</label><input type="text" data-m="title" value="' +
      esc(d.title) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelMemorialLine || 'Line on plaque') +
      '</label><select data-m="line">' +
      memorialChoiceOptions(lineChoices, d.line) +
      '</select></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelMemorialVariant || 'Card style') +
      '</label><select data-m="variant">' +
      memorialChoiceOptions(variantChoices, d.variant) +
      '</select></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelMemorialYear || 'Year (optional)') +
      '</label><input type="text" data-m="year" value="' +
      esc(d.year) +
      '" placeholder="2026"></div>' +
      '</section>' +
      '<div class="mch-actions mch-actions--sticky">' +
      '<button type="button" class="button button-primary" data-action="save-memorial-publish">' +
      esc(cfg.i18n.publish) +
      '</button>' +
      '<button type="button" class="button" data-action="save-memorial">' +
      esc(cfg.i18n.save) +
      '</button>' +
      '<a class="button" href="' +
      esc(memorialUrl) +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.previewMemorial || cfg.i18n.preview) +
      '</a>' +
      trashBtn +
      '</div>'
    );
  }

  function renderFlyerEditor() {
    var d = state.flyerDraft || emptyFlyer();
    var trashBtn = d.id
      ? '<button type="button" class="button button-link-delete" data-action="trash-flyer">' +
        esc(cfg.i18n.trash) +
        '</button>'
      : '';
    return (
      '<section class="mch-section">' +
      '<h3 class="mch-section__title">' +
      esc(cfg.i18n.sectionFlyerDetails) +
      '</h3>' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionFlyerHint) +
      '</p>' +
      '<p class="mch-section__hint mch-section__hint--note">' +
      esc(cfg.i18n.calendarPublishHint) +
      '</p>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelFlyerTitle) +
      '</label><input type="text" data-f="title" value="' +
      esc(d.title) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelEventDate) +
      '</label><input type="date" data-f="event_date" value="' +
      esc(d.event_date) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelEventLink) +
      '</label><input type="url" data-f="link" value="' +
      esc(d.link) +
      '" placeholder="https://"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelEventNote) +
      '</label><textarea data-f="excerpt" rows="3">' +
      esc(d.excerpt) +
      '</textarea></div>' +
      '</section>' +
      '<section class="mch-section">' +
      '<h3 class="mch-section__title">' +
      esc(cfg.i18n.sectionFlyerImage) +
      '</h3>' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionFlyerImageHint) +
      '</p>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.heroImage) +
      '</label>' +
      renderImageField(d, 'flyer-image', 'flyer-remove-image') +
      '</div>' +
      '</section>' +
      '<div class="mch-actions">' +
      '<button type="button" class="button button-primary" data-action="save-flyer-publish">' +
      esc(cfg.i18n.publish) +
      '</button>' +
      '<button type="button" class="button" data-action="save-flyer">' +
      esc(cfg.i18n.save) +
      '</button>' +
      '<a class="button" href="' +
      esc(cfg.eventsUrl) +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.preview) +
      '</a>' +
      trashBtn +
      '</div>'
    );
  }

  function renderNewsletterBlocks() {
    var d = state.newsletterDraft || emptyNewsletter();
    var html = '';
    (d.blocks || []).forEach(function (block, i) {
      html +=
        '<div class="mch-block" data-block="' +
        i +
        '"><div class="mch-block__head">' +
        '<div class="mch-block__head-start">' +
        '<button type="button" class="mch-block__drag" draggable="true" data-block-drag="' +
        i +
        '" title="' +
        esc(cfg.i18n.dragSection) +
        '" aria-label="' +
        esc(cfg.i18n.dragSection) +
        '"><span class="mch-block__drag-icon" aria-hidden="true">⋮⋮</span></button>' +
        '<span class="mch-block__type-icon" aria-hidden="true">' +
        (block.type === 'list' ? MCH_BLOCK_ICONS.list : MCH_BLOCK_ICONS.paragraph) +
        '</span><strong>' +
        esc(block.type === 'list' ? cfg.i18n.listSection : cfg.i18n.paragraph) +
        '</strong></div>' +
        '<button type="button" class="button-link-delete" data-action="remove-block" data-i="' +
        i +
        '">Remove</button></div>' +
        '<div class="mch-field"><label>Section title</label><input type="text" data-block-field="title" data-i="' +
        i +
        '" value="' +
        esc(block.title) +
        '"></div>';
      if (block.type === 'list') {
        html += renderListItemsEditor(i, block.items || []);
      } else {
        html +=
          '<div class="mch-field mch-field--rich"><label>Body</label>' +
          '<p class="mch-field__hint">' +
          esc(cfg.i18n.bodyHint) +
          '</p>' +
          '<textarea id="' +
          bodyEditorId(i) +
          '" class="mch-rich-body" data-block-field="body" data-i="' +
          i +
          '"></textarea></div>';
      }
      html += '</div>';
    });
    return html;
  }

  function renderListItemsEditor(blockIndex, items) {
    var rows = items && items.length ? items.slice() : [''];
    var html =
      '<div class="mch-field mch-field--list">' +
      '<label>' +
      esc(cfg.i18n.listItemsLabel) +
      '</label>' +
      '<p class="mch-field__hint">' +
      esc(cfg.i18n.listItemsHint) +
      '</p>' +
      '<div class="mch-list-items" data-list-block="' +
      blockIndex +
      '">';
    rows.forEach(function (item, itemIndex) {
      var upDisabled = itemIndex === 0 ? ' disabled' : '';
      var downDisabled = itemIndex === rows.length - 1 ? ' disabled' : '';
      html +=
        '<div class="mch-list-item" data-list-block="' +
        blockIndex +
        '" data-list-item="' +
        itemIndex +
        '">' +
        '<span class="mch-list-item__num" aria-hidden="true">' +
        (itemIndex + 1) +
        '</span>' +
        '<div class="mch-list-item__fields">' +
        '<label class="screen-reader-text">' +
        esc(cfg.i18n.listItemLabel) +
        ' ' +
        (itemIndex + 1) +
        '</label>' +
        '<textarea rows="2" class="mch-list-item__input" data-list-item-field data-list-block="' +
        blockIndex +
        '" data-list-item="' +
        itemIndex +
        '" placeholder="' +
        esc(cfg.i18n.listItemPlaceholder) +
        '">' +
        esc(item) +
        '</textarea>' +
        '<div class="mch-list-item__actions">' +
        '<button type="button" class="button button-small" data-action="list-item-up" data-block-i="' +
        blockIndex +
        '" data-item-i="' +
        itemIndex +
        '" title="' +
        esc(cfg.i18n.moveUp) +
        '"' +
        upDisabled +
        '>↑</button>' +
        '<button type="button" class="button button-small" data-action="list-item-down" data-block-i="' +
        blockIndex +
        '" data-item-i="' +
        itemIndex +
        '" title="' +
        esc(cfg.i18n.moveDown) +
        '"' +
        downDisabled +
        '>↓</button>' +
        '<button type="button" class="button-link-delete" data-action="remove-list-item" data-block-i="' +
        blockIndex +
        '" data-item-i="' +
        itemIndex +
        '">' +
        esc(cfg.i18n.removeListItem) +
        '</button>' +
        '</div></div></div>';
    });
    html +=
      '</div>' +
      '<button type="button" class="button button-small" data-action="add-list-item" data-block-i="' +
      blockIndex +
      '">+ ' +
      esc(cfg.i18n.addListItem) +
      '</button></div>';
    return html;
  }

  function syncListItemsFromForm() {
    var d = state.newsletterDraft;
    if (!d || !d.blocks) {
      return;
    }
    var grouped = {};
    root.querySelectorAll('[data-list-item-field]').forEach(function (el) {
      var blockIndex = parseInt(el.getAttribute('data-list-block'), 10);
      var itemIndex = parseInt(el.getAttribute('data-list-item'), 10);
      if (Number.isNaN(blockIndex) || Number.isNaN(itemIndex)) {
        return;
      }
      if (!grouped[blockIndex]) {
        grouped[blockIndex] = {};
      }
      grouped[blockIndex][itemIndex] = el.value.trim();
    });
    Object.keys(grouped).forEach(function (blockKey) {
      var blockIndex = parseInt(blockKey, 10);
      if (!d.blocks[blockIndex] || d.blocks[blockIndex].type !== 'list') {
        return;
      }
      var itemMap = grouped[blockIndex];
      var indices = Object.keys(itemMap)
        .map(function (key) {
          return parseInt(key, 10);
        })
        .sort(function (a, b) {
          return a - b;
        });
      d.blocks[blockIndex].items = indices.map(function (itemIndex) {
        return itemMap[itemIndex];
      });
    });
  }

  function renderGalleryEditor() {
    var d = state.newsletterDraft || emptyNewsletter();
    ensureNewsletterGallery(d);
    var items = d.gallery || [];
    if (!items.length) {
      return '<p class="description">No photos yet.</p>';
    }
    return items
      .map(function (item, i) {
        var img = item.url
          ? '<img src="' + esc(item.url) + '" alt="" class="mch-gallery-item__thumb">'
          : '';
        return (
          '<div class="mch-gallery-item" data-gallery-i="' +
          i +
          '">' +
          img +
          '<div class="mch-gallery-item__fields">' +
          '<label class="screen-reader-text">' +
          esc(cfg.i18n.altText) +
          '</label>' +
          '<input type="text" data-gallery-alt="' +
          i +
          '" value="' +
          esc(item.alt) +
          '" placeholder="' +
          esc(cfg.i18n.altText) +
          '">' +
          '<div class="mch-gallery-item__actions">' +
          '<button type="button" class="button button-small" data-action="gallery-up" data-i="' +
          i +
          '" title="' +
          esc(cfg.i18n.moveUp) +
          '">↑</button>' +
          '<button type="button" class="button button-small" data-action="gallery-down" data-i="' +
          i +
          '" title="' +
          esc(cfg.i18n.moveDown) +
          '">↓</button>' +
          '<button type="button" class="button-link-delete" data-action="gallery-remove" data-i="' +
          i +
          '">' +
          esc(cfg.i18n.removePhoto) +
          '</button>' +
          '</div></div></div>'
        );
      })
      .join('');
  }

  function renderNewsletterEditor() {
    var d = state.newsletterDraft || emptyNewsletter();
    ensureNewsletterGallery(d);
    var trashBtn = d.id
      ? '<button type="button" class="button button-link-delete" data-action="trash-news">' +
        esc(cfg.i18n.trash) +
        '</button>'
      : '';
    return (
      '<div class="mch-notice mch-notice--info"><p>' +
      esc(cfg.i18n.homeBandNoticeShort) +
      ' <a href="' +
      esc(cfg.editHomeUrl) +
      '">' +
      esc(cfg.i18n.editHome) +
      '</a></p></div>' +
      '<section class="mch-section">' +
      '<h3 class="mch-section__title">' +
      esc(cfg.i18n.sectionIssueInfo) +
      '</h3>' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionIssueHint) +
      '</p>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelIssueTitle) +
      '</label><input type="text" data-nf="title" value="' +
      esc(d.title) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelIssueDate) +
      '</label><input type="date" data-nf="issue_date" value="' +
      esc(d.issue_date) +
      '"></div>' +
      '</section>' +
      '<section class="mch-section">' +
      '<h3 class="mch-section__title">' +
      esc(cfg.i18n.sectionCardHeader) +
      '</h3>' +
      '<p class="mch-section__hint">' +
      esc(cfg.i18n.sectionCardHint) +
      '</p>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelTopLine) +
      '</label><input type="text" data-nf="hero_eyebrow" value="' +
      esc(d.hero_eyebrow) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelMainHeadline) +
      '</label><input type="text" data-nf="hero_title" value="' +
      esc(d.hero_title) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelNewsletterTitle) +
      '</label><input type="text" data-nf="heading" value="' +
      esc(d.heading) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.labelByline) +
      '</label><input type="text" data-nf="byline" value="' +
      esc(d.byline) +
      '"></div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.heroImage) +
      '</label>' +
      renderImageField(d, 'news-hero', 'news-remove-hero') +
      '</div>' +
      '<h3>Sections</h3><button type="button" class="button" data-action="add-letter">+ ' +
      esc(cfg.i18n.paragraph) +
      '</button> <button type="button" class="button" data-action="add-list">+ ' +
      esc(cfg.i18n.listSection) +
      '</button>' +
      '<div data-blocks-wrap>' +
      renderNewsletterBlocks() +
      '</div>' +
      '<div class="mch-field"><label>' +
      esc(cfg.i18n.gallery) +
      '</label><button type="button" class="button" data-action="news-gallery">Add photos</button>' +
      '<div class="mch-gallery-list">' +
      renderGalleryEditor() +
      '</div></div>' +
      '<div class="mch-actions">' +
      '<button type="button" class="button button-primary" data-action="save-news-publish">Publish</button>' +
      '<button type="button" class="button" data-action="save-news">Save draft</button>' +
      '<button type="button" class="button" data-action="feature-news">' +
      esc(cfg.i18n.setFeatured) +
      '</button>' +
      '<button type="button" class="button" data-action="reset-home-mirror">' +
      esc(cfg.i18n.resetHomeMirror) +
      '</button>' +
      (d.permalink
        ? '<a class="button" href="' + esc(d.permalink) + '" target="_blank" rel="noopener">' + esc(cfg.i18n.preview) + '</a>'
        : '') +
      trashBtn +
      '</div>'
    );
  }

  function renderMigrationBanner() {
    if (!state.migrationStatus || !state.migrationStatus.needs_repair) {
      return '';
    }
    return (
      '<div class="mch-notice mch-notice--warn" role="status">' +
      '<p>' +
      esc(cfg.i18n.repairBanner) +
      ' <button type="button" class="button button-secondary" data-action="repair-migration">' +
      esc(cfg.i18n.repairMigration) +
      '</button></p></div>'
    );
  }

  function renderHomepageHealthBanner() {
    var h = state.homepageHealth;
    if (!h) {
      return '';
    }
    if (h.mirror_set && !h.mirror_valid) {
      return (
        '<div class="mch-notice mch-notice--warn" role="status"><p>' +
        esc(cfg.i18n.homeHealthInvalidMirror) +
        ' <button type="button" class="button button-secondary" data-action="reset-home-mirror">' +
        esc(cfg.i18n.resetHomeMirror) +
        '</button></p></div>'
      );
    }
    return '';
  }

  function renderCalendarPreviewHtml() {
    if (state.calendarPreviewHtml) {
      return state.calendarPreviewHtml;
    }
    return '<p class="description">' + esc(cfg.i18n.calendarLoading) + '</p>';
  }

  function bindCalendarEvents() {
    var preview = root.querySelector('[data-calendar-preview]');
    if (!preview) {
      return;
    }
    preview.querySelectorAll('[data-action="calendar-open-flyer"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-flyer-id'), 10);
        if (!id) {
          return;
        }
        state.activeFlyerId = id;
        var found = state.flyers.find(function (f) {
          return f.id === id;
        });
        state.flyerDraft = found ? Object.assign({}, found) : emptyFlyer();
        render();
      });
    });
    preview.querySelectorAll('[data-action="calendar-set-date"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ymd = btn.getAttribute('data-ymd') || '';
        if (!ymd) {
          return;
        }
        syncFlyerFromForm();
        if (!state.flyerDraft) {
          state.flyerDraft = emptyFlyer();
        }
        state.flyerDraft.event_date = ymd;
        render();
        setStatus(cfg.i18n.calendarDateSet, true);
      });
    });
  }

  function renderFlyerList() {
    if (!state.flyers.length) {
      return '<li class="mch-list__empty">No flyers yet - add your first one above.</li>';
    }
    var filtering = !!(state.flyerFilter && state.flyerFilter.trim());
    var visible = mchFilterByTitle(state.flyers, state.flyerFilter);
    if (!visible.length) {
      return '<li class="mch-list__empty">No flyers match your search.</li>';
    }
    return visible
      .map(function (f) {
        // Reordering is only meaningful against the full, unfiltered
        // order, so up/down is hidden while a search is active rather
        // than operating on filtered-list positions that don't match
        // the real order.
        if (filtering) {
          return (
            '<li class="mch-list__item">' +
            '<div class="mch-list__row">' +
            '<button type="button" class="mch-list__btn' +
            (state.activeFlyerId === f.id ? ' is-active' : '') +
            '" data-flyer-id="' +
            f.id +
            '">' +
            esc(f.title || 'Untitled') +
            (f.status && f.status !== 'publish'
              ? '<span class="mch-badge mch-badge--draft">' + esc(cfg.i18n.draft) + '</span>'
              : '') +
            '</button></div></li>'
          );
        }
        var index = state.flyers.indexOf(f);
        var upDisabled = index === 0 ? ' disabled' : '';
        var downDisabled = index === state.flyers.length - 1 ? ' disabled' : '';
        return (
          '<li class="mch-list__item">' +
          '<div class="mch-list__row">' +
          '<button type="button" class="button button-small mch-list__order" data-action="flyer-up" data-flyer-id="' +
          f.id +
          '" title="' +
          esc(cfg.i18n.moveUp) +
          '"' +
          upDisabled +
          '>↑</button>' +
          '<button type="button" class="button button-small mch-list__order" data-action="flyer-down" data-flyer-id="' +
          f.id +
          '" title="' +
          esc(cfg.i18n.moveDown) +
          '"' +
          downDisabled +
          '>↓</button>' +
          '<button type="button" class="mch-list__btn' +
          (state.activeFlyerId === f.id ? ' is-active' : '') +
          '" data-flyer-id="' +
          f.id +
          '">' +
          esc(f.title || 'Untitled') +
          (f.status && f.status !== 'publish'
            ? '<span class="mch-badge mch-badge--draft">' + esc(cfg.i18n.draft) + '</span>'
            : '') +
          '</button></div></li>'
        );
      })
      .join('');
  }

  function renderNewsletterList() {
    if (!state.newsletters.length) {
      return '<li class="mch-list__empty">No newsletter issues yet - add your first one above.</li>';
    }
    var visible = mchFilterByTitle(state.newsletters, state.newsletterFilter);
    if (!visible.length) {
      return '<li class="mch-list__empty">No issues match your search.</li>';
    }
    return visible
      .map(function (n) {
        return (
          '<li class="mch-list__item"><button type="button" class="mch-list__btn' +
          (state.activeNewsletterId === n.id ? ' is-active' : '') +
          '" data-news-id="' +
          n.id +
          '">' +
          esc(n.title || 'Untitled') +
          (n.featured ? '<span class="mch-badge">' + esc(cfg.i18n.onHomepage) + '</span>' : '') +
          '</button></li>'
        );
      })
      .join('');
  }

  function accomplishmentsYearKeys() {
    return Object.keys(state.accomplishmentsYears || {}).sort(function (a, b) {
      return parseInt(b, 10) - parseInt(a, 10);
    });
  }

  function syncAccomplishmentsFromForm() {
    root.querySelectorAll('[data-outcome-year]').forEach(function (row) {
      var year = row.getAttribute('data-outcome-year');
      if (!year) {
        return;
      }
      state.accomplishmentsYears[year] = {
        adoptions: parseInt(row.querySelector('[data-outcome-field="adoptions"]').value, 10) || 0,
        return_to_owner: parseInt(row.querySelector('[data-outcome-field="return_to_owner"]').value, 10) || 0,
        intakes: parseInt(row.querySelector('[data-outcome-field="intakes"]').value, 10) || 0
      };
    });
  }

  function saveAccomplishments() {
    syncAccomplishmentsFromForm();
    setStatus(cfg.i18n.loading, true);
    return api('/accomplishments', {
      method: 'PUT',
      data: { years: state.accomplishmentsYears }
    })
      .then(function (res) {
        state.accomplishmentsYears = res && res.years ? res.years : state.accomplishmentsYears;
        setStatus(cfg.i18n.saved, true);
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function renderAccomplishmentsEditor() {
    var years = accomplishmentsYearKeys();
    if (!years.length) {
      state.accomplishmentsYears = { 2024: { adoptions: 433, return_to_owner: 0, intakes: 510 } };
      years = accomplishmentsYearKeys();
    }

    var hint = '<p class="mch-section__hint">' + esc(cfg.i18n.sectionOutcomesHint) + '</p>';
    var actions =
      '<p class="mch-outcomes-actions">' +
      '<button type="button" class="button" data-action="add-outcome-year">' +
      esc(cfg.i18n.addYear) +
      '</button> ' +
      '<button type="button" class="button button-primary" data-action="save-outcomes">' +
      esc(cfg.i18n.save) +
      '</button> ' +
      '<a class="button" href="' +
      esc(cfg.homeUrl + '#Accomplishments') +
      '" target="_blank" rel="noopener">' +
      esc(cfg.i18n.previewOutcomes) +
      '</a></p>';

    /* Staff gets a card per year instead of a raw editable table - the
       3 stat fields and the remove action still key off the same
       data-outcome-year/data-outcome-field attributes the table used,
       so syncAccomplishmentsFromForm() and the event bindings below
       work unchanged against either markup. wp-admin keeps the
       original table (cfg.staffMode is false there). */
    if (cfg.staffMode) {
      var cards = years
        .map(function (year) {
          var row = state.accomplishmentsYears[year] || {};
          return (
            '<div class="mch-outcomes-card" data-outcome-year="' +
            esc(year) +
            '"><div class="mch-outcomes-card__head">' +
            '<h3 class="mch-outcomes-card__year">' +
            esc(year) +
            '</h3>' +
            '<button type="button" class="button-link-delete" data-action="remove-outcome-year">' +
            esc(cfg.i18n.removeYear) +
            '</button></div>' +
            '<div class="mch-outcomes-card__stats">' +
            '<label class="mch-field"><span class="mch-field__label">' +
            esc(cfg.i18n.labelAdoptions) +
            '</span><input type="number" min="0" inputmode="numeric" data-outcome-field="adoptions" value="' +
            esc(row.adoptions || 0) +
            '"></label>' +
            '<label class="mch-field"><span class="mch-field__label">' +
            esc(cfg.i18n.labelReturnToOwner) +
            '</span><input type="number" min="0" inputmode="numeric" data-outcome-field="return_to_owner" value="' +
            esc(row.return_to_owner || 0) +
            '"></label>' +
            '<label class="mch-field"><span class="mch-field__label">' +
            esc(cfg.i18n.labelIntakes) +
            '</span><input type="number" min="0" inputmode="numeric" data-outcome-field="intakes" value="' +
            esc(row.intakes || 0) +
            '"></label>' +
            '</div></div>'
          );
        })
        .join('');

      return (
        '<div class="mch-panel mch-panel--wide mch-outcomes">' +
        hint +
        '<div class="mch-outcomes-grid">' +
        cards +
        '</div>' +
        actions +
        '</div>'
      );
    }

    var rows = years
      .map(function (year) {
        var row = state.accomplishmentsYears[year] || {};
        return (
          '<tr data-outcome-year="' +
          esc(year) +
          '"><th scope="row">' +
          esc(year) +
          '</th>' +
          '<td><input type="number" min="0" class="small-text" value="' +
          esc(row.adoptions || 0) +
          '" data-outcome-field="adoptions" aria-label="' +
          esc(cfg.i18n.labelAdoptions) +
          '" /></td>' +
          '<td><input type="number" min="0" class="small-text" value="' +
          esc(row.return_to_owner || 0) +
          '" data-outcome-field="return_to_owner" aria-label="' +
          esc(cfg.i18n.labelReturnToOwner) +
          '" /></td>' +
          '<td><input type="number" min="0" class="small-text" value="' +
          esc(row.intakes || 0) +
          '" data-outcome-field="intakes" aria-label="' +
          esc(cfg.i18n.labelIntakes) +
          '" /></td>' +
          '<td><button type="button" class="button-link-delete" data-action="remove-outcome-year">' +
          esc(cfg.i18n.removeYear) +
          '</button></td></tr>'
        );
      })
      .join('');

    return (
      '<div class="mch-panel mch-panel--wide mch-outcomes">' +
      hint +
      '<table class="widefat striped mch-outcomes-table"><thead><tr><th>' +
      esc(cfg.i18n.labelYear) +
      '</th><th>' +
      esc(cfg.i18n.labelAdoptions) +
      '</th><th>' +
      esc(cfg.i18n.labelReturnToOwner) +
      '</th><th>' +
      esc(cfg.i18n.labelIntakes) +
      '</th><th></th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      actions +
      '</div>'
    );
  }

  function syncActiveTabFromForm() {
    if (state.tab === 'newsletter' && state.newsletterDraft) {
      syncNewsFromForm();
    } else if (state.tab === 'event_flyers') {
      syncFlyerFromForm();
    } else if (state.tab === 'memorials') {
      syncMemorialFromForm();
    } else if (state.tab === 'navigation' && state.navConfig) {
      syncNavFromForm();
    } else if (state.tab === 'membership' && state.membershipConfig) {
      syncMembershipFromForm();
    } else if (state.tab === 'artwork_contest' && state.artworkContestFlyers) {
      syncArtworkContestFlyersFromForm();
    }
  }

  var MCH_TAB_ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    memorials: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.3 4.5 5.8 4c2-.3 3.8.6 5 2.2C12 4.6 13.8 3.7 15.8 4c3.5.5 5.3 4 3.8 7.7C17 16.4 12 21 12 21z"/></svg>',
    event_flyers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
    shelter_outcomes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18M7 15l4-6 3 4 4-7"/></svg>',
    navigation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    membership: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    artwork_contest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>',
    newsletter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 8h16"/></svg>'
  };

  var MCH_BLOCK_ICONS = {
    paragraph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>'
  };

  /* Staff-only: fuller title + description shown above the active tab's
     content, since the tab bar itself uses short labels ("Flyers", "Nav")
     to fit a mobile drawer. Not used in wp-admin (cfg.staffMode is false
     there), where the existing per-section h3 titles already do this job
     inside a narrower admin column. */
  var MCH_TAB_META = {
    home: { title: 'Overview', hint: 'A quick look at what needs attention before you dig into a section.' },
    memorials: { title: 'Memorial tributes', hint: cfg.i18n.sectionMemorialHint },
    event_flyers: { title: 'Event flyers', hint: cfg.i18n.sectionFlyerHint },
    newsletter: { title: 'Newsletter', hint: 'Issues published here appear on the homepage and /newsletter/.' },
    shelter_outcomes: { title: 'Shelter outcomes', hint: cfg.i18n.sectionOutcomesHint },
    navigation: { title: 'Site navigation', hint: cfg.i18n.sectionNavHint },
    membership: { title: 'Membership plans', hint: cfg.i18n.sectionMembershipHint },
    artwork_contest: { title: cfg.i18n.artworkContestFlyers || 'Homepage flyers', hint: cfg.i18n.sectionArtworkContestFlyersHint }
  };

  function renderPanelHeader(tabKey) {
    if (!cfg.staffMode) {
      return '';
    }
    var meta = MCH_TAB_META[tabKey];
    if (!meta) {
      return '';
    }
    var icon = MCH_TAB_ICONS[tabKey] || '';
    return (
      '<div class="mch-panel-header">' +
      '<span class="mch-panel-header__icon" aria-hidden="true">' +
      icon +
      '</span><div class="mch-panel-header__text">' +
      '<h2 class="mch-panel-header__title">' +
      esc(meta.title) +
      '</h2>' +
      (meta.hint ? '<p class="mch-panel-header__hint">' + esc(meta.hint) + '</p>' : '') +
      '</div></div>'
    );
  }

  function mchTabGroupLabel(text) {
    return '<div class="mch-tab-group-label">' + esc(text) + '</div>';
  }

  function mchDashboardCard(iconKey, label, value, meta, jumpTab) {
    return (
      '<button type="button" class="mch-dashboard-card" data-action="dashboard-jump" data-jump-tab="' +
      esc(jumpTab) +
      '">' +
      '<span class="mch-dashboard-card__icon" aria-hidden="true">' +
      (MCH_TAB_ICONS[iconKey] || '') +
      '</span>' +
      '<span class="mch-dashboard-card__body">' +
      '<span class="mch-dashboard-card__label">' +
      esc(label) +
      '</span>' +
      '<span class="mch-dashboard-card__value">' +
      esc(value) +
      '</span>' +
      '<span class="mch-dashboard-card__meta">' +
      esc(meta) +
      '</span>' +
      '</span></button>'
    );
  }

  function renderHomeDashboard() {
    var draftFlyers = state.flyers.filter(function (f) {
      return f.status !== 'publish';
    });
    var draftMemorials = state.memorials.filter(function (m) {
      return m.status !== 'publish';
    });

    var todayYmd = new Date().toISOString().slice(0, 10);
    var weekAheadYmd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    var upcoming = state.flyers
      .filter(function (f) {
        return f.event_date && f.event_date >= todayYmd && f.event_date <= weekAheadYmd;
      })
      .sort(function (a, b) {
        return a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
      });

    var latestNewsletter = state.newsletters
      .slice()
      .sort(function (a, b) {
        var ad = a.issue_date || '';
        var bd = b.issue_date || '';
        return ad < bd ? 1 : ad > bd ? -1 : 0;
      })[0];

    var flyerCard = mchDashboardCard(
      'event_flyers',
      'Draft flyers',
      String(draftFlyers.length),
      draftFlyers.length ? 'waiting to publish' : 'All caught up',
      'event_flyers'
    );

    var memorialCard = mchDashboardCard(
      'memorials',
      'Memorial tributes',
      String(state.memorials.length),
      draftMemorials.length ? draftMemorials.length + ' draft' + (draftMemorials.length === 1 ? '' : 's') : 'All published',
      'memorials'
    );

    var newsletterCard = mchDashboardCard(
      'newsletter',
      'Newsletter',
      latestNewsletter ? latestNewsletter.title || 'Untitled' : 'None yet',
      latestNewsletter
        ? 'Last issue' + (latestNewsletter.issue_date ? ' - ' + latestNewsletter.issue_date : '')
        : 'Add the first issue',
      'newsletter'
    );

    var weekCard = mchDashboardCard(
      'event_flyers',
      'This week',
      String(upcoming.length),
      upcoming.length ? 'upcoming event' + (upcoming.length === 1 ? '' : 's') : 'Nothing scheduled',
      'event_flyers'
    );

    var upcomingList = '';
    if (upcoming.length) {
      upcomingList =
        '<div class="mch-dashboard-upcoming">' +
        '<h3 class="mch-dashboard-upcoming__title">Coming up this week</h3>' +
        '<ul class="mch-dashboard-upcoming__list">' +
        upcoming
          .map(function (f) {
            return (
              '<li><span class="mch-dashboard-upcoming__date">' +
              esc(f.event_date) +
              '</span><span class="mch-dashboard-upcoming__name">' +
              esc(f.title || 'Untitled') +
              '</span></li>'
            );
          })
          .join('') +
        '</ul></div>';
    }

    return (
      '<div class="mch-dashboard">' +
      '<div class="mch-dashboard-grid">' +
      flyerCard +
      memorialCard +
      newsletterCard +
      weekCard +
      '</div>' +
      upcomingList +
      '</div>'
    );
  }

  function bindHomeDashboardEvents() {
    root.querySelectorAll('[data-action="dashboard-jump"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-jump-tab');
        if (state.tab === 'event_flyers' && !state.calendarPreviewHtml) {
          loadCalendarPreview().then(render);
          return;
        }
        render();
      });
    });
  }

  function renderTabBar() {
    var flyersTab = mchTab('event_flyers', cfg.i18n.eventFlyers);
    var newsTab = mchTab('newsletter', cfg.i18n.newsletter);
    var outcomesTab = mchTab('shelter_outcomes', cfg.i18n.shelterOutcomes);
    var navTab = mchTab('navigation', cfg.i18n.navigation);
    var membershipTab = mchTab('membership', cfg.i18n.membershipPlans);
    var contestTab = mchTab('artwork_contest', cfg.i18n.artworkContest || 'Artwork contest');
    var memorialsTab = mchTab('memorials', cfg.i18n.memorials || 'Memorial tributes');

    if (!cfg.staffMode) {
      return memorialsTab + flyersTab + outcomesTab + navTab + membershipTab + contestTab + newsTab;
    }

    return (
      mchTab('home', 'Home') +
      mchTabGroupLabel('Content') +
      memorialsTab +
      flyersTab +
      newsTab +
      outcomesTab +
      mchTabGroupLabel('Site setup') +
      navTab +
      membershipTab +
      contestTab
    );
  }

  function mchTab(key, label) {
    var icon = MCH_TAB_ICONS[key] || '';
    return (
      '<button type="button" class="mch-tab' +
      (state.tab === key ? ' is-active' : '') +
      '" data-tab="' +
      key +
      '"><span class="mch-tab__icon" aria-hidden="true">' +
      icon +
      '</span><span class="mch-tab__label">' +
      esc(label || '') +
      '</span></button>'
    );
  }

  function render(options) {
    options = options || {};
    if (!options.skipSync && state.tab === 'newsletter' && state.newsletterDraft) {
      syncNewsFromForm();
    }
    destroyBodyEditors();

    var newsList = renderNewsletterList();

    var main =
      state.tab === 'home'
        ? renderHomeDashboard()
        : state.tab === 'memorials'
        ? '<div class="mch-layout">' +
          '<div class="mch-panel"><button type="button" class="button button-primary" data-action="new-memorial" style="width:100%;margin-bottom:0.75rem;">' +
          esc(cfg.i18n.addMemorial || 'Add tribute') +
          '</button>' +
          renderListFilterInput('memorials', state.memorialFilter, 'Search tributes…') +
          '<ul class="mch-list" data-list-for="memorials">' +
          renderMemorialList() +
          '</ul></div><div class="mch-panel" data-editor="memorial">' +
          renderMemorialEditor() +
          '</div></div>'
        : state.tab === 'event_flyers'
        ? '<div class="mch-layout mch-layout--flyers">' +
          '<div class="mch-panel mch-panel--flyer-list"><button type="button" class="button button-primary" data-action="new-flyer" style="width:100%;margin-bottom:0.75rem;">' +
          esc(cfg.i18n.addFlyer) +
          '</button>' +
          renderListFilterInput('event_flyers', state.flyerFilter, 'Search flyers…') +
          '<ul class="mch-list" data-list-for="event_flyers">' +
          renderFlyerList() +
          '</ul></div><div class="mch-panel mch-panel--flyer-main">' +
          '<div class="mch-calendar-preview" data-calendar-preview>' +
          renderCalendarPreviewHtml() +
          '</div>' +
          '<div data-editor="flyer">' +
          renderFlyerEditor() +
          '</div></div></div>'
        : state.tab === 'shelter_outcomes'
          ? renderAccomplishmentsEditor()
          : state.tab === 'navigation'
            ? renderNavigationEditor()
            : state.tab === 'membership'
              ? renderMembershipEditor()
              : state.tab === 'artwork_contest'
                ? renderArtworkContestFlyersEditor()
              : '<div class="mch-layout">' +
          '<div class="mch-panel"><button type="button" class="button button-primary" data-action="new-news" style="width:100%;margin-bottom:0.75rem;">' +
          esc(cfg.i18n.addIssue) +
          '</button>' +
          renderListFilterInput('newsletter', state.newsletterFilter, 'Search issues…') +
          '<ul class="mch-list" data-list-for="newsletter">' +
          newsList +
          '</ul></div><div class="mch-panel" data-editor="news">' +
          renderNewsletterEditor() +
          '</div></div>';

    root.innerHTML =
      renderMigrationBanner() +
      renderHomepageHealthBanner() +
      '<div class="mch-tabs">' +
      renderTabBar() +
      '</div>' +
      '<div class="mch-tab-content">' + renderPanelHeader(state.tab) + main + '</div>';

    bindEvents();
    if (state.tab === 'event_flyers') {
      bindCalendarEvents();
    }
    if (state.tab === 'newsletter' && state.newsletterDraft) {
      populateBodyTextareas();
      initBodyEditors();
    }
    if (state.tab === 'navigation') {
      bindNavEditorEvents();
    }
    if (state.tab === 'membership') {
      bindMembershipEditorEvents();
    }
    if (state.tab === 'artwork_contest') {
      bindArtworkContestFlyersEvents();
    }
  }

  function syncFlyerFromForm() {
    var d = state.flyerDraft;
    if (!d) return;
    root.querySelectorAll('[data-f]').forEach(function (el) {
      d[el.getAttribute('data-f')] = el.value;
    });
  }

  function syncNewsFromForm() {
    var d = state.newsletterDraft;
    if (!d) return;
    root.querySelectorAll('[data-nf]').forEach(function (el) {
      d[el.getAttribute('data-nf')] = el.value;
    });
    root.querySelectorAll('[data-block-field]').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-i'), 10);
      var field = el.getAttribute('data-block-field');
      if (!d.blocks[i]) return;
      if (field !== 'body') {
        d.blocks[i][field] = el.value;
      }
    });
    syncListItemsFromForm();
    (d.blocks || []).forEach(function (block, i) {
      if (block.type !== 'list') {
        d.blocks[i].body = getBodyFieldValue(i);
      }
    });
    ensureNewsletterGallery(d);
    root.querySelectorAll('[data-gallery-alt]').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-gallery-alt'), 10);
      if (d.gallery[i]) {
        d.gallery[i].alt = el.value;
      }
    });
    d.gallery_ids = d.gallery.map(function (g) {
      return g.id;
    });
  }

  function syncMemorialFromForm() {
    var d = state.memorialDraft;
    if (!d) return;
    root.querySelectorAll('[data-m]').forEach(function (el) {
      d[el.getAttribute('data-m')] = el.value;
    });
  }

  function bindMemorialEditorEvents() {
    var saveDraft = root.querySelector('[data-action="save-memorial"]');
    if (saveDraft) {
      saveDraft.addEventListener('click', function () {
        syncMemorialFromForm();
        setStatus(cfg.i18n.loading, true);
        saveMemorial(false)
          .then(render)
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var savePublish = root.querySelector('[data-action="save-memorial-publish"]');
    if (savePublish) {
      savePublish.addEventListener('click', function () {
        syncMemorialFromForm();
        setStatus(cfg.i18n.loading, true);
        saveMemorial(true)
          .then(render)
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var trashMemorial = root.querySelector('[data-action="trash-memorial"]');
    if (trashMemorial) {
      trashMemorial.addEventListener('click', function () {
        syncMemorialFromForm();
        var trashedId = state.memorialDraft.id;
        if (!trashedId) return;
        var trashedTitle = state.memorialDraft.title || 'Untitled';
        setStatus(cfg.i18n.loading, true);
        api('/memorial-tributes/' + trashedId, { method: 'DELETE' })
          .then(function () {
            state.activeMemorialId = null;
            state.memorialDraft = null;
            return loadMemorials();
          })
          .then(function () {
            if (state.memorials.length) {
              state.memorialDraft = Object.assign({}, state.memorials[0]);
              state.activeMemorialId = state.memorials[0].id;
            }
            render();
            setStatusWithAction('Trashed "' + trashedTitle + '".', 'Undo', function () {
              restoreMemorialTribute(trashedId);
            });
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }
  }

  function restoreMemorialTribute(id) {
    setStatus(cfg.i18n.loading, true);
    api('/memorial-tributes/' + id + '/restore', { method: 'POST' })
      .then(function (restored) {
        return loadMemorials().then(function () {
          state.memorialDraft = Object.assign({}, restored);
          state.activeMemorialId = restored.id;
          render();
          setStatus(cfg.i18n.saved, true);
        });
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  function bindFlyerEditorEvents() {
    var flyerImg = root.querySelector('[data-action="flyer-image"]');
    if (flyerImg) {
      flyerImg.addEventListener('click', function () {
        pickMedia(cfg.i18n.heroImage).then(applyFlyerImagePick);
      });
    }

    var flyerRemoveImg = root.querySelector('[data-action="flyer-remove-image"]');
    if (flyerRemoveImg) {
      flyerRemoveImg.addEventListener('click', function () {
        syncFlyerFromForm();
        if (!state.flyerDraft) {
          state.flyerDraft = emptyFlyer();
        }
        state.flyerDraft.thumbnail_id = null;
        state.flyerDraft.thumbnail_url = null;
        refreshFlyerEditorPanel();
      });
    }

    var saveDraft = root.querySelector('[data-action="save-flyer"]');
    if (saveDraft) {
      saveDraft.addEventListener('click', function () {
        syncFlyerFromForm();
        setStatus(cfg.i18n.loading, true);
        saveFlyer(false)
          .then(render)
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var savePublish = root.querySelector('[data-action="save-flyer-publish"]');
    if (savePublish) {
      savePublish.addEventListener('click', function () {
        syncFlyerFromForm();
        setStatus(cfg.i18n.loading, true);
        saveFlyer(true)
          .then(render)
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var trashFlyer = root.querySelector('[data-action="trash-flyer"]');
    if (trashFlyer) {
      trashFlyer.addEventListener('click', function () {
        syncFlyerFromForm();
        var trashedId = state.flyerDraft.id;
        if (!trashedId) return;
        var trashedTitle = state.flyerDraft.title || 'Untitled';
        setStatus(cfg.i18n.loading, true);
        api('/event-flyers/' + trashedId, { method: 'DELETE' })
          .then(function () {
            state.activeFlyerId = null;
            state.flyerDraft = null;
            return loadFlyers().then(loadCalendarPreview);
          })
          .then(function () {
            if (state.flyers.length) {
              state.flyerDraft = Object.assign({}, state.flyers[0]);
              state.activeFlyerId = state.flyers[0].id;
            }
            render();
            setStatusWithAction('Trashed "' + trashedTitle + '".', 'Undo', function () {
              restoreEventFlyer(trashedId);
            });
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }
  }

  function restoreEventFlyer(id) {
    setStatus(cfg.i18n.loading, true);
    api('/event-flyers/' + id + '/restore', { method: 'POST' })
      .then(function (restored) {
        return loadFlyers()
          .then(loadCalendarPreview)
          .then(function () {
            state.flyerDraft = Object.assign({}, restored);
            state.activeFlyerId = restored.id;
            render();
            setStatus(cfg.i18n.saved, true);
          });
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  /* Extracted from bindEvents() so the list-filter refresh (which only
     replaces the <ul>, not the whole tab) can re-bind just these
     handlers without re-running the rest of bindEvents() and attaching
     duplicate listeners to elements that were never removed. */
  function bindMemorialListEvents() {
    root.querySelectorAll('[data-memorial-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-memorial-id'), 10);
        state.activeMemorialId = id;
        var found = state.memorials.find(function (m) {
          return m.id === id;
        });
        state.memorialDraft = found ? Object.assign({}, found) : emptyMemorial();
        render();
      });
    });
  }

  function bindFlyerListEvents() {
    root.querySelectorAll('[data-action="flyer-up"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.disabled) return;
        moveFlyer(parseInt(btn.getAttribute('data-flyer-id'), 10), 'up');
      });
    });

    root.querySelectorAll('[data-action="flyer-down"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.disabled) return;
        moveFlyer(parseInt(btn.getAttribute('data-flyer-id'), 10), 'down');
      });
    });

    root.querySelectorAll('[data-flyer-id]').forEach(function (btn) {
      if (btn.getAttribute('data-action')) return;
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-flyer-id'), 10);
        state.activeFlyerId = id;
        var found = state.flyers.find(function (f) {
          return f.id === id;
        });
        state.flyerDraft = found ? Object.assign({}, found) : emptyFlyer();
        render();
      });
    });
  }

  function bindNewsListEvents() {
    root.querySelectorAll('[data-news-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var id = parseInt(btn.getAttribute('data-news-id'), 10);
        state.activeNewsletterId = id;
        var found = state.newsletters.find(function (n) {
          return n.id === id;
        });
        state.newsletterDraft = found ? JSON.parse(JSON.stringify(found)) : emptyNewsletter();
        ensureNewsletterGallery(state.newsletterDraft);
        render();
      });
    });
  }

  function refreshListPanel(key) {
    var ul = root.querySelector('[data-list-for="' + key + '"]');
    if (!ul) {
      return;
    }
    if (key === 'memorials') {
      ul.innerHTML = renderMemorialList();
      bindMemorialListEvents();
    } else if (key === 'event_flyers') {
      ul.innerHTML = renderFlyerList();
      bindFlyerListEvents();
    } else if (key === 'newsletter') {
      ul.innerHTML = renderNewsletterList();
      bindNewsListEvents();
    }
  }

  function bindListFilterEvents() {
    root.querySelectorAll('[data-list-filter]').forEach(function (input) {
      input.addEventListener('input', function () {
        var key = input.getAttribute('data-list-filter');
        if (key === 'memorials') {
          state.memorialFilter = input.value;
        } else if (key === 'event_flyers') {
          state.flyerFilter = input.value;
        } else if (key === 'newsletter') {
          state.newsletterFilter = input.value;
        }
        refreshListPanel(key);
      });
    });
  }

  function bindEvents() {
    bindListFilterEvents();
    bindHomeDashboardEvents();

    root.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncActiveTabFromForm();
        var nextTab = btn.getAttribute('data-tab');
        state.tab = nextTab;
        if (nextTab === 'event_flyers' && !state.calendarPreviewHtml) {
          loadCalendarPreview().then(render);
          return;
        }
        if (nextTab === 'navigation' && !state.navConfig) {
          loadNavigation().then(render);
          return;
        }
        if (nextTab === 'membership' && !state.membershipConfig) {
          loadMembership().then(render);
          return;
        }
        if (nextTab === 'artwork_contest' && !state.artworkContestFlyers) {
          loadArtworkContestFlyers().then(render);
          return;
        }
        if (nextTab === 'memorials' && !state.memorials.length) {
          loadMemorials().then(render);
          return;
        }
        render();
      });
    });

    var saveOutcomes = root.querySelector('[data-action="save-outcomes"]');
    if (saveOutcomes) {
      saveOutcomes.addEventListener('click', function () {
        saveAccomplishments().then(render);
      });
    }

    var addOutcomeYear = root.querySelector('[data-action="add-outcome-year"]');
    if (addOutcomeYear) {
      addOutcomeYear.addEventListener('click', function () {
        syncAccomplishmentsFromForm();
        var year = String(new Date().getFullYear());
        while (state.accomplishmentsYears[year]) {
          year = String(parseInt(year, 10) - 1);
        }
        state.accomplishmentsYears[year] = { adoptions: 0, return_to_owner: 0, intakes: 0 };
        render();
      });
    }

    root.querySelectorAll('[data-action="remove-outcome-year"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('[data-outcome-year]');
        if (!row) {
          return;
        }
        syncAccomplishmentsFromForm();
        delete state.accomplishmentsYears[row.getAttribute('data-outcome-year')];
        if (Object.keys(state.accomplishmentsYears).length === 0) {
          state.accomplishmentsYears = { 2024: { adoptions: 433, return_to_owner: 0, intakes: 510 } };
        }
        render();
      });
    });

    var repairBtn = root.querySelector('[data-action="repair-migration"]');
    if (repairBtn) {
      repairBtn.addEventListener('click', function () {
        setStatus(cfg.i18n.loading, true);
        api('/newsletters/repair-migration', { method: 'POST' })
          .then(function (result) {
            state.migrationStatus = result.status || state.migrationStatus;
            setStatus(result.message || cfg.i18n.saved, !!result.ok);
            return Promise.all([loadNewsletters(), loadMigrationStatus()]);
          })
          .then(function () {
            if (state.newsletters.length) {
              state.newsletterDraft = JSON.parse(JSON.stringify(state.newsletters[0]));
              state.activeNewsletterId = state.newsletters[0].id;
              ensureNewsletterGallery(state.newsletterDraft);
            }
            render();
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    bindFlyerListEvents();
    bindNewsListEvents();

    var newFlyer = root.querySelector('[data-action="new-flyer"]');
    if (newFlyer) {
      newFlyer.addEventListener('click', function () {
        state.flyerDraft = emptyFlyer();
        state.activeFlyerId = null;
        render();
      });
    }

    var newMemorial = root.querySelector('[data-action="new-memorial"]');
    if (newMemorial) {
      newMemorial.addEventListener('click', function () {
        state.memorialDraft = emptyMemorial();
        state.activeMemorialId = null;
        render();
      });
    }

    bindMemorialListEvents();

    bindMemorialEditorEvents();

    var newNews = root.querySelector('[data-action="new-news"]');
    if (newNews) {
      newNews.addEventListener('click', function () {
        state.newsletterDraft = emptyNewsletter();
        state.activeNewsletterId = null;
        render();
      });
    }

    bindFlyerEditorEvents();

    var newsHero = root.querySelector('[data-action="news-hero"]');
    if (newsHero) {
      newsHero.addEventListener('click', function () {
        syncNewsFromForm();
        pickMedia(cfg.i18n.heroImage).then(function (picked) {
          if (picked) {
            state.newsletterDraft.thumbnail_id = picked.id;
            state.newsletterDraft.thumbnail_url = picked.url;
            setStatus(cfg.i18n.imageSelected, true);
            render();
          }
        });
      });
    }

    var newsRemoveHero = root.querySelector('[data-action="news-remove-hero"]');
    if (newsRemoveHero) {
      newsRemoveHero.addEventListener('click', function () {
        syncNewsFromForm();
        state.newsletterDraft.thumbnail_id = null;
        state.newsletterDraft.thumbnail_url = null;
        render();
      });
    }

    var newsGal = root.querySelector('[data-action="news-gallery"]');
    if (newsGal) {
      newsGal.addEventListener('click', function () {
        syncNewsFromForm();
        pickGallery().then(function (items) {
          if (items && items.length) {
            state.newsletterDraft.gallery = (state.newsletterDraft.gallery || []).concat(items);
            ensureNewsletterGallery(state.newsletterDraft);
            render();
          }
        });
      });
    }

    root.querySelectorAll('[data-action="gallery-remove"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var i = parseInt(btn.getAttribute('data-i'), 10);
        state.newsletterDraft.gallery.splice(i, 1);
        ensureNewsletterGallery(state.newsletterDraft);
        render();
      });
    });

    root.querySelectorAll('[data-action="gallery-up"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var i = parseInt(btn.getAttribute('data-i'), 10);
        var g = state.newsletterDraft.gallery;
        if (i <= 0) return;
        var tmp = g[i];
        g[i] = g[i - 1];
        g[i - 1] = tmp;
        ensureNewsletterGallery(state.newsletterDraft);
        render();
      });
    });

    root.querySelectorAll('[data-action="gallery-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var i = parseInt(btn.getAttribute('data-i'), 10);
        var g = state.newsletterDraft.gallery;
        if (i >= g.length - 1) return;
        var tmp = g[i];
        g[i] = g[i + 1];
        g[i + 1] = tmp;
        ensureNewsletterGallery(state.newsletterDraft);
        render();
      });
    });

    var addLetter = root.querySelector('[data-action="add-letter"]');
    if (addLetter) {
      addLetter.addEventListener('click', function () {
        syncNewsFromForm();
        state.newsletterDraft.blocks.push({ type: 'letter', title: '', body: '', items: [] });
        render({ skipSync: true });
      });
    }

    var addList = root.querySelector('[data-action="add-list"]');
    if (addList) {
      addList.addEventListener('click', function () {
        syncNewsFromForm();
        state.newsletterDraft.blocks.push({ type: 'list', title: '', body: '', items: [''] });
        render({ skipSync: true });
      });
    }

    root.querySelectorAll('[data-action="add-list-item"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var blockIndex = parseInt(btn.getAttribute('data-block-i'), 10);
        if (!state.newsletterDraft.blocks[blockIndex]) {
          return;
        }
        if (!state.newsletterDraft.blocks[blockIndex].items) {
          state.newsletterDraft.blocks[blockIndex].items = [];
        }
        state.newsletterDraft.blocks[blockIndex].items.push('');
        render({ skipSync: true });
      });
    });

    root.querySelectorAll('[data-action="remove-list-item"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var blockIndex = parseInt(btn.getAttribute('data-block-i'), 10);
        var itemIndex = parseInt(btn.getAttribute('data-item-i'), 10);
        var items = state.newsletterDraft.blocks[blockIndex].items || [];
        if (items.length <= 1) {
          items[0] = '';
        } else {
          items.splice(itemIndex, 1);
        }
        state.newsletterDraft.blocks[blockIndex].items = items;
        render({ skipSync: true });
      });
    });

    root.querySelectorAll('[data-action="list-item-up"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) {
          return;
        }
        syncNewsFromForm();
        var blockIndex = parseInt(btn.getAttribute('data-block-i'), 10);
        var itemIndex = parseInt(btn.getAttribute('data-item-i'), 10);
        var items = state.newsletterDraft.blocks[blockIndex].items || [];
        if (itemIndex <= 0) {
          return;
        }
        var tmp = items[itemIndex];
        items[itemIndex] = items[itemIndex - 1];
        items[itemIndex - 1] = tmp;
        render({ skipSync: true });
      });
    });

    root.querySelectorAll('[data-action="list-item-down"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) {
          return;
        }
        syncNewsFromForm();
        var blockIndex = parseInt(btn.getAttribute('data-block-i'), 10);
        var itemIndex = parseInt(btn.getAttribute('data-item-i'), 10);
        var items = state.newsletterDraft.blocks[blockIndex].items || [];
        if (itemIndex >= items.length - 1) {
          return;
        }
        var tmp = items[itemIndex];
        items[itemIndex] = items[itemIndex + 1];
        items[itemIndex + 1] = tmp;
        render({ skipSync: true });
      });
    });

    root.querySelectorAll('[data-action="remove-block"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncNewsFromForm();
        var i = parseInt(btn.getAttribute('data-i'), 10);
        state.newsletterDraft.blocks.splice(i, 1);
        render({ skipSync: true });
      });
    });

    bindBlockDragDrop();

    function bindSave(sel, publish, syncFn, saveFn) {
      var el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener('click', function () {
        syncFn();
        setStatus(cfg.i18n.loading, true);
        saveFn(publish)
          .then(render)
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    bindSave('[data-action="save-news"]', false, syncNewsFromForm, saveNewsletter);
    bindSave('[data-action="save-news-publish"]', true, syncNewsFromForm, saveNewsletter);

    var feat = root.querySelector('[data-action="feature-news"]');
    if (feat) {
      feat.addEventListener('click', function () {
        syncNewsFromForm();
        saveNewsletter(true)
          .then(function () {
            return api('/newsletters/' + state.newsletterDraft.id + '/featured', { method: 'POST' });
          })
          .then(function (saved) {
            state.newsletterDraft = saved;
            ensureNewsletterGallery(state.newsletterDraft);
            if (saved.home_mirror_warning) {
              setStatus(saved.home_mirror_warning, false);
            } else {
              setStatus(cfg.i18n.saved, true);
            }
            return Promise.all([loadNewsletters(), loadHomepageHealth()]).then(render);
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var resetMirror = root.querySelector('[data-action="reset-home-mirror"]');
    if (resetMirror) {
      resetMirror.addEventListener('click', function () {
        if (!window.confirm('Show the original reference newsletter layout on the homepage again?')) {
          return;
        }
        api('/newsletters/clear-home-mirror', { method: 'POST' })
          .then(function (health) {
            state.homepageHealth = health;
            setStatus(cfg.i18n.saved, true);
            render();
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }

    var trashNews = root.querySelector('[data-action="trash-news"]');
    if (trashNews) {
      trashNews.addEventListener('click', function () {
        syncNewsFromForm();
        var trashedId = state.newsletterDraft.id;
        if (!trashedId) return;
        var trashedTitle = state.newsletterDraft.title || 'Untitled';
        var wasFeatured = !!state.newsletterDraft.featured;
        setStatus(cfg.i18n.loading, true);
        api('/newsletters/' + trashedId, { method: 'DELETE' })
          .then(function () {
            state.activeNewsletterId = null;
            state.newsletterDraft = null;
            return loadNewsletters();
          })
          .then(function () {
            if (state.newsletters.length) {
              state.newsletterDraft = JSON.parse(JSON.stringify(state.newsletters[0]));
              state.activeNewsletterId = state.newsletters[0].id;
              ensureNewsletterGallery(state.newsletterDraft);
            }
            return loadMigrationStatus();
          })
          .then(function () {
            render();
            setStatusWithAction(
              wasFeatured
                ? 'Trashed "' + trashedTitle + '" - it was on the homepage.'
                : 'Trashed "' + trashedTitle + '".',
              'Undo',
              function () {
                restoreNewsletter(trashedId);
              }
            );
          })
          .catch(function () {
            setStatus(cfg.i18n.error, false);
          });
      });
    }
  }

  function restoreNewsletter(id) {
    setStatus(cfg.i18n.loading, true);
    api('/newsletters/' + id + '/restore', { method: 'POST' })
      .then(function (restored) {
        return loadNewsletters().then(function () {
          state.newsletterDraft = JSON.parse(JSON.stringify(restored));
          state.activeNewsletterId = restored.id;
          ensureNewsletterGallery(state.newsletterDraft);
          render();
          setStatus(cfg.i18n.saved, true);
        });
      })
      .catch(function () {
        setStatus(cfg.i18n.error, false);
      });
  }

  root.innerHTML = '<p>' + esc(cfg.i18n.loading) + '</p>';
  Promise.all([
    loadFlyers(),
    loadMemorials(),
    loadNewsletters(),
    loadMigrationStatus(),
    loadHomepageHealth(),
    loadCalendarPreview(),
    loadAccomplishments(),
    loadNavigation(),
    loadMembership(),
    loadArtworkContestFlyers()
  ])
    .then(function () {
      if (!state.flyerDraft && state.flyers.length) {
        state.flyerDraft = Object.assign({}, state.flyers[0]);
        state.activeFlyerId = state.flyers[0].id;
      }
      if (!state.memorialDraft && state.memorials.length) {
        state.memorialDraft = Object.assign({}, state.memorials[0]);
        state.activeMemorialId = state.memorials[0].id;
      }
      if (!state.newsletterDraft && state.newsletters.length) {
        state.newsletterDraft = JSON.parse(JSON.stringify(state.newsletters[0]));
        ensureNewsletterGallery(state.newsletterDraft);
        state.activeNewsletterId = state.newsletters[0].id;
      }
    })
    .then(function () {
      render();
    })
    .catch(function () {
      root.innerHTML = '<p class="mch-status mch-status--err">' + esc(cfg.i18n.error) + '</p>';
    });
})();
