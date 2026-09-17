/**
 * Memorial CTA analytics hook.
 *
 * Pushes a privacy-safe event into an existing Google Tag Manager dataLayer
 * and emits a DOM event so another analytics provider can subscribe later.
 */
(function () {
  "use strict";

  document.addEventListener("click", function (event) {
    var link = event.target.closest("[data-monroe-memorial-cta]");
    if (!link) {
      return;
    }

    var destination = "";
    try {
      var url = new URL(link.href, window.location.href);
      destination = url.hostname + url.pathname;
    } catch (error) {
      destination = link.getAttribute("href") || "";
    }

    var detail = {
      event: "memorial_cta_click",
      memorial_cta: link.getAttribute("data-monroe-memorial-cta") || "unknown",
      destination: destination,
      page_path: window.location.pathname
    };

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(detail);
    }

    document.dispatchEvent(
      new CustomEvent("monroe:memorial-cta-click", {
        detail: detail
      })
    );
  });
})();
