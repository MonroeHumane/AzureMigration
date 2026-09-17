(function (wp) {
  var registerPlugin = wp.plugins.registerPlugin;
  var PluginDocumentSettingPanel = wp.editPost.PluginDocumentSettingPanel;
  var el = wp.element.createElement;

  if (!registerPlugin || !PluginDocumentSettingPanel || !window.monroeHomeEditMap) {
    return;
  }

  var cfg = window.monroeHomeEditMap;

  function EditMapPanel() {
    return el(
      PluginDocumentSettingPanel,
      {
        name: 'monroe-home-edit-map',
        title: cfg.title || 'Homepage edit map',
        className: 'monroe-home-edit-map-panel'
      },
      el('p', { style: { marginTop: 0 } }, cfg.intro || ''),
      cfg.indexItems && cfg.indexItems.length
        ? el(
            'div',
            { style: { marginBottom: '12px' } },
            el('strong', null, cfg.indexTitle || 'On this page'),
            el(
              'ul',
              { style: { margin: '6px 0 0 18px', listStyle: 'disc' } },
              cfg.indexItems.map(function (item) {
                return el(
                  'li',
                  { key: item.id || item.label },
                  el('code', null, '#' + (item.id || '')),
                  ' - ',
                  item.label || ''
                );
              })
            )
          )
        : null,
      el('strong', null, cfg.mapTitle || 'Editing locations'),
      el(
        'table',
        { className: 'widefat striped', style: { marginTop: '6px', fontSize: '12px' } },
        el(
          'tbody',
          null,
          (cfg.mapRows || []).map(function (row, i) {
            var link = row.url
              ? el(
                  'a',
                  { href: row.url, target: '_blank', rel: 'noopener noreferrer' },
                  row.where || ''
                )
              : row.where || '';
            return el(
              'tr',
              { key: String(i) },
              el(
                'td',
                { style: { padding: '6px 8px', verticalAlign: 'top', width: '42%' } },
                row.section || '',
                row.anchor ? el('div', null, el('code', { style: { fontSize: '11px' } }, row.anchor)) : null
              ),
              el('td', { style: { padding: '6px 8px', verticalAlign: 'top' } }, link)
            );
          })
        )
      ),
      cfg.viewSiteUrl
        ? el(
            'p',
            { style: { marginBottom: 0 } },
            el(
              'a',
              { href: cfg.viewSiteUrl, target: '_blank', rel: 'noopener noreferrer', className: 'button button-secondary' },
              'View homepage'
            )
          )
        : null
    );
  }

  registerPlugin('monroe-home-edit-map', {
    render: EditMapPanel,
    icon: 'admin-home'
  });
})(window.wp);
