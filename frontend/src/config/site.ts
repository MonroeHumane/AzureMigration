/**
 * Centralized Site Configuration & Single Source of Truth
 * 
 * All shelter contact info, addresses, third-party integration URLs,
 * and UI breakpoints are defined here to eliminate hardcoded duplication
 * across pages and components.
 */

export const SITE = {
  name: 'Humane Society of Monroe County',
  shortName: 'Monroe Humane',
  tagline: 'Safe Haven Animal Shelter & Adoptions Since 1954',
  url: 'https://monroe-humane.org',
  
  contact: {
    phone: '734-243-3669',
    phoneFormatted: '(734) 243-3669',
    phoneTel: 'tel:734-243-3669',
    email: 'info@monroe-humane.org',
    emailMailto: 'mailto:info@monroe-humane.org',
    address: {
      street: '911 S. Raisinville Rd',
      city: 'Monroe',
      state: 'MI',
      zip: '48161',
      poBox: 'P.O. Box 1457, Monroe, MI 48161',
      full: '911 S. Raisinville Rd, Monroe, MI 48161',
      googleMapsUrl: 'https://maps.google.com/?q=911+S+Raisinville+Rd+Monroe+MI+48161',
    },
    hours: {
      tuesdayToFriday: '11:00 AM - 4:00 PM',
      saturday: '11:00 AM - 3:00 PM',
      sundayMonday: 'Closed (Staff & Volunteer Care Only)',
    },
  },

  integrations: {
    betterUnite: {
      generalDonation: 'https://www.betterunite.com/adopthsmc',
      membership: 'https://www.betterunite.com/hsmc-becomeamembertoday',
      memorialPlaque: 'https://www.betterunite.com/adopthsmc',
      memorialGiving: 'https://app.betterunite.com/adopthsmc-donationsforhumanesocietyofmonroecounty',
    },
    payPal: {
      catRoomFund: 'https://www.paypal.com/US/fundraiser/charity/N9S3JQGK3HCTW',
      catRoomFundId: 'N9S3JQGK3HCTW',
      generalFund: 'https://www.paypal.com/US/fundraiser/charity/4JPVCLYXAW9BW',
      generalFundId: '4JPVCLYXAW9BW',
    },
    squareStore: {
      url: 'https://squareup.com/store/monroe-humane-society',
      shopNotice: 'Order online for shelter pickup or direct shipping. All proceeds support our animals.',
    },
    googleForms: {
      adoptionApp: 'https://docs.google.com/forms/d/e/1FAIpQLSfA70kSNxQZQBbC0Jq9gHfmgHiAs4k5ytci3t4IhOMzfrSjhQ/viewform?embedded=true',
      volunteerApp: 'https://docs.google.com/forms/d/e/1FAIpQLScyr0hSSoe1H1KpIk65OX8wALYx7bHmcrVAPAciiLG8aG_Buw/viewform?embedded=true',
    },
    zeffy: {
      shirtContest: 'https://www.zeffy.com/ticketing/humane-society-of-monroe-membership-shirt-contest',
    },
    social: {
      facebook: 'https://www.facebook.com/humanesocietyofmonroecounty',
    },
  },

  assets: {
    logo: '/assets/recovered/images/lirp.cdn-website.com/77cfa591/dms3rep/multi/opt/a93f9c_be31971351e8408cb8178224c57b9477-mv2-b3da8eac-1920w.webp',
    defaultOgImage: '/assets/recovered/images/lirp.cdn-website.com/77cfa591/dms3rep/multi/opt/a93f9c_be31971351e8408cb8178224c57b9477-mv2-b3da8eac-1920w.webp',
  },

  ui: {
    mobileDrawerBreakpoint: 1200,
    tabletBreakpoint: 768,
    desktopBreakpoint: 1201,
  },
} as const;

export type SiteConfig = typeof SITE;
