(function (wp) {
  var registerBlockType = wp.blocks.registerBlockType;
  var el = wp.element.createElement;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var RangeControl = wp.components.RangeControl;
  var ToggleControl = wp.components.ToggleControl;

  registerBlockType('monroe-rebuild/sponsor-marquee', {
    title: 'Sponsor Marquee',
    icon: 'images-alt2',
    category: 'widgets',
    attributes: {
      speedSeconds: { type: 'number', default: 26 },
      gapPx: { type: 'number', default: 36 },
      pauseOnHover: { type: 'boolean', default: true }
    },
    supports: {
      html: false
    },
    edit: function (props) {
      var a = props.attributes;
      return el(
        wp.element.Fragment,
        null,
        el(
          InspectorControls,
          null,
          el(
            PanelBody,
            { title: 'Marquee settings', initialOpen: true },
            el(RangeControl, {
              label: 'Speed (seconds)',
              min: 10,
              max: 80,
              value: a.speedSeconds,
              onChange: function (v) { props.setAttributes({ speedSeconds: v }); }
            }),
            el(RangeControl, {
              label: 'Gap (px)',
              min: 8,
              max: 80,
              value: a.gapPx,
              onChange: function (v) { props.setAttributes({ gapPx: v }); }
            }),
            el(ToggleControl, {
              label: 'Pause on hover',
              checked: !!a.pauseOnHover,
              onChange: function (v) { props.setAttributes({ pauseOnHover: !!v }); }
            })
          )
        ),
        el(
          'div',
          { className: 'monroe-runtime-widget-placeholder' },
          el('div', { className: 'monroe-runtime-widget-placeholder__badge' }, 'Native widget'),
          el('div', { className: 'monroe-runtime-widget-placeholder__title' }, 'Sponsor marquee'),
          el(
            'div',
            { className: 'monroe-runtime-widget-placeholder__desc' },
            'Renders the sponsor logo marquee on the front-end. Editor preview is simplified.'
          )
        )
      );
    },
    save: function () {
      return null;
    }
  });
})(window.wp);

