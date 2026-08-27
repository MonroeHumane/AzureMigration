(function (wp) {
  var registerBlockType = wp.blocks.registerBlockType;
  var el = wp.element.createElement;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var SelectControl = wp.components.SelectControl;
  var TextControl = wp.components.TextControl;

  var OPTIONS = [
    { label: 'Select a widget…', value: '' },
    { label: 'Auction banner', value: 'auction_banner' },
    { label: 'Featured pets (legacy)', value: 'featured_pets' },
    { label: 'Hero fence', value: 'hero_fence' },
    { label: 'Community vet partners', value: 'community_vet' },
    { label: 'Accomplishments widget', value: 'accomplishments_widget' },
    { label: 'Membership widget', value: 'membership_widget' },
    { label: 'Testimonials widget', value: 'testimonials_widget' },
    { label: 'Giving widget', value: 'giving_widget' },
    { label: 'Social feed', value: 'social_feed' },
    { label: 'Newsletter section', value: 'newsletter' }
  ];

  function titleFor(name) {
    if (!name) return 'Home widget';
    return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  registerBlockType('monroe-rebuild/home-legacy-widget', {
    title: 'Home Widget (Snapshot)',
    icon: 'layout',
    category: 'widgets',
    attributes: {
      name: { type: 'string', default: '' },
      className: { type: 'string', default: '' }
    },
    supports: { html: false },
    edit: function (props) {
      var attrs = props.attributes || {};
      return el(
        wp.element.Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: 'Widget settings', initialOpen: true },
            el(SelectControl, {
              label: 'Widget',
              value: attrs.name || '',
              options: OPTIONS,
              onChange: function (value) { props.setAttributes({ name: value }); }
            }),
            el(TextControl, {
              label: 'Extra CSS class (optional)',
              value: attrs.className || '',
              onChange: function (value) { props.setAttributes({ className: value }); }
            })
          )
        ),
        el(
          'div',
          { className: 'monroe-runtime-widget-placeholder' },
          el('div', { className: 'monroe-runtime-widget-placeholder__badge' }, 'Widget'),
          el('div', { className: 'monroe-runtime-widget-placeholder__title' }, titleFor(attrs.name)),
          el(
            'div',
            { className: 'monroe-runtime-widget-placeholder__desc' },
            'Uses locally cached homepage markup (scripts stripped except approved loaders).'
          )
        )
      );
    },
    save: function () { return null; }
  });
})(window.wp);

