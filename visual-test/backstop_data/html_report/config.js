report({
  "testSuite": "BackstopJS",
  "tests": [
    {
      "pair": {
        "reference": "..\\bitmaps_reference\\monroe_humane_Homepage_0_document_0_desktop_16_9.png",
        "test": "..\\bitmaps_test\\20260827-134917\\monroe_humane_Homepage_0_document_0_desktop_16_9.png",
        "selector": "document",
        "fileName": "monroe_humane_Homepage_0_document_0_desktop_16_9.png",
        "label": "Homepage",
        "requireSameDimensions": false,
        "misMatchThreshold": 0.1,
        "url": "https://delightful-dune-0d730f70f.7.azurestaticapps.net",
        "referenceUrl": "https://monroe-humane.org",
        "expect": 0,
        "viewportLabel": "desktop_16_9",
        "diff": {
          "isSameDimensions": false,
          "dimensionDifference": {
            "width": 0,
            "height": -2968
          },
          "rawMisMatchPercentage": 27.169487667127708,
          "misMatchPercentage": "27.17",
          "analysisTime": 736
        },
        "diffImage": "..\\bitmaps_test\\20260827-134917\\failed_diff_monroe_humane_Homepage_0_document_0_desktop_16_9.png"
      },
      "status": "fail"
    },
    {
      "pair": {
        "reference": "..\\bitmaps_reference\\monroe_humane_Contact_Page_0_document_0_desktop_16_9.png",
        "test": "..\\bitmaps_test\\20260827-134917\\monroe_humane_Contact_Page_0_document_0_desktop_16_9.png",
        "selector": "document",
        "fileName": "monroe_humane_Contact_Page_0_document_0_desktop_16_9.png",
        "label": "Contact Page",
        "requireSameDimensions": false,
        "misMatchThreshold": 0.1,
        "url": "https://delightful-dune-0d730f70f.7.azurestaticapps.net/contact",
        "referenceUrl": "https://monroe-humane.org/contact",
        "expect": 0,
        "viewportLabel": "desktop_16_9",
        "diff": {
          "isSameDimensions": false,
          "dimensionDifference": {
            "width": 0,
            "height": -1133
          },
          "rawMisMatchPercentage": 18.699183680857224,
          "misMatchPercentage": "18.70",
          "analysisTime": 88
        },
        "diffImage": "..\\bitmaps_test\\20260827-134917\\failed_diff_monroe_humane_Contact_Page_0_document_0_desktop_16_9.png"
      },
      "status": "fail"
    }
  ],
  "id": "monroe_humane"
});