(function () {
  var data = window.monroeRebuildData || {};
  var pageMap = data.pageMap || {};
  var legacyFallbacks = data.legacyFallbacks || {};

  function normalizeKey(input) {
    if (!input) {
      return null;
    }

    var value = String(input).trim();
    if (!value || value === '#') {
      return null;
    }

    // Fragment-only anchors (#section) are in-page links, not legacy route aliases.
    if (value.charAt(0) === '#') {
      return null;
    }

    var fragment = '';
    var hashIndex = value.indexOf('#');
    if (hashIndex >= 0) {
      fragment = value.slice(hashIndex + 1);
      value = value.slice(0, hashIndex);
    }

    if (/^https?:\/\//i.test(value)) {
      try {
        var parsed = new URL(value);
        var host = parsed.hostname.replace(/^www\./i, '');
        if (host !== 'monroe-humane.org' && host !== window.location.hostname.replace(/^www\./i, '')) {
          return null;
        }
        value = (parsed.pathname || '/').replace(/^\/+/, '') || 'home';
        if (parsed.search) {
          value += parsed.search;
        }
      } catch (error) {
        return null;
      }
    } else {
      value = value.replace(/^\/+/, '') || 'home';
      value = value.replace(/index\.html$/i, '').replace(/\/+$/, '') || 'home';
    }

    return {
      key: decodeURIComponent(value),
      fragment: fragment
    };
  }

  function resolveInternal(input) {
    var normalized = normalizeKey(input);
    if (!normalized) {
      return null;
    }

    var permalink = pageMap[normalized.key] || pageMap['/' + normalized.key];
    if (!permalink) {
      permalink = legacyFallbacks[normalized.key] || legacyFallbacks['/' + normalized.key] || null;
    }
    if (!permalink) {
      return null;
    }

    return normalized.fragment ? permalink + '#' + normalized.fragment : permalink;
  }

  function fixKnownAssetPath(href) {
    if (!href) {
      return href;
    }

    return href.replace(
      'Adoption_Application_2020_%28002%29.pdf',
      'Adoption_Application_2020_%2528002%2529.pdf'
    );
  }

  function fixLinks(root) {
    root.querySelectorAll('a').forEach(function (link) {
      var alias = link.getAttribute('data-target-page-alias');
      var resolved = resolveInternal(alias);
      if (!resolved) {
        resolved = resolveInternal(link.getAttribute('href'));
      }

      if (!resolved && link.getAttribute('link_type') === 'popup') {
        link.setAttribute('href', '#');
        link.addEventListener('click', function (event) {
          event.preventDefault();
        });
        return;
      }

      if (!resolved) {
        var fixedAssetHref = fixKnownAssetPath(link.getAttribute('href'));
        if (fixedAssetHref && fixedAssetHref !== link.getAttribute('href')) {
          link.setAttribute('href', fixedAssetHref);
        }
        return;
      }

      link.setAttribute('href', resolved);
      if (resolved === '#') {
        link.addEventListener('click', function (event) {
          event.preventDefault();
        });
      }
      if (link.getAttribute('target') === '_blank' && resolved.charAt(0) === '/') {
        link.removeAttribute('target');
      }
    });
  }

  function bindMobileMenus(root) {
    var docRef = root.nodeType === 9 ? root : root.ownerDocument || document;
    var mobileQuery = monroeGlobalNavDrawerMediaQuery(docRef);
    root.querySelectorAll('.unifiednav__item_has-sub-nav').forEach(function (trigger) {
      var wrap = trigger.closest('.unifiednav__item-wrap');
      if (!wrap) {
        return;
      }

      var submenu = wrap.querySelector('.unifiednav__container_sub-nav');
      if (!submenu) {
        return;
      }

      trigger.addEventListener('click', function (event) {
        if (!mobileQuery.matches) {
          return;
        }

        event.preventDefault();
        root.querySelectorAll('.unifiednav__item-wrap.is-open').forEach(function (openWrap) {
          if (openWrap !== wrap) {
            openWrap.classList.remove('is-open');
          }
        });
        wrap.classList.toggle('is-open');
      });
    });
  }

  function ensureResponsiveMedia(root) {
    root.querySelectorAll('img[width]').forEach(function (img) {
      if (!img.style.maxWidth) {
        img.style.maxWidth = '100%';
      }
      img.style.height = 'auto';
    });
  }

  /** PayPal Giving: defer heavy campaign iframes until the donations band is near the viewport. */
  function initPayPalGivingLoaders(root) {
    if (!root || !root.querySelector) {
      return;
    }

    var bands = root.querySelectorAll('.home-editable-paypal-giving');
    if (!bands.length) {
      return;
    }

    function paypalEmbedSrc(iframe) {
      return iframe.getAttribute('data-src') || iframe.getAttribute('src') || '';
    }

    function ensureLoaderFallback(loader, embedSrc) {
      if (!loader || !embedSrc || loader.querySelector('.pp-loader-fallback')) {
        return;
      }
      var link = document.createElement('a');
      link.className = 'pp-loader-fallback';
      link.href = embedSrc;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open secure donation in PayPal';
      loader.appendChild(link);
    }

    function wirePayPalIframe(iframe) {
      if (!iframe.id || iframe.dataset.monroePaypalWired === '1') {
        return null;
      }
      var embedSrc = paypalEmbedSrc(iframe);
      if (!embedSrc) {
        return null;
      }

      var suffix = iframe.id.replace(/^pp-iframe-/, '');
      var loader = document.getElementById('pp-loader-' + suffix);
      if (!loader) {
        return null;
      }

      iframe.dataset.monroePaypalWired = '1';
      iframe.setAttribute('data-src', embedSrc);
      iframe.removeAttribute('src');

      ensureLoaderFallback(loader, embedSrc);

      function hideLoader() {
        if (loader.classList.contains('hidden')) {
          return;
        }
        loader.classList.add('hidden');
        loader.setAttribute('aria-hidden', 'true');
      }

      function activateIframe() {
        if (iframe.dataset.monroePaypalActivated === '1') {
          return;
        }
        iframe.dataset.monroePaypalActivated = '1';
        iframe.addEventListener('load', function () {
          window.setTimeout(hideLoader, 400);
        });
        iframe.src = embedSrc;
        // Cross-origin load often never fires; still reveal after a cap.
        window.setTimeout(hideLoader, 8000);
      }

      return activateIframe;
    }

    function isPayPalBandNearViewport(band) {
      var rect = band.getBoundingClientRect();
      var margin = 320;
      return rect.top < window.innerHeight + margin && rect.bottom > -margin;
    }

    function loadPayPalBand(band) {
      if (!band || band.dataset.monroePaypalBandLoaded === '1') {
        return;
      }
      band.dataset.monroePaypalBandLoaded = '1';

      var activators = [];
      band.querySelectorAll('iframe[id^="pp-iframe-"]').forEach(function (iframe) {
        var activate = wirePayPalIframe(iframe);
        if (activate) {
          activators.push(activate);
        }
      });

      activators.forEach(function (activate, index) {
        window.setTimeout(activate, index * 500);
      });
    }

    bands.forEach(function (band) {
      if (band.dataset.monroePaypalBandLoaded === '1' || band.dataset.monroePaypalBandObserved === '1') {
        return;
      }
      band.dataset.monroePaypalBandObserved = '1';

      if (isPayPalBandNearViewport(band)) {
        loadPayPalBand(band);
        return;
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) {
                return;
              }
              loadPayPalBand(entry.target);
              observer.unobserve(entry.target);
            });
          },
          { root: null, rootMargin: '320px 0px', threshold: 0.01 }
        );
        observer.observe(band);
        return;
      }

      loadPayPalBand(band);
    });
  }

  /** Shared viewport observer for heavy homepage embeds (Facebook, Elfsight, featured pets). */
  function monroeIsNearViewport(el, marginPx) {
    if (!el || !el.getBoundingClientRect) {
      return false;
    }
    marginPx = marginPx || 320;
    var rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight + marginPx && rect.bottom > -marginPx;
  }

  function monroeObserveLazyBand(root, selector, onActivate) {
    if (!root || !root.querySelectorAll || typeof onActivate !== 'function') {
      return;
    }
    root.querySelectorAll(selector).forEach(function (band) {
      if (band.dataset.monroeLazyObserved === '1') {
        return;
      }
      band.dataset.monroeLazyObserved = '1';

      function activate() {
        if (band.dataset.monroeLazyActivated === '1') {
          return;
        }
        band.dataset.monroeLazyActivated = '1';
        onActivate(band);
      }

      if (monroeIsNearViewport(band)) {
        activate();
        return;
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) {
                return;
              }
              activate();
              observer.unobserve(entry.target);
            });
          },
          { root: null, rootMargin: '320px 0px', threshold: 0.01 }
        );
        observer.observe(band);
        return;
      }

      activate();
    });
  }

  // The Facebook Page plugin renders at a FIXED pixel width (max 500) baked into its URL.
  // To avoid a clipped/"zoomed in" feed on mobile or blank gutters on desktop, the iframe
  // element width must equal that URL width. We measure the container, clamp to FB's usable
  // range, then size both the iframe and the embed URL to match. Re-fits on significant resize.
  function buildFacebookSrc(href, width, height, hideCover, smallHeader) {
    return (
      'https://www.facebook.com/plugins/page.php?href=' +
      encodeURIComponent(href) +
      '&tabs=timeline&width=' +
      width +
      '&height=' +
      height +
      '&small_header=' +
      (smallHeader ? 'true' : 'false') +
      '&adapt_container_width=true&hide_cover=' +
      (hideCover ? 'true' : 'false') +
      '&show_facepile=false'
    );
  }

  function facebookEmbedIsMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function fitFacebookEmbed(band, force) {
    var iframe = band.querySelector('.home-editable-social-embed__iframe');
    var viewport = band.querySelector('.home-editable-social-embed__viewport');
    if (!iframe || !viewport) {
      return;
    }

    var mobile = facebookEmbedIsMobile();
    var frameEl = band.querySelector('.home-editable-social-embed__frame') || band;
    var avail = Math.floor(frameEl.getBoundingClientRect().width || 500);
    if (avail <= 0) {
      avail = mobile ? 340 : 500;
    }

    // FB Page plugin: 180–500px. Use full 500 on desktop so long page names fit;
    // on mobile use the full container width (capped at 500).
    var width = mobile ? Math.max(300, Math.min(500, avail)) : 500;
    var viewportH = window.innerHeight || 800;
    // Full header (not small_header) needs ~130px for name + Follow + follower count.
    var headerAllowance = 130;
    var hideCover = true;
    var smallHeader = false;
    var height;

    if (mobile) {
      height = Math.round(
        Math.min(headerAllowance + 460, Math.max(headerAllowance + 380, viewportH * 0.62))
      );
    } else {
      height = Math.round(
        Math.min(headerAllowance + 560, Math.max(headerAllowance + 500, viewportH * 0.78))
      );
    }

    var prev = parseInt(iframe.getAttribute('data-fb-width') || '0', 10);
    var prevH = parseInt(iframe.getAttribute('data-fb-height') || '0', 10);
    var prevHide = iframe.getAttribute('data-fb-hide-cover') || '';
    var prevSmall = iframe.getAttribute('data-fb-small-header') || '';
    var hideStr = hideCover ? '1' : '0';
    var smallStr = smallHeader ? '1' : '0';

    if (
      !force &&
      iframe.dataset.fbLoaded === '1' &&
      Math.abs(prev - width) < 12 &&
      Math.abs(prevH - height) < 24 &&
      prevHide === hideStr &&
      prevSmall === smallStr
    ) {
      return;
    }

    var href = iframe.getAttribute('data-fb-href') || 'https://www.facebook.com/adopthsmc';
    band.classList.add('is-loading');
    band.setAttribute('aria-busy', 'true');
    iframe.style.width = width + 'px';
    iframe.style.height = height + 'px';
    iframe.style.maxWidth = '100%';
    viewport.style.minHeight = height + 'px';
    viewport.style.height = height + 'px';
    iframe.setAttribute('data-fb-width', String(width));
    iframe.setAttribute('data-fb-height', String(height));
    iframe.setAttribute('data-fb-hide-cover', hideStr);
    iframe.setAttribute('data-fb-small-header', smallStr);

    iframe.onload = function () {
      band.classList.remove('is-loading');
      band.removeAttribute('aria-busy');
      iframe.dataset.fbLoaded = '1';
    };

    iframe.src = buildFacebookSrc(href, width, height, hideCover, smallHeader);
  }

  function initFacebookEmbed(band) {
    if (!band || band.dataset.fbInit === '1') {
      return;
    }
    band.dataset.fbInit = '1';
    fitFacebookEmbed(band, true);

    var viewport = band.querySelector('.home-editable-social-embed__viewport');
    var resizeTimer = null;

    function scheduleFit() {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(function () {
        fitFacebookEmbed(band, false);
      }, 200);
    }

    window.addEventListener('resize', scheduleFit);

    if (viewport && 'ResizeObserver' in window) {
      var ro = new ResizeObserver(scheduleFit);
      ro.observe(viewport);
    }
  }

  function initLazyHomeEmbeds(root) {
    if (!root || !root.querySelector) {
      return;
    }

    monroeObserveLazyBand(root, '.home-editable-social-embed', function (band) {
      initFacebookEmbed(band);
    });

    monroeObserveLazyBand(root, '#FeaturedPets', function () {
      document.dispatchEvent(new CustomEvent('monroe:load-featured-pets'));
    });

    monroeObserveLazyBand(root, '#featuredPetsWidget', function () {
      document.dispatchEvent(new CustomEvent('monroe:load-featured-pets'));
    });
  }

  /** Max width (px) for Monroe global nav drawer; mirrors `data-monroe-nav-drawer-max` from PHP. */
  function monroeReadNavDrawerMaxPx(doc) {
    if (!doc || !doc.querySelector) {
      return 1200;
    }
    var el = doc.querySelector('[data-monroe-global-nav]');
    if (!el) {
      return 1200;
    }
    var raw = el.getAttribute('data-monroe-nav-drawer-max');
    if (!raw) {
      return 1200;
    }
    var n = parseInt(raw, 10);
    return n > 0 ? n : 1200;
  }

  function monroeGlobalNavDrawerMediaQuery(doc) {
    var max = monroeReadNavDrawerMaxPx(doc);
    return window.matchMedia('(max-width: ' + max + 'px)');
  }

  function bindGlobalNav(root) {
    var nav = root.querySelector('[data-monroe-global-nav]');
    if (!nav) {
      return;
    }

    var navPanel = nav.querySelector('#monroe-global-nav-menu') || nav.querySelector('.monroe-global-nav__panel');
    var menuToggle = nav.querySelector('.monroe-global-nav__menu-toggle');
    var docRef = root.nodeType === 9 ? root : root.ownerDocument || document;
    var mobileQuery = monroeGlobalNavDrawerMediaQuery(docRef);
    var supportsInert = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

    /** Mobile accordions collapse with max-height - keep focus/tab order aligned with what's visible */
    function syncDropdownInert() {
      if (!supportsInert) {
        return;
      }
      nav.querySelectorAll('.monroe-global-nav__dropdown').forEach(function (dd) {
        dd.inert = false;
      });

      if (!mobileQuery.matches) {
        return;
      }

      nav.querySelectorAll('.monroe-global-nav__item.has-children').forEach(function (item) {
        var dd = item.querySelector(':scope > .monroe-global-nav__dropdown');
        if (!dd) {
          return;
        }
        dd.inert = !item.classList.contains('is-open');
      });
    }

    var navBackdrop = nav.querySelector('.monroe-global-nav__backdrop');

    function syncNavBackdrop(drawerOpen) {
      if (!navBackdrop) {
        return;
      }
      if (!mobileQuery.matches || !drawerOpen) {
        navBackdrop.setAttribute('hidden', '');
      } else {
        navBackdrop.removeAttribute('hidden');
      }
    }

    function closeMobileDrawer(focusToggle) {
      nav.classList.remove('is-open');
      if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        if (focusToggle && typeof menuToggle.focus === 'function') {
          menuToggle.focus();
        }
      }
      syncMobileNavPanelAccessibility();
    }

    function syncMobileNavPanelAccessibility() {
      if (!navPanel) {
        syncDropdownInert();
        syncNavBackdrop(false);
        return;
      }
      if (!mobileQuery.matches) {
        navPanel.removeAttribute('aria-hidden');
        if (supportsInert) {
          navPanel.inert = false;
        }
        document.body.style.removeProperty('overflow');
        syncNavBackdrop(false);
        syncDropdownInert();
        return;
      }
      var drawerOpen = nav.classList.contains('is-open');
      if (drawerOpen) {
        navPanel.setAttribute('aria-hidden', 'false');
        if (supportsInert) {
          navPanel.inert = false;
        }
        document.body.style.overflow = 'hidden';
      } else {
        navPanel.setAttribute('aria-hidden', 'true');
        if (supportsInert) {
          navPanel.inert = true;
        }
        document.body.style.removeProperty('overflow');
      }
      syncNavBackdrop(drawerOpen);
      syncDropdownInert();
    }

    if (navBackdrop) {
      navBackdrop.addEventListener('click', function () {
        if (mobileQuery.matches && nav.classList.contains('is-open')) {
          closeMobileDrawer(true);
        }
      });
    }

    if (menuToggle) {
      menuToggle.addEventListener('click', function () {
        var isOpen = nav.classList.toggle('is-open');
        menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        syncMobileNavPanelAccessibility();
        if (isOpen && navPanel && mobileQuery.matches) {
          window.requestAnimationFrame(function () {
            var first = navPanel.querySelector('a.monroe-global-nav__link, button.monroe-global-nav__trigger');
            if (first && typeof first.focus === 'function') {
              first.focus();
            }
          });
        }
      });
    }

    if (navPanel) {
      navPanel.addEventListener('click', function (event) {
        if (!mobileQuery.matches) {
          return;
        }
        var link = event.target.closest(
          'a.monroe-global-nav__link, a.monroe-global-nav__dropdown-link, a.monroe-global-nav__member, a.monroe-global-nav__donate, a.monroe-global-nav__call'
        );
        if (!link || link.getAttribute('href') === '#') {
          return;
        }
        nav.classList.remove('is-open');
        if (menuToggle) {
          menuToggle.setAttribute('aria-expanded', 'false');
        }
        syncMobileNavPanelAccessibility();
      });
    }

    function resetNavDropdownInlineStyles() {
      nav.querySelectorAll('.monroe-global-nav__dropdown').forEach(function (dd) {
        dd.style.removeProperty('max-height');
      });
      nav.querySelectorAll('.monroe-global-nav__item.has-children').forEach(function (li) {
        li.style.removeProperty('--monroe-nav-dropdown-max');
      });
    }

    function setDropdownMaxHeight(item, dropdown, isOpen) {
      if (!item || !dropdown) return;
      if (!mobileQuery.matches) {
        dropdown.style.removeProperty('max-height');
        item.style.removeProperty('--monroe-nav-dropdown-max');
        return;
      }

      if (!isOpen) {
        dropdown.style.maxHeight = '0px';
        return;
      }

      // Measure actual height and store it for CSS transition.
      dropdown.style.maxHeight = 'none';
      var h = dropdown.scrollHeight || 0;
      dropdown.style.maxHeight = h + 'px';
      item.style.setProperty('--monroe-nav-dropdown-max', h + 'px');
    }

    function closeAllDropdowns() {
      nav.querySelectorAll('.monroe-global-nav__item.is-open').forEach(function (openItem) {
        openItem.classList.remove('is-open');
        var openTrigger = openItem.querySelector('.monroe-global-nav__trigger');
        if (openTrigger) {
          openTrigger.setAttribute('aria-expanded', 'false');
        }
        var dropdown = openItem.querySelector('.monroe-global-nav__dropdown');
        if (dropdown) {
          setDropdownMaxHeight(openItem, dropdown, false);
        }
      });
      nav.querySelectorAll('.monroe-global-nav__trigger').forEach(function (t) {
        t.setAttribute('aria-expanded', 'false');
      });
      resetNavDropdownInlineStyles();
      syncDropdownInert();
    }

    nav.querySelectorAll('.monroe-global-nav__trigger').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        if (!mobileQuery.matches) {
          return;
        }

        var item = trigger.closest('.monroe-global-nav__item');
        if (!item) {
          return;
        }

        nav.querySelectorAll('.monroe-global-nav__item.is-open').forEach(function (openItem) {
          if (openItem !== item) {
            openItem.classList.remove('is-open');
            var openTrigger = openItem.querySelector('.monroe-global-nav__trigger');
            if (openTrigger) {
              openTrigger.setAttribute('aria-expanded', 'false');
            }
            var openDd = openItem.querySelector('.monroe-global-nav__dropdown');
            if (openDd) {
              setDropdownMaxHeight(openItem, openDd, false);
            }
          }
        });

        var nextState = !item.classList.contains('is-open');
        item.classList.toggle('is-open', nextState);
        trigger.setAttribute('aria-expanded', nextState ? 'true' : 'false');

        var dropdown = item.querySelector('.monroe-global-nav__dropdown');
        if (dropdown) {
          setDropdownMaxHeight(item, dropdown, nextState);
        }
        syncDropdownInert();
      });
    });

    function onNavBreakpointChange() {
      closeAllDropdowns();
      if (nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        if (menuToggle) {
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      }
      syncMobileNavPanelAccessibility();
      if (typeof syncNavHeightVar === 'function') {
        syncNavHeightVar(docRef);
      }
    }

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', onNavBreakpointChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(onNavBreakpointChange);
    }

    syncMobileNavPanelAccessibility();
    if (typeof syncNavHeightVar === 'function') {
      syncNavHeightVar(docRef);
    }

    // Close dropdowns (and mobile drawer) when clicking outside the nav chrome.
    document.addEventListener('click', function (event) {
      if (nav.contains(event.target)) {
        return;
      }
      closeAllDropdowns();
      if (mobileQuery.matches && nav.classList.contains('is-open')) {
        closeMobileDrawer(false);
      }
    });

    // Close menus on Escape.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAllDropdowns();
        if (nav.classList.contains('is-open')) {
          closeMobileDrawer(true);
        }
      }
    });
  }

  function syncNavHeightVar(root) {
    var docEl = root.documentElement;
    if (!docEl) {
      return;
    }

    var win = root.defaultView || window;
    var docForNav = root.nodeType === 9 ? root : root.ownerDocument || document;
    var globalNavForClearance = root.querySelector('[data-monroe-global-nav]');
    var isMobileNav;
    if (globalNavForClearance && win.matchMedia) {
      isMobileNav = monroeGlobalNavDrawerMediaQuery(docForNav).matches;
    } else if (win.matchMedia) {
      isMobileNav = win.matchMedia('(max-width: ' + monroeReadNavDrawerMaxPx(docForNav) + 'px)').matches;
    } else {
      isMobileNav = false;
    }

    var nav =
      root.querySelector('[data-monroe-global-nav]') ||
      root.querySelector('#dmNav') ||
      root.querySelector('.unifiednav') ||
      root.querySelector('[id^="dmNav"]');
    if (!nav) {
      return;
    }

    var clearance;

    if (globalNavForClearance && isMobileNav) {
      var bar = globalNavForClearance.querySelector('.monroe-global-nav__bar');
      if (bar) {
        clearance = Math.ceil(bar.getBoundingClientRect().bottom);
      } else {
        var brandEl = globalNavForClearance.querySelector('.monroe-global-nav__brand');
        var toggleEl = globalNavForClearance.querySelector('.monroe-global-nav__menu-toggle');
        var parts = [];
        if (brandEl) {
          parts.push(brandEl.getBoundingClientRect().bottom);
        }
        if (toggleEl) {
          parts.push(toggleEl.getBoundingClientRect().bottom);
        }
        clearance =
          parts.length > 0
            ? Math.ceil(Math.max.apply(null, parts))
            : Math.ceil(globalNavForClearance.getBoundingClientRect().bottom);
      }
    } else {
      clearance = Math.ceil(nav.getBoundingClientRect().bottom);
    }

    if (clearance > 0) {
      docEl.style.setProperty('--monroe-nav-height', clearance + 'px');
    }
  }

  function getNavBottomClearance(root) {
    var win = root.defaultView || window;
    var docForNav = root.nodeType === 9 ? root : root.ownerDocument || document;
    var globalNav = root.querySelector('[data-monroe-global-nav]');
    var isMobileNav;
    if (globalNav && win.matchMedia) {
      isMobileNav = monroeGlobalNavDrawerMediaQuery(docForNav).matches;
    } else if (win.matchMedia) {
      isMobileNav = win.matchMedia('(max-width: ' + monroeReadNavDrawerMaxPx(docForNav) + 'px)').matches;
    } else {
      isMobileNav = false;
    }

    var nav =
      root.querySelector('[data-monroe-global-nav]') ||
      root.querySelector('#dmNav') ||
      root.querySelector('.unifiednav') ||
      root.querySelector('[id^="dmNav"]');
    if (!nav) {
      var v = '';
      if (root.documentElement && win && win.getComputedStyle) {
        v = String(win.getComputedStyle(root.documentElement).getPropertyValue('--monroe-nav-height') || '').trim();
      }
      var parsed = parseFloat(v);
      if (parsed && v.indexOf('px') !== -1) {
        return Math.ceil(parsed);
      }
      return 108;
    }

    var globalNav = root.querySelector('[data-monroe-global-nav]');
    if (globalNav && isMobileNav) {
      var bar = globalNav.querySelector('.monroe-global-nav__bar');
      if (bar) {
        return Math.ceil(bar.getBoundingClientRect().bottom);
      }
      var brandEl = globalNav.querySelector('.monroe-global-nav__brand');
      var toggleEl = globalNav.querySelector('.monroe-global-nav__menu-toggle');
      var parts = [];
      if (brandEl) {
        parts.push(brandEl.getBoundingClientRect().bottom);
      }
      if (toggleEl) {
        parts.push(toggleEl.getBoundingClientRect().bottom);
      }
      if (parts.length > 0) {
        return Math.ceil(Math.max.apply(null, parts));
      }
    }

    return Math.ceil(nav.getBoundingClientRect().bottom);
  }

  function alignDocumentToHash(root, behavior) {
    var win = root.defaultView || window;
    if (!win || !win.location || !win.location.hash || win.location.hash.length < 2) {
      return;
    }
    var raw = win.location.hash.slice(1);
    var id;
    try {
      id = decodeURIComponent(raw);
    } catch (e) {
      return;
    }
    if (!id || id.indexOf(' ') >= 0 || id.indexOf('/') >= 0) {
      return;
    }
    var el = root.getElementById(id);
    if (!el || !el.getBoundingClientRect) {
      return;
    }
    syncNavHeightVar(root);
    var clearance = getNavBottomClearance(root) + 12;
    var rect = el.getBoundingClientRect();
    var currentTop = rect.top;
    if (currentTop >= clearance - 2) {
      return;
    }
    var y = win.pageYOffset + currentTop - clearance;
    var top = Math.max(0, y);
    if (win.scrollTo) {
      try {
        win.scrollTo({ top: top, behavior: behavior || 'auto' });
      } catch (err) {
        win.scrollTo(0, top);
      }
    }
  }

  function initFragmentScrollUnderFixedNav(root) {
    var win = root.defaultView || window;
    if (!win || !win.location) {
      return;
    }

    function align(behavior) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          alignDocumentToHash(root, behavior);
        });
      });
    }

    align('auto');
    root.addEventListener('hashchange', function () {
      align('auto');
    });
    win.addEventListener('load', function () {
      align('auto');
    });
  }

  function initCondensedNav(root) {
    var nav = root.querySelector('[data-monroe-global-nav]');
    if (!nav) return;

    var ticking = false;
    function update() {
      ticking = false;
      var shouldCondense = window.scrollY > 12;
      nav.classList.toggle('is-condensed', shouldCondense);
      syncNavHeightVar(document);
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    window.addEventListener('resize', function () {
      syncNavHeightVar(document);
    });

    update();
  }

  function activateSponsorMarquee(widget) {
    if (!widget) {
      return;
    }

    var track = widget.querySelector('.logo-track');
    if (!track) {
      return;
    }

    // Make init idempotent. If we've already started the loop once,
    // don't restart it again (that can freeze some browsers).
    if (widget.getAttribute('data-marquee-ready') === '1') {
      return;
    }

    var images = Array.prototype.slice.call(widget.querySelectorAll('img'));
    if (!images.length) {
      widget.setAttribute('data-marquee-ready', '1');
      return;
    }

    // Pause until images have stable dimensions, then restart animation cleanly.
    function markReady() {
      widget.setAttribute('data-marquee-ready', '1');

      // Ensure the animation is running, then restart once after layout settles.
      track.style.animationPlayState = 'running';

      // Force a single clean restart (without permanently overriding CSS).
      track.style.animation = 'none';
      // eslint-disable-next-line no-unused-expressions
      track.offsetHeight;
      // Two RAFs makes restart more reliable across browsers.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          track.style.animation = '';
        });
      });
    }

    var remaining = images.length;
    var done = false;

    function onOneDone() {
      if (done) return;
      remaining -= 1;
      if (remaining <= 0) {
        done = true;
        markReady();
      }
    }

    // Pause immediately while we wait for stable image sizes.
    track.style.animationPlayState = 'paused';

    // Safety: don't stall forever if a logo 404s or decode hangs.
    var timeout = window.setTimeout(function () {
      if (done) return;
      done = true;
      markReady();
    }, 10000);

    images.forEach(function (img) {
      // Prefer decode() when available to avoid the final paint pop.
      // Even if `complete` is true, decode() ensures it's actually ready to paint.
      if (img.decode) {
        img
          .decode()
          .then(onOneDone)
          .catch(onOneDone);
        return;
      }

      if (img.complete) {
        onOneDone();
        return;
      }

      img.addEventListener('load', onOneDone, { once: true });
      img.addEventListener('error', onOneDone, { once: true });
    });

    // Clear timeout once ready.
    var observer = new MutationObserver(function () {
      if (widget.getAttribute('data-marquee-ready') === '1') {
        window.clearTimeout(timeout);
        observer.disconnect();
      }
    });
    observer.observe(widget, { attributes: true, attributeFilter: ['data-marquee-ready'] });
  }

  /** Defer marquee image decode + animation until the band is near the viewport. */
  function initSponsorMarquee(root) {
    monroeObserveLazyBand(root, '#sponsorMarqueeWidget', function (band) {
      activateSponsorMarquee(band);
    });
  }

  /** Poster-first hero; load video when near viewport on desktop. */
  function initHomeHeroMobilePoster(root) {
    var hero = root.querySelector('.home-editable-hero.wp-block-cover, .wp-block-cover.home-editable-hero');
    if (!hero || !window.matchMedia) {
      return;
    }

    var video = hero.querySelector('.wp-block-cover__video-background');
    if (!video) {
      return;
    }

    var dataSrc = video.getAttribute('data-src') || video.getAttribute('src') || '';
    if (video.hasAttribute('src') && !video.getAttribute('data-src')) {
      video.setAttribute('data-src', video.getAttribute('src'));
      video.removeAttribute('src');
    }

    var mobileQuery = window.matchMedia('(max-width: 768px)');
    var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var videoLoaded = false;

    function shouldUsePosterOnly() {
      return mobileQuery.matches || reduceMotionQuery.matches;
    }

    function applyPosterBackground() {
      var poster = video.getAttribute('poster') || '';
      if (poster) {
        hero.style.backgroundImage = 'url("' + poster.replace(/"/g, '\\"') + '")';
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
      }
    }

    function loadHeroVideo() {
      if (videoLoaded || !dataSrc || video.getAttribute('src')) {
        return;
      }
      video.setAttribute('src', dataSrc);
      video.load();
      videoLoaded = true;
    }

    function applyHeroPlayback() {
      if (shouldUsePosterOnly()) {
        video.pause();
        applyPosterBackground();
        return;
      }

      hero.style.removeProperty('background-image');
      hero.style.removeProperty('background-size');
      hero.style.removeProperty('background-position');
      loadHeroVideo();
      if (typeof video.play === 'function') {
        video.play().catch(function () {});
      }
    }

    applyHeroPlayback();

    if (!shouldUsePosterOnly() && 'IntersectionObserver' in window) {
      var heroIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            applyHeroPlayback();
            heroIo.disconnect();
          }
        });
      }, { rootMargin: '200px' });
      heroIo.observe(hero);
    }

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', applyHeroPlayback);
      reduceMotionQuery.addEventListener('change', applyHeroPlayback);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(applyHeroPlayback);
      reduceMotionQuery.addListener(applyHeroPlayback);
    }
  }

  /**
   * Highlights homepage index links (mobile pills + desktop rail) while scrolling.
   */
  function initHomePageIndexScrollSpy(root) {
    var links = root.querySelectorAll('.home-editable-page-index a.home-editable-page-index__link');
    if (!links.length || !('IntersectionObserver' in window)) {
      return;
    }
    if (!links.length) {
      return;
    }

    var scrollIds =
      window.monroeRebuildData &&
      window.monroeRebuildData.homePageIndex &&
      Array.isArray(window.monroeRebuildData.homePageIndex.scrollIds)
        ? window.monroeRebuildData.homePageIndex.scrollIds
        : [
            'Top',
            'Intro',
            'Events',
            'FeaturedPets',
            'hs-hero-fence-widget',
            'VetPartners',
            'furry-friends-auction-sponsors',
            'sponsorMarqueeWidget',
            'Membership',
            'Donations',
            'Newsletter',
            'FAQ',
            'Accomplishments',
            'Contact'
          ];

    var sections = [];
    var seen = new Set();

    function addSection(el, navId) {
      if (!el || !navId || seen.has(el)) {
        return;
      }
      seen.add(el);
      sections.push({ el: el, navId: navId });
    }

    scrollIds.forEach(function (id) {
      var el = root.getElementById(id);
      if (el) {
        addSection(el, id);
      }
    });

    root.querySelectorAll('[data-home-nav-section]').forEach(function (el) {
      var navId = el.getAttribute('data-home-nav-section');
      if (navId) {
        addSection(el, navId);
      }
    });

    if (!sections.length) {
      return;
    }

    function activateForId(id) {
      links.forEach(function (link) {
        var href = link.getAttribute('href') || '';
        var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#') + 1) : '';
        var scrollTarget = link.getAttribute('data-scroll-target') || '';
        var isActive = hash === id || scrollTarget === id;
        link.classList.toggle('is-active', isActive);
      });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (e) {
            return e.isIntersecting;
          })
          .sort(function (a, b) {
            return (b.intersectionRatio || 0) - (a.intersectionRatio || 0);
          });
        if (!visible.length) {
          return;
        }
        var navId = visible[0].target.getAttribute('data-home-nav-section') || visible[0].target.id;
        if (navId) {
          activateForId(navId);
        }
      },
      {
        root: null,
        rootMargin: '-42% 0px -42% 0px',
        threshold: [0, 0.08, 0.15, 0.25, 0.5]
      }
    );

    sections.forEach(function (section) {
      observer.observe(section.el);
    });

    // Initial state: highlight first section in view
    requestAnimationFrame(function () {
      var firstHit = sections.find(function (section) {
        var r = section.el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.55 && r.bottom > window.innerHeight * 0.25;
      });
      if (firstHit) {
        var navId = firstHit.el.getAttribute('data-home-nav-section') || firstHit.el.id || firstHit.navId;
        if (navId) {
          activateForId(navId);
        }
      }
    });
  }

  /**
   * Seed HTML gets FAQ/Contact/Volunteer IDs from front-page.php; editor-managed home may not.
   */
  function setAnchorIdIfMissing(root, id, selector) {
    if (root.getElementById(id)) {
      return;
    }
    var el = root.querySelector(selector);
    if (!el) {
      return;
    }
    var existing = el.getAttribute('id');
    if (existing && String(existing).trim() !== '') {
      return;
    }
    el.setAttribute('id', id);
  }

  function initHomePageAnchorIds(root) {
    var body = root.body;
    if (!body) {
      return;
    }
    var isHome =
      body.classList.contains('page-slug-home-editable') ||
      body.getAttribute('data-page-alias') === 'home-editable';
    if (!isHome) {
      return;
    }

    setAnchorIdIfMissing(root, 'FAQ', '.home-editable-faq-card');
    setAnchorIdIfMissing(root, 'Games', '.home-editable-games-band');
    setAnchorIdIfMissing(root, 'Contact', '.home-editable-contact-card');

    if (!root.getElementById('Volunteer')) {
      var tiles = root.querySelectorAll('.home-editable-give-tile');
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        var h3 = tile.querySelector('h3');
        if (!h3 || h3.textContent.trim() !== 'Volunteer') {
          continue;
        }
        var tileId = tile.getAttribute('id');
        if (tileId && String(tileId).trim() !== '') {
          break;
        }
        tile.setAttribute('id', 'Volunteer');
        break;
      }
    }
  }

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function initSectionReveal(root) {
    if (!('IntersectionObserver' in window)) {
      return;
    }
    var selectors = [
      '.home-editable-section',
      '.home-editable-card',
      '.monroe-native-inner .monroe-native-stack'
    ];
    var targets = [];
    selectors.forEach(function (sel) {
      root.querySelectorAll(sel).forEach(function (el) {
        targets.push(el);
      });
    });
    if (!targets.length) {
      return;
    }
    if (prefersReducedMotion() || (window.matchMedia && window.matchMedia('(max-width: 781px)').matches)) {
      targets.forEach(function (el) {
        el.classList.add('monroe-reveal-target', 'is-revealed');
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var el = entry.target;
          el.classList.add('is-revealed');
          observer.unobserve(el);
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    targets.forEach(function (el) {
      el.classList.add('monroe-reveal-target');
      observer.observe(el);
    });
  }

  function initInnerPagePillNav(root) {
    var nav = root.querySelector('.monroe-inner-page-pills');
    if (!nav || !('IntersectionObserver' in window)) {
      return;
    }
    var links = nav.querySelectorAll('a.monroe-inner-page-pills__link');
    if (!links.length) {
      return;
    }
    var sections = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#') + 1) : '';
      if (!hash) {
        return;
      }
      var target = root.getElementById(hash);
      if (target) {
        sections.push({ id: hash, el: target });
      }
    });
    if (!sections.length) {
      return;
    }
    function activateForId(id) {
      links.forEach(function (link) {
        var href = link.getAttribute('href') || '';
        var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#') + 1) : '';
        link.classList.toggle('is-active', hash === id);
        if (hash === id) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }
    var observer = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (e) {
            return e.isIntersecting;
          })
          .sort(function (a, b) {
            return (b.intersectionRatio || 0) - (a.intersectionRatio || 0);
          });
        if (!visible.length) {
          return;
        }
        var id = visible[0].target.id;
        if (id) {
          activateForId(id);
        }
      },
      {
        root: null,
        rootMargin: '-38% 0px -48% 0px',
        threshold: [0, 0.1, 0.25]
      }
    );
    sections.forEach(function (item) {
      if (!item.el.id) {
        item.el.id = item.id;
      }
      observer.observe(item.el);
    });
    requestAnimationFrame(function () {
      var first = sections.find(function (item) {
        var r = item.el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.65 && r.bottom > 120;
      });
      if (first) {
        activateForId(first.id);
      }
    });
  }

  function initNavHeightTracking(root) {
    syncNavHeightVar(root);
    window.addEventListener('load', function () {
      syncNavHeightVar(root);
    });
    var nav = root.querySelector('[data-monroe-global-nav]');
    if (nav && typeof ResizeObserver !== 'undefined') {
      var observeEl = nav.querySelector('.monroe-global-nav__bar') || nav;
      var ro = new ResizeObserver(function () {
        syncNavHeightVar(root);
      });
      ro.observe(observeEl);
    }
  }

  /** Gallery lightbox for .hs-news-section newsletter issues. */
  function initNewsletterLightbox(root) {
    root.querySelectorAll('.hs-news-section[data-hs-lightbox]').forEach(function (section) {
      var lbId = section.getAttribute('data-hs-lightbox');
      if (!lbId) {
        return;
      }
      var lb = section.querySelector('#' + lbId);
      if (!lb) {
        return;
      }
      var lbImg = lb.querySelector('[data-hs-lb-img]');
      var lbClose = lb.querySelector('.hs-lb-close');
      var lbPrev = lb.querySelector('.hs-lb-prev');
      var lbNext = lb.querySelector('.hs-lb-next');
      var capL = lb.querySelector('[data-hs-lb-cap-l]');
      var capR = lb.querySelector('[data-hs-lb-cap-r]');
      var thumbs = [].slice.call(section.querySelectorAll('.hs-thumb img'));
      if (!lbImg || !lbClose || !thumbs.length) {
        return;
      }

      var idx = 0;
      var trigger = null;
      var focusable = [lbClose, lbPrev, lbNext].filter(Boolean);

      function show() {
        lbImg.src = thumbs[idx].src;
        lbImg.alt = thumbs[idx].alt || '';
        if (capL) {
          capL.textContent = thumbs[idx].alt || 'Image';
        }
        if (capR) {
          capR.textContent = idx + 1 + ' / ' + thumbs.length;
        }
        lb.classList.add('active');
        lb.setAttribute('aria-hidden', 'false');
        document.body.classList.add('hs-lb-open');
        try {
          lbClose.focus({ preventScroll: true });
        } catch (e) {}
      }

      function close() {
        lb.classList.remove('active');
        lb.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('hs-lb-open');
        window.setTimeout(function () {
          lbImg.removeAttribute('src');
        }, 250);
        if (trigger && typeof trigger.focus === 'function') {
          try {
            trigger.focus();
          } catch (e2) {}
        }
        trigger = null;
      }

      function prev() {
        idx = (idx - 1 + thumbs.length) % thumbs.length;
        show();
      }

      function next() {
        idx = (idx + 1) % thumbs.length;
        show();
      }

      [].slice.call(section.querySelectorAll('.hs-thumb')).forEach(function (fig, i) {
        fig.addEventListener('click', function () {
          trigger = fig;
          idx = i;
          show();
        });
        fig.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            trigger = fig;
            idx = i;
            show();
          }
        });
      });

      lbClose.addEventListener('click', close);
      if (lbPrev) {
        lbPrev.addEventListener('click', prev);
      }
      if (lbNext) {
        lbNext.addEventListener('click', next);
      }
      lb.addEventListener('click', function (e) {
        if (e.target === lb) {
          close();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('active')) {
          return;
        }
        if (e.key === 'Escape') {
          close();
        } else if (e.key === 'ArrowLeft') {
          prev();
        } else if (e.key === 'ArrowRight') {
          next();
        }
      });
    });
  }

  /** Full-size flyer lightbox on /events/#EventFlyers. */
  function initEventFlyerLightbox(root) {
    root.querySelectorAll('.monroe-event-flyers[data-flyer-lightbox]').forEach(function (section) {
      var lbId = section.getAttribute('data-flyer-lightbox');
      if (!lbId) {
        return;
      }
      var lb = section.querySelector('#' + lbId);
      if (!lb) {
        return;
      }

      var cards = [].slice.call(section.querySelectorAll('[data-flyer-open]'));
      if (!cards.length) {
        return;
      }

      var lbImg = lb.querySelector('[data-flyer-lb-img]');
      var lbTitle = lb.querySelector('[data-flyer-lb-title]');
      var lbDate = lb.querySelector('[data-flyer-lb-date]');
      var lbDownload = lb.querySelector('[data-flyer-lb-download]');
      var lbMore = lb.querySelector('[data-flyer-lb-more]');
      var lbClose = lb.querySelector('.monroe-event-flyers__lightbox-close');
      var lbPrev = lb.querySelector('.monroe-event-flyers__lightbox-prev');
      var lbNext = lb.querySelector('.monroe-event-flyers__lightbox-next');
      if (!lbImg || !lbClose || !lbDownload) {
        return;
      }

      var idx = 0;
      var trigger = null;
      var showNav = cards.length > 1;

      function cardData(card) {
        return {
          full: card.getAttribute('data-flyer-full') || '',
          download: card.getAttribute('data-flyer-download') || '',
          title: card.getAttribute('data-flyer-title') || '',
          date: card.getAttribute('data-flyer-date') || '',
          more: card.getAttribute('data-flyer-more') || '',
          id: card.getAttribute('data-flyer-id') || ''
        };
      }

      function syncHash(id) {
        if (!id) {
          return;
        }
        var hash = '#flyer-' + id;
        if (window.location.hash === hash) {
          return;
        }
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', hash);
        } else {
          window.location.hash = hash;
        }
      }

      function showAt(nextIdx) {
        idx = nextIdx;
        var data = cardData(cards[idx]);
        lbImg.src = data.full;
        lbImg.alt = data.title || 'Event flyer';
        if (lbTitle) {
          lbTitle.textContent = data.title;
        }
        if (lbDate) {
          lbDate.textContent = data.date;
        }
        lbDownload.href = data.download || data.full;
        lbDownload.setAttribute('download', '');
        if (lbMore) {
          if (data.more) {
            lbMore.href = data.more;
            lbMore.hidden = false;
          } else {
            lbMore.hidden = true;
          }
        }
        if (lbPrev) {
          lbPrev.hidden = !showNav;
        }
        if (lbNext) {
          lbNext.hidden = !showNav;
        }
        lb.classList.add('is-active');
        lb.setAttribute('aria-hidden', 'false');
        document.body.classList.add('monroe-event-flyers-lb-open');
        syncHash(data.id);
        try {
          lbClose.focus({ preventScroll: true });
        } catch (e) {}
      }

      function close() {
        lb.classList.remove('is-active');
        lb.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('monroe-event-flyers-lb-open');
        window.setTimeout(function () {
          lbImg.removeAttribute('src');
        }, 250);
        if (trigger && typeof trigger.focus === 'function') {
          try {
            trigger.focus();
          } catch (e2) {}
        }
        trigger = null;
      }

      function openFromCard(card) {
        var cardIdx = cards.indexOf(card);
        if (cardIdx < 0) {
          return;
        }
        trigger = card;
        showAt(cardIdx);
      }

      function openFromHash() {
        var hash = window.location.hash || '';
        if (!/^#flyer-\d+$/.test(hash)) {
          return;
        }
        var item = section.querySelector(hash);
        if (!item) {
          return;
        }
        var card = item.querySelector('[data-flyer-open]');
        if (!card) {
          return;
        }
        openFromCard(card);
      }

      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          openFromCard(card);
        });
      });

      lbClose.addEventListener('click', close);
      if (lbPrev) {
        lbPrev.addEventListener('click', function () {
          showAt((idx - 1 + cards.length) % cards.length);
        });
      }
      if (lbNext) {
        lbNext.addEventListener('click', function () {
          showAt((idx + 1) % cards.length);
        });
      }
      lb.addEventListener('click', function (e) {
        if (e.target === lb) {
          close();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('is-active')) {
          return;
        }
        if (e.key === 'Escape') {
          close();
        } else if (e.key === 'ArrowLeft' && showNav) {
          showAt((idx - 1 + cards.length) % cards.length);
        } else if (e.key === 'ArrowRight' && showNav) {
          showAt((idx + 1) % cards.length);
        }
      });

      window.addEventListener('hashchange', function () {
        if (lb.classList.contains('is-active')) {
          return;
        }
        openFromHash();
      });

      openFromHash();
    });
  }

  function formatAccomplishmentsCount(value) {
    var n = Math.max(0, Math.round(Number(value) || 0));
    try {
      return n.toLocaleString();
    } catch (e) {
      return String(n);
    }
  }

  function reserveAccomplishmentsValueWidth(el, target) {
    if (!el) {
      return;
    }
    var formatted = formatAccomplishmentsCount(target);
    if (formatted) {
      el.style.minWidth = formatted.length + 'ch';
    }
  }

  function prefersMobileAccomplishmentsLayout() {
    return window.matchMedia && window.matchMedia('(max-width: 781px)').matches;
  }

  function animateAccomplishmentsPanel(panel, options) {
    if (!panel) {
      return;
    }
    options = options || {};
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var values = panel.querySelectorAll('.monroe-accomplishments-stat__value[data-count]');
    if (!values.length) {
      return;
    }

    values.forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      reserveAccomplishmentsValueWidth(el, target);
      if (reduceMotion || options.instant || prefersMobileAccomplishmentsLayout()) {
        el.textContent = formatAccomplishmentsCount(target);
        return;
      }

      var duration = 1200;
      var start = null;
      el.textContent = formatAccomplishmentsCount(0);

      function step(timestamp) {
        if (start === null) {
          start = timestamp;
        }
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = formatAccomplishmentsCount(target * eased);
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          el.textContent = formatAccomplishmentsCount(target);
        }
      }

      window.requestAnimationFrame(step);
    });
  }

  function initAccomplishmentsWidget(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-monroe-accomplishments-widget]').forEach(function (widget) {
      var tabs = widget.querySelectorAll('[data-accomplishments-year]');

      function visiblePanel() {
        return (
          widget.querySelector('[data-accomplishments-panel]:not([hidden])') ||
          widget.querySelector('[data-accomplishments-panel].is-active')
        );
      }

      function runCountUpForVisiblePanel() {
        animateAccomplishmentsPanel(visiblePanel());
      }

      if (tabs.length) {
        tabs.forEach(function (tab) {
          tab.addEventListener('click', function () {
            var year = tab.getAttribute('data-accomplishments-year');
            tabs.forEach(function (btn) {
              var active = btn === tab;
              btn.classList.toggle('is-active', active);
              btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            widget.querySelectorAll('[data-accomplishments-panel]').forEach(function (panel) {
              var show = panel.getAttribute('data-accomplishments-panel') === year;
              panel.classList.toggle('is-active', show);
              if (show) {
                panel.removeAttribute('hidden');
                animateAccomplishmentsPanel(panel);
              } else {
                panel.setAttribute('hidden', 'hidden');
              }
            });
          });
        });
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                runCountUpForVisiblePanel();
                observer.unobserve(widget);
              }
            });
          },
          { threshold: 0.25 }
        );
        observer.observe(widget);
      } else {
        runCountUpForVisiblePanel();
      }
    });
  }

  // Clamp long homepage prose (e.g. the newsletter "A New Direction" letter) on all
  // viewports and add an accessible Read more / Show less toggle. Progressive: without
  // JS the full content is shown.
  function initHomeReadMore(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var targets = scope.querySelectorAll('[data-monroe-readmore], .home-editable-newsletter-section .monroe-home-newsletter-slot');
    targets.forEach(function (slot) {
      if (slot.getAttribute('data-monroe-readmore-ready') === '1') {
        return;
      }
      var collapsedMax = parseInt(slot.getAttribute('data-monroe-readmore-max') || '520', 10);
      // Only bother if content meaningfully exceeds the collapsed height.
      if (slot.scrollHeight <= collapsedMax + 120) {
        return;
      }
      slot.setAttribute('data-monroe-readmore-ready', '1');
      slot.classList.add('is-collapsible');
      slot.style.setProperty('--monroe-readmore-max', collapsedMax + 'px');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'monroe-readmore-toggle';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = slot.getAttribute('data-monroe-readmore-label') || 'Read more';
      var lessLabel = slot.getAttribute('data-monroe-readmore-less') || 'Show less';
      var moreLabel = btn.textContent;

      btn.addEventListener('click', function () {
        var expanded = slot.classList.toggle('is-expanded');
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.textContent = expanded ? lessLabel : moreLabel;
        if (!expanded) {
          var top = slot.getBoundingClientRect().top + window.pageYOffset - 120;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });

      if (slot.parentNode) {
        slot.parentNode.insertBefore(btn, slot.nextSibling);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fixLinks(document);
    bindMobileMenus(document);
    bindGlobalNav(document);
    initPayPalGivingLoaders(document);
    initLazyHomeEmbeds(document);
    ensureResponsiveMedia(document);
    initNavHeightTracking(document);
    initCondensedNav(document);
    initFragmentScrollUnderFixedNav(document);
    initSponsorMarquee(document);
    initHomePageIndexScrollSpy(document);
    initHomeHeroMobilePoster(document);
    initNewsletterLightbox(document);
    initEventFlyerLightbox(document);
    initHomePageAnchorIds(document);
    initAccomplishmentsWidget(document);
    initHomeReadMore(document);
    initSectionReveal(document);
    initInnerPagePillNav(document);

    // Lazy loading for images
    function initLazyLoading() {
      var lazyImages = document.querySelectorAll('img[loading="lazy"]');
      if ('IntersectionObserver' in window) {
        var imageObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var img = entry.target;
              img.classList.add('loaded');
              imageObserver.unobserve(img);
            }
          });
        });
        lazyImages.forEach(function (img) {
          imageObserver.observe(img);
        });
      } else {
        // Fallback for browsers without IntersectionObserver
        lazyImages.forEach(function (img) {
          img.classList.add('loaded');
        });
      }
    }

    // Accessibility enhancements
    function initAccessibility() {
      // Ensure all images have alt text
      var images = document.querySelectorAll('img:not([alt])');
      images.forEach(function (img) {
        if (!img.hasAttribute('alt')) {
          img.setAttribute('alt', 'Image');
        }
      });

      // Add focus management for modal-like elements
      var focusableElements = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
      
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          document.body.classList.add('keyboard-navigation');
        }
      });

      document.addEventListener('mousedown', function () {
        document.body.classList.remove('keyboard-navigation');
      });
    }

    // Performance optimizations
    function initPerformance() {
      // Debounce scroll events
      var scrollTimer;
      window.addEventListener('scroll', function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
          // Trigger any scroll-dependent functionality
        }, 16);
      });

      // Preload critical resources
      if ('preload' in document.createElement('link')) {
        var criticalResources = [
          // Add any critical fonts or resources here
        ];
        criticalResources.forEach(function (href) {
          var link = document.createElement('link');
          link.rel = 'preload';
          link.href = href;
          document.head.appendChild(link);
        });
      }
    }

    initLazyLoading();
    initAccessibility();
    initPerformance();

    // Content performance tracking
    function initAnalytics() {
      // Track section visibility
      if ('IntersectionObserver' in window) {
        var sectionObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var section = entry.target;
              var sectionId = section.id || section.className.split(' ').find(function(cls) { return cls && cls.startsWith('home-editable-'); });
              if (sectionId && window.MONROE_DEBUG) {
                console.log('Section viewed:', sectionId);
              }
              sectionObserver.unobserve(section);
            }
          });
        }, { threshold: 0.5 });

        var sections = document.querySelectorAll('.home-editable-section, .home-editable-card');
        sections.forEach(function (section) {
          sectionObserver.observe(section);
        });
      }

      // Track button clicks (debug only).
      if (window.MONROE_DEBUG) {
        var buttons = document.querySelectorAll('.wp-block-button__link');
        buttons.forEach(function (button) {
          button.addEventListener('click', function () {
            var buttonText = this.textContent.trim();
            console.log('Button clicked:', buttonText);
          });
        });

        var forms = document.querySelectorAll('form');
        forms.forEach(function (form) {
          form.addEventListener('submit', function () {
            console.log('Form submitted:', form.action);
          });
        });
      }
    }

    initAnalytics();
  });

  // Re-run once all resources (images/fonts) have loaded to ensure a stable loop seam.
  window.addEventListener('load', function () {
    initSponsorMarquee(document);
    initPayPalGivingLoaders(document);
    initLazyHomeEmbeds(document);
    syncNavHeightVar(document);
  });
})();
