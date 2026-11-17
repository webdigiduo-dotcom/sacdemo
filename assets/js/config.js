/* ==========================================================================
   Sachika Hotels — site configuration
   Edit these values; no build step is needed.
   ========================================================================== */
window.SACHIKA_CONFIG = {
  /* Direct booking engine (Swiftbook). Opened by every "Book online" / "Check availability" link. */
  bookingEngineUrl:
    'https://www.swiftbook.io/inst/#/home?propertyId=522MjxVisCLFVKpHnRAfp78wsCySc1xU2NTQ=&JDRN=Y&RoomID=151043,151044,151326&gsId=522MjxVisCLFVKpHnRAfp78wsCySc1xU2NTQ=',

  /* Enquiry form endpoint. Leave empty to let guests send the enquiry by email or WhatsApp instead.
     Any service that accepts a JSON POST works (Formspree, Web3Forms, Basin, your own API).
     Example: 'https://formspree.io/f/xxxxxxx' */
  enquiryEndpoint: '',

  /* Reservations contact (used for the email / WhatsApp fallback). */
  enquiryEmail: 'help@sachikahotels.com',
  whatsappNumber: '917099004522', // international format, digits only

  /* Analytics — scripts load only when an ID is present. */
  ga4Id: '',        // e.g. 'G-XXXXXXXXXX'
  metaPixelId: '',  // e.g. '1234567890'

  /* Guest reviews on the home page.
     Without keys the page shows the ratings below and the guest quotes written into index.html.
     With keys it fetches recent reviews live and shows only those at or above minRating,
     labelled as a selection with links to every review (never presented as the full picture). */
  reviews: {
    minRating: 4,      // only 4- and 5-star reviews are shown
    max: 9,            // most reviews to show
    minLength: 40,     // skip very short reviews

    /* Google: a Maps JavaScript API key with the Places API (New) enabled, restricted to your domain.
       Leave googlePlaceId empty to look the hotel up by googlePlaceQuery. */
    googleApiKey: '',
    googlePlaceId: '',
    googlePlaceQuery: 'Sachika Hotels, Amingaon, Guwahati, Assam',
    googleUrl: 'https://maps.app.goo.gl/xDctNtq67rTRG4YZ8',

    /* Tripadvisor: the Content API needs a server-side key, so point this at a small proxy
       (see tools/tripadvisor-proxy.js) that returns { rating, count, url, reviews: [...] }. */
    tripadvisorEndpoint: '',
    tripadvisorUrl: 'https://www.tripadvisor.in/Hotel_Review-g503692-d26394884-Reviews-Sachika_Hotels-Guwahati_Kamrup_Metropolitan_District_Assam.html',

    /* Shown until live data loads (checked 17 Nov 2026 — update when you update the page). */
    fallback: {
      google: { rating: 4.6, count: 1113 },
      tripadvisor: { rating: 4.9, count: 359 },
    },
  },

  /* Log analytics events to the console while testing. */
  debug: false,
};
