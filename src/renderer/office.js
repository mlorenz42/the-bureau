/* global window, document, requestAnimationFrame */
(function () {
  const { TILE, planForAspect, buildWorld, walkable, crossesPartition, findPath } = window.World;
  const SEATING_KEY = 'the-bureau.seating';
  const Sprites = window.Sprites;

  const AGENT_SPEED = 3.6;
  const PLAYER_SPEED = 5;
  const NEAR_RADIUS = 2.05;
  const NEAR_DELAY_MS = 300;
  const BUBBLE_MS = 6000;
  const BREAK_MS = 90 * 1000; // a coffee break in the lounge after finishing a task
  const IDLE_LOUNGE_MS = 3 * 60 * 1000; // idle this long: wait in the lounge instead of at the desk
  const MIN_SCALE = 0.4;

  const canvas = document.getElementById('office');
  canvas.title = window.I18n.t('officeHint');
  document.documentElement.lang = window.I18n.lang;
  const ctx = canvas.getContext('2d');
  const errorBox = document.getElementById('error');

  let world = buildWorld();
  let snapshot = { agents: [], subagents: [] };
  let firstSnapshot = true;
  const characters = new Map();
  const meetingSeats = new Map();
  const loungeSeatByKey = new Map();
  let visitorKey = null; // the waiting agent standing in my office
  const groupRooms = new Map();
  const bubbles = new Map();
  const keys = new Set();
  let scale = 1;
  let camera = { x: 0, y: 0 };
  let nearCandidate = null;
  let pinnedKey = null;
  const beams = [];
  const BEAM_MS = 1500;
  let ufo = null;
  let nextUfoAt = performance.now() + 20000;

  const SUIT = { shirt: '#2a2f3b', pants: '#1c1f27' };
  const FAIR = '#f5d0b5';
  const COSTUMES = {
    'Agent Mulder': { ...SUIT, hair: '#3a2a1d', hairStyle: 0, skin: '#f2c9a0', tie: '#7f1d1d' },
    'Agent Scully': { ...SUIT, hair: '#b4472a', hairStyle: 2, skin: FAIR, tie: null },
    'Agent Skinner': { ...SUIT, hairStyle: 3, skin: '#e8b896', glasses: '#9ca3af', tie: '#1e3a5f' },
    'Agent Doggett': { ...SUIT, hair: '#9a8466', hairStyle: 0, skin: '#e8b896', tie: '#3f3f46' },
    'Agent Reyes': { shirt: '#5b3a2e', pants: '#1c1f27', hair: '#2b1d14', hairStyle: 2, skin: '#f2c9a0', tie: null },
    'Agent Krycek': { shirt: '#15151a', pants: '#24242c', hair: '#1a1a1a', hairStyle: 0, skin: '#f2c9a0', tie: null },
    'Agent Spender': { ...SUIT, hair: '#6b4a2e', hairStyle: 1, skin: FAIR, tie: '#4b5563' },
    'Agent Fowley': { shirt: '#3b3b4f', pants: '#1c1f27', hair: '#1f1612', hairStyle: 2, skin: FAIR, tie: null },
    'Agent Kersh': { ...SUIT, hair: '#1a1a1a', hairStyle: 0, skin: '#6b4128', tie: '#7c2d12' },
    'Agent Pendrell': { shirt: '#e5e7eb', pants: '#3b3b4f', hair: '#8a4b2a', hairStyle: 1, skin: FAIR, tie: null },
    'Agent Einstein': { ...SUIT, hair: '#c2552f', hairStyle: 2, skin: FAIR, tie: null },
    'Agent Miller': { ...SUIT, hair: '#3a2a1d', hairStyle: 1, skin: '#f2c9a0', tie: '#1e3a5f' },
    'Agent Harrison': { shirt: '#4f7cac', pants: '#1c1f27', hair: '#c9763c', hairStyle: 2, skin: FAIR, tie: null },
    'Agent Follmer': { ...SUIT, hair: '#2b1d14', hairStyle: 1, skin: '#e8b896', tie: '#334155' },
    'Agent Blevins': { ...SUIT, hair: '#b8b8b8', hairStyle: 1, skin: '#f2c9a0', tie: '#4b5563' },
    'Agent Colton': { ...SUIT, hair: '#5a3825', hairStyle: 0, skin: FAIR, tie: '#1e3a5f' },
    'Agent Willis': { ...SUIT, hair: '#4a3020', hairStyle: 0, skin: '#e8b896', tie: '#7f1d1d' },
    'Agent Purdue': { ...SUIT, hair: '#8c8c8c', hairStyle: 0, skin: '#e8b896', tie: '#365314' },
    'Agent Patterson': { ...SUIT, hair: '#a3a3a3', hairStyle: 1, skin: FAIR, glasses: '#3f3f46', tie: '#3f3f46' },
    'Agent Byers': { ...SUIT, hair: '#4a3020', hairStyle: 1, skin: FAIR, beard: '#4a3020', tie: '#7f1d1d' },
    'Agent Frohike': { shirt: '#1f1f24', pants: '#2d2d33', hair: '#6b6b6b', hairStyle: 0, skin: '#e8b896', glasses: '#111827', tie: null },
    'Agent Langly': { shirt: '#1f2937', pants: '#28394a', hair: '#e3d3a8', hairStyle: 2, skin: FAIR, glasses: '#111827', tie: null },
    'Agent Covarrubias': { shirt: '#e8dcc8', pants: '#3b3b4f', hair: '#d9b36c', hairStyle: 2, skin: FAIR, tie: null },
    'Agent Kurtzweil': { shirt: '#6b5b4b', pants: '#3b3b4f', hair: '#c0c0c0', hairStyle: 1, skin: FAIR, glasses: '#3f3f46', tie: null },
    'Agent Kritschgau': { ...SUIT, hair: '#9a9a9a', hairStyle: 1, skin: '#f2c9a0', tie: '#3f3f46' },
  };

  function dressUp(character) {
    character.looks = { ...character.baseLooks, ...(COSTUMES[character.name] || {}) };
  }

  const player = {
    key: 'player',
    name: window.I18n.t('me'),
    task: '',
    isPlayer: true,
    x: world.bossChair.x,
    y: world.bossChair.y,
    face: 'down',
    moving: false,
    path: [],
    target: world.bossChair,
    phaseOffset: 0,
    looks: { skin: '#9fd4a3', shirt: '#d97757', pants: '#2d3748', hairStyle: 3, alien: true },
  };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(() =>
    requestAnimationFrame(() => {
      resize();
      arrangeBySpace();
      markDirty();
    }),
  ).observe(canvas);
  resize();

  function agentByKey(key) {
    return snapshot.agents.find((agent) => agent.key === key);
  }

  const seating = loadSeating();

  function loadSeating() {
    try {
      return JSON.parse(window.localStorage.getItem(SEATING_KEY)) || {};
    } catch {
      return {};
    }
  }

  function arrangeBySpace() {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width && rect.height ? rect.width / rect.height : 1.6;
    const plan = planForAspect(snapshot.agents, seating, aspect);
    try {
      window.localStorage.setItem(SEATING_KEY, JSON.stringify(seating));
    } catch {
      // seating then only lasts until the app quits
    }
    if (plan.signature === world.signature) return;
    const previous = world;
    world = buildWorld(plan);
    const atBossChair = Math.hypot(player.x - previous.bossChair.x, player.y - previous.bossChair.y) < 0.05;
    if (player.target === previous.bossChair || atBossChair) {
      if (atBossChair) {
        player.x = world.bossChair.x;
        player.y = world.bossChair.y;
        player.path = [];
      } else {
        player.path = findPath(world, player, world.bossChair).slice(1);
      }
      player.target = world.bossChair;
    }
  }

  function applySnapshot(next) {
    snapshot = next;
    arrangeBySpace();
    const alive = new Set();
    for (const agent of snapshot.agents) {
      alive.add(agent.key);
      let character = characters.get(agent.key);
      if (!character) {
        const seat = world.deskByKey.get(agent.key).chair;
        const spawn = firstSnapshot ? seat : world.entrance;
        character = newCharacter(agent.key, spawn, agent.seed);
        characters.set(agent.key, character);
      }
      if (agent.status !== 'done') character.breakUntil = 0;
      else if (character.status === 'working') character.breakUntil = performance.now() + BREAK_MS;
      Object.assign(character, { name: agent.name, task: agent.task, status: agent.status, leaving: false });
      dressUp(character);
    }
    for (const subagent of snapshot.subagents) {
      alive.add(subagent.key);
      let character = characters.get(subagent.key);
      if (!character) {
        const parent = characters.get(subagent.parentKey);
        character = newCharacter(subagent.key, parent || world.entrance, subagent.seed);
        character.isSubagent = true;
        if (!firstSnapshot) {
          character.beamInAt = performance.now();
          beams.push({ x: character.x, y: character.y, at: character.beamInAt });
        }
        characters.set(subagent.key, character);
      }
      Object.assign(character, {
        name: subagent.name,
        task: subagent.task,
        status: 'working',
        parentKey: subagent.parentKey,
        leaving: false,
      });
    }
    for (const [key, character] of characters) {
      if (!alive.has(key)) character.leaving = true;
    }
    followFocus();
    firstSnapshot = false;
    markDirty();
  }

  // Office hours: while nobody waits I walk over to the agent whose tab Herdr shows; as soon as
  // someone needs me I go back to my office and stay there (I can still walk around by hand).
  let followEnabled = true;
  let lastFocusedKey = null;
  let someoneWaited = false;
  window.office.getFollowFocus().then((enabled) => {
    followEnabled = enabled;
  });
  window.office.onFollowFocus((enabled) => {
    followEnabled = enabled;
  });

  // Tab switches the office itself asks Herdr for (click, standing next to an agent) must not
  // count as "I opened this tab" for following, or walking past agents bounces between them.
  let requestedFocusKey = null;
  function showInHerdr(agent) {
    if (!agent) return;
    requestedFocusKey = agent.key;
    window.Terminals.showAgent(agent);
  }

  function goToOffice() {
    pinnedKey = null;
    player.target = world.bossChair;
    player.path = findPath(world, player, world.bossChair).slice(1);
  }

  function followFocus() {
    const focused = snapshot.agents.find((agent) => agent.focused);
    const focusedKey = focused ? focused.key : null;
    const focusChanged = focusedKey !== lastFocusedKey;
    lastFocusedKey = focusedKey;
    const waiting = snapshot.agents.some((agent) => agent.status === 'blocked');
    const startedWaiting = waiting && !someoneWaited;
    someoneWaited = waiting;
    if (firstSnapshot || !followEnabled) return;
    if (startedWaiting) {
      if (player.target !== world.bossChair) goToOffice();
      return;
    }
    if (focusChanged && focused && focused.key === requestedFocusKey) {
      requestedFocusKey = null; // the office asked for this tab itself
      return;
    }
    if (waiting || !focusChanged || !focused || keys.size) return;
    const character = characters.get(focused.key);
    if (!character || pinnedKey === focused.key) return;
    pinnedKey = focused.key;
    nearCandidate = { key: focused.key, since: 0, shown: true };
    // walk to where the agent is going, not where it is: a new agent spawns at the entrance
    // and only gets its desk once targets are assigned
    assignTargets();
    const destination = character.target || character;
    const goal = spotBeside(destination);
    player.target = goal;
    player.path = findPath(world, player, goal).slice(1);
  }

  function newCharacter(key, position, seed) {
    return {
      key,
      x: Math.round(position.x),
      y: Math.round(position.y),
      face: 'down',
      moving: false,
      path: [],
      target: null,
      phaseOffset: (seed % 1000) / 100,
      looks: Sprites.looksFromSeed(seed),
      baseLooks: Sprites.looksFromSeed(seed),
    };
  }

  function assignTargets() {
    // In my office: the waiting agent whose tab I open; otherwise whoever is already in there;
    // otherwise whoever waits longest. The others sit on the chairs in that order.
    const waiting = snapshot.agents.filter((agent) => agent.status === 'blocked');
    const inOffice = waiting.find((agent) => agent.focused) || waiting.find((agent) => agent.key === visitorKey);
    visitorKey = inOffice ? inOffice.key : null;
    const visitors = waiting.sort((a, b) => Number(b === inOffice) - Number(a === inOffice) || a.statusSince - b.statusSince);
    if (!visitorKey && visitors.length) visitorKey = visitors[0].key;
    const visitorTarget = new Map();
    visitors.forEach((agent, index) => {
      visitorTarget.set(agent.key, index === 0 ? world.visitorSpot : world.queueSpots[Math.min(index - 1, world.queueSpots.length - 1)]);
    });

    const groups = new Map();
    for (const subagent of snapshot.subagents) {
      if (!groups.has(subagent.parentKey)) groups.set(subagent.parentKey, []);
      groups.get(subagent.parentKey).push(subagent.key);
    }
    const rooms = new Map(world.meetingRooms.map((room) => [room.id, room]));
    const wanted = assignMeetingRooms(groups, rooms, visitorTarget);
    const meetingTargets = assignMeetingSeats(wanted, rooms);
    const loungeTargets = assignLoungeSeats(new Set([...visitorTarget.keys(), ...meetingTargets.keys()]));

    for (const [key, character] of characters) {
      let target;
      if (character.leaving) target = world.entrance;
      else if (visitorTarget.has(key)) target = visitorTarget.get(key);
      else if (meetingTargets.has(key)) target = meetingTargets.get(key);
      else if (loungeTargets.has(key)) target = loungeTargets.get(key);
      else {
        const agent = agentByKey(key);
        target = agent ? world.deskByKey.get(key).chair : world.entrance;
      }
      setTarget(character, target);
    }
  }

  function assignMeetingRooms(groups, rooms, visitorTarget) {
    for (const [parentKey, roomId] of [...groupRooms]) {
      if (!groups.has(parentKey) || !rooms.has(roomId)) groupRooms.delete(parentKey);
    }
    const occupied = new Set([...groupRooms.values()].filter((roomId) => !rooms.get(roomId).shared));
    const wanted = new Map();
    for (const [parentKey, subagentKeys] of groups) {
      const members = (visitorTarget.has(parentKey) ? [] : [parentKey]).concat(subagentKeys);
      const current = rooms.get(groupRooms.get(parentKey));
      if (current && !current.shared && current.seats.length < members.length) {
        groupRooms.delete(parentKey);
        occupied.delete(current.id);
      }
      if (!groupRooms.has(parentKey)) {
        const origin = world.deskByKey.get(parentKey)?.chair || characters.get(parentKey) || world.entrance;
        const room =
          world.meetingRooms
            .filter((candidate) => !candidate.shared && !occupied.has(candidate.id) && candidate.seats.length >= members.length)
            .sort((a, b) => distance(a.center, origin) - distance(b.center, origin))[0] || rooms.get('main');
        groupRooms.set(parentKey, room.id);
        if (!room.shared) occupied.add(room.id);
      }
      for (const key of members) wanted.set(key, groupRooms.get(parentKey));
    }
    return wanted;
  }

  function assignMeetingSeats(wanted, rooms) {
    for (const [key, seat] of [...meetingSeats]) {
      if (wanted.get(key) !== seat.roomId) meetingSeats.delete(key);
    }
    const taken = new Map();
    for (const seat of meetingSeats.values()) {
      if (!taken.has(seat.roomId)) taken.set(seat.roomId, new Set());
      taken.get(seat.roomId).add(seat.index);
    }
    const targets = new Map();
    for (const [key, roomId] of wanted) {
      const room = rooms.get(roomId);
      if (!meetingSeats.has(key)) {
        const used = taken.get(roomId) || new Set();
        let index = room.seats.findIndex((_seat, candidate) => !used.has(candidate));
        if (index < 0) index = used.size % room.seats.length;
        used.add(index);
        taken.set(roomId, used);
        meetingSeats.set(key, { roomId, index });
      }
      targets.set(key, room.seats[meetingSeats.get(key).index]);
    }
    return targets;
  }

  function wantsBreak(agent) {
    const character = characters.get(agent.key);
    if (!character || character.leaving) return false;
    if (character.summonedFor === agent.statusSince) return false; // called back to the desk
    if (agent.status === 'done') return character.breakUntil > performance.now();
    return agent.status === 'idle' && Date.now() - agent.statusSince > IDLE_LOUNGE_MS;
  }

  function seatTaken(seat, exceptKey) {
    if (Math.hypot(player.x - seat.x, player.y - seat.y) < 0.5) return true;
    for (const character of characters.values()) {
      if (character.key !== exceptKey && character.target && character.target.x === seat.x && character.target.y === seat.y) return true;
    }
    return false;
  }

  function assignLoungeSeats(busy) {
    const seats = world.loungeSeats;
    const resting = snapshot.agents.filter((agent) => !busy.has(agent.key) && wantsBreak(agent));
    const keys = new Set(resting.map((agent) => agent.key));
    for (const [key, index] of [...loungeSeatByKey]) {
      if (!keys.has(key) || index >= seats.length) loungeSeatByKey.delete(key);
    }
    const taken = new Set(loungeSeatByKey.values());
    const targets = new Map();
    for (const agent of resting) {
      if (!loungeSeatByKey.has(agent.key)) {
        const free = seats.map((_seat, index) => index).filter((index) => !taken.has(index) && !seatTaken(seats[index], agent.key));
        if (!free.length) continue; // lounge full: wait at the desk
        // join colleagues from the same Herdr space, else start a group at an empty table
        const groupOf = (index) => seats[index].group;
        const sitting = [...loungeSeatByKey].map(([key, index]) => ({ agent: agentByKey(key), group: groupOf(index) }));
        const mates = new Set(sitting.filter((other) => other.agent?.workspaceId === agent.workspaceId).map((other) => other.group));
        const busy = new Set(sitting.map((other) => other.group));
        const withMates = free.filter((index) => mates.has(groupOf(index)));
        const emptyGroups = free.filter((index) => !busy.has(groupOf(index)));
        const choice = withMates.length ? withMates : emptyGroups.length ? emptyGroups : free;
        const index = choice[agent.seed % choice.length];
        loungeSeatByKey.set(agent.key, index);
        taken.add(index);
      }
      targets.set(agent.key, seats[loungeSeatByKey.get(agent.key)]);
    }
    return targets;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function setTarget(character, target) {
    if (character.target && character.target.x === target.x && character.target.y === target.y) return;
    character.target = target;
    character.path = findPath(world, character, target).slice(1);
  }

  function markSeated(character) {
    const { target } = character;
    character.seated = Boolean(
      target && target.seat && !character.moving && !character.path.length && Math.hypot(character.x - target.x, character.y - target.y) < 0.05,
    );
  }

  function step(character, speed, dt) {
    const next = character.path[0];
    if (!next) {
      character.moving = false;
      if (character.target && character.target.face) character.face = character.target.face;
      return;
    }
    const dx = next.x - character.x;
    const dy = next.y - character.y;
    const distance = Math.hypot(dx, dy);
    const travel = speed * dt;
    character.moving = true;
    character.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (distance <= travel) {
      character.x = next.x;
      character.y = next.y;
      character.path.shift();
    } else {
      character.x += (dx / distance) * travel;
      character.y += (dy / distance) * travel;
    }
  }

  function movePlayer(dt) {
    let dx = 0;
    let dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
    if (!dx && !dy) {
      step(player, PLAYER_SPEED, dt); // on arrival this also turns towards the target's facing
      return;
    }
    player.path = [];
    player.target = null; // walking by hand: no destination to turn towards or sit down on
    pinnedKey = null;
    const length = Math.hypot(dx, dy);
    const travel = PLAYER_SPEED * dt;
    const nx = player.x + (dx / length) * travel;
    const ny = player.y + (dy / length) * travel;
    if (free(nx, player.y) && !crossesPartition(world, Math.round(player.x), Math.round(player.y), Math.round(nx), Math.round(player.y))) player.x = nx;
    if (free(player.x, ny) && !crossesPartition(world, Math.round(player.x), Math.round(player.y), Math.round(player.x), Math.round(ny))) player.y = ny;
    player.moving = true;
    player.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  function free(x, y) {
    const half = 0.3;
    for (const cx of [x - half, x + half]) {
      for (const cy of [y - half + 0.2, y + half]) {
        if (!walkable(world, Math.round(cx), Math.round(cy))) return false;
      }
    }
    return true;
  }

  function updateProximity(now) {
    if (pinnedKey) {
      const pinned = characters.get(pinnedKey);
      if (pinned && !pinned.leaving && player.path.length) return;
      pinnedKey = null;
    }
    // walking past agents must not switch tabs: only standing next to one shows it
    if (player.moving || player.path.length) {
      nearCandidate = null;
      return;
    }
    let nearest = null;
    let nearestDistance = Infinity;
    for (const character of characters.values()) {
      if (character.leaving) continue;
      const distance = Math.hypot(character.x - player.x, character.y - player.y);
      if (distance < nearestDistance) {
        nearest = character;
        nearestDistance = distance;
      }
    }
    if (!nearest || nearestDistance > NEAR_RADIUS) {
      nearCandidate = null;
      return;
    }
    if (!nearCandidate || nearCandidate.key !== nearest.key) {
      nearCandidate = { key: nearest.key, since: now, shown: false };
      return;
    }
    if (nearCandidate.shown || now - nearCandidate.since < NEAR_DELAY_MS) return;
    nearCandidate.shown = true;
    showInHerdr(consoleAgent(nearest));
  }

  function consoleAgent(character) {
    if (character.isSubagent) return agentByKey(character.parentKey);
    return agentByKey(character.key);
  }

  function updateCamera() {
    const viewWidth = canvas.width / (window.devicePixelRatio || 1);
    const viewHeight = canvas.height / (window.devicePixelRatio || 1);
    const mapWidth = world.cols * TILE;
    const mapHeight = world.rows * TILE;
    scale = Math.max(Math.min(viewWidth / mapWidth, viewHeight / mapHeight), MIN_SCALE);
    const visibleWidth = viewWidth / scale;
    const visibleHeight = viewHeight / scale;
    const clamp = (value, max) => (max <= 0 ? max / 2 : Math.max(0, Math.min(value, max)));
    camera.x = clamp(player.x * TILE + TILE / 2 - visibleWidth / 2, mapWidth - visibleWidth);
    camera.y = clamp(player.y * TILE + TILE / 2 - visibleHeight / 2, mapHeight - visibleHeight);
  }

  // Floor, walls, rugs, furniture and chairs only change with the office layout, the zoom or the
  // counts on the legend rug, so they are drawn once into an offscreen canvas and copied each frame.
  const staticLayer = document.createElement('canvas');
  let staticKey = '';

  function drawStaticLayer(ratio) {
    const counts = {};
    for (const agent of snapshot.agents) counts[agent.status] = (counts[agent.status] || 0) + 1;
    const width = world.cols * TILE;
    const height = world.rows * TILE;
    const factor = ratio * scale;
    const key = [world.signature, world.cols, world.rows, factor.toFixed(4), JSON.stringify(counts), snapshot.subagents.length].join('|');
    if (key !== staticKey) {
      staticKey = key;
      staticLayer.width = Math.ceil(width * factor);
      staticLayer.height = Math.ceil(height * factor);
      const layer = staticLayer.getContext('2d');
      layer.setTransform(factor, 0, 0, factor, 0, 0);
      Sprites.setLegendCounts(counts, snapshot.subagents.length);
      Sprites.drawFloorAndWalls(layer, world);
      Sprites.drawSpaceAreas(layer, world);
      Sprites.drawPartitions(layer, world);
      Sprites.drawSpaceSigns(layer, world);
      for (const item of world.decor) {
        if (item.kind === 'rug') continue;
        layer.save();
        Sprites.drawDecor(layer, item);
        layer.restore();
      }
      Sprites.drawBossDesk(layer, world);
      Sprites.drawMeetingTable(layer, world);
      for (const pod of world.pods) Sprites.drawTable(layer, pod.table);
      Sprites.drawGlassWalls(layer, world);
      for (const chair of world.chairs) {
        Sprites.drawChair(layer, chair, 'seat');
        if (!Sprites.chairBackInFront(chair)) Sprites.drawChair(layer, chair, 'back');
      }
    }
    ctx.drawImage(staticLayer, 0, 0, width, height);
  }

  function render(now) {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1d1f24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, -camera.x * ratio * scale, -camera.y * ratio * scale);

    drawStaticLayer(ratio);
    for (const desk of world.desks) {
      const agent = agentByKey(desk.ownerKey);
      if (!agent || awayFromDesk(agent)) Sprites.drawEmptyCubicle(ctx, desk, world);
      if (agent && awayFromDesk(agent)) Sprites.drawDeskRug(ctx, desk, agent, loungeSeatByKey.has(agent.key));
    }
    for (const desk of world.desks) Sprites.drawDesk(ctx, desk, agentByKey(desk.ownerKey), now);
    Sprites.drawRoomSigns(ctx, world, scale);

    const drawn = [...characters.values(), player].sort((a, b) => a.y - b.y);
    for (const character of drawn) Sprites.drawCharacter(ctx, character, now);
    for (const chair of world.chairs) if (Sprites.chairBackInFront(chair)) Sprites.drawChair(ctx, chair, 'back');
    for (const character of characters.values()) {
      if (character.status === 'idle' && !character.moving) Sprites.drawZzz(ctx, character, now);
    }
    const placed = [];
    for (const character of [...drawn].sort((a, b) => Math.round(a.y) - Math.round(b.y) || a.x - b.x)) {
      if (character === player) continue; // the alien gets its marker above the head instead
      Sprites.drawLabel(ctx, character, scale, Boolean(agentByKey(character.key)?.focused), placed);
    }
    for (const [key, bubble] of bubbles) {
      const character = characters.get(key);
      if (!character || now - bubble.at > BUBBLE_MS) bubbles.delete(key);
      else Sprites.drawBubble(ctx, character, bubble.text, scale);
    }
    Sprites.drawPlayerMarker(ctx, player, scale, now);
    drawBeams(now);
    drawUfoFlyby(now);
  }

  function drawScaledUfo(px, py, beamTo, beamAlpha, now, size) {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(size, size);
    Sprites.drawUfo(ctx, 0, 0, now, beamTo === null ? null : (beamTo - py) / size, beamAlpha);
    ctx.restore();
  }

  function drawBeams(now) {
    for (let i = beams.length - 1; i >= 0; i--) {
      const beam = beams[i];
      const age = now - beam.at;
      if (age > BEAM_MS + 600) {
        beams.splice(i, 1);
        continue;
      }
      const px = beam.x * TILE + TILE / 2;
      const ground = beam.y * TILE + TILE / 2 + 12;
      const hover = ground - 3.6 * TILE + Math.sin(now / 200) * 2;
      const alpha = age < 300 ? age / 300 : age > BEAM_MS ? 1 - (age - BEAM_MS) / 600 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      drawScaledUfo(px, hover, ground, age < BEAM_MS ? 1 : alpha, now, 1.5);
      ctx.restore();
    }
  }

  function drawUfoFlyby(now) {
    if (!ufo && animate && now > nextUfoAt) {
      const rightward = Math.random() < 0.5;
      ufo = { start: now, duration: 11000, y: 2 + Math.random() * (world.rows - 6), rightward };
      ufo.beamAt = 0.3 + Math.random() * 0.4;
    }
    if (!ufo) return;
    const progress = (now - ufo.start) / ufo.duration;
    if (progress >= 1) {
      ufo = null;
      nextUfoAt = now + 120000 + Math.random() * 180000;
      return;
    }
    const span = world.cols + 6;
    const tx = ufo.rightward ? -3 + progress * span : world.cols + 3 - progress * span;
    const px = tx * TILE;
    const py = ufo.y * TILE + Math.sin(now / 300) * 6;
    const beamPhase = Math.abs(progress - ufo.beamAt);
    const beamAlpha = beamPhase < 0.08 ? 1 - beamPhase / 0.08 : 0;
    drawScaledUfo(px, py, py + 3 * TILE, beamAlpha, now, 1.8);
  }

  let last = performance.now();
  // Frames per second: 30 while someone walks, 15 when everyone sits (lights, screens and breathing
  // still look smooth), 8 while the window is in the background, none while the office is hidden.
  // With animations off (View menu) the picture is redrawn only when something changes, and
  // lights, screens, breathing and z's are drawn as they look at a fixed moment.
  const STILL_TIME = 40; // a moment in which the blinking "needs you" light is on
  let animate = true;
  let dirty = true;
  let wasWalking = false;
  const markDirty = () => {
    dirty = true;
  };
  window.office.getAnimations().then((enabled) => {
    animate = enabled;
    markDirty();
  });
  window.office.onAnimations((enabled) => {
    animate = enabled;
    markDirty();
  });

  function isWalking() {
    return Boolean(
      keys.size || player.moving || player.path.length || ufo || beams.length ||
        [...characters.values()].some((character) => character.moving || character.path.length),
    );
  }

  function frameInterval(walking) {
    if (!document.hasFocus()) return 1000 / 8;
    return 1000 / (walking ? 30 : 15);
  }

  function frame(now) {
    const walking = isWalking();
    const bubbleExpired = [...bubbles.values()].some((bubble) => now - bubble.at > BUBBLE_MS);
    const changed = dirty || walking || wasWalking || bubbleExpired;
    if (!canvas.clientWidth || (!animate && !changed) || now - last < frameInterval(walking) - 2) {
      requestAnimationFrame(frame);
      return;
    }
    dirty = false;
    wasWalking = walking;
    const dt = Math.min((now - last) / 1000, 0.15);
    last = now;
    assignTargets();
    for (const [key, character] of characters) {
      if (character.isSubagent && character.leaving) {
        if (!character.beamOutAt) {
          character.beamOutAt = now;
          beams.push({ x: character.x, y: character.y, at: now });
        }
        character.alpha = Math.max(0, 1 - (now - character.beamOutAt - 300) / 900);
        if (now - character.beamOutAt > BEAM_MS) characters.delete(key);
        continue;
      }
      if (character.beamInAt && now - character.beamInAt < BEAM_MS) {
        character.alpha = Math.min(1, Math.max(0, (now - character.beamInAt - 300) / 900));
        continue;
      }
      character.alpha = undefined;
      step(character, AGENT_SPEED, dt);
      if (character.leaving && !character.path.length) characters.delete(key);
    }
    movePlayer(dt);
    for (const character of [...characters.values(), player]) markSeated(character);
    updateProximity(now);
    updateCamera();
    render(animate || walking ? now : STILL_TIME);
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', (event) => {
    if (window.Terminals.hasFocus()) return;
    if (event.code === 'Enter') {
      event.preventDefault();
      window.Terminals.focusHerdr();
      return;
    }
    if (event.code === 'KeyH') {
      goToOffice();
      return;
    }
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    markDirty();
  });
  window.addEventListener('blur', () => keys.clear());

  function characterAt(worldX, worldY) {
    let hit = null;
    let hitDistance = Infinity;
    for (const character of characters.values()) {
      if (character.leaving) continue;
      const dx = worldX - character.x;
      const dy = worldY - character.y;
      if (Math.abs(dx) > 0.9 || dy < -1.7 || dy > 1.5) continue;
      const distance = Math.hypot(dx, dy);
      if (distance < hitDistance) {
        hit = character;
        hitDistance = distance;
      }
    }
    return hit;
  }

  function awayFromDesk(agent) {
    const character = characters.get(agent.key);
    const chair = world.deskByKey.get(agent.key)?.chair;
    return Boolean(character && chair && Math.hypot(character.x - chair.x, character.y - chair.y) > 0.5);
  }

  // Calling an agent: Herdr shows its tab, it leaves the lounge for its desk and I walk there.
  function visitDesk(agent) {
    const character = characters.get(agent.key);
    const desk = world.deskByKey.get(agent.key);
    if (!character || !desk || !agent.paneId) return;
    character.summonedFor = agent.statusSince;
    character.breakUntil = 0;
    pinnedKey = agent.key;
    nearCandidate = { key: agent.key, since: 0, shown: true };
    showInHerdr(agent);
    window.Terminals.focusHerdr();
    const goal = spotBeside(desk.chair);
    player.target = goal;
    player.path = findPath(world, player, goal).slice(1);
  }

  function deskAt(x, y) {
    for (const [key, desk] of world.deskByKey) {
      const onDesk = y === desk.y && (x === desk.x || x === desk.x + 1);
      const onChair = (x === desk.chair.x || x === desk.chair.x - 1) && y === desk.chair.y;
      const onRug = x >= desk.x - 1 && x <= desk.x + 3 && y >= desk.chair.y + 1 && y <= desk.chair.y + 2;
      if (onDesk || onChair || onRug) return agentByKey(key);
    }
    return null;
  }

  function visit(character) {
    const agent = consoleAgent(character);
    if (!agent || !agent.paneId) return;
    if (!character.isSubagent && loungeSeatByKey.has(character.key)) {
      visitDesk(agent);
      return;
    }
    if (agent.status === 'blocked') {
      // someone waiting is seen in my office: show the tab and let it come in
      showInHerdr(agent);
      window.Terminals.focusHerdr();
      goToOffice();
      return;
    }
    pinnedKey = character.key;
    nearCandidate = { key: character.key, since: 0, shown: true };
    showInHerdr(agent);
    window.Terminals.focusHerdr();
    const goal = spotBeside(character);
    player.target = goal;
    player.path = findPath(world, player, goal).slice(1);
  }

  function spotBeside(character) {
    const x = Math.round(character.x);
    const y = Math.round(character.y);
    const occupied = new Set(
      [...characters.values()].filter((other) => other !== character).map((other) => `${Math.round(other.x)},${Math.round(other.y)}`),
    );
    // in order of preference: right beside the agent first, the others only when that is blocked
    const candidates = [
      { x: x + 1, y, face: 'left' },
      { x: x - 1, y, face: 'right' },
      { x: x + 1, y: y + 1, face: 'up' },
      { x, y: y + 1, face: 'up' },
      { x: x - 1, y: y + 1, face: 'up' },
      { x, y: y - 1, face: 'down' },
    ].filter(
      (spot) =>
        walkable(world, spot.x, spot.y) &&
        !occupied.has(`${spot.x},${spot.y}`) &&
        (spot.x === x || spot.y === y ? !crossesPartition(world, x, y, spot.x, spot.y) : true),
    );
    const reachable = (spot) => {
      const [start, second] = findPath(world, player, spot);
      return !(second && Math.abs(second.x - start.x) + Math.abs(second.y - start.y) > 1);
    };
    return candidates.find(reachable) || { x, y };
  }

  canvas.addEventListener('mousedown', (event) => {
    markDirty();
    const rect = canvas.getBoundingClientRect();
    const worldX = (event.clientX - rect.left) / scale / TILE + camera.x / TILE - 0.5;
    const worldY = (event.clientY - rect.top) / scale / TILE + camera.y / TILE - 0.5;
    const clicked = characterAt(worldX, worldY);
    if (clicked) {
      event.preventDefault();
      visit(clicked);
      return;
    }
    const deskOwner = deskAt(Math.round(worldX), Math.round(worldY));
    if (deskOwner && awayFromDesk(deskOwner)) {
      event.preventDefault();
      visitDesk(deskOwner);
      return;
    }
    pinnedKey = null;
    const x = Math.round(worldX);
    const y = Math.round(worldY);
    let goal = { x, y };
    const seat = [...world.loungeSeats, ...world.chairs].find((chair) => chair.x === x && chair.y === y);
    if (seat && seat.seat && !seatTaken(seat, 'player')) goal = seat;
    else if (!walkable(world, x, y)) {
      const neighbours = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]
        .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
        .filter((tile) => walkable(world, tile.x, tile.y));
      if (!neighbours.length) return;
      goal = neighbours[0];
    }
    player.target = goal;
    player.path = findPath(world, player, goal).slice(1);
    document.activeElement?.blur?.();
  });

  window.office.onAgents((next) => {
    errorBox.classList.add('hidden');
    applySnapshot(next);
  });
  window.office.onBubble(({ key, text }) => {
    bubbles.set(key, { text, at: performance.now() });
    markDirty();
  });
  window.office.onError((message) => {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  });
  window.office.getAgents().then((initial) => {
    if (initial.agents.length) {
      applySnapshot(initial);
    }
  });

  requestAnimationFrame(frame);
})();
