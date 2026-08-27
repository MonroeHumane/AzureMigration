(function (wp) {
  var addFilter = wp.hooks.addFilter;
  var el = wp.element.createElement;
  var cfg = window.monroeHomeShortcodes || {};
  var labels = cfg.labels || {};

  function parseShortcodeName(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    var trimmed = text.trim();
    var match = trimmed.match(/^\[([a-z0-9_]+)/i);
    return match ? match[1].toLowerCase() : '';
  }

  function titleFor(name) {
    if (labels[name]) {
      return labels[name];
    }
    return name.replace(/_/g, ' ').replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  addFilter('editor.BlockEdit', 'monroe-rebuild/home-shortcode-placeholder', function (BlockEdit) {
    return function (props) {
      if (props.name !== 'core/shortcode') {
        return el(BlockEdit, props);
      }

      var text = (props.attributes && props.attributes.text) || '';
      var name = parseShortcodeName(text);
      if (!name || name.indexOf('monroe_') !== 0) {
        return el(BlockEdit, props);
      }

      return el(
        'div',
        { className: 'monroe-runtime-widget-placeholder', style: { margin: '4px 0' } },
        el('div', { className: 'monroe-runtime-widget-placeholder__badge' }, 'Monroe widget'),
        el('div', { className: 'monroe-runtime-widget-placeholder__title' }, titleFor(name)),
        el('div', { className: 'monroe-runtime-widget-placeholder__desc' }, cfg.hint || ''),
        el(
          'div',
          { style: { marginTop: '8px', fontSize: '12px', opacity: 0.85 } },
          el('code', null, text.trim())
        ),
        el(BlockEdit, props)
      );
    };
  });
})(window.wp);
