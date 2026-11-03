/* Random day events. Times are drawn by shuffle.js from the seed; 2 to 4 run per in-game day. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.TRD = root.TRD || {}).events = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    EVENTS: [
      { id: 'boom',    name: 'Market boom',      text: 'MARKET BOOM! All business income x3.',            secs: 60 },
      { id: 'refund',  name: 'Tax refund',       text: 'TAX REFUND! The city hands some of it back. Rude.', secs: 0 },
      { id: 'firesale', name: 'Fire sale',       text: 'FIRE SALE! A marked shop is half price. Terrible news.', secs: 45 },
      { id: 'spree',   name: 'Spending spree',   text: 'SPENDING SPREE! Frenzy lasts 8 seconds.',          secs: 60 },
      { id: 'auction', name: 'Surprise auction', text: 'SURPRISE AUCTION! A one-of-a-kind deal is on the map.', secs: 90 }
    ],
    SURPRISE_DEALS: [
      { name: "A Pharaoh's Spare Pyramid", price: 3 }, { name: 'The Last Dinosaur Egg (Probably)', price: 4 },
      { name: 'Naming Rights to Tuesday', price: 2 }, { name: 'A Slightly Used Comet', price: 5 },
      { name: "The World's Largest Rubber Duck", price: 2 }, { name: 'Sole Ownership of the Colour Beige', price: 3 },
      { name: 'A Sunken Galleon, Still Damp', price: 4 }, { name: 'Royal Title: Duke of Parking', price: 2 }
    ],
    WEATHER: [
      { id: 'clear' }, { id: 'rain' }, { id: 'fog' }
    ]
  };
});
