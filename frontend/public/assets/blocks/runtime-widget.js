(function (wp) {
  var registerBlockType = wp.blocks.registerBlockType;
  var el = wp.element.createElement;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var SelectControl = wp.components.SelectControl;
  var TextControl = wp.components.TextControl;

  var WIDGET_OPTIONS = [
    { label: 'Select a widget…', value: '' },
    { label: 'Auction banner', value: 'auction_banner' },
    { label: 'Featured pets (legacy)', value: 'featured_pets' },
    { label: 'Hero fence', value: 'hero_fence' },
    { label: 'Community vet partners', value: 'community_vet' },
    { label: 'Membership widget', value: 'membership_widget' },
    { label: 'Giving widget', value: 'giving_widget' },
    { label: 'Testimonials widget', value: 'testimonials_widget' },
    { label: 'Accomplishments widget', value: 'accomplishments_widget' },
    { label: 'Sponsor marquee', value: 'sponsor_marquee' },
    { label: 'Newsletter section', value: 'newsletter' },
    { label: 'Social feed', value: 'social_feed' }
  ];

  function titleFor(name) {
    if (!name) return 'Runtime widget';
    return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  registerBlockType('monroe-rebuild/runtime-widget', {
    title: 'Monroe Runtime Widget',
    icon: 'welcome-widgets-menus',
    category: 'widgets',
    attributes: {
      name: { type: 'string', default: '' },
      className: { type: 'string', default: '' }
    },
    supports: {
      html: false
    },
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
            { title: 'Runtime widget settings', initialOpen: true },
            el(SelectControl, {
              label: 'Widget',
              value: attrs.name || '',
              options: WIDGET_OPTIONS,
              onChange: function (value) {
                props.setAttributes({ name: value });
              }
            }),
            el(TextControl, {
              label: 'Extra CSS class (optional)',
              value: attrs.className || '',
              onChange: function (value) {
                props.setAttributes({ className: value });
              }
            })
          )
        ),
        el(
          'div',
          { className: 'monroe-runtime-widget-placeholder' },
          el('div', { className: 'monroe-runtime-widget-placeholder__badge' }, 'Runtime widget'),
          el('div', { className: 'monroe-runtime-widget-placeholder__title' }, titleFor(attrs.name)),
          el(
            'div',
            { className: 'monroe-runtime-widget-placeholder__desc' },
            attrs.name
              ? 'Preview is simplified in the editor. The full widget renders on the live site.'
              : 'Select which widget to render on the live site.'
          )
        )
      );
    },
    save: function () {
      return null;
    }
  });
})(window.wp);

