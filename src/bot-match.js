// ---------------------------------------------------------------------------
// Tee Game Bot Match Module
// Simulated "Find Match" with AI opponent using existing physics.
// No servers, no real matchmaking, no accounts.
// ---------------------------------------------------------------------------

(() => {
  "use strict";

  const MATCH_LENGTH = 5;
  const COURSE_PAR = 3;
  const GRAVITY = 9.81;
  const GREEN_ROLLING_RESISTANCE = 0.12;

  // --- Opponent Generation ---

  const GOLF_NAMES = [
    "BogeyBandit", "FairwayMenace", "ClubhouseKing", "MulliganMax",
    "SandTrapSam", "RoughRider99", "BirdieHunter", "GreenMachine",
    "SliceAndDice", "ForeRight42", "TapInTerry", "CaddieShack",
    "DimpleDuke", "BackNineBob", "PinSeeker", "DivotDave",
    "EagleEyeEd", "LagPuttLarry", "TexasWedge", "GimmieGrant",
    "FlopShotPhil", "StingerSteve", "PowerFadePete", "LinksLegend",
    "AceVentura", "IronByron", "SweetSpotSue", "ChipAndRun",
    "HoleInWon", "ParThenBar", "TeeBoxTony", "GreenSideGrace",
    "BunkerBuster", "RangeRatRob", "SwingDoctor", "CartPathCarl",
    "DuffedItDan", "ThinToWin", "GolfBallPaul", "YippeeKai"
  ];

  const SKILL_TIERS = [
    { name: "Beginner", weight: 10, aimNoise: 0.18, powerNoise: 0.15, shotDelayMin: 2.0, shotDelayMax: 4.5 },
    { name: "Casual", weight: 20, aimNoise: 0.10, powerNoise: 0.08, shotDelayMin: 1.5, shotDelayMax: 3.5 },
    { name: "Solid", weight: 25, aimNoise: 0.05, powerNoise: 0.04, shotDelayMin: 1.0, shotDelayMax: 2.5 },
    { name: "Sharp", weight: 22, aimNoise: 0.025, powerNoise: 0.02, shotDelayMin: 0.8, shotDelayMax: 2.0 },
    { name: "Scratch", weight: 15, aimNoise: 0.01, powerNoise: 0.01, shotDelayMin: 0.6, shotDelayMax: 1.5 },
    { name: "Tour", weight: 6, aimNoise: 0.004, powerNoise: 0.005, shotDelayMin: 0.5, shotDelayMax: 1.2 },
    { name: "Legend", weight: 1.5, aimNoise: 0.001, powerNoise: 0.002, shotDelayMin: 0.3, shotDelayMax: 0.8 },
    { name: "Mythic", weight: 0.5, aimNoise: 0.0005, powerNoise: 0.001, shotDelayMin: 0.2, shotDelayMax: 0.5 }
  ];

  const PERSONALITIES = [
    { name: "Friendly", emojis: ["😀","😍","😂"], reactionChance: 0.6, trashTalk: false },
    { name: "Competitive", emojis: ["😮","😡","😀"], reactionChance: 0.8, trashTalk: true },
    { name: "Chill", emojis: ["😀","😍"], reactionChance: 0.35, trashTalk: false },
    { name: "Wild", emojis: ["😂","😮","😡","😍"], reactionChance: 0.9, trashTalk: true }
  ];

  // --- State ---

  let matchState = {
    active: false,
    phase: "idle"  // idle | searching | playing | finished
  };
  let opponent = null;
  let playerName = "You";
  let currentTurn = "player";  // player | opponent
  let holeIndex = 0;
  let playerTotalScores = [];   // strokes per hole
  let opponentTotalScores = []; // strokes per hole
  let playerHoleStrokes = 0;
  let opponentHoleStrokes = 0;
  let playerHoled = false;
  let opponentHoled = false;
  let botPlanningTimer = 0;
  let botShotDelay = 0;
  let botHasShotThisTurn = false;
  let reactionCooldowns = {};
  let playerBallState = null;
  let opponentBallState = null;
  let playerOutfitIndex = 0;
  let opponentOutfitIndex = 1;

  // --- UI Elements ---

  let mmOverlay = null;
  let mmStatusEl = null;
  let matchHudEl = null;
  let matchCardEl = null;
  let matchReactBtn = null;
  let matchReactTray = null;
  let botStatusEl = null;

  // --- Helpers ---

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className") el.className = v;
      else if (k === "innerHTML") el.innerHTML = v;
      else if (k === "textContent") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === "string") el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
    return el;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function weightedPick(items, weightKey) {
    const total = items.reduce((s, i) => s + i[weightKey], 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item[weightKey];
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // --- Opponent Generation ---

  function generateOpponent() {
    const name = pickRandom(GOLF_NAMES);
    const tier = weightedPick(SKILL_TIERS, "weight");
    const personality = pickRandom(PERSONALITIES);
    return {
      name,
      tier,
      personality,
      skillAimNoise: tier.aimNoise,
      skillPowerNoise: tier.powerNoise,
      shotDelayMin: tier.shotDelayMin,
      shotDelayMax: tier.shotDelayMax
    };
  }

  // --- Matchmaking UI ---

  function createMatchmakingOverlay() {
    if (mmOverlay) return;
    const wrapper = document.querySelector(".game-wrapper");
    if (!wrapper) return;

    mmOverlay = createEl("div", { className: "bm-overlay", id: "bm-matchmaking" });

    const panel = createEl("div", { className: "bm-panel" });

    panel.appendChild(createEl("img", {
      src: "tee-game-logo.svg",
      className: "bm-logo",
      alt: "Tee Game"
    }));

    panel.appendChild(createEl("h2", {
      className: "bm-heading",
      textContent: "Finding Match"
    }));

    mmStatusEl = createEl("p", {
      className: "bm-status",
      textContent: "Connecting to the clubhouse..."
    });
    panel.appendChild(mmStatusEl);

    const spinner = createEl("div", { className: "bm-spinner" });
    panel.appendChild(spinner);

    const cancelBtn = createEl("button", {
      className: "intro-button bm-cancel-btn",
      textContent: "Cancel",
      onClick: cancelMatchmaking
    });
    panel.appendChild(cancelBtn);

    mmOverlay.appendChild(panel);
    wrapper.appendChild(mmOverlay);
  }

  const SEARCH_MESSAGES = [
    "Checking the clubhouse...",
    "Finding a fairway menace...",
    "Opponent warming up...",
    "Polishing the irons...",
    "Lining up on the range...",
    "Teeing up a challenger...",
    "Scanning the leaderboard...",
    "Match found!"
  ];

  let searchMsgIndex = 0;
  let searchTimer = 0;
  let searchDuration = 0;
  let searchElapsed = 0;

  function showMatchmaking() {
    createMatchmakingOverlay();
    if (!mmOverlay) return;
    mmOverlay.classList.add("visible");
    searchMsgIndex = 0;
    searchElapsed = 0;
    searchDuration = rand(1.5, 10.0);
    mmStatusEl.textContent = SEARCH_MESSAGES[0];
    startSearchLoop();
  }

  function hideMatchmaking() {
    if (mmOverlay) mmOverlay.classList.remove("visible");
  }

  function cancelMatchmaking() {
    hideMatchmaking();
    matchState.phase = "idle";
    matchState.active = false;
  }

  function startSearchLoop() {
    const step = 0.3;
    const interval = setInterval(() => {
      if (!matchState.active && matchState.phase !== "searching") {
        clearInterval(interval);
        return;
      }
      searchElapsed += step;
      const progress = searchElapsed / searchDuration;

      if (progress < 0.85) {
        const msgIdx = Math.min(
          Math.floor(progress * (SEARCH_MESSAGES.length - 2)),
          SEARCH_MESSAGES.length - 2
        );
        if (msgIdx !== searchMsgIndex) {
          searchMsgIndex = msgIdx;
          mmStatusEl.textContent = SEARCH_MESSAGES[msgIdx];
        }
      } else if (progress >= 1.0) {
        mmStatusEl.textContent = SEARCH_MESSAGES[SEARCH_MESSAGES.length - 1];
        clearInterval(interval);
        setTimeout(() => {
          hideMatchmaking();
          opponent = generateOpponent();
          startMatch();
        }, 800);
      }
    }, step * 1000);
  }

  // --- Match Flow ---

  function startMatch() {
    matchState.active = true;
    matchState.phase = "playing";
    holeIndex = 0;
    playerTotalScores = [];
    opponentTotalScores = [];
    playerHoleStrokes = 0;
    opponentHoleStrokes = 0;
    playerHoled = false;
    opponentHoled = false;
    playerBallState = null;
    opponentBallState = null;
    currentTurn = "player";
    botPlanningTimer = 0;
    botShotDelay = 0;
    botHasShotThisTurn = false;
    reactionCooldowns = {};
    playerEmojiCount = 0;
    playerEmojiTimer = 0;

    hideIntroModal();
    createMatchHUD();
    updateMatchHUD();

    // Reset to hole 0 for the match
    window.dispatchEvent(new CustomEvent("tee:bot-match-start", {
      detail: { holeIndex: 0, matchLength: MATCH_LENGTH }
    }));

    // Coin toss: random who goes first
    if (Math.random() < 0.5) {
      currentTurn = "opponent";
      scheduleBotShot();
    }
  }

  function endMatch() {
    matchState.phase = "finished";
    matchState.active = false;
    destroyMatchHUD();
    showMatchResult();
  }

  function hideIntroModal() {
    const introModal = document.getElementById("intro-modal");
    if (introModal) introModal.classList.remove("visible");
  }

  function getWorld() {
    return window.TeeGame && window.TeeGame.getWorld ? window.TeeGame.getWorld() : null;
  }

  // --- Turn Management ---

  function switchTurn() {
    if (!matchState.active) return;

    // Don't switch to a player who already holed
    const nextTurn = currentTurn === "player" ? "opponent" : "player";
    if ((nextTurn === "player" && playerHoled) || (nextTurn === "opponent" && opponentHoled)) {
      if (currentTurn === "opponent" && !opponentHoled) {
        botHasShotThisTurn = false;
        scheduleBotShot();
      }
      updateMatchHUD();
      return;
    }

    // Save current player's ball state
    const world = getWorld();
    if (world && world.ball) {
      const b = world.ball;
      const state = { x: b.x, y: b.y };
      if (currentTurn === "player") {
        playerBallState = state;
        playerHoleStrokes = world.strokes;
      } else {
        opponentBallState = state;
        opponentHoleStrokes = world.strokes;
      }
    }

    currentTurn = currentTurn === "player" ? "opponent" : "player";

    // Restore incoming player's ball state (or default to tee)
    const incomingState = currentTurn === "player" ? playerBallState : opponentBallState;
    if (world && world.ball) {
      if (incomingState) {
        const b = world.ball;
        b.x = incomingState.x;
        b.y = incomingState.y;
        b.vx = 0; b.vy = 0; b.omega = 0;
        b.angle = 0; b.grounded = true; b.asleep = true;
        b.slipping = false; b.bounceCount = 0;
        const tg = window.TeeGame;
        if (tg) b.y = tg.terrainHeight(b.x) + 0.31;
        world.cameraMode = "settled";
        world.holed = false;
        world.holeSinkTimer = 0;
        world.holeTransitionShown = false;
      } else {
        // First shot on this hole: reset ball to tee
        window.dispatchEvent(new CustomEvent("tee:bot-match-reset-ball", {
          detail: { holeIndex }
        }));
      }
      // Re-get world in case resetBallForTurn recreated it
      const w = getWorld();
      if (w) {
        w.strokes = currentTurn === "player" ? playerHoleStrokes : opponentHoleStrokes;
        w.player.x = w.ball.x;
        w.player.y = w.ball.y;
        w.player.animating = false;
        w.player.aiming = false;
        w.player.timer = 0;
        w.player.frame = 0;
        w.player.pendingLaunch = null;
        w.cameraMode = "settled";
      }
    }

    botHasShotThisTurn = false;
    updateMatchHUD();
    updateBotStatus();

    if (currentTurn === "opponent" && !opponentHoled) {
      scheduleBotShot();
    } else if (currentTurn === "player" && !playerHoled) {
      if (botStatusEl) botStatusEl.textContent = "";
    }
  }

  function scheduleBotShot() {
    if (!opponent) return;
    botPlanningTimer = 0;
    botShotDelay = rand(opponent.shotDelayMin, opponent.shotDelayMax);
    botHasShotThisTurn = false;
    updateBotStatus();
  }

  function updateBotStatus() {
    if (!botStatusEl || currentTurn !== "opponent" || botHasShotThisTurn) return;
    if (!opponent) return;
    const msgs = [
      opponent.name + " is lining up...",
      opponent.name + " checking the wind...",
      opponent.name + " addressing the ball...",
      opponent.name + " taking a practice swing..."
    ];
    botStatusEl.textContent = pickRandom(msgs);
  }

  // --- Bot Shot Planner ---

  function planBotShot(world) {
    if (!world || !opponent || world.holed) return null;

    const ball = world.ball;
    const tg = window.TeeGame;
    const holeX = tg ? tg.getHoleX() : ball.x + 100;
    const dx = holeX - ball.x;
    const distance = Math.abs(dx);

    // Very close to hole: tap-in putt
    if (distance < 0.8) {
      const vx = (dx > 0 ? 1 : -1) * clamp(distance * 1.8 + 0.3, 0.5, 8);
      return { vx, vy: 0, mode: "putt" };
    }

    const tgBall = { x: ball.x, grounded: ball.grounded };
    const isPutt = tg && ball.grounded && tg.isPuttLie(tgBall);
    const mode = isPutt ? "putt" : "swing";

    if (mode === "putt") {
      const idealFlatSpeed = Math.sqrt(distance * 2 * GRAVITY * GREEN_ROLLING_RESISTANCE);
      const maxPuttSpeed = clamp(idealFlatSpeed * 1.85 + 1.2, 7.5, 18);
      const noiseFactor = 1.0 + (Math.random() - 0.5) * 2 * opponent.skillPowerNoise * 0.5;
      const speed = clamp(idealFlatSpeed * noiseFactor, 0.6, maxPuttSpeed);
      const vx = dx > 0 ? speed : -speed;
      return { vx, vy: 0, mode: "putt" };
    }

    // Swing: distance-to-speed table with drag compensation built in
    let targetSpeed;
    if (distance < 20) {
      targetSpeed = distance * 0.85 + 3;
    } else if (distance < 80) {
      targetSpeed = distance * 0.55 + 10;
    } else if (distance < 180) {
      targetSpeed = distance * 0.42 + 18;
    } else if (distance < 280) {
      targetSpeed = distance * 0.30 + 32;
    } else {
      targetSpeed = distance * 0.20 + 52;
    }
    targetSpeed = clamp(targetSpeed, 6, 85);

    // Skill-based noise
    const noiseAmt = opponent.skillPowerNoise * 20;
    const baseSpeed = targetSpeed + (Math.random() - 0.5) * 2 * noiseAmt;
    const speed = clamp(baseSpeed, 5, 85);

    // Launch angle: steeper for longer shots
    const distNorm = clamp(distance / 300, 0, 1);
    const baseAngle = lerp(0.22, 0.48, distNorm);
    const angleNoise = opponent.skillAimNoise * 0.15;
    const angle = clamp(baseAngle + (Math.random() - 0.5) * 2 * angleNoise, 0.08, 0.72);

    const dir = dx > 0 ? 1 : -1;
    const vx = Math.cos(angle) * dir * speed;
    const vy = -Math.sin(angle) * speed;

    return { vx, vy, mode: "swing" };
  }

  function getTerrainSlope(x) {
    if (window.TeeGame && window.TeeGame.terrainSlope) {
      return Math.abs(window.TeeGame.terrainSlope(x));
    }
    return 0;
  }

  function executeBotShot(launch) {
    if (!launch || !window.TeeGame || !window.TeeGame.botLaunch) return;
    botHasShotThisTurn = true;
    if (botStatusEl) botStatusEl.textContent = "";

    const tg = window.TeeGame;
    const world = tg.getWorld();
    if (world) world.player.direction = launch.vx >= 0 ? 1 : -1;

    // Single animation: aiming off, swing on, wait for contact frame, then launch
    tg.setOpponentAiming(false);
    tg.triggerOpponentSwing();

    const contactMs = launch.mode === "putt" ? 330 : 390;
    setTimeout(() => {
      if (!matchState.active) return;
      // Guard: don't launch if swing was restarted
      if (tg.getWorld && tg.getWorld()) {
        const w = tg.getWorld();
        if (w.holed) return;
      }
      tg.botLaunch(launch.vx, launch.vy, launch.mode);
    }, contactMs);
  }

  // --- Reaction System ---

  const PLAYER_EMOJIS = [
    { emoji: "😀", name: "happy" },
    { emoji: "😍", name: "love" },
    { emoji: "😂", name: "laugh" },
    { emoji: "😮", name: "surprised" },
    { emoji: "😡", name: "rage" }
  ];

  let playerEmojiCount = 0;
  let playerEmojiTimer = 0;

  function checkBotReaction(context) {
    if (!opponent || !matchState.active || currentTurn === "opponent") return;

    const cooldown = reactionCooldowns[context] || 0;
    if (cooldown > 0) return;

    const p = opponent.personality;
    const roll = Math.random();
    if (roll > p.reactionChance * 1.2) return;

    let emoji = null;

    switch (context) {
      case "player_hole_in_one":
      case "player_eagle":
        emoji = p.trashTalk
          ? (Math.random() < 0.6 ? "😡" : "😮")
          : (Math.random() < 0.6 ? "😮" : "😍");
        break;
      case "player_birdie":
        emoji = Math.random() < 0.5 ? "😀" : (p.trashTalk ? "😡" : "😮");
        break;
      case "player_bad_miss":
        emoji = p.trashTalk
          ? (Math.random() < 0.6 ? "😂" : "😀")
          : "😂";
        break;
      case "player_great_shot":
        emoji = Math.random() < 0.5 ? "😮" : "😍";
        break;
      case "opponent_bad_miss":
        emoji = p.trashTalk ? "😡" : (Math.random() < 0.5 ? "😀" : "😮");
        break;
      case "opponent_takes_lead":
        emoji = p.trashTalk ? "😀" : "😍";
        break;
      case "player_takes_lead":
        emoji = "😡";
        break;
      default:
        return;
    }

    if (emoji) {
      reactionCooldowns[context] = 10; // prevent duplicate immediately
      const delay = rand(600, 2800);
      setTimeout(() => {
        if (!matchState.active) return;
        spawnFloatingEmoji(emoji, true);
        reactionCooldowns[context] = rand(3, 8);
      }, delay);
    }
  }

  function playerSendReaction(emoji) {
    spawnFloatingEmoji(emoji, false);
    playerEmojiCount++;
    playerEmojiTimer = 2.5;

    // Respond to emoji spam (3+ in a short window)
    if (playerEmojiCount >= 3 && opponent && currentTurn !== "opponent") {
      const p = opponent.personality;
      const spamReply = p.trashTalk
        ? (Math.random() < 0.5 ? "😡" : "😂")
        : pickRandom(p.emojis);
      const delay = rand(500, 1500);
      setTimeout(() => {
        if (!matchState.active) return;
        spawnFloatingEmoji(spamReply, true);
      }, delay);
      playerEmojiCount = 0;
      return;
    }

    // Occasional reply to single emoji
    if (opponent && Math.random() < 0.35 && currentTurn !== "opponent") {
      const delay = rand(800, 2500);
      setTimeout(() => {
        if (!matchState.active || currentTurn === "opponent") return;
        const reply = pickRandom(opponent.personality.emojis);
        spawnFloatingEmoji(reply, true);
      }, delay);
    }
  }

  function playerSendReaction(emoji) {
    spawnFloatingEmoji(emoji, false);
    if (opponent && Math.random() < 0.4) {
      setTimeout(() => {
        const reply = pickRandom(opponent.personality.emojis);
        spawnFloatingEmoji(reply, true);
      }, rand(600, 2000));
    }
  }

  function spawnFloatingEmoji(emoji, isBot) {
    const wrapper = document.querySelector(".game-wrapper");
    if (!wrapper) return;

    const floatEl = document.createElement("div");
    floatEl.className = "mp-emoji-float";
    floatEl.textContent = emoji;

    // Position near the reaction button or at opponent side
    const btn = matchReactBtn || document.querySelector(".mp-react-btn");
    if (btn && !isBot) {
      const btnRect = btn.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      floatEl.style.left = (btnRect.left - wrapRect.left + btnRect.width / 2 - 14) + "px";
      floatEl.style.top = (btnRect.top - wrapRect.top) + "px";
    } else {
      floatEl.style.left = (isBot ? 65 : 35) + "%";
      floatEl.style.top = "55%";
    }

    wrapper.appendChild(floatEl);
    floatEl.addEventListener("animationend", () => {
      if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
    });
  }

  // --- Match HUD ---

  function createMatchHUD() {
    if (matchHudEl) return;

    const wrapper = document.querySelector(".game-wrapper");
    if (!wrapper) return;

    matchHudEl = createEl("div", { className: "mp-hud", id: "bm-hud" });
    wrapper.appendChild(matchHudEl);

    matchReactBtn = createEl("button", {
      className: "mp-react-btn",
      innerHTML: "😊",
      onClick: (e) => {
        e.stopPropagation();
        toggleMatchReactTray();
      }
    });
    matchHudEl.appendChild(matchReactBtn);

    matchReactTray = createEl("div", { className: "mp-react-tray" });
    PLAYER_EMOJIS.forEach((item) => {
      const btn = createEl("button", {
        className: "mp-react-emoji",
        textContent: item.emoji,
        onClick: (e) => {
          e.stopPropagation();
          matchReactTray.classList.remove("open");
          playerSendReaction(item.emoji);
        }
      });
      matchReactTray.appendChild(btn);
    });
    matchHudEl.appendChild(matchReactTray);

    botStatusEl = createEl("div", { className: "bm-bot-status" });
    wrapper.appendChild(botStatusEl);
  }

  function toggleMatchReactTray() {
    if (!matchReactTray) return;
    const isOpen = matchReactTray.classList.contains("open");
    if (isOpen) {
      matchReactTray.classList.remove("open");
    } else {
      positionMatchReactTray();
      matchReactTray.classList.add("open");
    }
  }

  function positionMatchReactTray() {
    if (!matchReactTray || !matchReactBtn || !matchHudEl) return;
    const btnRect = matchReactBtn.getBoundingClientRect();
    const hudRect = matchHudEl.getBoundingClientRect();
    const trayW = matchReactTray.offsetWidth || 240;
    const trayH = matchReactTray.offsetHeight || 46;

    let left = btnRect.left - hudRect.left + btnRect.width / 2 - trayW / 2;
    left = Math.max(0, Math.min(left, matchHudEl.offsetWidth - trayW));

    let top = btnRect.top - hudRect.top - trayH - 8;
    if (top < -hudRect.top + 8) {
      // Flip below if not enough space above
      top = btnRect.bottom - hudRect.top + 8;
    }

    matchReactTray.style.top = top + "px";
    matchReactTray.style.left = left + "px";
  }

  function updateMatchHUD() {
    if (!matchHudEl) return;
    matchHudEl.style.display = matchState.active ? "" : "none";
    if (!matchState.active) return;

    if (matchCardEl && matchCardEl.parentNode) {
      matchCardEl.parentNode.removeChild(matchCardEl);
    }

    matchCardEl = createEl("div", { className: "mp-hud-card" });

    const isPlayerTurn = currentTurn === "player";

    // Player score
    const playerScore = createEl("div", {
      className: "mp-player-score" + (isPlayerTurn ? " mp-active" : "")
    });
    playerScore.appendChild(createEl("span", { className: "mp-score-name", textContent: "You" }));
    playerScore.appendChild(createEl("span", { className: "mp-score-strokes", textContent: String(playerHoleStrokes) }));
    matchCardEl.appendChild(playerScore);

    matchCardEl.appendChild(createEl("span", { className: "mp-vs", textContent: "vs" }));

    // Opponent score (just strokes, name moved under logo)
    const oppScore = createEl("div", {
      className: "mp-player-score" + (!isPlayerTurn ? " mp-active" : "")
    });
    const shortName = (opponent?.name || "Opp").substring(0, 6);
    oppScore.appendChild(createEl("span", { className: "mp-score-name", textContent: shortName }));
    oppScore.appendChild(createEl("span", { className: "mp-score-strokes", textContent: String(opponentHoleStrokes) }));
    matchCardEl.appendChild(oppScore);

    matchCardEl.appendChild(createEl("div", { className: "mp-hud-divider" }));

    // Hole info
    const holeInfo = createEl("div", { className: "mp-hole-info" });
    holeInfo.appendChild(createEl("span", { className: "mp-hole-number", textContent: "Hole " + (holeIndex + 1) + "/" + MATCH_LENGTH }));
    holeInfo.appendChild(createEl("span", { className: "mp-hole-par", textContent: "Par " + COURSE_PAR }));
    matchCardEl.appendChild(holeInfo);

    // Turn pill
    const turnPill = createEl("div", { className: "mp-turn-pill" });
    if (isPlayerTurn) {
      turnPill.classList.add("mp-my-turn");
      turnPill.textContent = "Your Turn";
    } else {
      turnPill.classList.add("mp-opp-turn");
      const name = opponent?.name || "Opp";
      const short = name.length > 5 ? name.substring(0, 4) + "…" : name;
      turnPill.textContent = short;
    }
    matchCardEl.appendChild(turnPill);

    matchHudEl.insertBefore(matchCardEl, matchReactBtn);
  }

  function destroyMatchHUD() {
    if (matchHudEl && matchHudEl.parentNode) {
      matchHudEl.parentNode.removeChild(matchHudEl);
    }
    if (botStatusEl && botStatusEl.parentNode) {
      botStatusEl.parentNode.removeChild(botStatusEl);
    }
    matchHudEl = null;
    matchCardEl = null;
    matchReactBtn = null;
    matchReactTray = null;
    botStatusEl = null;
  }

  // --- Match Result Screen ---

  function showMatchResult() {
    const wrapper = document.querySelector(".game-wrapper");
    if (!wrapper) return;

    let overlay = document.getElementById("bm-match-result");
    if (!overlay) {
      overlay = createEl("div", { className: "mp-overlay bm-result-overlay", id: "bm-match-result" });
      wrapper.appendChild(overlay);
    }

    const panel = createEl("div", { className: "mp-panel" });

    const isWin = getTotalPlayerStrokes() < getTotalOpponentStrokes();
    const isTie = getTotalPlayerStrokes() === getTotalOpponentStrokes();

    panel.appendChild(createEl("img", {
      src: "tee-game-logo.svg",
      className: "bm-logo",
      alt: "Tee Game"
    }));

    panel.appendChild(createEl("h2", {
      className: "mp-heading mp-match-heading",
      textContent: isTie ? "IT'S A TIE!" : (isWin ? "YOU WIN!" : opponent.name + " WINS!")
    }));

    // Player row
    const pRow = createEl("div", { className: "mp-match-player" });
    pRow.appendChild(createEl("span", { className: "mp-match-name", textContent: "You" }));
    pRow.appendChild(createEl("span", { className: "mp-match-strokes", textContent: getTotalPlayerStrokes() + " strokes" }));
    panel.appendChild(pRow);

    // Opponent row
    const oRow = createEl("div", { className: "mp-match-player" });
    oRow.appendChild(createEl("span", { className: "mp-match-name", textContent: opponent?.name || "Opponent" }));
    oRow.appendChild(createEl("span", { className: "mp-match-strokes", textContent: getTotalOpponentStrokes() + " strokes" }));
    oRow.appendChild(createEl("span", {
      className: "bm-skill-badge",
      textContent: opponent?.tier?.name || ""
    }));
    panel.appendChild(oRow);

    // Hole-by-hole breakdown
    const breakdown = createEl("div", { className: "bm-breakdown" });
    breakdown.appendChild(createEl("h3", { textContent: "Hole by Hole" }));
    for (let i = 0; i < playerTotalScores.length; i++) {
      const row = createEl("div", { className: "bm-hole-row" });
      row.appendChild(createEl("span", { textContent: "Hole " + (i + 1) }));
      row.appendChild(createEl("span", { textContent: String(playerTotalScores[i] || 0) }));
      row.appendChild(createEl("span", { textContent: String(opponentTotalScores[i] || 0) }));
      breakdown.appendChild(row);
    }
    panel.appendChild(breakdown);

    const btnRow = createEl("div", { className: "mp-btn-row" });
    const playAgainBtn = createEl("button", {
      className: "intro-button mp-small-btn",
      textContent: "Find New Match",
      onClick: () => {
        overlay.innerHTML = "";
        overlay.classList.remove("visible");
        matchState.phase = "searching";
        matchState.active = true;
        showMatchmaking();
      }
    });
    const menuBtn = createEl("button", {
      className: "intro-button mp-back-btn",
      textContent: "Back to Menu",
      onClick: () => {
        overlay.innerHTML = "";
        overlay.classList.remove("visible");
        matchState.active = false;
        matchState.phase = "idle";
      }
    });
    btnRow.appendChild(playAgainBtn);
    panel.appendChild(btnRow);
    panel.appendChild(menuBtn);

    overlay.innerHTML = "";
    overlay.appendChild(panel);
    overlay.classList.add("visible");
  }

  function getTotalPlayerStrokes() {
    return playerTotalScores.reduce((s, v) => s + v, 0);
  }

  function getTotalOpponentStrokes() {
    return opponentTotalScores.reduce((s, v) => s + v, 0);
  }

  // --- Event Handlers ---

  function handleShotSettled(detail) {
    if (!matchState.active) return;

    const strokes = detail?.strokes ?? 0;
    const holed = detail?.holed ?? false;

    if (currentTurn === "player") {
      playerHoleStrokes = strokes;
    } else {
      opponentHoleStrokes = strokes;
    }

    // Force hole-out at 7 strokes
    if (!holed && currentTurn === "opponent" && opponentHoleStrokes >= 7) {
      forceOpponentHoleOut();
      return;
    }

    if (holed) {
      if (currentTurn === "player") {
        playerHoled = true;
        if (playerHoleStrokes === 1) checkBotReaction("player_hole_in_one");
        else if (playerHoleStrokes <= COURSE_PAR - 2) checkBotReaction("player_eagle");
        else if (playerHoleStrokes <= COURSE_PAR - 1) checkBotReaction("player_birdie");
      } else {
        opponentHoled = true;
      }

      // If both holed, advance immediately
      if (playerHoled && opponentHoled) {
        updateMatchHUD();
        advanceHole();
        return;
      }
    } else {
      if (currentTurn === "player" && playerHoleStrokes >= 4) checkBotReaction("player_bad_miss");
      if (currentTurn === "opponent" && opponentHoleStrokes >= 4) checkBotReaction("opponent_bad_miss");
    }

    updateMatchHUD();
    switchTurn();
  }

  function handleHoleComplete() {
    if (!matchState.active) return;
    const gameHole = window.TeeGame ? window.TeeGame.getCurrentHoleIndex() : holeIndex;
    if (gameHole !== holeIndex) return;
    if (playerHoled && opponentHoled) {
      advanceHole();
    }
  }

  function advanceHole() {
    playerTotalScores.push(playerHoleStrokes);
    opponentTotalScores.push(opponentHoleStrokes);

    const pTotal = getTotalPlayerStrokes();
    const oTotal = getTotalOpponentStrokes();
    if (pTotal < oTotal && opponentTotalScores.length >= 2) {
      const wasLeading = opponentTotalScores.slice(0, -1).reduce((s, v) => s + v, 0)
        >= playerTotalScores.slice(0, -1).reduce((s, v) => s + v, 0);
      if (wasLeading) checkBotReaction("player_takes_lead");
    }
    if (oTotal < pTotal && opponentTotalScores.length >= 2) {
      const wasLeading = playerTotalScores.slice(0, -1).reduce((s, v) => s + v, 0)
        >= opponentTotalScores.slice(0, -1).reduce((s, v) => s + v, 0);
      if (wasLeading) checkBotReaction("opponent_takes_lead");
    }

    playerHoleStrokes = 0;
    opponentHoleStrokes = 0;
    playerHoled = false;
    opponentHoled = false;
    playerBallState = null;
    opponentBallState = null;
    holeIndex++;

    if (holeIndex >= MATCH_LENGTH) {
      endMatch();
      return;
    }

    window.dispatchEvent(new CustomEvent("tee:bot-match-advance-hole", {
      detail: { holeIndex }
    }));

    currentTurn = Math.random() < 0.5 ? "player" : "opponent";
    const world = getWorld();
    if (world) world.strokes = 0;
    updateMatchHUD();
    if (currentTurn === "opponent") scheduleBotShot();
  }

  function forceOpponentHoleOut() {
    opponentHoled = true;
    opponentHoleStrokes = 7;
    updateMatchHUD();

    if (playerHoled) {
      advanceHole();
    } else {
      switchTurn();
    }
  }

  function resetBallForTurn() {
    window.dispatchEvent(new CustomEvent("tee:bot-match-reset-ball", {
      detail: { holeIndex }
    }));
  }

  // --- Update Loop (for bot shot timer) ---

  function update(dt) {
    if (!matchState.active || matchState.phase !== "playing") return;

    if (reactionCooldowns) {
      for (const k in reactionCooldowns) {
        if (reactionCooldowns[k] > 0) reactionCooldowns[k] -= dt;
      }
    }
    if (playerEmojiTimer > 0) {
      playerEmojiTimer -= dt;
      if (playerEmojiTimer <= 0) playerEmojiCount = 0;
    }

    if (currentTurn === "opponent" && !botHasShotThisTurn && opponent) {
      botPlanningTimer += dt;

      // Timeout guard: force shot after 15 seconds
      const forceShot = botPlanningTimer > 15.0;
      if (botPlanningTimer >= botShotDelay || forceShot) {
        if (forceShot) botShotDelay = 0;
        const world = getWorld();
        if (world && world.ball && world.ball.asleep && !world.holed && !opponentHoled) {
          const launch = planBotShot(world);
          if (launch) {
            executeBotShot(launch);
          } else {
            // Fallback: direct putt toward hole
            const tg = window.TeeGame;
            const holeX = tg ? tg.getHoleX() : world.ball.x + 100;
            const dx = holeX - world.ball.x;
            const vx = dx > 0 ? 1.5 : -1.5;
            executeBotShot({ vx, vy: 0, mode: "putt" });
          }
        }
      }
    }
  }

  // --- Public API ---

  function isActive() {
    return matchState.active;
  }

  function isPlaying() {
    return matchState.active && matchState.phase === "playing";
  }

  function isLocalTurn() {
    return currentTurn === "player";
  }

  function getOpponent() {
    return opponent;
  }

  function getCurrentTurn() {
    return currentTurn;
  }

  function getHoleIndex() {
    return holeIndex;
  }

  // --- Initialization ---

  // Document click to close reaction tray
  document.addEventListener("click", (e) => {
    if (!matchReactTray || !matchReactTray.classList.contains("open")) return;
    if (matchReactBtn && matchReactBtn.contains(e.target)) return;
    if (matchReactTray.contains(e.target)) return;
    matchReactTray.classList.remove("open");
  });

  // Listen for game events
  window.addEventListener("tee:shot-settled", (e) => {
    if (isPlaying()) {
      handleShotSettled(e.detail);
    }
  });

  window.addEventListener("tee:hole-complete", (e) => {
    if (isPlaying()) {
      handleHoleComplete();
    }
  });

  // Listen for Find Match button
  window.addEventListener("tee:bot-match-find", () => {
    if (matchState.active && matchState.phase === "playing") return;
    resetState();
    matchState.phase = "searching";
    matchState.active = true;
    showMatchmaking();
  });

  window.addEventListener("tee:bot-match-find-confirmed", (event) => {
    if (matchState.active && matchState.phase === "playing") return;
    resetState();
    playerOutfitIndex = normalizeOutfitIndex(event.detail?.outfitIndex);
    opponentOutfitIndex = normalizeOutfitIndex(playerOutfitIndex + 1 + Math.floor(Math.random() * 4));
    matchState.phase = "searching";
    matchState.active = true;
    showMatchmaking();
  });

  function resetState() {
    matchState = { active: false, phase: "idle" };
    opponent = null;
    currentTurn = "player";
    holeIndex = 0;
    playerTotalScores = [];
    opponentTotalScores = [];
    playerHoleStrokes = 0;
    opponentHoleStrokes = 0;
    playerHoled = false;
    opponentHoled = false;
    botPlanningTimer = 0;
    botShotDelay = 0;
    botHasShotThisTurn = false;
    reactionCooldowns = {};
    playerEmojiCount = 0;
    playerEmojiTimer = 0;
  }

  function normalizeOutfitIndex(index) {
    const n = Number(index);
    if (!Number.isFinite(n)) return 0;
    return ((Math.round(n) % 5) + 5) % 5;
  }

  // Tick handler registered with game loop
  window.addEventListener("tee:frame-tick", (e) => {
    if (e.detail && e.detail.dt) {
      update(e.detail.dt);
    }
  });

  // Expose
  window.TeeBotMatch = {
    isActive,
    isPlaying,
    isLocalTurn,
    getOpponent,
    getCurrentTurn,
    getHoleIndex,
    getPlayerOutfitIndex: () => playerOutfitIndex,
    getOpponentOutfitIndex: () => opponentOutfitIndex,
    startMatch,
    endMatch,
    update,
    playerSendReaction,
    checkBotReaction
  };

  console.log("[TeeBotMatch] Initialized");
})();
