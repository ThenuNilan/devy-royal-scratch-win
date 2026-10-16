
"use strict";

/* DEVY Royal Scratch & Win campaign settings.
   Keep this file in the same folder as index.html. */

window.DEVY_CONFIG = Object.freeze({
  storageKey: "devyRoyalScratchCustomersV2",
  stockKey: "devyRoyalScratchStockV2",
  nextNumberKey: "devyRoyalScratchNextNumberV2",

  cardCount: 5,
  specialInterval: 7,
  scratchRevealThreshold: 0.70,

  prizes: [
    { id: "facial", name: "Golden Glow Facial", value: 4800, quantity: 2, icon: "✧" },
    { id: "hair", name: "Hair Styling", value: 2200, quantity: 5, icon: "✦" },
    { id: "cleanup", name: "Clean Up Facial", value: 1000, quantity: 5, icon: "❋" },
    { id: "nail", name: "Normal Nail Polish", value: 500, quantity: 8, icon: "◇" },
    { id: "brow", name: "Eyebrow Threading", value: 300, quantity: 10, icon: "✧" }
  ],

  positions: {
    1: [2],
    2: [1],
    3: [4],
    4: [3],
    5: [5],
    6: [4],
    7: [2, 4],
    8: [2],
    9: [1],
    10: [4],
    11: [3],
    12: [5],
    13: [4],
    14: [3, 5],
    15: [2],
    16: [4],
    17: [1],
    18: [5],
    19: [3],
    20: [2],
    21: [1, 5]
  },

  effects: [
    "golden-explosion",
    "royal-spotlight",
    "gold-confetti-rain",
    "fireworks-pop",
    "magic-ring",
    "golden-ribbon-swirl",
    "shooting-star",
    "gold-card-flip",
    "golden-heart-burst",
    "golden-wave-reveal"
  ]
});
