// ---------------------------------------------------------------------------
// Tee Game Multiplayer Module
// Casual friend mode – not cheat-proof. Uses anonymous Supabase auth,
// Realtime postgres_changes for room state, and broadcast channels for live aim.
// ---------------------------------------------------------------------------

(() => {
  "use strict";

  const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const ROOM_CODE_LENGTH = 5;
  const MAX_CODE_ATTEMPTS = 8;
  const LIVE_AIM_INTERVAL = 66; // ~15 updates/sec throttle
  const MATCH_LENGTH = 6;
  const COURSE_PAR = 3;

  let supabase = null;
  let channel = null;
  let roomChannel = null;
  let userId = null;
  let playerName = "You";
  let mode = "solo"; // solo | host | guest
  let roomCode = null;
  let roomState = null;
  let activePlayerId = null;
  let holeIndex = 0;
  let turnNumber = 0;
  let localRole = null; // host | guest
  let lastAimTime = 0;
  let lastSubmittedPaload = null;
  let shotSubmitted = false;

  function init() {
    const config = window.TEE_SUPABASE_CONFIG;
    if (!config || !config.url || !config.publishableKey) {
      console.warn("[TeeGame MP] Supabase config not found or incomplete. Multiplayer disabled.");
      return;
    }

    if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
      console.warn("[TeeGame MP] Supabase JS library not loaded. Multiplayer disabled.");
      return;
    }

    try {
      supabase = window.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        }
      });
    } catch (err) {
      console.warn("[TeeGame MP] Failed to create Supabase client:", err.message);
      return;
    }
  }

  function isEnabled() {
    return supabase !== null && mode !== "solo";
  }

  function getMode() { return mode; }
  function getRoomCode() { return roomCode; }
  function getUserId() { return userId; }
  function getPlayerName() { return playerName; }
  function getLocalRole() { return localRole; }
  function getActivePlayerId() { return activePlayerId; }
  function getRoomState() { return roomState; }

  function isLocalTurn() {
    if (!isEnabled() || !activePlayerId || !userId) return false;
    return activePlayerId === userId;
  }

  function getLocalPlayerState() {
    if (!roomState || !userId) return null;
    return roomState.players?.[userId] || null;
  }

  function getOpponentPlayerState() {
    if (!roomState || !userId) return null;
    const players = roomState.players || {};
    for (const id of Object.keys(players)) {
      if (id !== userId) return players[id];
    }
    return null;
  }

  function getActivePlayerState() {
    if (!roomState || !activePlayerId) return null;
    return roomState.players?.[activePlayerId] || null;
  }

  function emitEvent(name, detail) {
    window.dispatchEvent(new CustomEvent("tee:" + name, { detail }));
  }

  async function ensureAuth() {
    if (!supabase) return false;
    if (userId) return true;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        userId = sessionData.session.user.id;
        return true;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("[TeeGame MP] Anonymous sign-in failed:", error.message);
        emitEvent("multiplayer-error", { code: "AUTH_FAILED", message: "Could not sign in anonymously." });
        return false;
      }
      if (data?.user) {
        userId = data.user.id;
        return true;
      }
      return false;
    } catch (err) {
      console.error("[TeeGame MP] Auth error:", err.message);
      emitEvent("multiplayer-error", { code: "AUTH_ERROR", message: "Sign-in error: " + err.message });
      return false;
    }
  }

  function generateRoomCode() {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    }
    return code;
  }

  function makeInitialState(hostId, hostName) {
    return {
      matchLength: MATCH_LENGTH,
      holes: [0, 1, 2, 3, 4, 5],
      par: COURSE_PAR,
      coinToss: { winnerId: null, seed: null, completedAt: null },
      players: {
        [hostId]: makePlayerState(hostId, hostName, "host")
      },
      holeResults: {}
    };
  }

  function makePlayerState(id, name, role) {
    return {
      id,
      name,
      role,
      connected: true,
      ready: true,
      totalStrokes: 0,
      currentHoleStrokes: 0,
      holed: false,
      ball: {
        x: 0, y: 0, vx: 0, vy: 0, omega: 0,
        angle: 0, grounded: true, asleep: true, slipping: false
      },
      holeResults: {}
    };
  }

  async function createRoom(name) {
    if (!await ensureAuth()) return null;

    playerName = name || "Host";
    mode = "host";
    localRole = "host";

    let code = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = generateRoomCode();
      const { data: existing } = await supabase
        .from("tee_rooms")
        .select("room_code")
        .eq("room_code", candidate)
        .maybeSingle();

      if (!existing) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      emitEvent("multiplayer-error", { code: "CODE_GEN_FAILED", message: "Could not generate a room code." });
      return null;
    }

    const initialState = makeInitialState(userId, playerName);

    const { data, error } = await supabase
      .from("tee_rooms")
      .insert({
        room_code: code,
        status: "lobby",
        host_id: userId,
        host_name: playerName,
        state: initialState,
        hole_index: 0,
        turn_number: 0
      })
      .select()
      .single();

    if (error) {
      console.error("[TeeGame MP] Create room failed:", error.message);
      emitEvent("multiplayer-error", { code: "CREATE_FAILED", message: "Could not create room: " + error.message });
      return null;
    }

    roomCode = code;
    roomState = initialState;
    activePlayerId = null;
    shotSubmitted = false;

    subscribeToRoom(code);
    emitEvent("multiplayer-state", {
      mode,
      roomCode: code,
      state: roomState,
      status: "lobby"
    });

    return code;
  }

  async function joinRoom(code, name) {
    if (!await ensureAuth()) return false;

    playerName = name || "Guest";
    mode = "guest";
    localRole = "guest";

    const { data: room, error } = await supabase
      .from("tee_rooms")
      .select("*")
      .eq("room_code", code.toUpperCase().trim())
      .maybeSingle();

    if (error || !room) {
      emitEvent("multiplayer-error", { code: "ROOM_NOT_FOUND", message: "Room not found. Check the code and try again." });
      return false;
    }

    if (room.expires_at && new Date(room.expires_at) < new Date()) {
      emitEvent("multiplayer-error", { code: "ROOM_EXPIRED", message: "This room has expired." });
      return false;
    }

    if (room.status !== "lobby") {
      emitEvent("multiplayer-error", { code: "ROOM_FULL", message: "This match is already in progress." });
      return false;
    }

    if (room.guest_id && room.guest_id !== userId) {
      emitEvent("multiplayer-error", { code: "ROOM_FULL", message: "This room is already full (2 players max)." });
      return false;
    }

    const state = room.state || {};

    // Add guest player to state
    state.players = state.players || {};
    state.players[userId] = makePlayerState(userId, playerName, "guest");

    const { error: updateError } = await supabase
      .from("tee_rooms")
      .update({
        guest_id: userId,
        guest_name: playerName,
        status: "coin_toss",
        state
      })
      .eq("room_code", room.room_code);

    if (updateError) {
      console.error("[TeeGame MP] Join room update failed:", updateError.message);
      emitEvent("multiplayer-error", { code: "JOIN_FAILED", message: "Could not join room." });
      return false;
    }

    roomCode = room.room_code;
    roomState = state;
    activePlayerId = null;
    shotSubmitted = false;

    subscribeToRoom(roomCode);
    emitEvent("multiplayer-state", {
      mode,
      roomCode,
      state: roomState,
      status: "coin_toss"
    });

    return true;
  }

  async function startCoinTossIfHost() {
    if (mode !== "host" || !roomCode) return;

    const seed = Math.random();
    const tossWinnerId = seed < 0.5 ? userId : (roomState.players ? Object.keys(roomState.players).find(id => id !== userId) : null);

    if (!tossWinnerId) {
      emitEvent("multiplayer-error", { code: "TOSS_ERROR", message: "Coin toss failed: guest not found." });
      return;
    }

    const updatedState = { ...roomState };
    updatedState.coinToss = {
      winnerId: tossWinnerId,
      seed,
      completedAt: Date.now()
    };

    const { error } = await supabase
      .from("tee_rooms")
      .update({
        status: "playing",
        state: updatedState,
        active_player_id: tossWinnerId,
        turn_number: 1,
        hole_index: 0
      })
      .eq("room_code", roomCode);

    if (error) {
      console.error("[TeeGame MP] Coin toss update failed:", error.message);
    }
  }

  function subscribeToRoom(code) {
    cleanupSubscriptions();

    roomChannel = supabase
      .channel("room-" + code)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tee_rooms",
          filter: "room_code=eq." + code
        },
        (payload) => {
          handleRoomUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribeToLiveAim(code);
        }
      });
  }

  function subscribeToLiveAim(code) {
    channel = supabase.channel("aim-" + code, {
      config: { broadcast: { self: false } }
    });

    channel.on("broadcast", { event: "live_aim" }, (payload) => {
      if (payload.payload) {
        emitEvent("multiplayer-live-aim", payload.payload);
      }
    });

    channel.on("broadcast", { event: "shot_started" }, (payload) => {
      if (payload.payload) {
        emitEvent("multiplayer-remote-shot-start", payload.payload);
      }
    });

    channel.subscribe();
  }

  function handleRoomUpdate(newData) {
    if (!newData) return;

    roomState = newData.state || {};
    activePlayerId = newData.active_player_id || null;
    holeIndex = newData.hole_index ?? holeIndex;
    turnNumber = newData.turn_number ?? turnNumber;
    const newStatus = newData.status;

    emitEvent("multiplayer-state", {
      mode,
      roomCode: newData.room_code,
      state: roomState,
      status: newStatus,
      activePlayerId,
      holeIndex,
      turnNumber
    });

    if (newData.latest_shot && !shotSubmitted) {
      emitEvent("multiplayer-remote-shot-settled", newData.latest_shot);
    }

    // Host checks if both players holed — advance hole
    if (mode === "host" && roomState) {
      const players = roomState.players || {};
      const ids = Object.keys(players);
      if (ids.length === 2 && ids.every(id => players[id]?.holed)) {
        setTimeout(() => advanceToNextHole(), 1200);
      }
    }
  }

  function cleanupSubscriptions() {
    if (roomChannel) {
      supabase.removeChannel(roomChannel).catch(() => {});
      roomChannel = null;
    }
    if (channel) {
      supabase.removeChannel(channel).catch(() => {});
      channel = null;
    }
  }

  async function leaveRoom() {
    if (!supabase || !roomCode) return;

    cleanupSubscriptions();

    // If host leaves, mark room as expired
    if (mode === "host") {
      await supabase
        .from("tee_rooms")
        .update({ status: "expired", expires_at: new Date().toISOString() })
        .eq("room_code", roomCode);
    } else if (mode === "guest") {
      // Remove guest from state
      const state = { ...roomState };
      if (state.players && userId) {
        delete state.players[userId];
      }
      await supabase
        .from("tee_rooms")
        .update({ guest_id: null, guest_name: null, status: "lobby", state })
        .eq("room_code", roomCode);
    }

    mode = "solo";
    localRole = null;
    roomCode = null;
    roomState = null;
    activePlayerId = null;
    shotSubmitted = false;
    userId = null;

    emitEvent("multiplayer-state", { mode: "solo", status: null });
  }

  async function submitLiveAim(aimData) {
    if (!isEnabled() || !isLocalTurn() || !channel || !roomCode) return;

    const now = Date.now();
    if (now - lastAimTime < LIVE_AIM_INTERVAL) return;
    lastAimTime = now;

    await channel.send({
      type: "broadcast",
      event: "live_aim",
      payload: aimData
    });
  }

  function clearLiveAim() {
    lastAimTime = 0;
  }

  async function submitShotStart(shotData) {
    if (!isEnabled() || !isLocalTurn() || !channel || !roomCode) return;

    shotSubmitted = false;

    await channel.send({
      type: "broadcast",
      event: "shot_started",
      payload: shotData
    });
  }

  async function submitShotSettled(result) {
    if (!isEnabled() || !isLocalTurn() || !supabase || !roomCode) return;
    if (shotSubmitted) return;
    shotSubmitted = true;

    const playerState = getLocalPlayerState();
    if (!playerState) return;

    const updatedState = { ...roomState };
    updatedState.players = { ...updatedState.players };
    updatedState.players[userId] = {
      ...playerState,
      currentHoleStrokes: result.strokes,
      holed: result.holed,
      ball: result.ball,
      totalStrokes: playerState.totalStrokes
    };

    if (result.holed) {
      playerState.totalStrokes = (playerState.totalStrokes || 0) + result.strokes;
      const hi = holeIndex;
      updatedState.holeResults = updatedState.holeResults || {};
      updatedState.holeResults[hi] = updatedState.holeResults[hi] || {};
      updatedState.holeResults[hi][userId] = {
        strokes: result.strokes,
        score: result.strokes - COURSE_PAR,
        time: result.holeTimer || 0,
        farthestHit: result.farthestHit || 0,
        completedAt: Date.now()
      };
    }

    const { nextActive, turnNumber, advanceHole } = resolveNextTurn(updatedState);

    const updateData = {
      state: updatedState,
      active_player_id: nextActive,
      turn_number: turnNumber,
      latest_shot: result
    };

    const { error } = await supabase
      .from("tee_rooms")
      .update(updateData)
      .eq("room_code", roomCode);

    if (error) {
      console.error("[TeeGame MP] Shot settled update failed:", error.message);
      shotSubmitted = false;
    }

    // If both holed and this is the host, advance to next hole after a short delay
    if (advanceHole && mode === "host") {
      setTimeout(() => advanceToNextHole(), 1200);
    }
  }

  function resolveNextTurn(state) {
    const players = state.players || {};
    const playerIds = Object.keys(players);
    if (playerIds.length < 2) return { nextActive: activePlayerId, turnNumber: (roomState?.turnNumber || 0) + 1, advanceHole: false };

    const a = players[playerIds[0]];
    const b = players[playerIds[1]];

    if (a.holed && b.holed) {
      return { nextActive: null, turnNumber: (roomState?.turnNumber || 0) + 1, advanceHole: true };
    }

    let nextActive;
    const otherId = activePlayerId === playerIds[0] ? playerIds[1] : playerIds[0];
    const otherPlayer = players[otherId];

    if (!otherPlayer.holed) {
      nextActive = otherId;
    } else {
      nextActive = activePlayerId;
    }

    return {
      nextActive,
      turnNumber: (roomState?.turnNumber || 0) + 1,
      advanceHole: false
    };
  }

  async function advanceToNextHole() {
    if (!isEnabled() || !supabase || !roomCode) return;

    const nextHoleIdx = holeIndex + 1;
    const isMatchOver = nextHoleIdx >= MATCH_LENGTH;

    // Reset player hole states
    const updatedState = { ...roomState };
    updatedState.players = { ...updatedState.players };
    for (const id of Object.keys(updatedState.players)) {
      updatedState.players[id] = {
        ...updatedState.players[id],
        currentHoleStrokes: 0,
        holed: false,
        ball: {
          x: 0, y: 0, vx: 0, vy: 0, omega: 0,
          angle: 0, grounded: true, asleep: true, slipping: false
        }
      };
    }

    // Resolve who goes first on next hole
    const tossWinner = updatedState.coinToss?.winnerId;
    const firstForHole = nextHoleIdx % 2 === 0 ? tossWinner : (Object.keys(updatedState.players).find(id => id !== tossWinner));

    const { error } = await supabase
      .from("tee_rooms")
      .update({
        status: isMatchOver ? "finished" : "playing",
        hole_index: nextHoleIdx,
        state: updatedState,
        active_player_id: firstForHole,
        turn_number: turnNumber + 1,
        latest_shot: null
      })
      .eq("room_code", roomCode);

    if (error) {
      console.error("[TeeGame MP] Advance hole failed:", error.message);
    }
  }

  async function startMatchFromRoom() {
    if (mode !== "host" || !roomCode) return;

    const updatedState = { ...roomState };
    // Ball positions will be set by game.js when loading the hole
    const { error } = await supabase
      .from("tee_rooms")
      .update({
        status: "playing",
        state: updatedState,
        active_player_id: updatedState.coinToss?.winnerId || userId,
        turn_number: 1,
        hole_index: 0
      })
      .eq("room_code", roomCode);

    if (error) {
      console.error("[TeeGame MP] Start match failed:", error.message);
    }
  }

  // Get ball state for the currently active player to load into world.ball
  function getBallForPlayer(playerId) {
    const ps = roomState?.players?.[playerId];
    if (!ps || !ps.ball) return null;
    return { ...ps.ball };
  }

  function isHoleComplete() {
    if (!roomState) return false;
    const players = roomState.players || {};
    const ids = Object.keys(players);
    if (ids.length < 2) return false;
    return ids.every(id => players[id]?.holed);
  }

  function isMatchFinished() {
    return roomState && (roomState.status === "finished" || holeIndex >= MATCH_LENGTH);
  }

  function getMatchResults() {
    if (!roomState) return null;
    const players = roomState.players || {};
    const results = {};
    for (const id of Object.keys(players)) {
      const p = players[id];
      const holeResults = roomState.holeResults || {};
      let total = 0;
      for (const holeKey of Object.keys(holeResults)) {
        total += (holeResults[holeKey][id]?.strokes || 0);
      }
      results[id] = { name: p.name, totalStrokes: total, role: p.role };
    }
    return results;
  }

  function destroy() {
    cleanupSubscriptions();
    mode = "solo";
    roomCode = null;
    roomState = null;
    activePlayerId = null;
    shotSubmitted = false;
  }

  // Expose as window.TeeMultiplayer
  window.TeeMultiplayer = {
    init,
    isEnabled,
    getMode,
    getRoomCode,
    getUserId,
    getPlayerName,
    getLocalRole,
    getActivePlayerId,
    getRoomState,
    getHoleIndex: () => holeIndex,
    getTurnNumber: () => turnNumber,
    isLocalTurn,
    getLocalPlayerState,
    getOpponentPlayerState,
    getActivePlayerState,
    createRoom,
    joinRoom,
    leaveRoom,
    startCoinTossIfHost,
    startMatchFromRoom,
    submitLiveAim,
    clearLiveAim,
    submitShotStart,
    submitShotSettled,
    advanceToNextHole,
    getBallForPlayer,
    isHoleComplete,
    isMatchFinished,
    getMatchResults,
    ensureAuth,
    emitEvent,
    destroy
  };

  // Auto-init when script loads
  init();
})();
