// ---------------------------------------------------------------------------
// Tee Game Multiplayer UI
// Handles all multiplayer UI: modals, HUD, overlays, scoreboards.
// ---------------------------------------------------------------------------

(() => {
  "use strict";

  const MP = window.TeeMultiplayer;
  const MATCH_LENGTH = 6;
  const COURSE_PAR = 3;

  // ---------- DOM Creation ----------

  function createElement(tag, attrs = {}, children = []) {
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

  // ---------- Main Intro Buttons ----------

  function addMultiplayerIntroButtons() {
    const playButton = document.getElementById("play-button");
    if (!playButton) return;
    const parent = playButton.parentNode;

    // --- Find Match section ---
    const findMatchSection = createElement("div", { className: "intro-section mp-intro-section" });

    const fmBtn = createElement("button", {
      className: "intro-button mp-intro-btn",
      textContent: "FIND MATCH →",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("tee:bot-match-find"));
      }
    });

    findMatchSection.appendChild(fmBtn);

    // --- Play a Friend section ---
    const modeSection = createElement("div", { className: "intro-section mp-intro-section", id: "mp-intro-buttons" });

    const playFriendBtn = createElement("button", {
      className: "intro-button mp-intro-btn",
      textContent: "PLAY A FRIEND →",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("tee:open-multiplayer-panel"));
      }
    });

    modeSection.appendChild(playFriendBtn);

    // Insert after the product section, before the play button
    const sections = parent.querySelectorAll(".intro-section");
    const lastSection = sections[sections.length - 1];
    if (lastSection) {
      lastSection.after(findMatchSection);
      findMatchSection.after(modeSection);
    } else {
      playButton.before(modeSection);
    }

    // Update play button text
    playButton.textContent = "PLAY SOLO →";
  }

  // ---------- Lobby / Room Panel ----------

  let lobbyPanel = null;

  function createLobbyPanel() {
    if (lobbyPanel) return lobbyPanel;

    const overlay = document.getElementById("mp-lobby-overlay");
    if (!overlay) return null;

    const panel = overlay.querySelector(".mp-panel");
    if (!panel) {
      const p = createElement("div", { className: "mp-panel" });
      overlay.appendChild(p);
      lobbyPanel = { overlay, panel: p };
    } else {
      lobbyPanel = { overlay, panel };
    }
    return lobbyPanel;
  }

  function showLobbyPanel() {
    const lp = createLobbyPanel();
    if (!lp) return;
    lp.overlay.classList.add("visible");
    renderLobbyContent();
  }

  function hideLobbyPanel() {
    if (lobbyPanel) {
      lobbyPanel.overlay.classList.remove("visible");
    }
  }

  function renderLobbyContent(view = "main") {
    const lp = lobbyPanel;
    if (!lp) return;
    lp.panel.innerHTML = "";

    if (view === "main") {
      lp.panel.appendChild(buildMainLobby());
    } else if (view === "create") {
      lp.panel.appendChild(buildCreateRoom());
    } else if (view === "join") {
      lp.panel.appendChild(buildJoinRoom());
    }
  }

  function buildMainLobby() {
    const div = createElement("div", {});

    div.appendChild(createElement("img", {
      src: "tee-game-logo.svg",
      className: "mp-logo",
      alt: "Tee Game"
    }));

    div.appendChild(createElement("h1", {
      className: "mp-heading",
      textContent: "Play a Friend"
    }));

    div.appendChild(createElement("p", {
      className: "mp-subtitle",
      innerHTML: "No accounts needed.<br>Create a room, send the code, tee off."
    }));

    const createBtn = createElement("button", {
      className: "intro-button mp-action-btn",
      textContent: "Create Room",
      onClick: () => renderLobbyContent("create")
    });

    const joinBtn = createElement("button", {
      className: "intro-button mp-action-btn mp-join-btn",
      textContent: "Join With Code",
      onClick: () => renderLobbyContent("join")
    });

    const backBtn = createElement("button", {
      className: "intro-button mp-back-btn",
      textContent: "Back",
      onClick: hideLobbyPanel
    });

    div.appendChild(createBtn);
    div.appendChild(joinBtn);
    div.appendChild(backBtn);

    return div;
  }

  function buildCreateRoom() {
    const div = createElement("div", {});

    div.appendChild(createElement("h2", {
      className: "mp-heading",
      textContent: "Create Room"
    }));

    const nameInput = createElement("input", {
      type: "text",
      className: "mp-input",
      placeholder: "Your name",
      maxLength: "16",
      id: "mp-create-name",
      value: "Host"
    });

    const statusEl = createElement("p", {
      className: "mp-status",
      id: "mp-create-status"
    });

    const createBtn = createElement("button", {
      className: "intro-button mp-action-btn",
      textContent: "Create Room",
      onClick: async () => {
        const name = document.getElementById("mp-create-name")?.value?.trim() || "Host";
        createBtn.disabled = true;
        createBtn.textContent = "Creating...";
        statusEl.textContent = "";

        try {
          const code = await MP.createRoom(name);
          if (code) {
            renderLobbyContentShowRoom(code);
          } else {
            createBtn.disabled = false;
            createBtn.textContent = "Create Room";
            statusEl.textContent = "Failed to create room. Check connection.";
          }
        } catch (err) {
          createBtn.disabled = false;
          createBtn.textContent = "Create Room";
          statusEl.textContent = "Error: " + err.message;
        }
      }
    });

    const backBtn = createElement("button", {
      className: "intro-button mp-back-btn",
      textContent: "Back",
      onClick: () => renderLobbyContent("main")
    });

    div.appendChild(nameInput);
    div.appendChild(createBtn);
    div.appendChild(statusEl);
    div.appendChild(backBtn);

    return div;
  }

  function buildJoinRoom() {
    const div = createElement("div", {});

    div.appendChild(createElement("h2", {
      className: "mp-heading",
      textContent: "Join Room"
    }));

    // Check URL param for room code
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");

    const codeInput = createElement("input", {
      type: "text",
      className: "mp-input mp-code-input",
      placeholder: "Enter room code (e.g. K9F2Q)",
      maxLength: "5",
      id: "mp-join-code",
      value: roomParam || ""
    });

    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });

    const nameInput = createElement("input", {
      type: "text",
      className: "mp-input",
      placeholder: "Your name",
      maxLength: "16",
      id: "mp-join-name",
      value: "Guest"
    });

    const statusEl = createElement("p", {
      className: "mp-status",
      id: "mp-join-status"
    });

    const joinBtn = createElement("button", {
      className: "intro-button mp-action-btn",
      textContent: "Join Room",
      onClick: async () => {
        const code = document.getElementById("mp-join-code")?.value?.trim()?.toUpperCase();
        const name = document.getElementById("mp-join-name")?.value?.trim() || "Guest";

        if (!code || code.length !== 5) {
          statusEl.textContent = "Please enter a valid 5-character room code.";
          return;
        }

        joinBtn.disabled = true;
        joinBtn.textContent = "Joining...";
        statusEl.textContent = "";

        try {
          const success = await MP.joinRoom(code, name);
          if (!success) {
            joinBtn.disabled = false;
            joinBtn.textContent = "Join Room";
          }
        } catch (err) {
          joinBtn.disabled = false;
          joinBtn.textContent = "Join Room";
          statusEl.textContent = "Error: " + err.message;
        }
      }
    });

    const backBtn = createElement("button", {
      className: "intro-button mp-back-btn",
      textContent: "Back",
      onClick: () => renderLobbyContent("main")
    });

    div.appendChild(codeInput);
    div.appendChild(nameInput);
    div.appendChild(joinBtn);
    div.appendChild(statusEl);
    div.appendChild(backBtn);

    return div;
  }

  function renderLobbyContentShowRoom(code) {
    const lp = lobbyPanel;
    if (!lp) return;
    lp.panel.innerHTML = "";

    const div = createElement("div", {});

    div.appendChild(createElement("h2", {
      className: "mp-heading",
      textContent: "Room Created!"
    }));

    const codeBlock = createElement("div", {
      className: "mp-code-block",
      textContent: code
    });

    div.appendChild(codeBlock);

    const link = window.location.origin + window.location.pathname + "?room=" + code;
    const linkEl = createElement("input", {
      type: "text",
      className: "mp-input",
      value: link,
      readOnly: "true",
      onClick: (e) => e.target.select()
    });

    const btnRow = createElement("div", { className: "mp-btn-row" });

    const copyCodeBtn = createElement("button", {
      className: "intro-button mp-small-btn",
      textContent: "Copy Code",
      onClick: () => copyText(code, copyCodeBtn)
    });

    const copyLinkBtn = createElement("button", {
      className: "intro-button mp-small-btn",
      textContent: "Copy Link",
      onClick: () => copyText(link, copyLinkBtn)
    });

    const shareBtn = createElement("button", {
      className: "intro-button mp-small-btn",
      textContent: "Share",
      onClick: () => shareRoom(code, link)
    });

    btnRow.appendChild(copyCodeBtn);
    btnRow.appendChild(copyLinkBtn);
    btnRow.appendChild(shareBtn);

    div.appendChild(linkEl);
    div.appendChild(btnRow);

    const waiting = createElement("p", {
      className: "mp-status mp-waiting",
      textContent: "Waiting for friend to join..."
    });
    div.appendChild(waiting);

    const backBtn = createElement("button", {
      className: "intro-button mp-back-btn",
      textContent: "Cancel Room",
      onClick: async () => {
        await MP.leaveRoom();
        hideLobbyPanel();
        renderLobbyContent("main");
      }
    });
    div.appendChild(backBtn);

    lp.panel.appendChild(div);
  }

  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = original; }, 1500);
      }).catch(() => {
        fallbackCopy(text, btn);
      });
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  }

  function shareRoom(code, link) {
    if (navigator.share) {
      navigator.share({
        title: "Tee Game - Play a Friend",
        text: "Join my Tee Game room! Code: " + code,
        url: link
      }).catch(() => {});
    } else {
      copyText(link, document.querySelector(".mp-small-btn"));
    }
  }

  // ---------- Coin Toss Overlay ----------

  let coinTossOverlay = null;

  function createCoinTossOverlay() {
    if (coinTossOverlay) return coinTossOverlay;
    const overlay = document.getElementById("mp-coin-toss-overlay");
    if (!overlay) return null;
    const panel = overlay.querySelector(".mp-panel");
    if (!panel) {
      const p = createElement("div", { className: "mp-panel" });
      overlay.appendChild(p);
      coinTossOverlay = { overlay, panel: p };
    } else {
      coinTossOverlay = { overlay, panel };
    }
    return coinTossOverlay;
  }

  function showCoinToss(state) {
    const ct = createCoinTossOverlay();
    if (!ct) return;

    const toss = state.coinToss;
    const players = state.players || {};
    const winner = toss?.winnerId ? players[toss.winnerId] : null;

    ct.panel.innerHTML = "";
    ct.panel.appendChild(createElement("h2", {
      className: "mp-heading",
      textContent: "Flipping Tee..."
    }));

    if (winner) {
      ct.panel.appendChild(createElement("div", {
        className: "mp-coin-result",
        innerHTML: "<strong>" + winner.name + "</strong> tees off first!"
      }));
    }

    ct.panel.appendChild(createElement("p", {
      className: "mp-status",
      textContent: "Starting match..."
    }));

    ct.overlay.classList.add("visible");

    // Auto-hide after delay
    setTimeout(() => {
      ct.overlay.classList.remove("visible");
    }, 2200);
  }

  // ---------- Match Result Overlay ----------

  let matchResultOverlay = null;

  function createMatchResultOverlay() {
    if (matchResultOverlay) return matchResultOverlay;
    const overlay = document.getElementById("mp-match-result-overlay");
    if (!overlay) return null;
    const panel = overlay.querySelector(".mp-panel");
    if (!panel) {
      const p = createElement("div", { className: "mp-panel mp-match-panel" });
      overlay.appendChild(p);
      matchResultOverlay = { overlay, panel: p };
    } else {
      matchResultOverlay = { overlay, panel };
    }
    return matchResultOverlay;
  }

  function showMatchResult(results) {
    const mr = createMatchResultOverlay();
    if (!mr) return;

    const entries = Object.entries(results).sort((a, b) => a[1].totalStrokes - b[1].totalStrokes);
    const winner = entries[0];
    const loser = entries[1];
    const isTie = winner[1].totalStrokes === loser[1].totalStrokes;

    mr.panel.innerHTML = "";

    mr.panel.appendChild(createElement("h2", {
      className: "mp-heading mp-match-heading",
      textContent: isTie ? "IT'S A TIE!" : winner[1].name + " WINS!"
    }));

    for (const [id, data] of entries) {
      const row = createElement("div", { className: "mp-match-player" });
      row.appendChild(createElement("span", {
        className: "mp-match-name",
        textContent: data.name
      }));
      row.appendChild(createElement("span", {
        className: "mp-match-strokes",
        textContent: data.totalStrokes + " strokes"
      }));
      mr.panel.appendChild(row);
    }

    const btnRow = createElement("div", { className: "mp-btn-row" });

    const rematchBtn = createElement("button", {
      className: "intro-button mp-small-btn",
      textContent: "Rematch",
      onClick: () => {
        mr.overlay.classList.remove("visible");
        // Go back to lobby for re-creation
        window.dispatchEvent(new CustomEvent("tee:open-multiplayer-panel"));
      }
    });

    const homeBtn = createElement("button", {
      className: "intro-button mp-back-btn",
      textContent: "Back to Menu",
      onClick: () => {
        mr.overlay.classList.remove("visible");
        MP.leaveRoom().then(() => {
          window.dispatchEvent(new CustomEvent("tee:multiplayer-exit"));
        });
      }
    });

    btnRow.appendChild(rematchBtn);
    mr.panel.appendChild(btnRow);
    mr.panel.appendChild(homeBtn);

    mr.overlay.classList.add("visible");
  }

  // ---------- Compact HUD + Reactions ----------

  let hudEl = null;
  let hudCardEl = null;
  let reactBtnEl = null;
  let reactTrayEl = null;

  const EMOJIS = [
    { emoji: "😀", name: "happy" },
    { emoji: "😍", name: "love" },
    { emoji: "😂", name: "laugh" },
    { emoji: "😮", name: "surprised" },
    { emoji: "😡", name: "rage" }
  ];

  function createHUD() {
    if (hudEl) return hudEl;
    const gameWrapper = document.querySelector(".game-wrapper");
    if (!gameWrapper) return null;

    hudEl = createElement("div", { className: "mp-hud", id: "mp-hud" });
    gameWrapper.appendChild(hudEl);
    return hudEl;
  }

  function ensureReactButton() {
    if (reactBtnEl && reactBtnEl.parentNode) return;
    if (!hudEl) return;

    reactBtnEl = createElement("button", {
      className: "mp-react-btn",
      innerHTML: "😊",
      onClick: (e) => {
        e.stopPropagation();
        toggleReactTray();
      }
    });
    hudEl.appendChild(reactBtnEl);
  }

  function ensureReactTray() {
    if (reactTrayEl && reactTrayEl.parentNode) return;
    if (!hudEl) return;

    reactTrayEl = createElement("div", { className: "mp-react-tray" });

    EMOJIS.forEach((item) => {
      const btn = createElement("button", {
        className: "mp-react-emoji",
        textContent: item.emoji,
        onClick: (e) => {
          e.stopPropagation();
          selectReaction(item.emoji);
        }
      });
      reactTrayEl.appendChild(btn);
    });

    hudEl.appendChild(reactTrayEl);
  }

  function toggleReactTray() {
    ensureReactTray();
    if (!reactTrayEl) return;
    const isOpen = reactTrayEl.classList.contains("open");
    if (isOpen) {
      closeReactTray();
    } else {
      positionReactTray();
      reactTrayEl.classList.add("open");
    }
  }

  function positionReactTray() {
    if (!reactTrayEl || !reactBtnEl || !hudEl) return;
    const btnRect = reactBtnEl.getBoundingClientRect();
    const hudRect = hudEl.getBoundingClientRect();
    reactTrayEl.style.top = (btnRect.top - hudRect.top - reactTrayEl.offsetHeight - 8) + "px";
    reactTrayEl.style.left = (btnRect.left - hudRect.left + btnRect.width / 2 - reactTrayEl.offsetWidth / 2) + "px";
  }

  function closeReactTray() {
    if (reactTrayEl) {
      reactTrayEl.classList.remove("open");
    }
  }

  function selectReaction(emoji) {
    closeReactTray();
    spawnFloatingEmoji(emoji);
    if (MP.isEnabled() && MP.submitEmojiReaction) {
      MP.submitEmojiReaction(emoji);
    }
  }

  function spawnFloatingEmoji(emoji) {
    const gameWrapper = document.querySelector(".game-wrapper");
    if (!gameWrapper || !reactBtnEl) return;

    const floatEl = document.createElement("div");
    floatEl.className = "mp-emoji-float";
    floatEl.textContent = emoji;

    const btnRect = reactBtnEl.getBoundingClientRect();
    const wrapperRect = gameWrapper.getBoundingClientRect();
    floatEl.style.left = (btnRect.left - wrapperRect.left + btnRect.width / 2 - 14) + "px";
    floatEl.style.top = (btnRect.top - wrapperRect.top) + "px";

    gameWrapper.appendChild(floatEl);

    floatEl.addEventListener("animationend", () => {
      if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
    });
  }

  function receiveRemoteReaction(emoji) {
    spawnFloatingEmoji(emoji);
  }

  function updateHUD() {
    if (!MP.isEnabled()) {
      if (hudEl) hudEl.style.display = "none";
      return;
    }

    const hud = createHUD();
    if (!hud) return;
    hud.style.display = "";

    const state = MP.getRoomState();
    if (!state) return;

    const localPlayer = MP.getLocalPlayerState();
    const opponent = MP.getOpponentPlayerState();
    const hi = MP.getHoleIndex();
    const isMyTurn = MP.isLocalTurn();
    const par = state.par || COURSE_PAR;

    // Remove old card content only, preserve react button and tray
    if (hudCardEl && hudCardEl.parentNode) {
      hudCardEl.parentNode.removeChild(hudCardEl);
    }

    // Build the frosted glass card
    hudCardEl = createElement("div", { className: "mp-hud-card" });

    // --- Guest score block ---
    const isGuest = MP.getLocalRole() === "guest";
    const guestPlayer = isGuest ? localPlayer : opponent;
    const guestScore = createElement("div", {
      className: "mp-player-score" + ((isGuest && isMyTurn) || (!isGuest && !isMyTurn) ? " mp-active" : "")
    });
    guestScore.appendChild(createElement("span", {
      className: "mp-score-name",
      textContent: guestPlayer?.name || "Guest"
    }));
    guestScore.appendChild(createElement("span", {
      className: "mp-score-strokes",
      textContent: String(guestPlayer?.currentHoleStrokes ?? 0)
    }));
    hudCardEl.appendChild(guestScore);

    // --- VS divider ---
    hudCardEl.appendChild(createElement("span", {
      className: "mp-vs",
      textContent: "vs"
    }));

    // --- Host score block ---
    const hostPlayer = isGuest ? opponent : localPlayer;
    const hostScore = createElement("div", {
      className: "mp-player-score" + ((!isGuest && isMyTurn) || (isGuest && !isMyTurn) ? " mp-active" : "")
    });
    hostScore.appendChild(createElement("span", {
      className: "mp-score-name",
      textContent: hostPlayer?.name || "Host"
    }));
    hostScore.appendChild(createElement("span", {
      className: "mp-score-strokes",
      textContent: String(hostPlayer?.currentHoleStrokes ?? 0)
    }));
    hudCardEl.appendChild(hostScore);

    // --- Divider ---
    hudCardEl.appendChild(createElement("div", { className: "mp-hud-divider" }));

    // --- Hole info block ---
    const holeInfo = createElement("div", { className: "mp-hole-info" });
    holeInfo.appendChild(createElement("span", {
      className: "mp-hole-number",
      textContent: "Hole " + (hi + 1) + "/" + MATCH_LENGTH
    }));
    holeInfo.appendChild(createElement("span", {
      className: "mp-hole-par",
      textContent: "Par " + par
    }));
    hudCardEl.appendChild(holeInfo);

    // --- Turn pill ---
    const turnPill = createElement("div", { className: "mp-turn-pill" });
    if (isMyTurn) {
      turnPill.classList.add("mp-my-turn");
      turnPill.textContent = localPlayer?.name ? localPlayer.name.split(" ")[0] + " Turn" : "Your Turn";
    } else {
      turnPill.classList.add("mp-opp-turn");
      turnPill.textContent = (opponent?.name ? opponent.name.split(" ")[0] + " Turn" : "Host Turn");
    }
    hudCardEl.appendChild(turnPill);

    // Insert card before react button if it exists, otherwise append
    if (reactBtnEl && reactBtnEl.parentNode === hud) {
      hud.insertBefore(hudCardEl, reactBtnEl);
    } else {
      hud.appendChild(hudCardEl);
    }

    // Ensure react button and tray exist
    ensureReactButton();
    ensureReactTray();
    positionReactTray();
  }

  // ---------- Error Toast ----------

  let errorToast = null;

  function showError(message) {
    if (!errorToast) {
      errorToast = createElement("div", { className: "mp-error-toast", id: "mp-error-toast" });
      document.querySelector(".game-wrapper")?.appendChild(errorToast);
    }
    errorToast.textContent = message;
    errorToast.classList.add("visible");
    clearTimeout(errorToast._timeout);
    errorToast._timeout = setTimeout(() => {
      errorToast.classList.remove("visible");
    }, 3000);
  }

  // --- Close tray on outside click ---
  document.addEventListener("click", (e) => {
    if (!reactTrayEl || !reactTrayEl.classList.contains("open")) return;
    if (reactBtnEl && reactBtnEl.contains(e.target)) return;
    if (reactTrayEl.contains(e.target)) return;
    closeReactTray();
  });

  // --- Status message for lobby ---
  function setLobbyStatus(msg) {
    const els = document.querySelectorAll(".mp-status");
    els.forEach(el => { el.textContent = msg; });
  }

  // ---------- Listen for multiplayer events ----------

  window.addEventListener("tee:multiplayer-state", (event) => {
    const detail = event.detail;
    updateHUD();

    if (detail.status === "playing") {
      hideLobbyPanel();
      hideIntroModal();
    }

    if (detail.status === "coin_toss") {
      hideLobbyPanel();
      // Host triggers the coin toss
      if (MP.getMode() === "host") {
        setTimeout(() => MP.startCoinTossIfHost(), 600);
      }
      showCoinToss(detail.state);
    }

    if (detail.status === "finished") {
      hideLobbyPanel();
      const results = MP.getMatchResults();
      if (results) {
        showMatchResult(results);
      }
    }

    // Lobby status messages
    if (MP.getMode() === "host" && MP.getRoomState()) {
      const roomState = MP.getRoomState();
      const players = roomState.players || {};
      const hasGuest = Object.keys(players).length >= 2;

      if (hasGuest && roomState.status === "lobby") {
        // Both players joined, show ready message
        setLobbyStatus("Friend joined! Starting match...");
        // Auto-start coin toss
        setTimeout(() => {
          if (MP.getMode() === "host" && MP.getRoomState()?.status === "lobby") {
            MP.startCoinTossIfHost();
          }
        }, 1000);
      } else if (hasGuest && roomState.status === "coin_toss") {
        setLobbyStatus("Flipping tee...");
      }
    }

    if (MP.getMode() === "guest") {
      // Update lobby for guest side
      if (lobbyPanel?.overlay.classList.contains("visible")) {
        if (detail.status === "coin_toss") {
          hideLobbyPanel();
          showCoinToss(detail.state);
        }
      }
    }
  });

  window.addEventListener("tee:multiplayer-live-aim", (event) => {
    // Forward aim data - game.js handles rendering
    window.dispatchEvent(new CustomEvent("tee:opponent-aim-update", { detail: event.detail }));
  });

  window.addEventListener("tee:multiplayer-remote-shot-start", (event) => {
    window.dispatchEvent(new CustomEvent("tee:opponent-shot-start", { detail: event.detail }));
  });

  window.addEventListener("tee:multiplayer-remote-shot-settled", (event) => {
    window.dispatchEvent(new CustomEvent("tee:opponent-shot-settled", { detail: event.detail }));
  });

  window.addEventListener("tee:multiplayer-emoji-reaction", (event) => {
    if (event.detail && event.detail.emoji) {
      receiveRemoteReaction(event.detail.emoji);
    }
  });

  window.addEventListener("tee:multiplayer-error", (event) => {
    showError(event.detail.message || "Multiplayer error");
  });

  window.addEventListener("tee:open-multiplayer-panel", () => {
    showLobbyPanel();
  });

  window.addEventListener("tee:multiplayer-exit", () => {
    hideLobbyPanel();
    if (matchResultOverlay) matchResultOverlay.overlay.classList.remove("visible");
    if (coinTossOverlay) coinTossOverlay.overlay.classList.remove("visible");
    if (hudEl) hudEl.style.display = "none";
    closeReactTray();
    updateHUD();
  });

  // ---------- Auto-join from URL param ----------

  function checkUrlForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room");
    if (roomParam && roomParam.trim().length === 5) {
      // Delay until after intro is shown
      setTimeout(() => {
        showLobbyPanel();
        renderLobbyContent("join");
      }, 800);
    }
  }

  function hideIntroModal() {
    const introModal = document.getElementById("intro-modal");
    if (introModal) introModal.classList.remove("visible");
  }

  // ---------- Init ----------

  function initUI() {
    addMultiplayerIntroButtons();
    checkUrlForRoom();

    // Listen for game events to sync state
    window.addEventListener("tee:shot-settled", (event) => {
      if (MP.isEnabled() && MP.isLocalTurn()) {
        MP.submitShotSettled(event.detail);
      }
    });

    window.addEventListener("tee:shot-started", (event) => {
      if (MP.isEnabled() && MP.isLocalTurn()) {
        MP.submitShotStart(event.detail);
      }
    });

    window.addEventListener("tee:live-aim", (event) => {
      if (MP.isEnabled() && MP.isLocalTurn()) {
        MP.submitLiveAim(event.detail);
      }
    });

    window.addEventListener("tee:hole-complete", () => {
      if (MP.isEnabled()) {
        MP.advanceToNextHole();
      }
    });

    return true;
  }

  // Run on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }

  // Expose for external use
  window.TeeMultiplayerUI = {
    showLobbyPanel,
    hideLobbyPanel,
    updateHUD,
    showCoinToss,
    showMatchResult,
    showError
  };

})();
