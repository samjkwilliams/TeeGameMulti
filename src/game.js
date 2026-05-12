(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true });
  const skyCanvas = document.getElementById("sky");
  const aspectButtons = document.querySelectorAll("[data-aspect]");
  const holePrevButton = document.querySelector("[data-hole-prev]");
  const holeNextButton = document.querySelector("[data-hole-next]");
  const holeCounter = document.querySelector("[data-hole-counter]");
  const introModal = document.getElementById("intro-modal");
  const playButton = document.getElementById("play-button");
  const holeAdvanceModal = document.getElementById("hole-advance-modal");
  const holeAdvanceContinue = document.getElementById("hole-advance-continue");
  const holeAdvanceRetry = document.getElementById("hole-advance-retry");
  const holeAdvanceBonus = document.getElementById("hole-advance-bonus");

  const BALL_SPRITE_SRC = `golfball`;
  const OUTFIT_SETS = [
    { swing: "Outfit01.png", putt: "Outfit01_Putt.png", idle: "Outfit01_Idle.png" },
    { swing: "Outfit02.png", putt: "Outfit02_Putt.png", idle: "Outfit02_Idle.png" },
    { swing: "Outfit03.png", putt: "Outfit03_Putt.png", idle: "Outfit03_Idle.png" }
  ];
  const TERRAIN_OVERLAY_SRC = `overlay.webp`;
  
  const AUDIO = {
    swing: new Audio("swing.mp3"),
    putt: new Audio("putt.m4a"),
    hole: new Audio("hole.mp3"),
    thud: new Audio("thud.mp3")
  };

  const SKY_QUALITY = window.TEE_SKY_QUALITY || "auto";

  const BALL = {
    radius: 0.31, // Halved from 0.62 for a smaller ball
    mass: 0.045,
    maxSpeed: 85,
    minSpeed: 4.5,
    dragArea: 0.00143,
    airDensity: 1.18,
    dragCoefficient: 0.22,
    liftCoefficient: 0.085,
    spinDecay: 0.54,
    inertiaFactor: 0.4,
    groundGrip: 18,
    landingGrip: 8,
    bounceFriction: 0.33,
    greenRollingResistance: 0.12,
    fairwayRollingResistance: 0.18,
    stopSpeed: 0.08
  };

  const GRAVITY = 9.81;
  const FIXED_DT = 1 / 120;
  const MAX_GUIDE_STEPS = 240;
  const MIN_LAUNCH_ANGLE = -0.05;
  const MAX_LAUNCH_ANGLE = 0.84;
  const PUTT_DISTANCE = 34;
  const PUTT_FLAT_SLOPE = 0.055;
  const STRIKE_CYCLES_PER_SECOND = 1.85;
  const STRIKE_TARGET = 0.84;
  const FINISH_SETTLE_SPEED = 0.16;
  const FINISH_SETTLE_SLOPE = 0.58;
  const FINISH_SETTLE_SECONDS = 0.025;
  const FORCE_SETTLE_SPEED = 0.42;
  const FORCE_SETTLE_SECONDS = 0.78;
  const COURSE_PAR = 3;
  const HOLE_SPINNER_DELAY = 2.85;
  const MAX_PHYSICS_STEPS_PER_FRAME = 5;
  const LOW_POWER_RENDER = true;
  const MINIMAP_REFRESH_SECONDS = 1 / 12;
  const pts = (rows) => rows.map(([x, y]) => ({ x, y }));

  const HOLE_PRODUCTS = [
    [
      { name: "PRIMO UPSIDE DOWN HAT", sub: "BLACK", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/BlackUpsideDownHat-1.webp?v=1773204047", url: "https://teegame.com.au/collections/headwear/products/primo-upside-down-hat-black" },
      { name: "PRIMO CLASSIC COLLAR POLO", sub: "BLACK CHERRY", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/BlackCherryClassicPolo-1-7.webp?v=1773204987", url: "https://teegame.com.au/collections/golf-polos/products/primo-classic-collar-polo" },
      { name: "PRIMO SIGNATURE GOLF JOGGER", sub: "BLACK", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/PrimoBlackJoggerPDP-1-9.webp?v=1773274842", url: "https://teegame.com.au/collections/golf-pants/products/primo-signature-golf-jogger-black" }
    ],
    [
      { name: "GOOD GOOD TAKE W ROPE HAT", sub: "SKY BLUE", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/1Q3A0564.webp?v=1777362320", url: "https://teegame.com.au/collections/headwear/products/good-good-golf-takew-rope-hat" },
      { name: "GOOD GOOD QUARTER ZIP", sub: "CHARISMA", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/goodgood_charisma-qzip_ls-1.webp?v=1777521780", url: "https://teegame.com.au/collections/golf-outerwear/products/good-good-golf-quarter-zip-charisma" },
      { name: "PRIMO SIGNATURE GOLF JOGGER", sub: "LIGHT GREY", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/PrimoLightGrayJoggersPDP-3-3.webp?v=1773274491", url: "https://teegame.com.au/collections/golf-pants/products/primo-signature-golf-jogger-light-grey" }
    ],
    [
      { name: "GOOD GOOD ROPE HAT", sub: "BORN TO GOLF", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/1Q3A0644.webp?v=1777522324", url: "https://teegame.com.au/collections/headwear/products/good-good-golf-swing-easy-rope-hat-copy" },
      { name: "GOOD GOOD FIRST CUT POLO", sub: "GREEN", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/GG_FirstCutPolo_1.webp?v=1773539488", url: "https://teegame.com.au/collections/golf-polos/products/good-good-golf-first-cut-polo" },
      { name: "PRIMO TRADITIONAL PANTS", sub: "KHAKI", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/TraditionalPants-KhakiF_124bb347-1287-4843-9a1b-163c93983b51.jpg?v=1776753072", url: "https://teegame.com.au/collections/golf-pants/products/primo-traditional-pants-khaki" }
    ],
    [
      { name: "PRIMO MONOCHROME CURSIVE HAT", sub: "BLACK", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/BlackonBlackCursive-1_62c79218-8c7f-49f1-b8e0-5ad270d012a2.webp?v=1773205161", url: "https://teegame.com.au/collections/headwear/products/primo-monochrome-cursive-hat" },
      { name: "PRIMO BLADE POLO", sub: "BLACK", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/BlackBladePoloUpdated-1.webp?v=1773275803", url: "https://teegame.com.au/collections/golf-polos/products/primo-blade-polo-black" },
      { name: "PRIMO TRADITIONAL PANTS", sub: "LIGHT GREY", img: "https://cdn.shopify.com/s/files/1/0972/7800/1523/files/TraditionalPants-BlkF_5f4c1c8b-2875-4b88-a489-1d523ca07cf8.jpg?v=1776774332", url: "https://teegame.com.au/collections/golf-pants/products/primo-traditional-pants-light-grey" }
    ]
  ];

const HOLES = [
    {
      name: "Serene Start",
      startX: 15,
      holeX: 248,
      endX: 460,
      greenStart: 234,
      greenEnd: 260,
      holeRadius: 0.18,
      colors: {
        skyTop: "#d7f6ff",
        skyMid: "#9fe2ff",
        skyGlow: "#58b9f5",
        skyHorizon: "#1f82d7",
        fairway: "#1e5b47",
        fairwayMid: "#539e6a",
        soil: "#113a24",
        rim: "rgb(255 238 145 / 0.75)",
        flag: "#3f6a34"
      },
      atmosphere: "haze",
      terrainKnots: pts([
        [-140, 0.4],
        [-90, -0.8],
        [-40, 1.2],
        [15, 1.0],
        [60, -1.0],
        [110, 0.5],
        [160, -0.5],
        [210, 1.0],
        [234, 0.8],
        [248, 0.7],
        [260, 0.75],
        [300, -0.5],
        [350, 1.0],
        [400, -1.0],
        [460, 0.0]
      ])
    },
    {
      name: "Hillside Challenge",
      startX: 15,
      holeX: 166,
      endX: 338,
      greenStart: 154,
      greenEnd: 176,
      holeRadius: 0.18,
      colors: {
        skyTop: "#1f82d7",
        skyMid: "#58b9f5",
        skyGlow: "#9fe2ff",
        skyHorizon: "#d7f6ff",
        fairway: "#0f5a33",
        fairwayMid: "#3fa044",
        soil: "#113a24",
        rim: "rgb(255 238 145 / 0.75)",
        flag: "#245a36"
      },
      atmosphere: "haze",
      terrainKnots: pts([
        [-140, -0.8],
        [-100, 1.9],
        [-54, -0.2],
        [20, 1.2],
        [65, 3.5], // Added a hill
        [110, -2.0],
        [150, -1.0],
        [166, -0.9],
        [176, -1.05],
        [220, 1.5],
        [270, -2.0],
        [338, 0.0]
      ])
    },
    {
      name: "Valley Drop",
      startX: 15,
      holeX: 176,
      endX: 360,
      greenStart: 163,
      greenEnd: 188,
      holeRadius: 0.18,
      colors: {
        skyTop: "#7a2639",
        skyMid: "#df5a3f",
        skyGlow: "#ff9a35",
        skyHorizon: "#ffd46b",
        fairway: "#2b1d18",
        fairwayMid: "#764128",
        soil: "#1d1411",
        rim: "rgb(255 191 91 / 0.75)",
        flag: "#573224"
      },
      atmosphere: "glow",
      terrainKnots: pts([
        [-140, 0.4],
        [-96, 3.6],
        [-54, -1.0],
        [26, 2.2],
        [70, -8.0], // Deep valley
        [114, -6.1],
        [146, -2.0],
        [164, -1.2],
        [176, -1.1],
        [188, -1.25],
        [230, 2.0],
        [280, -3.0],
        [360, 0.0]
      ])
    },
    {
      name: "Island Green",
      startX: 15,
      holeX: 188,
      endX: 376,
      greenStart: 176,
      greenEnd: 198,
      holeRadius: 0.18,
      colors: {
        skyTop: "#061022",
        skyMid: "#0b2c64",
        skyGlow: "#183f86",
        skyHorizon: "#234d95",
        fairway: "#021f2c",
        fairwayMid: "#0b3b4e",
        soil: "#02121b",
        rim: "rgb(145 205 255 / 0.55)",
        flag: "#5f7485"
      },
      atmosphere: "night",
      terrainKnots: pts([
        [-140, -1.0],
        [-70, -2.2],
        [18, -5.6],
        [94, -1.0],
        [150, -8.0], // Big drop before green
        [176, -1.2],
        [188, -1.1],
        [198, -1.3],
        [210, -8.0], // Big drop after green
        [268, -2.0],
        [318, -4.8],
        [386, -2.6]
      ])
    },
    {
      name: "Cliffside Finale",
      startX: 15,
      holeX: 305,
      endX: 480,
      greenStart: 292,
      greenEnd: 316,
      holeRadius: 0.18,
      colors: {
        skyTop: "#ee9fbb",
        skyMid: "#ffc09b",
        skyGlow: "#ffe8b4",
        skyHorizon: "#fff2d0",
        fairway: "#1f5f35",
        fairwayMid: "#74bd4f",
        soil: "#11331a",
        rim: "rgb(255 240 166 / 0.76)",
        flag: "#3f6a34"
      },
      atmosphere: "soft",
      terrainKnots: pts([
        [-140, 3.0],
        [-60, 6.5],
        [15, 12.0],   // Cliff edge — player tees off from high ground
        [40, -4.0],   // Sharp cliff drop
        [80, -8.5],   // Deep valley
        [125, -5.0],
        [170, -2.5],  // Ridge
        [200, -7.0],  // Second dip
        [240, -4.0],
        [270, -6.5],  // Undulation before green
        [292, -2.8],  // Green approach rises
        [305, -2.5],  // Green (hole sits here)
        [316, -2.8],
        [340, -7.0],  // Steep fall past green
        [380, -3.0],
        [440, -6.0],
        [500, -4.0]
      ])
    },
    {
      name: "The Gauntlet",
      startX: 15,
      holeX: 365,
      endX: 520,
      greenStart: 352,
      greenEnd: 376,
      holeRadius: 0.18,
      colors: {
        skyTop: "#1a0533",
        skyMid: "#3d0e61",
        skyGlow: "#e04090",
        skyHorizon: "#ff6db0",
        fairway: "#2d1f5e",
        fairwayMid: "#5e3a9e",
        soil: "#1a0a3e",
        rim: "rgb(255 120 200 / 0.76)",
        flag: "#ff4da6"
      },
      atmosphere: "night",
      bumpers: [
        { x: 80,  y: 8,  radius: 2.5 },
        { x: 130, y: -6, radius: 3.0 },
        { x: 180, y: 4,  radius: 2.0 },
        { x: 220, y: -8, radius: 3.5 },
        { x: 270, y: 0,  radius: 2.5 },
        { x: 320, y: -5, radius: 2.0 },
      ],
      terrainKnots: pts([
        [-140, 0],
        [-60, 2],
        [15, 5.0],    // Tee on a raised platform
        [50, -3.0],   // Drop into the gauntlet
        [70, -1.5],   // Bumper approach
        [90, -5.0],   // Dip between bumpers
        [110, 0.0],   // Rise
        [140, -8.0],  // Deep chasm — need speed to clear
        [170, -4.0],  // Landing zone
        [210, -10.0], // Second chasm, deeper
        [250, -4.0],  // Landing
        [280, -8.0],  // Final obstacle dip
        [310, -1.0],  // Ramp up to green
        [352, -1.8],  // Green approach
        [365, -1.5],  // Green (hole)
        [376, -1.8],
        [400, -9.0],  // Steep punishment past green
        [460, -3.0],
        [530, -6.0]
      ])
    }
  ];

  // Scale holes to 270-290m range. Each hole keeps its startX and terrain shape,
  // but X values stretch proportionally to move the hole further from the tee.
  (() => {
    const desiredDistances = [270, 275, 280, 285, 290];
    HOLES.forEach((hole, i) => {
      const sx = hole.startX;
      const currentDist = hole.holeX - sx;
      const targetDist = desiredDistances[i];
      if (targetDist == null) return;
      const scale = targetDist / currentDist;
      const stretch = (x) => sx + (x - sx) * scale;
      hole.holeX = stretch(hole.holeX);
      hole.endX = stretch(hole.endX);
      hole.greenStart = stretch(hole.greenStart);
      hole.greenEnd = stretch(hole.greenEnd);
      hole.terrainKnots = hole.terrainKnots.map(k => ({ x: stretch(k.x), y: k.y }));
    });
  })();

  const SKY_PRESETS = [
    makeSkyPreset({
      key: "dawn-sweep",
      mood: "sunset",
      gradient: [[0, "#102e57"], [0.32, "#5369bd"], [0.63, "#fb6f87"], [0.83, "#ffc36f"], [1, "#ffc36f"]],
      cloudDensity: 0.34,
      cloudSoftness: 0.34,
      cloudSpeed: 0.018,
      cloudBand: 0.34,
      sunDirection: { x: 0.54, y: 0.82 },
      haze: 0.2,
      horizonGlow: "rgb(255 202 126 / 0.28)",
      hazeColor: "rgb(255 210 174 / 0.1)",
      cloudLight: "rgb(255 236 218 / 0.78)",
      cloudMid: "rgb(255 188 178 / 0.34)",
      cloudShade: "rgb(126 73 118 / 0.12)"
    }),
    makeSkyPreset({
      key: "bright-day",
      mood: "morning",
      gradient: [[0, "#1f82d7"], [0.36, "#58b9f5"], [0.72, "#d7f6ff"], [1, "#d7f6ff"]],
      cloudDensity: 0.38,
      cloudSoftness: 0.4,
      cloudSpeed: 0.016,
      cloudBand: 0.28,
      sunDirection: { x: 0.72, y: 0.78 },
      haze: 0.18,
      horizonGlow: "rgb(255 255 255 / 0.22)",
      hazeColor: "rgb(225 248 255 / 0.12)",
      cloudLight: "rgb(255 255 255 / 0.74)",
      cloudMid: "rgb(221 246 255 / 0.3)",
      cloudShade: "rgb(113 176 218 / 0.08)"
    }),
    makeSkyPreset({
      key: "golden-sunset",
      mood: "golden-hour",
      gradient: [[0, "#7a2639"], [0.36, "#df5a3f"], [0.65, "#ff9a35"], [0.84, "#ffd46b"], [1, "#ffd46b"]],
      cloudDensity: 0.32,
      cloudSoftness: 0.36,
      cloudSpeed: 0.012,
      cloudBand: 0.38,
      sunDirection: { x: 0.5, y: 0.84 },
      haze: 0.24,
      horizonGlow: "rgb(255 220 129 / 0.38)",
      hazeColor: "rgb(255 177 111 / 0.12)",
      cloudLight: "rgb(255 220 150 / 0.68)",
      cloudMid: "rgb(255 136 115 / 0.28)",
      cloudShade: "rgb(120 45 50 / 0.12)"
    }),
    makeSkyPreset({
      key: "moonlit-night",
      mood: "night",
      gradient: [[0, "#061022"], [0.44, "#0b2c64"], [0.76, "#183f86"], [1, "#234d95"]],
      cloudDensity: 0.18,
      cloudSoftness: 0.34,
      cloudSpeed: 0.006,
      cloudBand: 0.3,
      sunDirection: { x: 0.46, y: 0.24 },
      haze: 0.12,
      horizonGlow: "rgb(120 160 255 / 0.14)",
      hazeColor: "rgb(120 160 255 / 0.08)",
      cloudLight: "rgb(161 196 255 / 0.28)",
      cloudMid: "rgb(98 136 208 / 0.16)",
      cloudShade: "rgb(4 12 26 / 0.22)"
    }),
    makeSkyPreset({
      key: "autumn-afternoon",
      mood: "golden-hour",
      gradient: [[0, "#b65a2f"], [0.48, "#ed9c58"], [0.78, "#ffd88a"], [1, "#ffe2a8"]],
      cloudDensity: 0.26,
      cloudSoftness: 0.35,
      cloudSpeed: 0.012,
      cloudBand: 0.34,
      sunDirection: { x: 0.62, y: 0.78 },
      haze: 0.22,
      horizonGlow: "rgb(255 211 106 / 0.28)",
      hazeColor: "rgb(255 225 172 / 0.12)",
      cloudLight: "rgb(255 231 185 / 0.58)",
      cloudMid: "rgb(219 139 82 / 0.22)",
      cloudShade: "rgb(84 50 25 / 0.12)"
    }),
    makeSkyPreset({
      key: "winter-morning",
      mood: "overcast",
      gradient: [[0, "#5ba6df"], [0.42, "#bfe8ff"], [0.76, "#ecf9ff"], [1, "#f4fbff"]],
      cloudDensity: 0.46,
      cloudSoftness: 0.5,
      cloudSpeed: 0.01,
      cloudBand: 0.26,
      sunDirection: { x: 0.66, y: 0.72 },
      haze: 0.34,
      horizonGlow: "rgb(255 255 255 / 0.34)",
      hazeColor: "rgb(235 250 255 / 0.2)",
      cloudLight: "rgb(255 255 255 / 0.62)",
      cloudMid: "rgb(218 241 255 / 0.28)",
      cloudShade: "rgb(112 160 190 / 0.08)"
    }),
    makeSkyPreset({
      key: "spring-blossom",
      mood: "spring",
      gradient: [[0, "#ee9fbb"], [0.44, "#ffc09b"], [0.78, "#ffe8b4"], [1, "#fff2d0"]],
      cloudDensity: 0.36,
      cloudSoftness: 0.42,
      cloudSpeed: 0.018,
      cloudBand: 0.3,
      sunDirection: { x: 0.58, y: 0.78 },
      haze: 0.24,
      horizonGlow: "rgb(255 240 166 / 0.28)",
      hazeColor: "rgb(255 238 210 / 0.14)",
      cloudLight: "rgb(255 251 238 / 0.62)",
      cloudMid: "rgb(255 214 203 / 0.26)",
      cloudShade: "rgb(168 112 137 / 0.08)"
    }),
    makeSkyPreset({
      key: "storm-moody-night",
      mood: "stormy",
      gradient: [[0, "#07101a"], [0.46, "#142638"], [0.76, "#253b52"], [1, "#394a5c"]],
      cloudDensity: 0.64,
      cloudSoftness: 0.44,
      cloudSpeed: 0.004,
      cloudBand: 0.24,
      sunDirection: { x: 0.74, y: 0.3 },
      haze: 0.2,
      horizonGlow: "rgb(120 150 180 / 0.11)",
      hazeColor: "rgb(94 116 136 / 0.1)",
      cloudLight: "rgb(90 116 136 / 0.24)",
      cloudMid: "rgb(38 55 72 / 0.34)",
      cloudShade: "rgb(2 8 12 / 0.34)"
    }),
    makeSkyPreset({
      key: "coastal-dusk",
      mood: "sunset",
      gradient: [[0, "#18314f"], [0.42, "#4d6aa0"], [0.68, "#ef8ca3"], [0.86, "#ffd7ab"], [1, "#ffd7ab"]],
      cloudDensity: 0.42,
      cloudSoftness: 0.4,
      cloudSpeed: 0.014,
      cloudBand: 0.32,
      sunDirection: { x: 0.48, y: 0.82 },
      haze: 0.26,
      horizonGlow: "rgb(255 215 171 / 0.28)",
      hazeColor: "rgb(255 218 201 / 0.12)",
      cloudLight: "rgb(255 237 223 / 0.58)",
      cloudMid: "rgb(222 151 176 / 0.24)",
      cloudShade: "rgb(70 78 126 / 0.1)"
    })
  ];

  let currentHoleIndex = 0;
  let currentCourse = HOLES[currentHoleIndex];
  let terrainKnots = currentCourse.terrainKnots;
  const COURSE = {};
  const COLORS = {};
  Object.defineProperties(COURSE, {
    startX: { get: () => currentCourse.startX },
    holeX: { get: () => currentCourse.holeX },
    endX: { get: () => currentCourse.endX },
    greenStart: { get: () => currentCourse.greenStart },
    greenEnd: { get: () => currentCourse.greenEnd },
    holeRadius: { get: () => currentCourse.holeRadius },
    bumpers: { get: () => currentCourse.bumpers || [] }
  });
  Object.defineProperties(COLORS, {
    skyTop: { get: () => currentCourse.colors.skyTop },
    skyMid: { get: () => currentCourse.colors.skyMid },
    skyGlow: { get: () => currentCourse.colors.skyGlow },
    skyHorizon: { get: () => currentCourse.colors.skyHorizon },
    fairway: { get: () => currentCourse.colors.fairway },
    fairwayMid: { get: () => currentCourse.colors.fairwayMid },
    soil: { get: () => currentCourse.colors.soil },
    ball: { get: () => "#fbfff9" },
    ballShade: { get: () => "#cad6cc" },
    guideLanding: { get: () => "#ffd66f" },
    rim: { get: () => currentCourse.colors.rim },
    flag: { get: () => currentCourse.colors.flag }
  });

  const guide = [];
  const shotCaptions = [];

  const assets = {
    ball: null,
    ballReady: false,
    terrainOverlay: null,
    terrainOverlayReady: false,
    outfits: OUTFIT_SETS.map(() => ({ swing: null, putt: null, idle: null, ready: false }))
  };
  assets.ball = loadImage(BALL_SPRITE_SRC);
  OUTFIT_SETS.forEach((set, i) => {
    const outfit = assets.outfits[i];
    outfit.swing = new Image(); outfit.swing.decoding = "async";
    outfit.putt = new Image(); outfit.putt.decoding = "async";
    outfit.idle = new Image(); outfit.idle.decoding = "async";
    let loaded = 0;
    const onLoad = () => { loaded++; if (loaded >= 3) outfit.ready = true; };
    outfit.swing.onload = onLoad; outfit.swing.src = set.swing;
    outfit.putt.onload = onLoad; outfit.putt.src = set.putt;
    outfit.idle.onload = onLoad; outfit.idle.src = set.idle;
    if (outfit.swing.complete) loaded++;
    if (outfit.putt.complete) loaded++;
    if (outfit.idle.complete) loaded++;
    if (loaded >= 3) outfit.ready = true;
  });
  assets.terrainOverlay = loadImage(TERRAIN_OVERLAY_SRC, "terrainOverlayReady");
  const skySystem = window.SkySystem && skyCanvas ? new window.SkySystem(skyCanvas, { quality: SKY_QUALITY }) : null;
  window.teeSkySystem = skySystem;
  let world = createWorld();
  let gameStats = {
    totalStrokes: 0,
    totalTime: 0,
    bestScore: null,
    totalYards: 0,
    holesPlayed: 0
  };
  let view = {
    x: 0,
    y: 0,
    scale: 29,
    targetX: 0,
    targetY: 0,
    targetScale: 29,
    shakeX: 0,
    shakeY: 0
  };
  let pointer = null;
  let accumulator = 0;
  let lastTime = performance.now();
  let shotPreview = null;
  let guideCache = { x: Number.NaN, y: Number.NaN, ballX: Number.NaN, ballY: Number.NaN, time: 0 };
  let terrainOverlayPattern = null;
  let minimapCache = null;
  let terrainSurfaceCache = null;
  let resizeQueued = true;
  let multiplayerShotPending = false;
  let botMatchShotPending = false;
  let opponentAimData = null;
  let opponentAimGuide = [];
  let opponentSwingTimer = 0;
  let opponentSwingFrame = -1;
  let opponentAiming = false;
  let lastKnownActiveId = null;

  // ---- Multiplayer helpers ----

  function isMultiplayerActive() {
    return window.TeeMultiplayer && window.TeeMultiplayer.isEnabled();
  }

  function isBotMatchActive() {
    return window.TeeBotMatch && window.TeeBotMatch.isPlaying();
  }

  function canLocalAim() {
    if (isMultiplayerActive()) return window.TeeMultiplayer.isLocalTurn();
    if (isBotMatchActive()) return window.TeeBotMatch.isLocalTurn();
    return true;
  }

  function getMultiplayerUserId() {
    return window.TeeMultiplayer ? window.TeeMultiplayer.getUserId() : null;
  }

  function getMultiplayerTurnNumber() {
    if (!window.TeeMultiplayer) return 0;
    return window.TeeMultiplayer.getTurnNumber?.() || 0;
  }

  function serializeBall(ball) {
    return {
      x: ball.x, y: ball.y,
      vx: ball.vx, vy: ball.vy,
      omega: ball.omega, angle: ball.angle,
      grounded: ball.grounded, asleep: ball.asleep,
      slipping: ball.slipping
    };
  }

  function applyBallState(ball, state) {
    if (!state) return;
    ball.x = state.x ?? ball.x;
    ball.y = state.y ?? ball.y;
    ball.vx = state.vx ?? 0;
    ball.vy = state.vy ?? 0;
    ball.omega = state.omega ?? 0;
    ball.angle = state.angle ?? 0;
    ball.grounded = state.grounded ?? true;
    ball.asleep = state.asleep ?? true;
    ball.slipping = state.slipping ?? false;
    ball.bounceCount = 0;
  }

  function emitGameEvent(name, detail) {
    window.dispatchEvent(new CustomEvent("tee:" + name, { detail }));
  }

  // ---- Multiplayer event listeners ----

  window.addEventListener("tee:multiplayer-state", (event) => {
    const detail = event.detail;
    if (!isMultiplayerActive()) return;

    if (detail.status === "playing") {
      // Hide intro on first match start
      const introModal = document.getElementById("intro-modal");
      if (introModal && introModal.classList.contains("visible")) {
        introModal.classList.remove("visible");
      }

      // Check if hole changed
      const newHoleIndex = detail.holeIndex;
      if (newHoleIndex !== undefined && newHoleIndex !== currentHoleIndex && newHoleIndex < HOLES.length) {
        setHole(newHoleIndex);
        world.holed = false;
        world.holeTransitionShown = false;
        world.holeSinkTimer = 0;
        world.strokes = 0;
      }
      // Turn changed - load correct ball state
      loadMultiplayerStateIntoWorld();
    }

    if (detail.status === "finished") {
      pointer = null;
      shotPreview = null;
      guide.length = 0;
      invalidateGuideCache();
    }
  });

  window.addEventListener("tee:multiplayer-exit", () => {
    // Return to solo mode intro
    const introModal = document.getElementById("intro-modal");
    if (introModal && !introModal.classList.contains("visible")) {
      introModal.classList.add("visible");
    }
    setHole(0);
    world.strokes = 0;
    world.holed = false;
    world.holeTransitionShown = false;
    pointer = null;
    shotPreview = null;
    guide.length = 0;
    invalidateGuideCache();
  });

  window.addEventListener("tee:multiplayer-state", (event) => {
    const detail = event.detail;
    if (!isMultiplayerActive()) return;

    if (detail.status === "playing") {
      // Check if hole changed
      const newHoleIndex = detail.holeIndex;
      if (newHoleIndex !== undefined && newHoleIndex !== currentHoleIndex && newHoleIndex < HOLES.length) {
        setHole(newHoleIndex);
        world.holed = false;
        world.holeTransitionShown = false;
        world.holeSinkTimer = 0;
        world.strokes = 0;
      }
      // Turn changed - load correct ball state
      loadMultiplayerStateIntoWorld();
    }

    if (detail.status === "finished") {
      // Match over - disable input, show result handled by UI
      pointer = null;
      shotPreview = null;
      guide.length = 0;
      invalidateGuideCache();
    }
  });

  window.addEventListener("tee:opponent-shot-settled", (event) => {
    if (!isMultiplayerActive()) return;
    const detail = event.detail;
    if (!detail || !detail.ball) return;

    opponentSwingFrame = -1;
    opponentAimData = null;
    opponentAimGuide = [];
    opponentAiming = false;

    // Apply opponent's final ball state
    applyBallState(world.ball, detail.ball);
    world.ball.asleep = true;
    world.ball.grounded = true;
    world.ball.vx = 0;
    world.ball.vy = 0;
    world.ball.omega = 0;
    world.player.x = world.ball.x;
    world.player.y = world.ball.y;
    world.player.animating = false;
    world.player.timer = 0;
    world.player.frame = 0;
    world.player.idleTimer = 0;
    world.player.pendingLaunch = null;
    world.cameraMode = "settled";
    world.launchOriginX = world.ball.x;
    invalidateGuideCache();

    // Load local player strokes from room
    loadMultiplayerStateIntoWorld();
  });

  window.addEventListener("tee:opponent-aim-update", (event) => {
    if (!isMultiplayerActive() || isMultiplayerActive() && window.TeeMultiplayer.isLocalTurn()) return;
    opponentAimData = event.detail;
    opponentAiming = true;
    // Keep aim data alive for ~800ms between updates before fading guide
    clearTimeout(opponentAimData._timeout);
    opponentAimData._timeout = setTimeout(() => { opponentAimData = null; opponentAimGuide = []; }, 800);

    const aim = opponentAimData;
    if (aim && aim.preview) {
      // Update player direction from aim
      if (aim.preview.launch) {
        world.player.direction = aim.preview.launch.vx >= 0 ? 1 : -1;
      }
    }

    // Compute guide path from opponent's launch data (throttled)
    if (aim && aim.preview && aim.ball) {
      const now = performance.now();
      if (aim._lastGuideCompute && now - aim._lastGuideCompute < 100) return;
      aim._lastGuideCompute = now;
      const ghost = {
        x: aim.ball.x,
        y: aim.ball.y,
        vx: aim.preview.launch.vx,
        vy: aim.preview.launch.vy,
        omega: aim.preview.launch.omega,
        angle: 0,
        slipping: aim.preview.mode !== "putt",
        grounded: aim.preview.mode === "putt",
        asleep: false
      };
      opponentAimGuide = [];
      let bounces = 0;
      for (let i = 0; i < 180; i++) {
        if (aim.preview.mode === "putt") {
          stepGroundedGhost(ghost, 1 / 60);
        } else if (!ghost.grounded) {
          stepAir(ghost, 1 / 60);
          resolveGhostCollision(ghost);
          if (ghost.grounded) bounces += 1;
        } else {
          stepGroundedGhost(ghost, 1 / 60);
        }
        if (i % 5 === 0) {
          opponentAimGuide.push({ x: ghost.x, y: ghost.y, grounded: ghost.grounded });
        }
        if (ghost.grounded && Math.abs(groundSpeed(ghost)) < 0.35) break;
        if (bounces > 2 && i > 80) break;
        if (ghost.x < -70 || ghost.x > COURSE.endX + 65 || ghost.y < -20) break;
      }
    }
  });

  window.addEventListener("tee:opponent-shot-start", (event) => {
    if (!isMultiplayerActive()) return;
    const detail = event.detail;
    if (!detail || !detail.launch) return;

    world.strokes = detail.strokeNumber || 0;
    world.ball.asleep = false;
    world.ball.grounded = detail.mode === "putt";
    world.ball.vx = detail.launch.vx;
    world.ball.vy = detail.launch.vy;
    world.ball.omega = detail.launch.omega;
    world.ball.slipping = detail.mode !== "putt";
    world.ball.bounceCount = 0;
    world.launchOriginX = world.ball.x;
    world.cameraMode = "flight";
    world.finishTimer = 0;
    world.slowTimer = 0;
    world.trail = [];

    if (detail.mode !== "putt") {
      AUDIO.swing.currentTime = 0;
      AUDIO.swing.play().catch(() => {});
      world.cameraShake = 0.35 + detail.power * 1.5;
    } else {
      AUDIO.putt.currentTime = 0;
      AUDIO.putt.play().catch(() => {});
    }

    opponentSwingTimer = 0;
    opponentSwingFrame = 0;
    opponentAimData = null;
    opponentAimGuide = [];
    opponentAiming = false;

    world.player.direction = detail.launch.vx >= 0 ? 1 : -1;
  });

  function loadMultiplayerStateIntoWorld() {
    if (!isMultiplayerActive()) return;
    const mp = window.TeeMultiplayer;

    // Only reset opponent state when active player actually changes
    const currentActiveId = mp.getActivePlayerId();
    if (currentActiveId !== lastKnownActiveId) {
      lastKnownActiveId = currentActiveId;
      opponentSwingFrame = -1;
      opponentAimData = null;
      opponentAimGuide = [];
      opponentAiming = false;
    }

    const localPlayer = mp.getLocalPlayerState();
    const opponent = mp.getOpponentPlayerState();

    if (mp.isLocalTurn() && localPlayer && localPlayer.ball) {
      if (localPlayer.ball.x === 0 && localPlayer.ball.y === 0) {
        // Initial state - position at tee
        world.ball.x = COURSE.startX;
        world.ball.y = terrainHeight(COURSE.startX) + BALL.radius;
      } else {
        applyBallState(world.ball, localPlayer.ball);
      }
      world.strokes = localPlayer.currentHoleStrokes || 0;
      world.holed = localPlayer.holed || false;
      if (world.holed) world.holeTransitionShown = true;
      world.player.x = world.ball.x;
      world.player.y = world.ball.y;
      world.player.animating = false;
      world.player.timer = 0;
      world.player.frame = 0;
      world.player.idleTimer = 0;
      world.player.pendingLaunch = null;
      pointer = null;
      shotPreview = null;
      guide.length = 0;
      invalidateGuideCache();
      world.cameraMode = "settled";
      world.farthestHit = 0;
      world.launchOriginX = world.ball.x;
      world.holeTimer = 0;
    } else if (!mp.isLocalTurn() && opponent && opponent.ball) {
      if (opponent.ball.x === 0 && opponent.ball.y === 0) {
        world.ball.x = COURSE.startX;
        world.ball.y = terrainHeight(COURSE.startX) + BALL.radius;
      } else {
        applyBallState(world.ball, opponent.ball);
      }
      world.strokes = opponent.currentHoleStrokes || 0;
      world.holed = opponent.holed || false;
      world.player.x = world.ball.x;
      world.player.y = world.ball.y;
      world.player.animating = false;
      world.player.timer = 0;
      world.player.frame = 0;
      world.player.idleTimer = 0;
      world.player.pendingLaunch = null;
      pointer = null;
      shotPreview = null;
      guide.length = 0;
      invalidateGuideCache();
      world.cameraMode = "settled";
      world.farthestHit = 0;
      world.launchOriginX = world.ball.x;
      world.holeTimer = 0;
    }
  }

  function createWorld() {
    const x = COURSE.startX;
    const y = terrainHeight(x) + BALL.radius;
    return {
      holeIndex: currentHoleIndex,
      ball: {
        x,
        y,
        vx: 0,
        vy: 0,
        omega: 0,
        angle: 0,
        slipping: false,
        grounded: true,
        asleep: true,
        bounceCount: 0,
        nearMissShown: false
      },
      player: {
        x,
        y,
        direction: 1,
        animating: false,
        aiming: false,
        timer: 0,
        frame: 0,
        idleTimer: 0,
        pendingLaunch: null
      },
      cameraMode: "address",
      strokes: 0,
      holed: false,
      messageTimer: 0,
      holeSinkTimer: 0,
      cameraShake: 0,
      trail: [],
      finishTimer: 0,
      slowTimer: 0,
      freezeTimer: 0,
      holeTransitionShown: false,
      holeTimer: 0,
      farthestHit: 0,
      launchOriginX: 0
    };
  }



  function terrainHeight(x) {
    const first = terrainKnots[0];
    const last = terrainKnots[terrainKnots.length - 1];
    if (x < first.x) {
      const dx = x - first.x;
      return first.y + Math.sin(dx * 0.045) * 1.8 + Math.sin(dx * 0.018) * 1.1;
    }
    if (x > last.x) {
      const dx = x - last.x;
      return last.y + Math.sin(dx * 0.04) * 2.0 + Math.sin(dx * 0.017) * 1.2;
    }

    let segment = 0;
    for (let i = 0; i < terrainKnots.length - 1; i += 1) {
      if (x >= terrainKnots[i].x && x <= terrainKnots[i + 1].x) {
        segment = i;
        break;
      }
    }
    const p0 = terrainKnots[Math.max(0, segment - 1)];
    const p1 = terrainKnots[segment];
    const p2 = terrainKnots[segment + 1];
    const p3 = terrainKnots[Math.min(terrainKnots.length - 1, segment + 2)];
    const t = clamp((x - p1.x) / (p2.x - p1.x), 0, 1);
    return catmullRom(p0.y, p1.y, p2.y, p3.y, t);
  }

  function terrainSlope(x) {
    const e = 0.08;
    return (terrainHeight(x + e) - terrainHeight(x - e)) / (e * 2);
  }

  function terrainFrame(x) {
    const slope = terrainSlope(x);
    const inv = 1 / Math.hypot(1, slope);
    return {
      tangentX: inv,
      tangentY: slope * inv,
      normalX: -slope * inv,
      normalY: inv,
      slope
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rpmToRadPerSecond(rpm) {
    return rpm * Math.PI * 2 / 60;
  }

  function rollingOmega(tangentVelocity) {
    return -tangentVelocity / BALL.radius;
  }

  function spinRpm(ball) {
    return ball.omega * 60 / (Math.PI * 2);
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  function loadImage(src, readyKey = "ballReady") {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      assets[readyKey] = true;
    };
    image.src = src;
    return image;
  }

  function makeSkyPreset(preset) {
    const skyLightColor = preset.skyLightColor || brightestGradientColor(preset.gradient);
    const shaderColors = {
      top: colorToRgb(preset.gradient[0][1]),
      mid: colorToRgb(preset.gradient[Math.min(1, preset.gradient.length - 1)][1]),
      glow: colorToRgb(preset.gradient[Math.max(0, preset.gradient.length - 2)][1]),
      horizon: colorToRgb(preset.gradient[preset.gradient.length - 1][1]),
      cloudLight: colorToRgb(skyLightColor),
      cloudShade: colorToRgb(colorFromCssRgb(preset.cloudShade, "#6c7890"))
    };
    return {
      seed: preset.key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) / 997,
      ...preset,
      skyLightColor,
      shaderColors
    };
  }

  function currentSkyPreset() {
    return SKY_PRESETS[currentHoleIndex] || SKY_PRESETS[0];
  }

  function colorToRgb(color) {
    if (window.SkySystem?.colorToRgb) return window.SkySystem.colorToRgb(color);
    const hex = color.replace("#", "");
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255
    ];
  }

  function colorFromCssRgb(color, fallback) {
    if (!color.startsWith("rgb")) return color;
    const matches = color.match(/\d+(\.\d+)?/g);
    if (!matches || matches.length < 3) return fallback;
    const values = matches.slice(0, 3).map((value) => clamp(Math.round(Number(value)), 0, 255).toString(16).padStart(2, "0"));
    return `#${values.join("")}`;
  }

  function brightestGradientColor(gradient) {
    let best = gradient[0][1];
    let bestLuma = -1;
    gradient.forEach(([, color]) => {
      const [r, g, b] = colorToRgb(color);
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      if (luma > bestLuma) {
        best = color;
        bestLuma = luma;
      }
    });
    return best;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(2, Math.floor(rect.width * dpr));
    canvas.height = Math.max(2, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    skySystem?.resize(rect.width, rect.height);
    resizeQueued = false;
    snapCamera();
  }

  function canvasSize() {
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function snapCamera() {
    updateCameraTargets();
    view.x = view.targetX;
    view.y = view.targetY;
    view.scale = view.targetScale;
  }

  function updateCameraTargets() {
    const { width, height } = canvasSize();
    const b = world.ball;
    const terrainY = terrainHeight(b.x);
    const heightAboveGround = Math.max(0, b.y - terrainY);
    const verticalSpan = Math.max(24, Math.min(58, 27 + Math.abs(b.vy) * 0.18 + heightAboveGround * 1.08));
    const scaleByHeight = height / verticalSpan;
    const scaleByWidth = width / (verticalSpan * (width / height));
    const shotScale = Math.min(scaleByHeight, scaleByWidth) * (b.grounded ? 0.98 : 0.82);

    let ballScreenRatio = 0.38;
    let targetX = b.x - (width / shotScale) * ballScreenRatio;
    let targetY = terrainY - height / shotScale * 0.34;

    if (world.cameraMode === "address") {
      const holeDistance = COURSE.holeX - b.x;
      if (Math.abs(holeDistance) < width / shotScale * 0.55) {
        targetX = (b.x + COURSE.holeX) * 0.5 - width / shotScale * 0.5;
      }
    }

    if (world.cameraMode === "flight") {
      ballScreenRatio = 0.5;
      targetX = b.x - (width / shotScale) * ballScreenRatio;
      const ballScreenY = b.grounded ? 0.55 : b.vy > 0 ? 0.38 : 0.42;
      const ballTargetY = b.y - (height / shotScale) * (1 - ballScreenY);
      targetY = Math.max(targetY, ballTargetY);
    }

    if (world.cameraMode === "flight" && b.grounded && Math.abs(groundSpeed(b)) < 8.5) {
      world.cameraMode = "roll";
    }

    if (world.cameraMode === "roll" && Math.abs(groundSpeed(b)) > 9.5) {
      world.cameraMode = "flight";
    }

    if (world.cameraMode === "settled") {
      const ballPastHole = b.x > COURSE.holeX + 8;
      if (ballPastHole) {
        const scale = clamp(width / 36, height / 38, height / 21);
        view.targetScale = scale;
        view.targetX = b.x - width / scale * 0.5;
        view.targetY = terrainY - height / scale * 0.34;
        return;
      }

      const left = b.x;
      const right = Math.min(COURSE.holeX, b.x + 42);
      const desiredSpan = Math.max(32, (right - left) / 0.42);
      const scale = clamp(width / desiredSpan, height / 38, height / 21);
      view.targetScale = scale;
      view.targetX = b.x - width / scale * 0.38;
      view.targetY = terrainHeight((left + right) * 0.5) - height / scale * 0.34;
      return;
    }

    const cameraPadding = width / shotScale * 0.56;
    const minCameraX = Math.min(-8, b.x - cameraPadding);
    const maxCameraX = Math.max(COURSE.endX - width / shotScale + 8, b.x - width / shotScale * 0.5);
    view.targetX = clamp(targetX, minCameraX, maxCameraX);
    view.targetY = targetY;
    view.targetScale = clamp(shotScale, height / 48, height / 18);
  }

  function worldToScreen(x, y) {
    const { height } = canvasSize();
    
    return {
      x: (x - (view.x + view.shakeX)) * view.scale,
      y: height - (y - (view.y + view.shakeY)) * view.scale
    };
  }

  function update(dt) {
    updateCameraTargets();
    if (world.cameraShake > 0) {
      world.cameraShake = Math.max(0, world.cameraShake - dt * 3.5); // Decay
      const shakeAmt = world.cameraShake * 0.8;
      view.shakeX = (Math.random() - 0.5) * shakeAmt;
      view.shakeY = (Math.random() - 0.5) * shakeAmt;
    } else {
      view.shakeX = 0;
      view.shakeY = 0;
    }

    const responsiveness = 1 - Math.pow(world.cameraMode === "flight" ? 0.000001 : 0.001, dt);
    view.x = lerp(view.x, view.targetX, responsiveness);
    view.y = lerp(view.y, view.targetY, responsiveness);
    view.scale = lerp(view.scale, view.targetScale, responsiveness);

    if (world.player.animating || world.player.aiming) {
      world.player.timer += dt;
      if (world.player.animating) {
        const FPS = 18; // Slightly slower so we can appreciate the animation
        const newFrame = Math.floor(world.player.timer * FPS);
        
        const isPutt = world.player.pendingLaunch.mode === "putt";
        const CONTACT_FRAME = isPutt ? 6 : 7;
        const MAX_FRAME = isPutt ? 7 : 9;

        if (world.player.frame < CONTACT_FRAME && newFrame >= CONTACT_FRAME) {
          const b = world.ball;
          const preview = world.player.pendingLaunch;
          if (preview) {
            if (preview.mode === "putt") {
              AUDIO.putt.currentTime = 0;
              AUDIO.putt.play().catch(() => {});
            } else {
              AUDIO.swing.currentTime = 0;
              AUDIO.swing.play().catch(() => {});
              world.cameraShake = 0.5 + preview.power * 1.5;
            }

            const launch = preview.launch;
            b.vx = launch.vx;
            b.vy = launch.vy;
            b.omega = launch.omega;
            b.slipping = preview.mode === "putt" ? false : true;
            b.grounded = preview.mode === "putt";
            b.asleep = false;
            b.bounceCount = 0;
            world.launchOriginX = b.x;
            world.strokes += 1;
            spawnStrikeCaption(preview.power, preview.mode);
            world.cameraMode = "flight";
            world.finishTimer = 0;
            world.slowTimer = 0;

            if (isMultiplayerActive()) {
              multiplayerShotPending = true;
              emitGameEvent("shot-started", {
                holeIndex: currentHoleIndex,
                playerId: getMultiplayerUserId(),
                turnNumber: getMultiplayerTurnNumber(),
                strokeNumber: world.strokes,
                mode: preview.mode,
                power: preview.power,
                launch: { vx: launch.vx, vy: launch.vy, omega: launch.omega },
                ballBefore: { x: b.x, y: b.y, vx: 0, vy: 0, omega: 0, angle: b.angle, grounded: true, asleep: true, slipping: false },
                startedAt: Date.now()
              });
            }

            if (isBotMatchActive() && window.TeeBotMatch.isLocalTurn()) {
              botMatchShotPending = true;
            }
          }
        }

        world.player.frame = Math.min(newFrame, MAX_FRAME);
      }
    } else {
      // If not animating or aiming, advance the idle timer
      world.player.idleTimer += dt;
    }

    // Advance opponent swing animation
    if (opponentSwingFrame >= 0 && opponentSwingFrame < 9) {
      opponentSwingTimer += dt;
      const oppFPS = 18;
      opponentSwingFrame = Math.min(Math.floor(opponentSwingTimer * oppFPS), 9);
      if (opponentSwingFrame >= 9) {
        opponentSwingFrame = -1;
      }
    }

    if (!world.holed) {
      world.holeTimer += dt;
    }

    if (!world.ball.asleep || !world.ball.grounded) {
      stepBall(world.ball, dt);
      
      const dx = Math.abs(world.ball.x - world.launchOriginX);
      if (dx > world.farthestHit) world.farthestHit = dx;
      
      // Update trail
      const speed = Math.hypot(world.ball.vx, world.ball.vy);
      if (speed > 10 && !world.ball.grounded) {
        world.trail.push({ x: world.ball.x, y: world.ball.y, age: 0 });
      }
      
      world.cameraMode = world.ball.grounded && Math.abs(groundSpeed(world.ball)) < 0.25 ? "settled" : "flight";
      
      updateSlowSettle(dt);
    }

    // Age and prune trail
    for (let i = world.trail.length - 1; i >= 0; i--) {
      world.trail[i].age += dt;
      if (world.trail[i].age > 0.4) {
        world.trail.splice(i, 1);
      }
    }

    if (world.messageTimer > 0) {
      world.messageTimer -= dt;
    }

    if (world.holed) {
      if (world.holeSinkTimer === 0) {
        AUDIO.hole.currentTime = 0;
        AUDIO.hole.play().catch(() => {});
      }
      world.holeSinkTimer += dt;
      const sinkWorld = terrainHeight(COURSE.holeX);
      const t = clamp(world.holeSinkTimer / 0.28, 0, 1);
      world.ball.x = COURSE.holeX;
      world.ball.y = sinkWorld + BALL.radius * (0.32 - t * 1.55);
      if (world.holeSinkTimer > 2.0 && !world.holeTransitionShown) {
        world.holeTransitionShown = true;
        if (isMultiplayerActive() || isBotMatchActive()) {
          emitGameEvent("hole-complete");
        } else {
          showHoleAdvance();
        }
      }
    }

    updateShotCaptions(dt);
    updateFreezeSettle(dt);
  }

  function updateSlowSettle(dt) {
    const ball = world.ball;
    if (!ball.grounded || ball.asleep) {
      world.finishTimer = 0;
      world.slowTimer = 0;
      return;
    }
    const speed = Math.abs(groundSpeed(ball));
    const slope = Math.abs(terrainSlope(ball.x));
    if (speed < FINISH_SETTLE_SPEED && slope < FINISH_SETTLE_SLOPE) {
      world.finishTimer += dt;
      if (world.finishTimer >= FINISH_SETTLE_SECONDS) {
        settleBall(ball, true);
        return;
      }
    } else {
      world.finishTimer = 0;
    }
    if (speed < FORCE_SETTLE_SPEED) {
      world.slowTimer += dt;
      if (world.slowTimer >= FORCE_SETTLE_SECONDS) {
        settleBall(ball, true);
      }
    } else {
      world.slowTimer = 0;
    }
  }

  function updateFreezeSettle(dt) {
    const ball = world.ball;
    if (ball.asleep || world.holed) {
      world.freezeTimer = 0;
      return;
    }

    const surfaceY = terrainHeight(ball.x) + BALL.radius;
    const closeToGround = ball.grounded || Math.abs(ball.y - surfaceY) < 0.12;
    const speed = Math.hypot(ball.vx, ball.vy);
    const ground = Math.abs(groundSpeed(ball));
    const slope = Math.abs(terrainSlope(ball.x));
    const slowAndFlat = speed < 0.28 && ground < 0.12 && Math.abs(ball.vy) < 0.6 && slope < 0.62;

    if (closeToGround && slowAndFlat) {
      world.freezeTimer += dt;
      if (world.freezeTimer >= 0.12) {
        settleBall(ball, true);
      }
    } else {
      world.freezeTimer = 0;
    }
  }

  function settleBall(ball, triggerWheel) {
    const wasMoving = !ball.asleep;
    ball.y = terrainHeight(ball.x) + BALL.radius;
    ball.vx = 0;
    ball.vy = 0;
    ball.omega = 0;
    ball.slipping = false;
    ball.grounded = true;
    ball.asleep = true;
    world.finishTimer = 0;
    world.slowTimer = 0;
    world.freezeTimer = 0;
    world.cameraMode = "settled";
    
    if (wasMoving) {
      if (!isBotMatchActive() || window.TeeBotMatch.isLocalTurn()) {
        world.player.x = ball.x;
        world.player.y = ball.y;
        world.player.animating = false;
        world.player.timer = 0;
        world.player.frame = 0;
        world.player.idleTimer = 0;
        world.player.pendingLaunch = null;
      }
    }

    if (triggerWheel && wasMoving && !world.holed) {
      spawnLandingCaption();
    }

    if (wasMoving && isMultiplayerActive() && multiplayerShotPending) {
      multiplayerShotPending = false;
      emitGameEvent("shot-settled", {
        holeIndex: currentHoleIndex,
        playerId: getMultiplayerUserId(),
        turnNumber: getMultiplayerTurnNumber(),
        strokes: world.strokes,
        holed: world.holed,
        ball: serializeBall(ball),
        farthestHit: world.farthestHit,
        holeTimer: world.holeTimer,
        settledAt: Date.now()
      });
    }

    if (wasMoving && isBotMatchActive() && botMatchShotPending) {
      botMatchShotPending = false;
      emitGameEvent("shot-settled", {
        strokes: world.strokes,
        holed: world.holed,
        ball: serializeBall(ball),
        farthestHit: world.farthestHit
      });
    }
  }



  function spawnStrikeCaption(power, mode) {
    if (power > 0.95) {
      pushCaption(mode === "putt" ? "MAX PUTT!" : "FULL POWER!", "CRUSHED", {
        tone: "gold",
        y: 0.31,
        duration: 1.05,
        impact: 1.2
      });
    } else if (power < 0.15) {
      pushCaption(mode === "putt" ? "TAP IN" : "DELICATE", "TOUCH", {
        tone: "white",
        y: 0.31,
        duration: 1.05,
        impact: 0.8
      });
    }
  }

  function spawnLandingCaption() {
    const toPin = COURSE.holeX - world.ball.x;
    const distance = Math.abs(toPin);
    let text = "SETTLED";
    let sub = `${distance.toFixed(1)}M ${toPin < 0 ? "LONG" : "SHORT"}`;
    let tone = "white";
    if (distance < 1.4) {
      text = "TAP-IN!";
      sub = "RIGHT THERE";
      tone = "gold";
    } else if (distance < 4) {
      text = "CLOSE!";
      sub = `${distance.toFixed(1)}M TO PIN`;
      tone = "gold";
    } else if (Math.abs(toPin) < 9) {
      text = "PIN HIGH!";
      sub = `${distance.toFixed(1)}M AWAY`;
      tone = "mint";
    } else if (toPin < 0) {
      text = "SAILED!";
      tone = "coral";
    } else {
      text = "NEEDS LEGS!";
      tone = "coral";
    }
    pushCaption(text, sub, {
      tone,
      y: 0.34,
      duration: 1.3,
      impact: distance < 4 ? 1.28 : 1.05
    });
  }

  function spawnHoledCaption() {
    const score = world.strokes - COURSE_PAR;
    let text = "DROPPED!";
    if (world.strokes === 1) text = "ACE!";
    else if (score <= -2) text = "EAGLE!";
    else if (score === -1) text = "BIRDIE!";
    else if (score === 0) text = "PAR!";
    else if (score === 1) text = "BOGEY!";
    const relation = score === 0 ? "EVEN" : `${Math.abs(score)} ${score < 0 ? "UNDER" : "OVER"}`;
    pushCaption(text, `SHOT ${world.strokes} / PAR ${COURSE_PAR} • ${relation}`, {
      tone: score <= 0 ? "gold" : "mint",
      y: 0.28,
      duration: 2.0,
      impact: 1.55,
      celebrate: true
    });
  }

  function pushCaption(text, subtext, options = {}) {
    shotCaptions.push({
      text,
      subtext,
      age: 0,
      duration: options.duration || 1.2,
      x: options.x ?? 0.5,
      y: options.y ?? 0.33,
      tone: options.tone || "white",
      impact: options.impact || 1,
      celebrate: !!options.celebrate,
      wobble: Math.random() * Math.PI * 2
    });
    if (shotCaptions.length > 5) shotCaptions.splice(0, shotCaptions.length - 5);
  }

  function updateShotCaptions(dt) {
    for (let i = shotCaptions.length - 1; i >= 0; i -= 1) {
      shotCaptions[i].age += dt;
      if (shotCaptions[i].age >= shotCaptions[i].duration) {
        shotCaptions.splice(i, 1);
      }
    }
  }

  function captionPalette(tone) {
    if (tone === "gold") {
      return {
        fill: "rgb(255 249 224 / 0.98)",
        accent: "rgb(255 205 97 / 0.92)",
        shadow: "rgb(70 40 16 / 0.34)"
      };
    }
    if (tone === "mint") {
      return {
        fill: "rgb(235 255 246 / 0.96)",
        accent: "rgb(142 226 185 / 0.85)",
        shadow: "rgb(11 45 38 / 0.32)"
      };
    }
    if (tone === "coral") {
      return {
        fill: "rgb(255 239 232 / 0.96)",
        accent: "rgb(255 133 103 / 0.86)",
        shadow: "rgb(72 24 20 / 0.34)"
      };
    }
    return {
      fill: "rgb(255 255 255 / 0.95)",
      accent: "rgb(255 255 255 / 0.42)",
      shadow: "rgb(14 25 34 / 0.3)"
    };
  }



  function stepBall(ball, dt) {
    if (ball.grounded) {
      stepGrounded(ball, dt);
    } else {
      stepAir(ball, dt);
      resolveTerrainCollision(ball);
    }

    const holeY = terrainHeight(COURSE.holeX);
    const airborne = !ball.grounded;
    const cupReach = airborne ? COURSE.holeRadius * 4 : COURSE.holeRadius * 2.6;
    const nearCup = Math.abs(ball.x - COURSE.holeX) < cupReach;
    const speedLimit = airborne ? 8 : 2.5;
    const slowEnough = Math.hypot(ball.vx, ball.vy) < speedLimit;
    const descending = airborne ? ball.vy < 1 : true;
    if (!world.holed && nearCup && ball.y - BALL.radius < holeY + 0.12 && slowEnough && descending) {
      world.holed = true;
      world.messageTimer = 2.0;
      ball.x = COURSE.holeX;
      ball.y = holeY + BALL.radius * 0.35;
      world.holeSinkTimer = 0;
      spawnHoledCaption();
      settleBall(ball, false);
      if (isMultiplayerActive() && multiplayerShotPending) {
        multiplayerShotPending = false;
        emitGameEvent("shot-settled", {
          holeIndex: currentHoleIndex,
          playerId: getMultiplayerUserId(),
          turnNumber: getMultiplayerTurnNumber(),
          strokes: world.strokes,
          holed: true,
          ball: serializeBall(ball),
          farthestHit: world.farthestHit,
          holeTimer: world.holeTimer,
          settledAt: Date.now()
        });
      }
    } else if (!world.holed && nearCup && ball.y - BALL.radius < holeY + 0.12 && !ball.nearMissShown) {
      ball.nearMissShown = true;
      pushCaption("TOO FAST!", "Just rolled over the cup", {
        tone: "coral",
        y: 0.32,
        duration: 1.5,
        impact: 0.8
      });
    }
    if (!nearCup || ball.y - BALL.radius >= holeY + 0.5) {
      ball.nearMissShown = false;
    }

    if (ball.x < -70 || ball.x > COURSE.endX + 95 || ball.y < -40) {
      resetBallToPlayableLie();
    }

    if (!ball.asleep) resolveBumperCollisions(ball);
  }

  function resolveBumperCollisions(ball) {
    const bumpers = COURSE.bumpers;
    if (!bumpers.length) return;
    for (const b of bumpers) {
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const dist = Math.hypot(dx, dy);
      const minDist = BALL.radius + b.radius;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x = b.x + nx * minDist;
        ball.y = b.y + ny * minDist;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.vx -= 2 * vn * nx * 0.65;
          ball.vy -= 2 * vn * ny * 0.65;
        }
        ball.slipping = true;
      }
    }
  }

  function stepAir(ball, dt) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0.001) {
      const q = 0.5 * BALL.airDensity * speed * speed * BALL.dragCoefficient * BALL.dragArea / BALL.mass;
      ball.vx -= (ball.vx / speed) * q * dt;
      ball.vy -= (ball.vy / speed) * q * dt;

      const spinLift = BALL.liftCoefficient * clamp(spinRpm(ball) / 7200, -1, 1) * speed * 0.09;
      ball.vx += (-ball.vy / speed) * spinLift * dt;
      ball.vy += (ball.vx / speed) * spinLift * dt;
    }
    ball.vy -= GRAVITY * dt;
    ball.omega *= Math.exp(-BALL.spinDecay * dt);
    ball.angle += ball.omega * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
  }

  function resolveTerrainCollision(ball) {
    const h = terrainHeight(ball.x);
    const floorY = h + BALL.radius;
    if (ball.y > floorY) return;

    const frame = terrainFrame(ball.x);
    const normalVelocity = ball.vx * frame.normalX + ball.vy * frame.normalY;
    const tangentVelocity = ball.vx * frame.tangentX + ball.vy * frame.tangentY;
    ball.y = floorY;

    if (normalVelocity < 0) {
      const impact = Math.abs(normalVelocity);

      if (impact > 0.5) {
        // Clone the audio so multiple rapid bounces can overlap
        const thudClone = AUDIO.thud.cloneNode();
        // Scale volume based on impact velocity (max impact usually around 20-30)
        thudClone.volume = clamp(impact / 25, 0.1, 1.0);
        thudClone.play().catch(() => {});
        
        // Add camera shake on bounce based on impact velocity
        if (impact > 5) {
          world.cameraShake = Math.max(world.cameraShake, clamp(impact / 15, 0.2, 1.2));
        }

        // Phone vibration — strong on first bounce, fading on later bounces
        if (typeof navigator.vibrate === "function" && impact > 3) {
          ball.bounceCount++;
          const duration = Math.min(clamp(impact * 5, 8, 80), 80);
          const fade = Math.max(1, 5 - ball.bounceCount);
          navigator.vibrate(Math.round(duration / fade));
        }
      }

      const green = isGreen(ball.x);
      const restitution = clamp((green ? 0.21 : 0.31) + impact * 0.012, 0.18, green ? 0.38 : 0.48);
      const tangentRetention = clamp(1 - BALL.bounceFriction + impact * 0.008, 0.58, 0.88);
      const newNormalVelocity = -normalVelocity * restitution;
      const retainedTangent = tangentVelocity * tangentRetention;
      const slip = retainedTangent + ball.omega * BALL.radius;
      const maxContactDelta = clamp(impact * 0.22 + 0.8, 0.9, 7.5);
      const tangentDelta = clamp(-slip / (1 + 1 / BALL.inertiaFactor), -maxContactDelta, maxContactDelta);
      const newTangentVelocity = retainedTangent + tangentDelta;

      ball.vx = frame.normalX * newNormalVelocity + frame.tangentX * newTangentVelocity;
      ball.vy = frame.normalY * newNormalVelocity + frame.tangentY * newTangentVelocity;
      ball.omega += tangentDelta / (BALL.inertiaFactor * BALL.radius);
      ball.slipping = Math.abs(newTangentVelocity + ball.omega * BALL.radius) > 0.35;

      if (newNormalVelocity < 0.85 && Math.abs(newTangentVelocity) < 10.5) {
        ball.grounded = true;
        ball.vx = frame.tangentX * newTangentVelocity;
        ball.vy = frame.tangentY * newTangentVelocity;
      }
    } else {
      ball.grounded = true;
      ball.slipping = true;
    }
  }

  function stepGrounded(ball, dt) {
    const frame = terrainFrame(ball.x);
    ball.y = terrainHeight(ball.x) + BALL.radius;
    let vt = ball.vx * frame.tangentX + ball.vy * frame.tangentY;
    const slopeAccel = -GRAVITY * frame.slope / Math.sqrt(1 + frame.slope * frame.slope);
    const normalG = GRAVITY / Math.sqrt(1 + frame.slope * frame.slope);
    const resistance = (isGreen(ball.x) ? BALL.greenRollingResistance : BALL.fairwayRollingResistance) * normalG;
    const friction = vt === 0 ? 0 : -Math.sign(vt) * resistance;
    const slip = vt + ball.omega * BALL.radius;
    const isPureRolling = !ball.slipping && Math.abs(slip) < 0.12;
    const rollingSlopeAccel = slopeAccel / (1 + BALL.inertiaFactor);
    let contactAccel = 0;

    if (!isPureRolling) {
      const grip = ball.slipping ? BALL.landingGrip : BALL.groundGrip;
      contactAccel = clamp(-slip * grip, -normalG * 0.82, normalG * 0.82);
    }

    const nextVt = vt + ((isPureRolling ? rollingSlopeAccel : slopeAccel) + friction + contactAccel) * dt;

    if (Math.sign(vt) !== Math.sign(nextVt) && Math.abs(slopeAccel) < resistance) {
      vt = 0;
    } else {
      vt = nextVt;
    }

    if (isPureRolling) {
      ball.omega = rollingOmega(vt);
    } else {
      ball.omega += contactAccel / (BALL.inertiaFactor * BALL.radius) * dt;
      const nextSlip = vt + ball.omega * BALL.radius;
      if (Math.abs(nextSlip) < 0.08 || Math.abs(vt) < 0.1) {
        ball.slipping = false;
        ball.omega = rollingOmega(vt);
      }
    }
    ball.angle += ball.omega * dt;
    ball.x += frame.tangentX * vt * dt;
    ball.y = terrainHeight(ball.x) + BALL.radius;
    const newFrame = terrainFrame(ball.x);
    ball.vx = newFrame.tangentX * vt;
    ball.vy = newFrame.tangentY * vt;

    if (Math.abs(vt) < BALL.stopSpeed && Math.abs(slopeAccel) < resistance * 0.9) {
      settleBall(ball, true);
    }
  }

  function groundSpeed(ball) {
    const frame = terrainFrame(ball.x);
    return ball.vx * frame.tangentX + ball.vy * frame.tangentY;
  }

  function isGreen(x) {
    return x > COURSE.greenStart - 3 && x < COURSE.greenEnd + 5;
  }

  function isPuttLie(ball) {
    const toPin = Math.abs(COURSE.holeX - ball.x);
    const slope = Math.abs(terrainSlope(ball.x));
    return ball.grounded && toPin <= PUTT_DISTANCE && slope <= PUTT_FLAT_SLOPE;
  }

  function resetBallToPlayableLie() {
    const b = world.ball;
    const wasMoving = !b.asleep;
    b.x = clamp(b.x, -4, COURSE.endX + 55);
    b.y = terrainHeight(b.x) + BALL.radius;
    b.vx = 0;
    b.vy = 0;
    b.omega = 0;
    b.slipping = false;
    b.grounded = true;
    b.asleep = true;
    world.holeSinkTimer = 0;
    world.finishTimer = 0;
    world.slowTimer = 0;
    world.freezeTimer = 0;
    world.holeTransitionShown = false;
    world.cameraMode = "settled";

    if (wasMoving && isBotMatchActive() && botMatchShotPending) {
      botMatchShotPending = false;
      emitGameEvent("shot-settled", {
        strokes: world.strokes,
        holed: world.holed,
        ball: serializeBall(b),
        farthestHit: world.farthestHit
      });
    }

    if (wasMoving && isMultiplayerActive() && multiplayerShotPending) {
      multiplayerShotPending = false;
      world.player.x = b.x;
      world.player.y = b.y;
      world.player.animating = false;
      world.player.timer = 0;
      world.player.frame = 0;
      world.player.idleTimer = 0;
      world.player.pendingLaunch = null;
      emitGameEvent("shot-settled", {
        holeIndex: currentHoleIndex,
        playerId: getMultiplayerUserId(),
        turnNumber: getMultiplayerTurnNumber(),
        strokes: world.strokes,
        holed: world.holed,
        ball: serializeBall(b),
        farthestHit: world.farthestHit,
        holeTimer: world.holeTimer,
        settledAt: Date.now()
      });
    }
  }

  function setHole(index) {
    currentHoleIndex = (index + HOLES.length) % HOLES.length;
    currentCourse = HOLES[currentHoleIndex];
    terrainKnots = currentCourse.terrainKnots;
    world = createWorld();
    pointer = null;
    shotPreview = null;
    guide.length = 0;
    invalidateGuideCache();
    invalidateMinimapCache();
    invalidateTerrainSurfaceCache();
    accumulator = 0;
    resizeQueued = true;
    skySystem?.setPreset(currentSkyPreset());
    snapCamera();
    syncHoleUi();
  }

  function syncHoleUi() {
    if (holeCounter) {
      holeCounter.textContent = `${currentHoleIndex + 1}/${HOLES.length}`;
    }
  }

  function launchFromPointer() {
    if (!pointer || !world.ball.asleep || world.holed) return;
    if (!canLocalAim()) { pointer = null; shotPreview = null; guide.length = 0; invalidateGuideCache(); return; }
    
    // Store the computed launch parameters
    world.player.pendingLaunch = computeLaunchFromDrag();
    world.player.animating = true;
    const isPutt = world.player.pendingLaunch.mode === "putt";
    const AIM_FPS = 8;
    const AIM_MAX_FRAME = isPutt ? 2 : 3;
    const aimFrame = Math.min(Math.floor(world.player.timer * AIM_FPS), AIM_MAX_FRAME);
    world.player.frame = aimFrame;
    world.player.timer = (aimFrame + 0.01) / 18;
    
    // Clear UI inputs
    pointer = null;
    shotPreview = null;
    invalidateGuideCache();
  }

  function botLaunch(vx, vy, mode) {
    const b = world.ball;
    if (!b.asleep || world.holed) return;
    b.vx = vx;
    b.vy = vy;
    b.omega = mode === "putt" ? rollingOmega(vx) : 0;
    if (mode !== "putt") {
      b.grounded = false;
      b.slipping = true;
    } else {
      b.grounded = true;
      b.slipping = false;
    }
    b.asleep = false;
    b.bounceCount = 0;
    world.launchOriginX = b.x;
    world.strokes += 1;
    world.cameraMode = "flight";
    world.finishTimer = 0;
    world.slowTimer = 0;
    world.freezeTimer = 0;
    botMatchShotPending = true;
  }

  function computeLaunchFromDrag() {
    const b = world.ball;
    const ballScreen = worldToScreen(b.x, b.y);
    const rawX = pointer.startX - pointer.x;
    const rawY = pointer.y - pointer.startY;
    const pull = Math.hypot(rawX, rawY);
    const maxPull = Math.min(canvasSize().width, canvasSize().height) * 0.32;
    const power = clamp(pull / maxPull, 0, 1);
    const fallbackDirection = COURSE.holeX >= b.x ? 1 : -1;
    const direction = Math.abs(rawX) > 8 ? Math.sign(rawX) : fallbackDirection;
    
    // Update player's facing direction while aiming
    world.player.direction = direction;
    
    if (isPuttLie(b)) {
      const frame = terrainFrame(b.x);
      const targetDistance = Math.max(1.5, Math.abs(COURSE.holeX - b.x));
      const idealFlatSpeed = Math.sqrt(targetDistance * 2 * GRAVITY * BALL.greenRollingResistance);
      const maxPuttSpeed = clamp(idealFlatSpeed * 1.85 + 1.2, 7.5, 18);
      const speed = (0.25 + Math.pow(power, 1.42) * maxPuttSpeed);
      const vt = direction * speed;
      return {
        mode: "putt",
        power,
        pull,
        maxPull,
        ballScreen,
        launch: {
          vx: frame.tangentX * vt,
          vy: frame.tangentY * vt,
          omega: rollingOmega(vt)
        }
      };
    }

    // We want the user to be able to drag to aim up and down.
    // rawX is horizontal pull, rawY is vertical pull.
    // Ensure we don't allow crazy backward shots or weird angles if the pull is tiny.
    const horizontal = Math.max(Math.abs(rawX), pull * 0.18);
    let angle = Math.atan2(rawY, horizontal);
    
    // Clamp the angle so you can't hit it straight into the ground or totally vertical
    const launchAngle = clamp(angle, MIN_LAUNCH_ANGLE, MAX_LAUNCH_ANGLE);
    
    // The "base" speed just depends on power now
    const maxSpeed = BALL.maxSpeed;
    const minSpeed = BALL.minSpeed;
    const speed = minSpeed + Math.pow(power, 1.25) * (maxSpeed - minSpeed);
    
    // A slight gear penalty if they are trying to drag at extreme angles
    const gearPenalty = clamp(1 - Math.abs(launchAngle - angle) * 0.16, 0.72, 1);
    
    const vx = direction * Math.cos(launchAngle) * speed * gearPenalty;
    const vy = Math.sin(launchAngle) * speed * gearPenalty;
    
    // Backspin removed — ball only picks up natural roll spin from ground contact
    const omega = 0;

    return {
      mode: "swing",
      power,
      pull,
      maxPull,
      ballScreen,
      launch: {
        vx,
        vy,
        omega: omega
      }
    };
  }

  function invalidateGuideCache() {
    guideCache.x = Number.NaN;
    guideCache.y = Number.NaN;
    guideCache.ballX = Number.NaN;
    guideCache.ballY = Number.NaN;
    guideCache.time = 0;
  }

  function invalidateMinimapCache() {
    minimapCache = null;
  }

  function invalidateTerrainSurfaceCache() {
    terrainSurfaceCache = null;
  }

  function predictGuide(now = performance.now()) {
    if (!pointer || !world.ball.asleep || world.holed) {
      guide.length = 0;
      shotPreview = null;
      invalidateGuideCache();
      return;
    }

    const pointerMoved = Math.hypot(pointer.x - guideCache.x, pointer.y - guideCache.y);
    const ballMoved = Math.hypot(world.ball.x - guideCache.ballX, world.ball.y - guideCache.ballY);
    const cacheFresh = pointerMoved < 2.5 && ballMoved < 0.02 && now - guideCache.time < 90;
    if (cacheFresh && shotPreview) {
      return;
    }

    guide.length = 0;
    shotPreview = computeLaunchFromDrag();
    guideCache = { x: pointer.x, y: pointer.y, ballX: world.ball.x, ballY: world.ball.y, time: now };
    const ghost = {
      x: world.ball.x,
      y: world.ball.y,
      vx: shotPreview.launch.vx,
      vy: shotPreview.launch.vy,
      omega: shotPreview.launch.omega,
      angle: world.ball.angle,
      slipping: shotPreview.mode !== "putt",
      grounded: shotPreview.mode === "putt",
      asleep: false
    };
    let bounces = 0;
    for (let i = 0; i < MAX_GUIDE_STEPS; i += 1) {
      if (shotPreview.mode === "putt") {
        stepGroundedGhost(ghost, 1 / 60);
      } else if (!ghost.grounded) {
        stepAir(ghost, 1 / 60);
        const beforeVy = ghost.vy;
        resolveGhostCollision(ghost);
        if (ghost.grounded || beforeVy !== ghost.vy) bounces += 1;
      } else {
        stepGroundedGhost(ghost, 1 / 60);
      }
      if (i % 7 === 0) {
        guide.push({ x: ghost.x, y: ghost.y, grounded: ghost.grounded });
      }
      if (ghost.grounded && Math.abs(groundSpeed(ghost)) < 0.35) break;
      if (bounces > 2 && i > 120) break;
      if (ghost.x < -70 || ghost.x > COURSE.endX + 65 || ghost.y < -20) break;
    }
  }

  function resolveGhostCollision(ball) {
    const h = terrainHeight(ball.x);
    const floorY = h + BALL.radius;
    if (ball.y > floorY) return;
    const frame = terrainFrame(ball.x);
    const normalVelocity = ball.vx * frame.normalX + ball.vy * frame.normalY;
    const tangentVelocity = ball.vx * frame.tangentX + ball.vy * frame.tangentY;
    ball.y = floorY;
    if (normalVelocity < 0) {
      const impact = Math.abs(normalVelocity);
      const restitution = clamp((isGreen(ball.x) ? 0.2 : 0.29) + impact * 0.01, 0.16, 0.42);
      const newNormalVelocity = -normalVelocity * restitution;
      const tangentRetention = clamp(1 - BALL.bounceFriction + impact * 0.008, 0.58, 0.88);
      const retainedTangent = tangentVelocity * tangentRetention;
      const slip = retainedTangent + ball.omega * BALL.radius;
      const maxContactDelta = clamp(impact * 0.2 + 0.7, 0.8, 6.5);
      const tangentDelta = clamp(-slip / (1 + 1 / BALL.inertiaFactor), -maxContactDelta, maxContactDelta);
      const newTangentVelocity = retainedTangent + tangentDelta;
      ball.vx = frame.normalX * newNormalVelocity + frame.tangentX * newTangentVelocity;
      ball.vy = frame.normalY * newNormalVelocity + frame.tangentY * newTangentVelocity;
      ball.omega += tangentDelta / (BALL.inertiaFactor * BALL.radius);
      ball.slipping = Math.abs(newTangentVelocity + ball.omega * BALL.radius) > 0.35;
      if (newNormalVelocity < 0.8) {
        ball.grounded = true;
      }
    }
  }

  function stepGroundedGhost(ball, dt) {
    const frame = terrainFrame(ball.x);
    let vt = ball.vx * frame.tangentX + ball.vy * frame.tangentY;
    const slopeAccel = -GRAVITY * frame.slope / Math.sqrt(1 + frame.slope * frame.slope);
    const normalG = GRAVITY / Math.sqrt(1 + frame.slope * frame.slope);
    const resistance = (isGreen(ball.x) ? BALL.greenRollingResistance : BALL.fairwayRollingResistance) * normalG;
    const friction = vt === 0 ? 0 : -Math.sign(vt) * resistance;
    const slip = vt + ball.omega * BALL.radius;
    const isPureRolling = !ball.slipping && Math.abs(slip) < 0.12;
    let contactAccel = 0;
    if (!isPureRolling) {
      contactAccel = clamp(-slip * BALL.landingGrip, -normalG * 0.82, normalG * 0.82);
    }
    const rollingSlopeAccel = slopeAccel / (1 + BALL.inertiaFactor);
    const nextVt = vt + ((isPureRolling ? rollingSlopeAccel : slopeAccel) + friction + contactAccel) * dt;
    if (Math.sign(vt) !== Math.sign(nextVt) && Math.abs(slopeAccel) < resistance) {
      vt = 0;
    } else {
      vt = nextVt;
    }
    if (isPureRolling) {
      ball.omega = rollingOmega(vt);
    } else {
      ball.omega += contactAccel / (BALL.inertiaFactor * BALL.radius) * dt;
      if (Math.abs(vt + ball.omega * BALL.radius) < 0.08 || Math.abs(vt) < 0.1) {
        ball.slipping = false;
        ball.omega = rollingOmega(vt);
      }
    }
    ball.angle += ball.omega * dt;
    ball.x += frame.tangentX * vt * dt;
    ball.y = terrainHeight(ball.x) + BALL.radius;
    const newFrame = terrainFrame(ball.x);
    ball.vx = newFrame.tangentX * vt;
    ball.vy = newFrame.tangentY * vt;
  }

  function draw(nowSeconds = 0) {
    if (resizeQueued) resize();
    const { width, height } = canvasSize();
    ctx.clearRect(0, 0, width, height);
    const skyRendered = skySystem?.render(currentSkyPreset(), nowSeconds);
    if (!skyRendered) drawSky(width, height);
    drawTerrain(width, height);
    drawBumpers();
    drawCupHint();
    drawGuide();
    drawOpponentAim();
    drawPlayer();
    drawTrail();
    drawBall();
    drawMinimap(width, height);
    drawTinyReadout(width, height);
    drawShotCaptions(width, height);
  }

  function drawSky(width, height) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, COLORS.skyTop);
    sky.addColorStop(0.28, COLORS.skyMid);
    sky.addColorStop(0.55, COLORS.skyGlow);
    sky.addColorStop(0.76, COLORS.skyHorizon);
    sky.addColorStop(1, COLORS.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    let glowStart = "rgb(255 220 129 / 0.55)";
    let glowMid = "rgb(255 116 116 / 0.22)";
    if (currentCourse.atmosphere === "haze" || currentCourse.atmosphere === "soft") {
      glowStart = "rgb(255 255 255 / 0.22)";
      glowMid = "rgb(208 240 255 / 0.12)";
    } else if (currentCourse.atmosphere === "night") {
      glowStart = "rgb(120 160 255 / 0.15)";
      glowMid = "rgb(80 120 220 / 0.08)";
    } else if (currentCourse.atmosphere === "storm") {
      glowStart = "rgb(120 150 180 / 0.12)";
      glowMid = "rgb(40 58 72 / 0.1)";
    } else if (currentCourse.atmosphere === "snow") {
      glowStart = "rgb(255 255 255 / 0.34)";
      glowMid = "rgb(230 248 255 / 0.16)";
    } else if (currentCourse.atmosphere === "glow" || currentCourse.atmosphere === "warm") {
      glowStart = "rgb(255 220 129 / 0.56)";
      glowMid = "rgb(255 116 116 / 0.2)";
    }
    const glow = ctx.createRadialGradient(width * 0.5, height * 0.82, 0, width * 0.5, height * 0.82, height * 0.72);
    glow.addColorStop(0, glowStart);
    glow.addColorStop(0.46, glowMid);
    glow.addColorStop(1, "rgb(255 116 116 / 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    drawAtmosphere(width, height);
  }

  function drawAtmosphere(width, height) {
    const mode = currentCourse.atmosphere;
    ctx.save();
    if (mode === "haze" || mode === "soft") {
      const haze = ctx.createRadialGradient(width * 0.24, height * 0.7, 0, width * 0.24, height * 0.7, height * 0.28);
      haze.addColorStop(0, "rgb(255 255 255 / 0.16)");
      haze.addColorStop(0.45, "rgb(255 255 255 / 0.08)");
      haze.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);
      const haze2 = ctx.createRadialGradient(width * 0.76, height * 0.64, 0, width * 0.76, height * 0.64, height * 0.22);
      haze2.addColorStop(0, "rgb(255 255 255 / 0.11)");
      haze2.addColorStop(0.5, "rgb(255 255 255 / 0.04)");
      haze2.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = haze2;
      ctx.fillRect(0, 0, width, height);
    } else if (mode === "night") {
      ctx.fillStyle = "rgb(255 248 232 / 0.78)";
      const stars = [
        [0.22, 0.11, 1.1], [0.28, 0.18, 0.8], [0.34, 0.08, 0.7], [0.48, 0.21, 1.0],
        [0.57, 0.1, 0.75], [0.63, 0.17, 0.9], [0.7, 0.06, 0.8], [0.81, 0.13, 0.65],
        [0.88, 0.09, 0.85], [0.42, 0.28, 0.7]
      ];
      stars.forEach(([sx, sy, sr]) => {
        ctx.globalAlpha = 0.34 + sr * 0.2;
        ctx.beginPath();
        ctx.arc(width * sx, height * sy, sr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "rgb(255 245 228 / 0.76)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width * 0.49, height * 0.23, Math.min(width, height) * 0.025, Math.PI * 0.12, Math.PI * 1.32);
      ctx.stroke();
      ctx.strokeStyle = "rgb(6 16 34 / 0.76)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(width * 0.495, height * 0.225, Math.min(width, height) * 0.024, Math.PI * 0.08, Math.PI * 1.28);
      ctx.stroke();
    } else if (mode === "snow") {
      ctx.fillStyle = "rgb(255 255 255 / 0.62)";
      for (let i = 0; i < 20; i += 1) {
        const xSeed = (i * 37) % 100;
        const ySeed = (i * 61) % 100;
        ctx.globalAlpha = 0.1 + ((i % 5) * 0.04);
        ctx.beginPath();
        ctx.arc(width * (xSeed / 100), height * (0.06 + ySeed / 160), 0.6 + (i % 3) * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mode === "storm") {
      const cloud = ctx.createRadialGradient(width * 0.44, height * 0.22, 0, width * 0.44, height * 0.22, height * 0.34);
      cloud.addColorStop(0, "rgb(20 31 45 / 0.74)");
      cloud.addColorStop(0.52, "rgb(16 24 34 / 0.42)");
      cloud.addColorStop(1, "rgb(16 24 34 / 0)");
      ctx.fillStyle = cloud;
      ctx.fillRect(0, 0, width, height);
      const cloud2 = ctx.createRadialGradient(width * 0.78, height * 0.28, 0, width * 0.78, height * 0.28, height * 0.28);
      cloud2.addColorStop(0, "rgb(10 17 24 / 0.52)");
      cloud2.addColorStop(1, "rgb(10 17 24 / 0)");
      ctx.fillStyle = cloud2;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "rgb(205 230 255 / 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width * 0.84, height * 0.18);
      ctx.lineTo(width * 0.81, height * 0.25);
      ctx.lineTo(width * 0.86, height * 0.25);
      ctx.lineTo(width * 0.83, height * 0.32);
      ctx.stroke();
    } else if (mode === "glow") {
      const bloom = ctx.createRadialGradient(width * 0.54, height * 0.72, 0, width * 0.54, height * 0.72, height * 0.28);
      bloom.addColorStop(0, "rgb(255 236 162 / 0.2)");
      bloom.addColorStop(0.52, "rgb(255 187 92 / 0.12)");
      bloom.addColorStop(1, "rgb(255 187 92 / 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  function drawTerrain(width, height) {
    const rawStart = view.x - 10;
    const rawEnd = view.x + width / view.scale + 10;
    const step = Math.max(1.05, 5.6 / view.scale);
    const start = Math.floor(rawStart * 2) / 2;
    const end = Math.ceil(rawEnd * 2) / 2;
    const cacheKey = [
      currentHoleIndex,
      Math.round(width),
      Math.round(height),
      Math.round(view.x * 50) / 50,
      Math.round(view.y * 50) / 50,
      Math.round(view.scale * 100) / 100,
      start,
      end
    ].join(":");
    let terrainPoints = terrainSurfaceCache?.key === cacheKey ? terrainSurfaceCache.points : null;
    if (!terrainPoints) {
      terrainPoints = buildTerrainSurfacePoints(start, end, step);
      terrainSurfaceCache = { key: cacheKey, points: terrainPoints };
    }
    if (terrainPoints.length < 2) return;

    traceTerrainSurfaceFromPoints(terrainPoints);
    const last = terrainPoints[terrainPoints.length - 1];
    const first = terrainPoints[0];
    ctx.lineTo(last.x, height + 40);
    ctx.lineTo(first.x, height + 40);
    ctx.closePath();
    const land = ctx.createLinearGradient(0, height * 0.55, 0, height);
    land.addColorStop(0, COLORS.fairway);
    land.addColorStop(0.38, COLORS.fairwayMid);
    land.addColorStop(1, COLORS.soil);
    ctx.fillStyle = land;
    ctx.fill();
    drawTerrainOverlay(width, height, terrainPoints);

    ctx.save();
    ctx.shadowColor = COLORS.rim;
    ctx.shadowBlur = LOW_POWER_RENDER ? Math.max(4, view.scale * 0.18) : Math.max(10, view.scale * 0.55);
    ctx.lineWidth = Math.max(3, view.scale * 0.12);
    ctx.strokeStyle = COLORS.rim;
    traceTerrainSurfaceFromPoints(terrainPoints);
    ctx.stroke();
    ctx.restore();

    ctx.lineWidth = Math.max(1.2, view.scale * 0.035);
    ctx.strokeStyle = "rgb(255 248 220 / 0.32)";
    traceTerrainSurfaceFromPoints(terrainPoints);
    ctx.stroke();
  }

  function getTerrainOverlayPattern() {
    if (!assets.terrainOverlayReady) return null;
    if (!terrainOverlayPattern) {
      terrainOverlayPattern = ctx.createPattern(assets.terrainOverlay, "repeat");
    }
    return terrainOverlayPattern;
  }

  function drawTerrainOverlay(width, height, terrainPoints) {
    const pattern = getTerrainOverlayPattern();
    if (!pattern || terrainPoints.length < 2) return;

    const tile = 260;
    const scale = tile / assets.terrainOverlay.width;
    const offsetX = -(view.x * view.scale);
    const offsetY = height;

    ctx.save();
    traceTerrainSurfaceFromPoints(terrainPoints);
    const last = terrainPoints[terrainPoints.length - 1];
    const first = terrainPoints[0];
    ctx.lineTo(last.x, height + 40);
    ctx.lineTo(first.x, height + 40);
    ctx.closePath();
    ctx.clip();

    if (pattern.setTransform && typeof DOMMatrix !== "undefined") {
      pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, offsetX, offsetY]));
    }

    const alpha = terrainOverlayAlpha();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function terrainOverlayAlpha() {
    const mode = currentCourse.atmosphere;
    if (mode === "snow") return 0.442;
    if (mode === "night") return 0.745;
    if (mode === "storm") return 0.828;
    if (mode === "glow" || mode === "warm") return 0.635;
    return 0.773;
  }

  function buildTerrainSurfacePoints(start, end, step) {
    const points = [];
    for (let x = start; x <= end; x += step) {
      points.push({ ...worldToScreen(x, terrainHeight(x)), worldX: x });
    }
    if (!points.length || points[points.length - 1].worldX < end) {
      points.push({ ...worldToScreen(end, terrainHeight(end)), worldX: end });
    }
    return points;
  }

  function traceTerrainSurface(start, end, step) {
    traceTerrainSurfaceFromPoints(buildTerrainSurfacePoints(start, end, step));
  }

  function traceTerrainSurfaceFromPoints(points) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i += 1) {
      const midX = (points[i].x + points[i + 1].x) * 0.5;
      const midY = (points[i].y + points[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function drawBumpers() {
    const bumpers = COURSE.bumpers;
    if (!bumpers.length) return;
    ctx.save();
    for (const b of bumpers) {
      const s = worldToScreen(b.x, b.y);
      const r = b.radius * view.scale;
      ctx.fillStyle = "rgb(255 100 80 / 0.7)";
      ctx.strokeStyle = "rgb(255 200 180 / 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgb(255 255 255 / 0.4)";
      ctx.beginPath();
      ctx.arc(s.x - r * 0.25, s.y - r * 0.25, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCupHint() {
    const ground = terrainHeight(COURSE.holeX);
    const cup = worldToScreen(COURSE.holeX, ground);
    const scale = view.scale;
    const sink = world.holed ? clamp(world.holeSinkTimer / 0.28, 0, 1) : 0;
    const cupWidth = scale * 0.62;
    const cupHeight = scale * 0.18;
    ctx.save();
    ctx.shadowColor = "rgb(6 10 14 / 0.4)";
    ctx.shadowBlur = Math.max(4, scale * 0.25);
    ctx.fillStyle = "rgb(7 11 13 / 0.92)";
    ctx.beginPath();
    ctx.ellipse(cup.x, cup.y + scale * 0.03, cupWidth, cupHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgb(242 238 212 / 0.72)";
    ctx.lineWidth = Math.max(1, scale * 0.05);
    ctx.beginPath();
    ctx.moveTo(cup.x, cup.y - scale * 3.5);
    ctx.lineTo(cup.x, cup.y - scale * (1.15 + sink * 1.6));
    ctx.stroke();
    ctx.fillStyle = COLORS.flag;
    ctx.beginPath();
    ctx.moveTo(cup.x, cup.y - scale * 3.5);
    ctx.lineTo(cup.x + scale * 1.15, cup.y - scale * 3.08);
    ctx.lineTo(cup.x, cup.y - scale * 2.72);
    ctx.closePath();
    ctx.fill();

    if (sink > 0) {
      ctx.fillStyle = "rgb(7 11 13 / 0.92)";
      ctx.beginPath();
      ctx.ellipse(cup.x, cup.y + scale * (0.03 + sink * 0.1), cupWidth * (0.92 - sink * 0.06), cupHeight * (0.92 - sink * 0.08), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGuide() {
    if (!pointer || guide.length < 2 || !shotPreview) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const putt = shotPreview.mode === "putt";
    const maxGuideLength = putt ? 20 : guide.length; // 20 points * 7/60s = ~2.3 seconds of foresight for putts
    
    ctx.lineWidth = putt ? 3 : 2;
    if (!putt) ctx.setLineDash([4, 8]);
    
    // Draw guide line with fade out
    for (let i = 0; i < Math.min(guide.length - 1, maxGuideLength); i += 1) {
      const p1 = worldToScreen(guide[i].x, guide[i].y);
      const p2 = worldToScreen(guide[i + 1].x, guide[i + 1].y);
      
      let alpha = 0.62;
      if (putt) {
        alpha = 0.82 * (1 - Math.pow(i / maxGuideLength, 2));
      } else {
        // Fade out the last few points of the drive guide
        const fadeStart = maxGuideLength - 8;
        if (i > fadeStart) {
          alpha = 0.62 * (1 - (i - fadeStart) / 8);
        }
      }
      
      ctx.strokeStyle = putt ? `rgb(255 238 137 / ${alpha})` : `rgb(255 255 255 / ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (!putt) {
      const guideEnd = guide.find((point) => point.grounded) || guide[Math.min(guide.length - 1, maxGuideLength - 1)];
      const lp = worldToScreen(guideEnd.x, terrainHeight(guideEnd.x) + 0.05);
      ctx.fillStyle = COLORS.guideLanding;
      ctx.beginPath();
      ctx.ellipse(lp.x, lp.y, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const ball = shotPreview.ballScreen;
    const pull = clamp(shotPreview.pull / shotPreview.maxPull, 0, 1);
    ctx.strokeStyle = `rgb(255 255 255 / ${0.2 + pull * 0.45})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(pointer.x, pointer.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawOpponentAim() {
    if (!opponentAimData || !opponentAimData.pointer) return;
    if (isMultiplayerActive() && window.TeeMultiplayer.isLocalTurn()) return;

    const aim = opponentAimData;
    if (!aim.ball) return;

    const ballScreen = worldToScreen(aim.ball.x, aim.ball.y);

    // Draw draf line from ball to pointer
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "rgb(255 138 101 / 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ballScreen.x, ballScreen.y);
    ctx.lineTo(aim.pointer.x, aim.pointer.y);
    ctx.stroke();

    // Draw opponent's guide arc
    if (opponentAimGuide.length > 1) {
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < opponentAimGuide.length; i++) {
        const s = worldToScreen(opponentAimGuide[i].x, opponentAimGuide[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawPlayer() {
    const p = world.player;
    const isOppTurn = isMultiplayerActive() && !window.TeeMultiplayer.isLocalTurn();
    
    // Player is only drawn if they are visible (ball asleep, or animating swing)
    if (!world.ball.asleep && !p.animating && !(isOppTurn && (opponentSwingFrame >= 0 || opponentAiming))) return;

    const outfitIndex = Math.min(currentHoleIndex, OUTFIT_SETS.length - 1);
    const outfit = assets.outfits[outfitIndex];
    if (!outfit || !outfit.ready) return;

    const isPutt = p.animating && p.pendingLaunch
      ? p.pendingLaunch.mode === "putt"
      : isPuttLie(world.ball);
    let playerAsset;
    let frameIndex;
    
    if (isOppTurn && opponentSwingFrame >= 0) {
      // Opponent swing animation
      const oppIsPutt = isPutt;
      playerAsset = oppIsPutt ? outfit.putt : outfit.swing;
      frameIndex = opponentSwingFrame;
    } else if (isOppTurn && opponentAiming) {
      // Opponent aiming stance — show a static mid-aim pose
      const oppIsPutt = isPutt;
      playerAsset = oppIsPutt ? outfit.putt : outfit.swing;
      frameIndex = oppIsPutt ? 1 : 2;
    } else if (p.animating) {
      // Swing animation
      playerAsset = isPutt ? outfit.putt : outfit.swing;
      frameIndex = p.frame;
    } else if (p.aiming) {
      // Aiming "wind-up" — plays forward to hold frame, then pauses
      playerAsset = isPutt ? outfit.putt : outfit.swing;
      const AIM_FPS = 8;
      const AIM_MAX_FRAME = isPutt ? 2 : 3;
      frameIndex = Math.min(Math.floor(p.timer * AIM_FPS), AIM_MAX_FRAME);
    } else {
      // Idle animation
      playerAsset = outfit.idle;
      const IDLE_FPS = 5;
      const IDLE_FRAMES = 12;
      frameIndex = Math.floor(p.idleTimer * IDLE_FPS) % IDLE_FRAMES;
    }

    if (!playerAsset) return;

    // Sprite settings
    const SPRITE_W = 512;
    const SPRITE_H = 512;
    const BALL_X_IN_SPRITE = 282.1;
    const BALL_Y_IN_SPRITE = 455; 
    
    const playerWorldSize = 10.6;
    const drawSize = playerWorldSize * view.scale;
    
    const scale = drawSize / SPRITE_W;
    
    const anchorScreen = worldToScreen(p.x, p.y);
    
    const drawX = -BALL_X_IN_SPRITE * scale;
    const drawY = -BALL_Y_IN_SPRITE * scale;

    const col = frameIndex % 4;
    const row = Math.floor(frameIndex / 4);
    
    const sx = col * SPRITE_W;
    const sy = row * SPRITE_H;

    const frame = terrainFrame(p.x);
    const slopeAngle = Math.atan(frame.slope);

    ctx.save();
    
    ctx.translate(anchorScreen.x, anchorScreen.y);
    
    ctx.rotate(-slopeAngle);

    if (p.direction === -1) {
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(
      playerAsset,
      sx, sy, SPRITE_W, SPRITE_H,
      drawX, drawY, drawSize, drawSize
    );
    
    ctx.restore();
  }

  function drawTrail() {
    if (world.trail.length < 2) return;
    
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Draw trail as a glowing ribbon
    ctx.beginPath();
    for (let i = 0; i < world.trail.length; i++) {
      const pt = world.trail[i];
      const screenPt = worldToScreen(pt.x, pt.y);
      if (i === 0) ctx.moveTo(screenPt.x, screenPt.y);
      else ctx.lineTo(screenPt.x, screenPt.y);
    }
    
    // The gradient makes it fade smoothly from the ball to the tail
    const bScreen = worldToScreen(world.ball.x, world.ball.y);
    const tailScreen = worldToScreen(world.trail[0].x, world.trail[0].y);
    const grad = ctx.createLinearGradient(bScreen.x, bScreen.y, tailScreen.x, tailScreen.y);
    grad.addColorStop(0, "rgb(255 255 255 / 0.9)");
    grad.addColorStop(0.3, "rgb(255 240 180 / 0.6)");
    grad.addColorStop(1, "rgb(255 200 100 / 0)");

    ctx.strokeStyle = grad;
    ctx.lineWidth = BALL.radius * view.scale * 1.5;
    ctx.stroke();

    // Add a core highlight to the trail
    ctx.beginPath();
    for (let i = 0; i < world.trail.length; i++) {
      const pt = world.trail[i];
      const screenPt = worldToScreen(pt.x, pt.y);
      if (i === 0) ctx.moveTo(screenPt.x, screenPt.y);
      else ctx.lineTo(screenPt.x, screenPt.y);
    }
    const gradCore = ctx.createLinearGradient(bScreen.x, bScreen.y, tailScreen.x, tailScreen.y);
    gradCore.addColorStop(0, "rgb(255 255 255 / 0.95)");
    gradCore.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.strokeStyle = gradCore;
    ctx.lineWidth = BALL.radius * view.scale * 0.5;
    ctx.stroke();
    
    ctx.restore();
  }

  function drawBall() {
    const b = world.ball;
    if (world.holed && world.holeSinkTimer > 0.22) return;
    const p = worldToScreen(b.x, b.y);
    const sink = world.holed ? clamp(world.holeSinkTimer / 0.28, 0, 1) : 0;
    const r = Math.max(8, BALL.radius * view.scale * (world.holed ? 1 - sink * 0.78 : 1));
    if (!world.holed || sink < 0.28) {
      drawBallShadow(b, r);
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    if (world.holed) {
      ctx.globalAlpha = 1 - sink * 0.92;
    }
    if (assets.ballReady) {
      ctx.rotate(-b.angle);
      ctx.drawImage(assets.ball, -r, -r, r * 2, r * 2);
      ctx.restore();
      return;
    }

    const ballGradient = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.15, 0, 0, r);
    ballGradient.addColorStop(0, "#ffffff");
    ballGradient.addColorStop(0.68, COLORS.ball);
    ballGradient.addColorStop(1, COLORS.ballShade);
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(30 42 38 / 0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const spin = -b.angle;
    ctx.strokeStyle = "rgb(70 90 82 / 0.20)";
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.ellipse(Math.sin(spin + i) * r * 0.12, i * r * 0.24, r * 0.68, r * 0.15, spin * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBallShadow(ball, radius) {
    const ground = terrainHeight(ball.x);
    const drop = Math.max(0, ball.y - BALL.radius - ground);
    const p = worldToScreen(ball.x, ground + 0.04);
    const squash = clamp(1 - drop / 18, 0.14, 0.8);
    ctx.save();
    ctx.globalAlpha = 0.26 * squash;
    ctx.fillStyle = "#172018";
    ctx.beginPath();
    ctx.ellipse(p.x + radius * 0.18, p.y + radius * 0.14, radius * (0.92 + drop * 0.03), radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMinimap(width, height) {
    const compact = width < 620;
    const mapW = Math.min(width * (compact ? 0.58 : 0.28), compact ? 220 : 310);
    const mapH = Math.max(22, Math.min(height * 0.05, 36));
    const x0 = width * 0.5 - mapW * 0.5;
    const y0 = Math.max(compact ? 120 : 130, height * 0.25);
    if (!minimapCache) minimapCache = { stableX: world.ball.x, time: 0, key: "", terrain: [] };
    if (world.ball.asleep) minimapCache.stableX = world.ball.x;
    const refX = minimapCache.stableX;

    const distanceToHole = Math.abs(COURSE.holeX - refX);
    const minX = Math.min(refX, COURSE.holeX);
    const maxX = Math.max(refX, COURSE.holeX);
    const padding = clamp(distanceToHole * 0.15 + 8, 12, 30);
    let mapStart = minX - padding;
    let mapEnd = maxX + padding;
    if (mapEnd - mapStart < 45) {
      const diff = (45 - (mapEnd - mapStart)) / 2;
      mapStart -= diff;
      mapEnd += diff;
    }
    const xScale = mapW / (mapEnd - mapStart);
    const minY = -9;
    const maxY = 10;
    const yScale = mapH / (maxY - minY);
    const now = performance.now() / 1000;
    const cacheKey = [
      currentHoleIndex,
      Math.round(mapW),
      Math.round(mapH),
      Math.round(mapStart * 2) / 2,
      Math.round(mapEnd * 2) / 2
    ].join(":");

    if (minimapCache.key !== cacheKey || now - minimapCache.time > MINIMAP_REFRESH_SECONDS) {
      const terrain = [];
      const step = Math.max(0.5, (mapEnd - mapStart) / 60);
      for (let x = mapStart; x <= mapEnd; x += step) {
        terrain.push({
          x: x0 + (x - mapStart) * xScale,
          y: y0 + mapH - (terrainHeight(x) - minY) * yScale
        });
      }
      if (!terrain.length || terrain[terrain.length - 1].x < x0 + mapW) {
        const x = mapEnd;
        terrain.push({
          x: x0 + mapW,
          y: y0 + mapH - (terrainHeight(x) - minY) * yScale
        });
      }
      minimapCache.key = cacheKey;
      minimapCache.time = now;
      minimapCache.terrain = terrain;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 10, y0 - 200, mapW + 20, mapH + 210);
    ctx.clip();

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgb(244 244 236 / 0.62)";
    ctx.lineWidth = 3.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    minimapCache.terrain.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    if (guide.length > 1) {
      // Use a dark, bold navy color that pops against the light sky backgrounds
      ctx.strokeStyle = "rgb(15 25 45 / 0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      guide.forEach((g, i) => {
        const px = x0 + (g.x - mapStart) * xScale;
          const py = y0 + mapH - (g.y - minY) * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Opponent aim guide on minimap
    if (opponentAimGuide.length > 1) {
      ctx.strokeStyle = "rgb(255 138 101 / 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      opponentAimGuide.forEach((g, i) => {
        const px = x0 + (g.x - mapStart) * xScale;
        const py = y0 + mapH - (g.y - minY) * yScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const ballX = x0 + (world.ball.x - mapStart) * xScale;
    const ballY = y0 + mapH - (terrainHeight(world.ball.x) - minY) * yScale;
    ctx.fillStyle = "rgb(255 255 255 / 0.96)";
    ctx.beginPath();
    ctx.arc(ballX, ballY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    const holeX = x0 + (COURSE.holeX - mapStart) * xScale;
    const holeY = y0 + mapH - (terrainHeight(COURSE.holeX) - minY) * yScale;
    ctx.shadowColor = "rgb(255 225 86 / 0.8)";
    ctx.shadowBlur = LOW_POWER_RENDER ? 2 : 5;
    ctx.fillStyle = "rgb(255 225 86 / 0.98)";
    ctx.beginPath();
    ctx.arc(holeX, holeY, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgb(36 58 45 / 0.75)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawTinyReadout(width, height) {
    ctx.save();
    ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgb(20 31 29 / 0.28)";
    const toPin = COURSE.holeX - world.ball.x;
    const lie = world.holed ? "holed" : `${Math.abs(toPin).toFixed(1)}m ${toPin < -0.3 ? "long" : "to pin"}`;
    ctx.fillText(`hole ${currentHoleIndex + 1}/${HOLES.length} · strokes ${world.strokes} · ${lie}`, 14, height - 16);
    if (world.messageTimer > 0) {
      ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgb(255 255 255 / 0.92)";
      ctx.textAlign = "center";
      ctx.fillText("Holed", width / 2, height * 0.24);
    }
    ctx.restore();
  }

  function drawShotCaptions(width, height) {
    if (!shotCaptions.length) return;
    ctx.save();
    shotCaptions.forEach((caption, index) => {
      const t = clamp(caption.age / caption.duration, 0, 1);
      const enter = 1 - Math.pow(1 - clamp(t / 0.28, 0, 1), 3);
      const exit = 1 - Math.pow(clamp((t - 0.72) / 0.28, 0, 1), 2);
      const alpha = clamp(enter * exit, 0, 1);
      const pop = 0.72 + easeOutBack(clamp(t / 0.42, 0, 1)) * 0.42 * caption.impact;
      const driftY = Math.sin(t * Math.PI) * height * 0.02 - t * height * 0.035;
      const x = width * caption.x;
      const y = height * caption.y + driftY + index * height * 0.035;
      const palette = captionPalette(caption.tone);
      const titleSize = Math.round(clamp(width * 0.072, 34, 86) * caption.impact);
      const subSize = Math.round(clamp(width * 0.017, 11, 18));

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${titleSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.shadowColor = palette.shadow;
      ctx.shadowBlur = titleSize * 0.22;
      ctx.shadowOffsetY = titleSize * 0.06;
      ctx.strokeStyle = "rgb(5 13 18 / 0.28)";
      ctx.lineWidth = Math.max(3, titleSize * 0.08);
      ctx.strokeText(caption.text, 0, 0);
      ctx.fillStyle = palette.fill;
      ctx.fillText(caption.text, 0, 0);

      const measure = ctx.measureText(caption.text);
      const lineW = Math.min(width * 0.62, measure.width * 0.72);
      ctx.shadowBlur = titleSize * 0.12;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(2, titleSize * 0.035);
      ctx.beginPath();
      ctx.moveTo(-lineW * 0.5, titleSize * 0.58);
      ctx.lineTo(lineW * 0.5, titleSize * 0.58);
      ctx.stroke();

      if (caption.subtext) {
        ctx.shadowBlur = subSize * 0.45;
        ctx.font = `800 ${subSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = "rgb(255 255 255 / 0.78)";
        ctx.fillText(caption.subtext, 0, titleSize * 0.86);
      }

      if (caption.celebrate) {
        drawCaptionBurst(titleSize, t, palette);
      }
      ctx.restore();
    });
    ctx.restore();
  }

  function drawCaptionBurst(size, t, palette) {
    const burst = clamp((t - 0.04) / 0.52, 0, 1);
    if (burst <= 0 || burst >= 1) return;
    const alpha = (1 - burst) * 0.65;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(1.5, size * 0.018);
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      const inner = size * (0.82 + burst * 0.52);
      const outer = size * (1.0 + burst * 1.05);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += dt;
    if (pointer) {
      predictGuide(now);
    }
    let physicsSteps = 0;
    while (accumulator >= FIXED_DT && physicsSteps < MAX_PHYSICS_STEPS_PER_FRAME) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
      physicsSteps += 1;
    }
    if (physicsSteps >= MAX_PHYSICS_STEPS_PER_FRAME) accumulator = 0;
    draw(now / 1000);
    requestAnimationFrame(tick);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : event;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  function beginAim(event) {
    if (world.holed) {
      if (!world.holeTransitionShown) {
        world.holeTransitionShown = true;
        if (isMultiplayerActive()) {
          emitGameEvent("hole-complete");
        } else {
          showHoleAdvance();
        }
      }
      event.preventDefault();
      return;
    }
    if (!world.ball.asleep || world.holed) return;
    if (!canLocalAim()) { event.preventDefault(); return; }
    const pos = pointerPosition(event);
    pointer = {
      id: event.pointerId,
      startX: pos.x,
      startY: pos.y,
      x: pos.x,
      y: pos.y
    };
    world.player.aiming = true;
    invalidateGuideCache();
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveAim(event) {
    if (!pointer) return;
    const pos = pointerPosition(event);
    pointer.x = pos.x;
    pointer.y = pos.y;

    if (typeof navigator.vibrate === "function") {
      const rawX = pointer.startX - pointer.x;
      const rawY = pointer.y - pointer.startY;
      const pull = Math.hypot(rawX, rawY);
      const maxPull = Math.min(canvasSize().width, canvasSize().height) * 0.32;
      const power = clamp(pull / maxPull, 0, 1);
      const now = performance.now();
      if (power > 0.08 && (!pointer.lastHaptic || now - pointer.lastHaptic > 90)) {
        pointer.lastHaptic = now;
        navigator.vibrate(Math.round(5 + power * 18));
      }
    }

    // Emit live aim for multiplayer
    if (isMultiplayerActive() && shotPreview) {
      emitGameEvent("live-aim", {
        holeIndex: currentHoleIndex,
        playerId: getMultiplayerUserId(),
        ball: { x: world.ball.x, y: world.ball.y },
        pointer: { startX: pointer.startX, startY: pointer.startY, x: pointer.x, y: pointer.y },
        preview: {
          mode: shotPreview.mode,
          power: shotPreview.power,
          launch: { vx: shotPreview.launch.vx, vy: shotPreview.launch.vy, omega: shotPreview.launch.omega }
        },
        updatedAt: Date.now()
      });
    }

    event.preventDefault();
  }

  function endAim(event) {
    if (!pointer) return;
    shotPreview = computeLaunchFromDrag();
    const didPull = shotPreview && shotPreview.power > 0.035;
    if (didPull) launchFromPointer();
    else {
      pointer = null;
      shotPreview = null;
      guide.length = 0;
      invalidateGuideCache();
    }
    world.player.aiming = false;
    event.preventDefault();
  }

  canvas.addEventListener("pointerdown", beginAim);
  canvas.addEventListener("pointermove", moveAim);
  canvas.addEventListener("pointerup", endAim);
  canvas.addEventListener("pointercancel", endAim);

  window.addEventListener("keyup", (event) => {
    if (holeAdvanceModal?.classList.contains("visible")) {
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
        continueToNextHole();
      }
      return;
    }
    if (isMultiplayerActive() || isBotMatchActive()) return; // Block hole navigation in match modes
    if (event.key === "ArrowLeft") {
      setHole(currentHoleIndex - 1);
    } else if (event.key === "ArrowRight") {
      setHole(currentHoleIndex + 1);
    } else if ((event.key === "Enter" || event.key === " ") && world.holed) {
      if (!world.holeTransitionShown) {
        world.holeTransitionShown = true;
        showHoleAdvance();
      }
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      if (!isMultiplayerActive()) setHole(currentHoleIndex);
    }
    if ((event.key === "Enter" || event.key === " ") && wheel.visible && wheel.done) {
      setHole(currentHoleIndex + 1);
    }
  });

  aspectButtons.forEach((button) => {
    button.addEventListener("click", () => {
      aspectButtons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      document.body.classList.remove("phone", "four-five", "desktop");
      if (button.dataset.aspect !== "auto") {
        document.body.classList.add(button.dataset.aspect);
      } else {
        document.body.classList.add("phone"); // Default to phone
      }
      resizeQueued = true;
    });
  });

  // Default to phone on initial load
  document.body.classList.add("phone");
  const autoButton = document.querySelector("[data-aspect='auto']");
  if (autoButton) autoButton.classList.remove("active");
  const phoneButton = document.querySelector("[data-aspect='phone']");
  if (phoneButton) phoneButton.classList.add("active");


  holePrevButton?.addEventListener("click", () => {
    if (isMultiplayerActive() || isBotMatchActive()) return;
    setHole(currentHoleIndex - 1);
  });

  holeNextButton?.addEventListener("click", () => {
    if (isMultiplayerActive() || isBotMatchActive()) return;
    setHole(currentHoleIndex + 1);
  });

  resize();
  syncHoleUi();
  requestAnimationFrame(tick);

  // Intro modal logic
  function showIntro() {
    introModal.classList.add("visible");
    gameStats = { totalStrokes: 0, totalTime: 0, bestScore: null, totalYards: 0, holesPlayed: 0 };
  }

  let audioUnlocked = false;

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    Object.values(AUDIO).forEach(a => {
      a.volume = 0;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = 1; }).catch(() => {});
    });
  }

  function hideIntro() {
    unlockAudio();
    introModal.classList.remove("visible");
  }

  playButton.addEventListener("click", hideIntro);

  showIntro();

  // Hole advance modal logic

  function showHoleAdvance() {
    if (!holeAdvanceModal) return;
    if (isMultiplayerActive()) return; // Handled by multiplayer module
    const holeNum = currentHoleIndex + 1;
    const score = world.strokes - COURSE_PAR;
    const scoreText = score <= 0 ? String(score) : "+" + score;
    const scoreLabel = score < 0 ? "UNDER PAR" : score > 0 ? "OVER PAR" : "EVEN PAR";
    const yards = Math.round(world.farthestHit * 1.094);
    const totalSecs = Math.floor(world.holeTimer);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const timeText = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    const totalOutfits = HOLES.length;
    const outfitsUnlocked = Math.min(holeNum + 1, totalOutfits);
    const remainingOutfits = totalOutfits - outfitsUnlocked;
    const nextHole = holeNum + 1;
    const isLastHole = holeNum >= HOLES.length;

    gameStats.totalStrokes += world.strokes;
    gameStats.totalTime += world.holeTimer;
    gameStats.totalYards += yards;
    if (gameStats.bestScore === null || score < gameStats.bestScore) {
      gameStats.bestScore = score;
    }
    gameStats.holesPlayed += 1;

    const setText = (sel, val) => { const el = holeAdvanceModal.querySelector(sel); if (el) el.textContent = val; };
    const normalSections = holeAdvanceModal.querySelector(".advance-normal-sections");
    const summarySection = document.getElementById("hole-advance-summary");
    const continueBtn = document.getElementById("hole-advance-continue");

    if (isLastHole) {
      if (normalSections) normalSections.style.display = "none";
      if (summarySection) summarySection.style.display = "block";
      if (continueBtn) continueBtn.style.display = "none";
      const totalScore = gameStats.totalStrokes - (COURSE_PAR * gameStats.holesPlayed);
      const totalScoreText = totalScore <= 0 ? String(totalScore) : "+" + totalScore;
      const totalSecsAll = Math.floor(gameStats.totalTime);
      const tMins = Math.floor(totalSecsAll / 60);
      const tSecs = totalSecsAll % 60;
      const totalTimeText = String(tMins).padStart(2, "0") + ":" + String(tSecs).padStart(2, "0");
      const bestScoreText = gameStats.bestScore <= 0 ? String(gameStats.bestScore) : "+" + gameStats.bestScore;
      const finalScore = Math.round(clamp(100 - (gameStats.totalStrokes - 5) * 3.5, 0, 100));
      const isBonusAvailable = currentHoleIndex === HOLES.length - 2;
      if (holeAdvanceBonus) holeAdvanceBonus.style.display = isBonusAvailable ? "" : "none";
      setText("[data-advance-final-score]", finalScore);
      setText("[data-advance-total-score]", totalScoreText);
      setText("[data-advance-total-time]", totalTimeText);
      setText("[data-advance-best-hole]", bestScoreText);
      setText("[data-advance-total-yards]", gameStats.totalYards);
    } else {
      if (normalSections) normalSections.style.display = "";
      if (summarySection) summarySection.style.display = "none";
      if (continueBtn) continueBtn.style.display = "";
      setText("[data-advance-hole-number]", "HOLE " + holeNum + " COMPLETE");
      setText("[data-advance-score]", scoreText);
      setText("[data-advance-score-label]", scoreLabel);
      setText("[data-advance-farthest-hit]", yards + " YARDS");
      setText("[data-advance-time]", timeText);
      setText("[data-advance-outfits]", outfitsUnlocked + "/" + totalOutfits);
      setText("[data-advance-outfits-unlocked]", "You've unlocked " + outfitsUnlocked + " of " + totalOutfits + " outfits.");
      setText("[data-advance-outfits-remaining]", remainingOutfits + " more to unlock.");
      setText("[data-advance-continue-text]", "CONTINUE TO HOLE " + nextHole + " →");

      const progressSegments = holeAdvanceModal.querySelectorAll("[data-progress-segment]");
      progressSegments.forEach((seg, i) => {
        seg.classList.toggle("completed", i < outfitsUnlocked);
      });

      const productGrid = document.getElementById("hole-advance-products");
      if (productGrid) {
        const products = HOLE_PRODUCTS[currentHoleIndex] || HOLE_PRODUCTS[0];
        productGrid.innerHTML = products.map(p =>
          '<a href="' + p.url + '" target="_blank" class="product-item">' +
          '<img src="' + p.img + '" alt="' + p.name + '">' +
          '<p>' + p.name + '<br><strong>' + p.sub + '</strong></p>' +
          '</a>'
        ).join("");
      }
    }

    holeAdvanceModal.classList.add("visible");
  }

  function hideHoleAdvance() {
    if (!holeAdvanceModal) return;
    holeAdvanceModal.classList.remove("visible");
  }

  function continueToNextHole() {
    if (isMultiplayerActive()) {
      window.TeeMultiplayer.advanceToNextHole();
      return;
    }
    if (isBotMatchActive()) {
      return;
    }
    hideHoleAdvance();
    if (currentHoleIndex + 1 >= HOLES.length) {
      showIntro();
      setHole(0);
      return;
    }
    setHole(currentHoleIndex + 1);
  }

  holeAdvanceContinue?.addEventListener("click", continueToNextHole);
  holeAdvanceRetry?.addEventListener("click", () => { hideHoleAdvance(); showIntro(); setHole(0); });
  holeAdvanceBonus?.addEventListener("click", () => { hideHoleAdvance(); setHole(currentHoleIndex + 1); });

  // --- Bot Match Bridge ---

  window.TeeGame = {
    getWorld: () => world,
    botLaunch,
    terrainSlope: (x) => terrainSlope(x),
    terrainHeight: (x) => terrainHeight(x),
    getCurrentHoleIndex: () => currentHoleIndex,
    getHoles: () => HOLES,
    getHoleX: () => COURSE.holeX,
    getGreenStart: () => COURSE.greenStart,
    getGreenEnd: () => COURSE.greenEnd,
    isPuttLie: (ball) => isPuttLie(ball)
  };

  // Emit frame tick for bot match update loop
  const origTick = tick;
  tick = function(now) {
    origTick(now);
    if (isBotMatchActive()) {
      const dt = Math.min((now - (tick._last || now)) / 1000, 0.05);
      tick._last = now;
      window.dispatchEvent(new CustomEvent("tee:frame-tick", { detail: { dt } }));
    }
  };
  tick._last = 0;

  // Listen for bot match hole advance
  window.addEventListener("tee:bot-match-advance-hole", (e) => {
    if (e.detail && e.detail.holeIndex !== undefined) {
      setHole(e.detail.holeIndex);
    }
  });

  // Listen for bot match start
  window.addEventListener("tee:bot-match-start", (e) => {
    hideIntro();
    if (e.detail && e.detail.holeIndex !== undefined) {
      setHole(e.detail.holeIndex);
    }
  });

  // Listen for bot match ball reset
  window.addEventListener("tee:bot-match-reset-ball", (e) => {
    const idx = (e.detail && e.detail.holeIndex !== undefined) ? e.detail.holeIndex : currentHoleIndex;
    setHole(idx);
  });
})();