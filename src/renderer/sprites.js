/* global window */
(function () {
  const { TILE } = window.World;

  const SKIN = ['#f5d0b5', '#e8b896', '#c98e68', '#a36a45', '#7a4a2d', '#f2c9a0'];
  const HAIR = ['#2b1d14', '#5a3825', '#a0642e', '#d9b36c', '#1a1a1a', '#8c8c8c', '#b0402c', '#e3d3a8'];
  const SHIRT = ['#4f7cac', '#5b9a68', '#a85d8a', '#c9a227', '#6b5fb5', '#3e9aa3', '#c4573b', '#7a8b99', '#d17aa6', '#4c6e3d'];
  const PANTS = ['#2d3748', '#3b3b4f', '#4a3b2c', '#28394a'];

  const STATUS_COLORS = {
    working: '#4ade80',
    blocked: '#f97316',
    done: '#60a5fa',
    idle: '#f8fafc',
    unknown: '#6b7280',
  };

  function looksFromSeed(seed) {
    const pick = (list, shift) => list[(seed >>> shift) % list.length];
    return {
      skin: pick(SKIN, 0),
      hair: pick(HAIR, 3),
      shirt: pick(SHIRT, 7),
      pants: pick(PANTS, 11),
      hairStyle: (seed >>> 14) % 3,
    };
  }

  const OUTLINE = 'rgba(24,18,30,0.55)';
  const FIGURE_SCALE = 1.3;
  const PLANT_SCALE = 1.6;
  const FEET = 12;

  function figureY(py, offset) {
    return py + FEET + (offset - FEET) * FIGURE_SCALE;
  }

  function drawCharacter(ctx, character, time) {
    const { looks } = character;
    const px = character.x * TILE + TILE / 2;
    const py = character.y * TILE + TILE / 2;
    const walking = character.moving;
    const seated = Boolean(character.seated) && !walking;
    const phase = walking ? Math.sin(time / 90 + character.phaseOffset) : 0;
    const bob = walking ? Math.abs(phase) * 1.5 : Math.sin(time / 700 + character.phaseOffset) * 0.5;
    const face = character.face || 'down';
    const lift = (seated ? 3 : 0) - bob;

    ctx.save();
    ctx.translate(px, py + FEET);
    ctx.scale(FIGURE_SCALE, FIGURE_SCALE);
    ctx.translate(0, -FEET);
    if (character.alpha !== undefined) ctx.globalAlpha = character.alpha;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 12.5, 10, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (character.isPlayer) drawPlayerRing(ctx, time);

    ctx.translate(0, lift);
    ctx.lineWidth = 1;
    ctx.strokeStyle = OUTLINE;

    if (!seated) {
      for (const side of [-1, 1]) {
        const swing = side * phase * 2;
        ctx.fillStyle = looks.pants;
        roundRect(ctx, side < 0 ? -5.5 : 0.5, 3, 5, 8 + swing, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2b2b33';
        ctx.beginPath();
        ctx.ellipse(side * 3, 11.2 + swing, 3, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const side of [-1, 1]) {
      const swing = -side * phase * 1.5;
      ctx.fillStyle = shade(looks.shirt, -16);
      roundRect(ctx, side * 8.5 - 2, -4 + swing, 4, 9, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = looks.skin;
      ctx.beginPath();
      ctx.arc(side * 8.5, 5.6 + swing, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const torso = ctx.createLinearGradient(-8, 0, 8, 0);
    torso.addColorStop(0, shade(looks.shirt, 18));
    torso.addColorStop(0.55, looks.shirt);
    torso.addColorStop(1, shade(looks.shirt, -22));
    ctx.fillStyle = torso;
    roundRect(ctx, -7.5, -6, 15, 13, 5);
    ctx.fill();
    ctx.stroke();

    if (looks.tie && face !== 'up') {
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(-3, -6);
      ctx.lineTo(0, -2);
      ctx.lineTo(3, -6);
      ctx.fill();
      ctx.fillStyle = looks.tie;
      ctx.beginPath();
      ctx.moveTo(-1, -5);
      ctx.lineTo(1, -5);
      ctx.lineTo(1.6, 2);
      ctx.lineTo(0, 4);
      ctx.lineTo(-1.6, 2);
      ctx.closePath();
      ctx.fill();
    }

    if (looks.alien) drawAlienHead(ctx, looks, face, -13.5);
    else drawHead(ctx, looks, face, -13.5);

    if (looks.alien) {
      for (const side of [-1, 1]) {
        ctx.strokeStyle = shade(looks.skin, -40);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(side * 3, -22.5);
        ctx.quadraticCurveTo(side * 4, -27, side * 6, -29);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = OUTLINE;
        ctx.fillStyle = '#b6f7a8';
        ctx.beginPath();
        ctx.arc(side * 6, -29, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (character.isPlayer) {
      ctx.fillStyle = '#e8875f';
      ctx.strokeStyle = '#9a4a2c';
      ctx.beginPath();
      ctx.moveTo(-5.5, -22);
      ctx.lineTo(-3.5, -27);
      ctx.lineTo(0, -23.5);
      ctx.lineTo(3.5, -27);
      ctx.lineTo(5.5, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    if (character.status) drawStatusLight(ctx, px, figureY(py, -31 + lift), character.status, time);
    if (character.isSubagent) drawBadge(ctx, px + 9 * FIGURE_SCALE, figureY(py, -23 + lift));
  }

  // "You are here": a glowing green ring on the floor under the alien, gently pulsing
  function drawPlayerRing(ctx, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 400);
    ctx.save();
    const glow = ctx.createRadialGradient(0, 12.5, 2, 0, 12.5, 17);
    glow.addColorStop(0, `rgba(134,239,172,${0.35 + 0.2 * pulse})`);
    glow.addColorStop(1, 'rgba(134,239,172,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 12.5, 17, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(74,222,128,${0.75 + 0.25 * pulse})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 12.5, 13 + pulse * 1.5, 4.8 + pulse * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHead(ctx, looks, face, headY) {
    ctx.fillStyle = looks.skin;
    ctx.beginPath();
    ctx.arc(0, headY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (looks.hairStyle !== 3) drawHair(ctx, looks, face, headY);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-1.5, headY - 2, 5.5, Math.PI * 1.15, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;

    if (face === 'up') return;
    if (looks.beard) drawBeard(ctx, looks.beard, headY);
    drawFace(ctx, face, headY);
    if (looks.glasses) drawGlasses(ctx, looks.glasses, face, headY);
  }

  function drawAlienHead(ctx, looks, face, headY) {
    ctx.fillStyle = looks.skin;
    ctx.beginPath();
    ctx.moveTo(-8.8, headY - 2);
    ctx.bezierCurveTo(-9, headY - 13, 9, headY - 13, 8.8, headY - 2);
    ctx.bezierCurveTo(8.4, headY + 4, 3, headY + 8.5, 0, headY + 8.5);
    ctx.bezierCurveTo(-3, headY + 8.5, -8.4, headY + 4, -8.8, headY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(-1.5, headY - 3, 5.5, Math.PI * 1.15, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    if (face === 'up') return;

    // big slanted almond eyes, higher on the outer side
    const eyes = face === 'down' ? [-3.6, 3.6] : [face === 'left' ? -4.2 : 4.2];
    for (const ex of eyes) {
      const tilt = face === 'down' ? (ex < 0 ? 0.45 : -0.45) : (ex < 0 ? 0.3 : -0.3);
      const width = face === 'down' ? 3.2 : 2.6;
      ctx.fillStyle = '#111318';
      ctx.beginPath();
      ctx.ellipse(ex, headY + 0.5, width, 1.9, tilt, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ex + (ex < 0 ? 0.8 : -0.8), headY - 0.2, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (face === 'down') {
      ctx.strokeStyle = 'rgba(30,60,35,0.7)';
      ctx.beginPath();
      ctx.moveTo(-1, headY + 5.4);
      ctx.lineTo(1, headY + 5.4);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
    }
  }

  // hairStyle: 0 short, 1 side parting, 2 long, 3 bald
  function drawHair(ctx, looks, face, headY) {
    const hairGradient = ctx.createLinearGradient(0, headY - 9, 0, headY + 6);
    hairGradient.addColorStop(0, shade(looks.hair, 28));
    hairGradient.addColorStop(1, looks.hair);
    ctx.fillStyle = hairGradient;
    ctx.beginPath();
    if (face === 'up') {
      ctx.arc(0, headY, 8.4, 0, Math.PI * 2);
      if (looks.hairStyle === 2) ctx.rect(-8.4, headY, 16.8, 8);
    } else {
      ctx.arc(0, headY - 1, 8.6, Math.PI * 0.98, Math.PI * 2.02);
      ctx.lineTo(8.4, headY - 1);
      if (looks.hairStyle === 0) {
        ctx.quadraticCurveTo(4, headY - 3.5, 0, headY - 2.5);
        ctx.quadraticCurveTo(-4, headY - 4, -8.4, headY - 1);
      } else if (looks.hairStyle === 1) {
        ctx.quadraticCurveTo(2, headY - 6, -8.4, headY + 1);
      } else {
        ctx.lineTo(8.6, headY + 8);
        ctx.lineTo(6, headY + 8);
        ctx.quadraticCurveTo(5, headY - 3, 0, headY - 4);
        ctx.quadraticCurveTo(-5, headY - 3, -6, headY + 8);
        ctx.lineTo(-8.6, headY + 8);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  function drawBeard(ctx, color, headY) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-7.6, headY + 1);
    ctx.quadraticCurveTo(-6.5, headY + 8.6, 0, headY + 8.8);
    ctx.quadraticCurveTo(6.5, headY + 8.6, 7.6, headY + 1);
    ctx.quadraticCurveTo(4, headY + 4.6, 0, headY + 5);
    ctx.quadraticCurveTo(-4, headY + 4.6, -7.6, headY + 1);
    ctx.fill();
  }

  function drawGlasses(ctx, color, face, headY) {
    const eyes = face === 'down' ? [-3, 3] : [face === 'left' ? -3.5 : 3.5];
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    for (const ex of eyes) {
      ctx.beginPath();
      ctx.arc(ex, headY + 1, 2.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    if (eyes.length === 2) {
      ctx.moveTo(-0.6, headY + 0.6);
      ctx.lineTo(0.6, headY + 0.6);
    } else {
      const ex = eyes[0];
      ctx.moveTo(ex - Math.sign(ex) * 2.4, headY + 0.6);
      ctx.lineTo(-Math.sign(ex) * 7, headY);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = OUTLINE;
  }

  function drawFace(ctx, face, headY) {
    const eyes = face === 'down' ? [-3, 3] : [face === 'left' ? -3.5 : 3.5];
    for (const ex of eyes) {
      ctx.fillStyle = '#1f1a24';
      ctx.beginPath();
      ctx.ellipse(ex, headY + 1, 1.25, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + 0.45, headY + 0.4, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(236,112,112,0.35)';
      ctx.beginPath();
      ctx.arc(ex + (ex < 0 ? -1.5 : 1.5), headY + 3.8, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (face === 'down') {
      ctx.strokeStyle = 'rgba(60,30,30,0.7)';
      ctx.beginPath();
      ctx.arc(0, headY + 3.6, 1.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
    }
  }

  function drawChair(ctx, chair, part) {
    const cx = chair.x * TILE + TILE / 2;
    const cy = chair.y * TILE + TILE / 2;
    const color = chair.boss ? '#23272f' : '#3d4451';
    const light = shade(color, 22);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(FIGURE_SCALE, FIGURE_SCALE);
    ctx.translate(-cx, -cy);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    if (part === 'seat') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 11, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a2e36';
      ctx.lineWidth = 2;
      for (const angle of [0.3, 1.5, 2.7]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + 8);
        ctx.lineTo(cx + Math.cos(angle) * 8, cy + 8 + Math.sin(angle) * 3);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.fillStyle = color;
      roundRect(ctx, cx - 9, cy - 2, 18, 11, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = light;
      roundRect(ctx, cx - 7, cy - 1, 14, 4, 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      if (chair.face === 'up') roundRect(ctx, cx - 10, cy + 5, 20, 8, 3);
      else if (chair.face === 'down') roundRect(ctx, cx - 10, cy - 15, 20, 9, 3);
      else if (chair.face === 'left') roundRect(ctx, cx + 7, cy - 9, 6, 18, 3);
      else roundRect(ctx, cx - 13, cy - 9, 6, 18, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function chairBackInFront(chair) {
    return chair.face === 'up';
  }

  function drawStatusLight(ctx, x, y, status, time) {
    const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    let intensity = 1;
    if (status === 'working') intensity = 0.6 + 0.4 * Math.sin(time / 250);
    if (status === 'blocked') intensity = Math.sin(time / 160) > 0 ? 1 : 0.4;
    const radius = 6;
    ctx.save();
    ctx.fillStyle = 'rgba(15,17,22,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, radius + 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * intensity;
    ctx.globalAlpha = 0.45 + 0.55 * intensity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawBadge(ctx, x, y) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b2a00';
    ctx.font = 'bold 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', x, y + 0.5);
  }

  // placed: tags already drawn this frame. A standing or sitting character's tag moves down
  // past them so tags never cover each other; a walking character's tag stays put (no jumping).
  function drawLabel(ctx, character, scale, highlighted, placed = []) {
    const px = character.x * TILE + TILE / 2;
    let py = figureY(character.y * TILE + TILE / 2, 16);
    const nameSize = 11 / scale;
    const taskSize = 9.5 / scale;
    const lineGap = 1.5 / scale;
    const maxWidth = highlighted ? 8 * TILE : 4.4 * TILE - 16 / scale;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${nameSize}px -apple-system, system-ui, sans-serif`;
    // on a break in the lounge the tag is one short line: the name, no task
    const compact = Boolean(character.seated && character.target?.compactLabel);
    // a name too long for the desk width goes below a small "Agent" line instead of being cut
    const split = !highlighted && !compact && ctx.measureText(character.name).width > maxWidth && character.name.match(/^(Agent) (.+)$/);
    const name = highlighted || compact ? character.name : fitName(ctx, split ? split[2] : character.name, maxWidth);
    const nameWidth = ctx.measureText(name).width;
    const prefixSize = taskSize;
    ctx.font = `600 ${prefixSize}px -apple-system, system-ui, sans-serif`;
    const prefixWidth = split ? ctx.measureText(split[1]).width : 0;
    const prefixHeight = split ? prefixSize + lineGap : 0;
    ctx.font = `${taskSize}px -apple-system, system-ui, sans-serif`;
    const taskLines = character.task && !compact ? wrapLines(ctx, character.task, maxWidth, 2) : [];
    const taskWidth = Math.max(0, ...taskLines.map((line) => ctx.measureText(line).width));
    const width = Math.max(nameWidth + (character.status ? 12 / scale : 0), prefixWidth, taskWidth) + 10 / scale;
    const height = prefixHeight + nameSize + 4 / scale + taskLines.length * (taskSize + lineGap);
    const box = { x: px - width / 2, w: width, h: height };
    const clashes = (y) => placed.some((other) => box.x < other.x + other.w && other.x < box.x + box.w && y < other.y + other.h && other.y < y + box.h);
    if (!character.moving && clashes(py)) {
      // one level down, above the head, two levels down; if all are taken it stays where it was
      const step = height + 3 / scale;
      const above = figureY(character.y * TILE + TILE / 2, -38) - height;
      py = [py + step, above, py + 2 * step].find((y) => !clashes(y)) ?? py;
    }
    placed.push({ ...box, y: py });

    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 4 / scale;
    ctx.shadowOffsetY = 1 / scale;
    ctx.fillStyle = highlighted ? 'rgba(217,119,87,0.95)' : 'rgba(22,24,30,0.8)';
    roundRect(ctx, px - width / 2, py, width, height, 5 / scale);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    const dotRadius = 4 / scale;
    const nameOffset = character.status ? dotRadius + 2 / scale : 0;
    if (character.status) {
      ctx.fillStyle = STATUS_COLORS[character.status] || STATUS_COLORS.unknown;
      ctx.beginPath();
      ctx.arc(px - nameWidth / 2 - 1 / scale, py + 1.5 / scale + prefixHeight + nameSize / 2, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    if (split) {
      ctx.font = `600 ${prefixSize}px -apple-system, system-ui, sans-serif`;
      ctx.fillText(split[1], px, py + 1.5 / scale);
    }
    ctx.font = `600 ${nameSize}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(name, px + nameOffset, py + 1.5 / scale + prefixHeight);
    ctx.fillStyle = highlighted ? '#fff' : '#cbd5e1';
    ctx.font = `${taskSize}px -apple-system, system-ui, sans-serif`;
    taskLines.forEach((line, index) => {
      ctx.fillText(line, px, py + prefixHeight + nameSize + 3 / scale + index * (taskSize + lineGap));
    });
    ctx.restore();
  }

  // The floor of a cubicle nobody sits in right now (agent away, or a spare desk) turns paler,
  // so empty places stand out from occupied ones. Desk, chair and rug are drawn on top.
  // The cubicle runs from under its back wall down to the next back wall and from the left
  // divider to its own; it never leaves the team area.
  function drawEmptyCubicle(ctx, desk, world) {
    const top = desk.y - 1; // first row of the cubicle, where the back wall stands
    let x0 = (desk.x - 1) * TILE + 2;
    let x1 = (desk.x + 4) * TILE - 2;
    let y0 = top * TILE + 13;
    let y1 = (top + 5) * TILE + 6;
    const area = world.spaceAreas.find(
      (space) => desk.x >= space.x && desk.x < space.x + space.w && desk.y >= space.y && desk.y < space.y + space.h,
    );
    if (area) {
      // the team carpet is drawn inset from its tiles (see drawSpaceAreas)
      x0 = Math.max(x0, area.x * TILE + 6);
      x1 = Math.min(x1, (area.x + area.w) * TILE - 6);
      y0 = Math.max(y0, area.y * TILE + 10);
      y1 = Math.min(y1, (area.y + area.h) * TILE - 8);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    drawChair(ctx, desk.chair, 'seat');
    drawChair(ctx, desk.chair, 'back');
  }

  // A rug in front of the desk of an agent who is away (on a break, in a meeting, at my door):
  // who sits here and the tab name, so I can click it to call the agent back. It lies on the floor
  // and shrinks with the office like the other rugs.
  function drawDeskRug(ctx, desk, agent, onBreak) {
    const x = (desk.x - 1) * TILE + 6;
    const y = (desk.chair.y + 1) * TILE + 2;
    const w = 5 * TILE - 12;
    const h = 2 * TILE - 6;
    ctx.save();
    ctx.fillStyle = '#3d4658';
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#e8c48a';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 5);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = (text, weight, size, min) => {
      let fontSize = size;
      ctx.font = `${weight} ${fontSize}px -apple-system, system-ui, sans-serif`;
      while (fontSize > min && ctx.measureText(text).width > w - 22) {
        fontSize -= 0.5;
        ctx.font = `${weight} ${fontSize}px -apple-system, system-ui, sans-serif`;
      }
      return fitName(ctx, text, w - 22);
    };
    const who = fit(onBreak ? `☕ ${agent.name}` : agent.name, 600, 10, 8);
    const whoWidth = ctx.measureText(who).width;
    ctx.fillStyle = STATUS_COLORS[agent.status] || STATUS_COLORS.unknown;
    ctx.beginPath();
    ctx.arc(x + w / 2 - whoWidth / 2 - 6, y + 17, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c48a';
    ctx.fillText(who, x + w / 2 + 3, y + 17.5);
    if (agent.task) {
      const task = fit(agent.task, 700, 13, 9);
      ctx.fillStyle = '#fdf4e3';
      ctx.fillText(task, x + w / 2, y + 36);
    }
    ctx.restore();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && current) lines.push(current);
    const used = lines.join(' ').length;
    const overflow = used < words.join(' ').length;
    const result = lines.slice(0, maxLines).map((line) => fitName(ctx, line, maxWidth));
    if (overflow && result.length) {
      const last = result.length - 1;
      if (!result[last].endsWith('…')) result[last] = fitName(ctx, `${result[last]}…`, maxWidth);
    }
    return result;
  }

  function fitName(ctx, name, maxWidth) {
    if (ctx.measureText(name).width <= maxWidth) return name;
    let cut = name;
    while (cut.length > 2 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    return `${cut}…`;
  }

  // "Me": a green badge with a pointer above the alien's head, always on top and always the same
  // size on screen, so I can find myself at a glance even when standing next to an agent.
  function drawPlayerMarker(ctx, character, scale, time) {
    const px = character.x * TILE + TILE / 2;
    const tip = figureY(character.y * TILE + TILE / 2, -34) - (2 + Math.sin(time / 350) * 1.5) / scale;
    const size = 13 / scale;
    ctx.save();
    ctx.font = `700 ${size}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = character.name;
    const width = ctx.measureText(text).width + 14 / scale;
    const height = size + 8 / scale;
    const arrow = 5 / scale;
    const top = tip - arrow - height;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4 / scale;
    ctx.shadowOffsetY = 1 / scale;
    ctx.fillStyle = '#22c55e';
    roundRect(ctx, px - width / 2, top, width, height, height / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - arrow, top + height - 0.5 / scale);
    ctx.lineTo(px, tip);
    ctx.lineTo(px + arrow, top + height - 0.5 / scale);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#f0fdf4';
    ctx.lineWidth = 1.2 / scale;
    roundRect(ctx, px - width / 2, top, width, height, height / 2);
    ctx.stroke();
    ctx.fillStyle = '#052e16';
    ctx.fillText(text, px, top + height / 2 + 0.5 / scale);
    ctx.restore();
  }

  function drawBubble(ctx, character, text, scale) {
    const px = character.x * TILE + TILE / 2;
    const py = figureY(character.y * TILE + TILE / 2, -42);
    const size = 11 / scale;
    ctx.save();
    ctx.font = `600 ${size}px -apple-system, system-ui, sans-serif`;
    const width = ctx.measureText(text).width + 12 / scale;
    const height = size + 8 / scale;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1 / scale;
    roundRect(ctx, px - width / 2, py - height, width, height, 6 / scale);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px - 4 / scale, py);
    ctx.lineTo(px, py + 5 / scale);
    ctx.lineTo(px + 4 / scale, py);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px, py - height / 2);
    ctx.restore();
  }

  // One outlined "z", drawn once at a large size; the floating z's are scaled copies of it.
  // (Drawing text at a new font size every frame made the z's the most expensive part of a frame.)
  const ZZZ_SIZE = 72;
  const zSprite = (() => {
    const sprite = document.createElement('canvas');
    sprite.width = ZZZ_SIZE;
    sprite.height = ZZZ_SIZE;
    const c = sprite.getContext('2d');
    c.font = `900 ${ZZZ_SIZE * 0.75}px -apple-system, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.strokeStyle = '#1e293b';
    c.lineWidth = ZZZ_SIZE / 6;
    c.strokeText('z', ZZZ_SIZE / 2, ZZZ_SIZE / 2);
    c.fillStyle = '#e0f2fe';
    c.fillText('z', ZZZ_SIZE / 2, ZZZ_SIZE / 2);
    return sprite;
  })();

  function drawZzz(ctx, character, time) {
    const px = character.x * TILE + TILE / 2 + 10 * FIGURE_SCALE;
    const py = figureY(character.y * TILE + TILE / 2, -22);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const t = (time / 1800 + i / 3 + character.phaseOffset) % 1;
      const size = (9 + t * 9) / 0.75; // font size 9–18, and the glyph fills 3/4 of the sprite
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      ctx.globalAlpha = Math.max(0, alpha);
      const x = px + t * 14 + Math.sin(t * 6) * 2;
      const y = py - t * 22;
      ctx.drawImage(zSprite, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  // the shortcuts, woven into rugs: [title, colour, lines of [key, action] pairs]
  const HELP_RUG_COLORS = { walk: '#2f5d50', agents: '#2e4a7a', terminals: '#5b3a6e', view: '#6b4a24' };

  function drawHelpRug(ctx, item) {
    const [title, lines] = window.I18n.t('helpRugs')[item.help];
    const color = HELP_RUG_COLORS[item.help];
    const x = item.x * TILE + 6;
    const y = item.y * TILE + 4;
    const w = item.w * TILE - 12;
    const h = item.h * TILE - 8;
    ctx.save();
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = '#e8c48a';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 7);
    ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5deb3';
    ctx.font = '700 11px -apple-system, system-ui, sans-serif';
    ctx.fillText(title, x + w / 2, y + 20);

    ctx.textAlign = 'left';
    const keyFont = '700 11px -apple-system, system-ui, sans-serif';
    const textFont = '500 11px -apple-system, system-ui, sans-serif';
    lines.forEach((pairs, index) => {
      const parts = pairs.flatMap(([key, action], pairIndex) => [
        ...(pairIndex ? [[textFont, '#e8c48a', '  ·  ']] : []),
        [keyFont, '#ffe9a8', key],
        [textFont, '#fdf4e3', ` ${action}`],
      ]);
      const width = parts.reduce((sum, [font, , text]) => {
        ctx.font = font;
        return sum + ctx.measureText(text).width;
      }, 0);
      let cx = x + (w - width) / 2;
      const cy = y + 42 + index * 19;
      for (const [font, fill, text] of parts) {
        ctx.font = font;
        ctx.fillStyle = fill;
        ctx.fillText(text, cx, cy);
        cx += ctx.measureText(text).width;
      }
    });
    ctx.restore();
  }

  const LEGEND = ['working', 'blocked', 'done', 'idle'].map((status) => [status, window.I18n.t('legend')[status]]);

  function drawPosterRug(ctx, item) {
    const x = item.x * TILE + 4;
    const y = item.y * TILE + 4;
    const w = item.w * TILE - 8;
    const h = item.h * TILE - 8;
    ctx.save();
    ctx.strokeStyle = '#e7dcc4';
    ctx.lineWidth = 1.5;
    for (let fx = x + 6; fx < x + w - 4; fx += 5) {
      ctx.beginPath();
      ctx.moveTo(fx, y);
      ctx.lineTo(fx, y - 4);
      ctx.moveTo(fx, y + h);
      ctx.lineTo(fx, y + h + 4);
      ctx.stroke();
    }
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#070b1f');
    sky.addColorStop(1, '#1b2347');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e7dcc4';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

    ctx.fillStyle = '#e2e8f0';
    for (const [sx, sy] of [[14, 12], [40, 22], [70, 10], [168, 14], [200, 26], [228, 12], [24, 40], [214, 44], [100, 8], [150, 30]]) {
      ctx.fillRect(x + sx, y + sy, 1.5, 1.5);
    }

    const cx = x + w / 2;
    const beam = ctx.createLinearGradient(0, y + 30, 0, y + h - 20);
    beam.addColorStop(0, 'rgba(190,255,190,0.55)');
    beam.addColorStop(1, 'rgba(190,255,190,0.08)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - 10, y + 30);
    ctx.lineTo(cx + 10, y + 30);
    ctx.lineTo(cx + 34, y + h - 22);
    ctx.lineTo(cx - 34, y + h - 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0b1020';
    for (const [tx, height] of [[-80, 14], [-66, 20], [-52, 12], [52, 16], [66, 22], [82, 13]]) {
      ctx.beginPath();
      ctx.moveTo(cx + tx - 6, y + h - 22);
      ctx.lineTo(cx + tx, y + h - 22 - height);
      ctx.lineTo(cx + tx + 6, y + h - 22);
      ctx.fill();
    }
    ctx.fillRect(x + 6, y + h - 23, w - 12, 3);

    ctx.fillStyle = 'rgba(186,230,253,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, y + 24, 9, 7, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(cx, y + 27, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(cx - 14 + i * 7, y + 28, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 13px "Helvetica Neue", Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I  WANT  TO  BELIEVE', cx, y + h - 11);
    ctx.restore();
  }

  // live counts shown on the legend rug, set by the office before each frame
  let legendCounts = {};
  let legendSubagents = 0;
  function setLegendCounts(counts, subagents) {
    legendCounts = counts;
    legendSubagents = subagents;
  }

  function drawLegendRug(ctx, item) {
    const x = item.x * TILE + 6;
    const y = item.y * TILE + 4;
    const w = item.w * TILE - 12;
    const h = item.h * TILE - 8;
    ctx.save();
    ctx.fillStyle = '#7a2e2a';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = '#e8c48a';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 7);
    ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f5deb3';
    ctx.font = '700 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const subagents = `  ·  ${legendSubagents} ${legendSubagents === 1 ? 'Subagent' : 'Subagents'}`;
    const titleWidth = ctx.measureText(window.I18n.t('legendTitle')).width;
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    const subWidth = ctx.measureText(subagents).width;
    const titleLeft = x + w / 2 - (titleWidth + subWidth) / 2;
    ctx.textAlign = 'left';
    ctx.font = '700 11px -apple-system, system-ui, sans-serif';
    ctx.fillText(window.I18n.t('legendTitle'), titleLeft, y + 20);
    ctx.fillStyle = '#e8c48a';
    ctx.font = '600 10px -apple-system, system-ui, sans-serif';
    ctx.fillText(subagents, titleLeft + titleWidth, y + 20.5);

    ctx.textAlign = 'left';
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    const columns = [x + 22, x + w / 2 + 6];
    LEGEND.forEach(([status, text], index) => {
      const cx = columns[index % 2];
      const cy = y + 42 + Math.floor(index / 2) * 20;
      // a round badge with the count; it widens into a pill for two or more digits
      const count = String(legendCounts[status] || 0);
      ctx.font = '800 10px -apple-system, system-ui, sans-serif';
      const badge = Math.max(15, ctx.measureText(count).width + 8);
      const left = cx - 7.5;
      ctx.fillStyle = STATUS_COLORS[status];
      roundRect(ctx, left, cy - 7.5, badge, 15, 7.5);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1f1a24';
      ctx.fillText(count, left + badge / 2, cy + 0.5);
      ctx.textAlign = 'left';
      ctx.font = '600 11px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#fdf4e3';
      ctx.fillText(text, left + badge + 4.5, cy + 0.5);
    });
    ctx.restore();
  }

  const FLOOR_COLORS = {
    office: ['#c9a27a', '#c39b72'],
    meeting: ['#5b6f8f', '#566a8a'],
    lounge: ['#a9c4a0', '#a2bd99'],
    hall: ['#f4f4f2', '#c9c9c6'],
    open: ['#f4f4f2', '#c9c9c6'],
  };

  const CHECKER_TILES = 2;

  function drawFloorAndWalls(ctx, world) {
    const { grid } = world;
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const zone = world.zoneAt(x, y);
        const colors = FLOOR_COLORS[zone];
        ctx.fillStyle = colors[(Math.floor(x / CHECKER_TILES) + Math.floor(y / CHECKER_TILES)) % 2];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    for (const item of world.decor) if (item.kind === 'rug') drawDecor(ctx, item);
    const isWall = (x, y) => y >= 0 && y < world.rows && x >= 0 && x < world.cols && grid[y][x] === window.World.WALL;
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        if (!isWall(x, y) || isWall(x, y + 1) || y + 1 >= world.rows) continue;
        const shadow = ctx.createLinearGradient(0, (y + 1) * TILE, 0, (y + 1) * TILE + 12);
        shadow.addColorStop(0, 'rgba(0,0,0,0.22)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadow;
        ctx.fillRect(x * TILE, (y + 1) * TILE, TILE, 12);
      }
    }
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        if (!isWall(x, y)) continue;
        const left = x * TILE;
        const top = y * TILE;
        ctx.fillStyle = '#4a5261';
        ctx.fillRect(left, top, TILE, TILE);
        ctx.fillStyle = '#5b6473';
        ctx.fillRect(left, top, TILE, 3);
        if (!isWall(x, y + 1) && y + 1 < world.rows) {
          const front = ctx.createLinearGradient(0, top + TILE * 0.4, 0, top + TILE);
          front.addColorStop(0, '#6a7383');
          front.addColorStop(1, '#4b5260');
          ctx.fillStyle = front;
          ctx.fillRect(left, top + TILE * 0.4, TILE, TILE * 0.6);
          ctx.fillStyle = '#2f343d';
          ctx.fillRect(left, top + TILE - 3, TILE, 3);
        }
        const outer = y === 0 || y === world.rows - 1 || x === 0 || x === world.cols - 1;
        const corner = (x === 0 || x === world.cols - 1) && (y === 0 || y === world.rows - 1);
        if (outer && !corner && hasWindow(x, y, world)) drawWindow(ctx, x, y, world);
      }
    }
  }

  function drawGlassWalls(ctx, world) {
    const { grid } = world;
    const isGlass = (x, y) => y >= 0 && y < world.rows && x >= 0 && x < world.cols && grid[y][x] === window.World.GLASS;
    const bar = (x, y, w, h) => {
      ctx.fillStyle = 'rgba(170,215,240,0.5)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#8fa9bb';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        if (!isGlass(x, y)) continue;
        const left = x * TILE;
        const top = y * TILE;
        const horizontal = isGlass(x - 1, y) || isGlass(x + 1, y);
        const vertical = isGlass(x, y - 1) || isGlass(x, y + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        if (horizontal) ctx.fillRect(left, top + 21, TILE, 4);
        if (horizontal) bar(isGlass(x - 1, y) ? left : left + 11, top + 11, isGlass(x - 1, y) && isGlass(x + 1, y) ? TILE : TILE - 11, 10);
        if (vertical) bar(left + 11, isGlass(x, y - 1) ? top : top + 11, 10, isGlass(x, y - 1) && isGlass(x, y + 1) ? TILE : TILE - 11);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        if (horizontal) ctx.fillRect(left + 2, top + 13, TILE - 4, 1.5);
        if (vertical) ctx.fillRect(left + 13, top + 2, 1.5, TILE - 4);
      }
    }
  }

  function hasWindow(x, y, world) {
    const along = y === 0 || y === world.rows - 1 ? x : y;
    return along % 4 !== 0;
  }

  function drawWindow(ctx, x, y, world) {
    const left = x * TILE;
    const top = y * TILE;
    const horizontal = y === 0 || y === world.rows - 1;
    const pane = horizontal ? { x: left, y: top + 6, w: TILE, h: TILE - 10 } : { x: left + 9, y: top, w: 14, h: TILE };
    const glass = ctx.createLinearGradient(pane.x, pane.y, pane.x + pane.w, pane.y + pane.h);
    glass.addColorStop(0, '#d6eefa');
    glass.addColorStop(1, '#8cc4e6');
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(pane.x, pane.y, pane.w, pane.h);
    ctx.fillStyle = glass;
    ctx.fillRect(pane.x + 2, pane.y + 2, pane.w - 4, pane.h - 4);
    ctx.fillStyle = '#e5e7eb';
    if (horizontal) ctx.fillRect(pane.x + pane.w / 2 - 1, pane.y, 2, pane.h);
    else ctx.fillRect(pane.x, pane.y + pane.h / 2 - 1, pane.w, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x + 2, pane.y + 2, pane.w - 4, pane.h - 4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pane.x + 4, pane.y + pane.h);
    ctx.lineTo(pane.x + pane.w * 0.6, pane.y);
    ctx.stroke();
    ctx.restore();
    if (y === 0) {
      const light = ctx.createLinearGradient(0, TILE, 0, TILE * 2.6);
      light.addColorStop(0, 'rgba(255,250,220,0.22)');
      light.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(left + 2, TILE);
      ctx.lineTo(left + TILE - 2, TILE);
      ctx.lineTo(left + TILE + 8, TILE * 2.6);
      ctx.lineTo(left + 8, TILE * 2.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  const SPACE_CARPETS = [
    { carpet: '#9fb0c8', weave: '#93a5bf', edge: '#6f84a3', accent: '#4f7cac' },
    { carpet: '#a9c2a5', weave: '#9db79a', edge: '#78977a', accent: '#5b9a68' },
    { carpet: '#c9aabd', weave: '#bf9eb2', edge: '#a07890', accent: '#a85d8a' },
    { carpet: '#d6c597', weave: '#ccba8a', edge: '#ab9761', accent: '#c9a227' },
    { carpet: '#b0a9d0', weave: '#a59dc6', edge: '#8278ad', accent: '#6b5fb5' },
    { carpet: '#9cc4c6', weave: '#90babc', edge: '#679c9f', accent: '#3e9aa3' },
    { carpet: '#d4ab9c', weave: '#caa090', edge: '#a87a69', accent: '#c4573b' },
    { carpet: '#b3bbc2', weave: '#a8b1b8', edge: '#848e97', accent: '#7a8b99' },
  ];

  function drawSpaceAreas(ctx, world) {
    for (const area of world.spaceAreas) {
      const style = SPACE_CARPETS[area.colorIndex % SPACE_CARPETS.length];
      const x = area.x * TILE + 6;
      const y = area.y * TILE + 10;
      const w = area.w * TILE - 12;
      const h = area.h * TILE - 18;

      ctx.fillStyle = style.edge;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = style.carpet;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = style.weave;
      ctx.globalAlpha = 0.45;
      for (let row = 0; row * 8 < h - 6; row++) {
        for (let col = row % 2; col * 8 < w - 6; col += 2) {
          ctx.fillRect(x + 3 + col * 8, y + 3 + row * 8, Math.min(8, w - 6 - col * 8), Math.min(8, h - 6 - row * 8));
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawSpaceSigns(ctx, world) {
    for (const area of world.spaceAreas) {
      const style = SPACE_CARPETS[area.colorIndex % SPACE_CARPETS.length];
      const x = area.x * TILE + 6;
      const panelTop = area.y * TILE + 6;
      if (!area.label) continue;
      ctx.save();
      ctx.font = '700 12px -apple-system, system-ui, sans-serif';
      const plateWidth = ctx.measureText(area.label).width + 22;
      const plateX = x + 10;
      const plateY = panelTop - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, plateX + 1.5, plateY + 2, plateWidth, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#2b2f36';
      roundRect(ctx, plateX, plateY, plateWidth, 18, 3);
      ctx.fill();
      ctx.fillStyle = style.accent;
      ctx.fillRect(plateX + 4, plateY + 4, 4, 10);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(area.label, plateX + 13, plateY + 9.5);
      ctx.restore();
    }
  }

  function drawPartitions(ctx, world) {
    for (const part of world.partitions) {
      if (part.kind === 'back') {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(part.x, part.y + 7, part.w, 3);
        ctx.fillStyle = '#d9d4cb';
        ctx.fillRect(part.x, part.y, part.w, 7);
        ctx.fillStyle = '#9b958b';
        ctx.fillRect(part.x, part.y, part.w, 2);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(part.x + 4, part.y + 7, 3, part.h - 4);
        ctx.fillStyle = '#d9d4cb';
        ctx.fillRect(part.x, part.y, 4, part.h);
        ctx.fillStyle = '#9b958b';
        ctx.fillRect(part.x, part.y, 1.5, part.h);
      }
    }
  }

  function drawDecor(ctx, item) {
    const x = item.x * TILE;
    const y = item.y * TILE;
    const w = item.w * TILE;
    const h = item.h * TILE;
    switch (item.kind) {
      case 'rug':
        if (item.legend) {
          drawLegendRug(ctx, item);
          break;
        }
        if (item.poster) {
          drawPosterRug(ctx, item);
          break;
        }
        if (item.help) {
          drawHelpRug(ctx, item);
          break;
        }
        ctx.fillStyle = 'rgba(140,60,50,0.35)';
        roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 8);
        ctx.fill();
        break;
      case 'plant': {
        const anchorX = x + 16;
        const anchorY = y + 29;
        ctx.translate(anchorX, anchorY);
        ctx.scale(PLANT_SCALE, PLANT_SCALE);
        ctx.translate(-anchorX, -anchorY);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 29, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        const pot = ctx.createLinearGradient(x + 9, 0, x + 23, 0);
        pot.addColorStop(0, '#c97a4f');
        pot.addColorStop(1, '#8f4f2e');
        ctx.fillStyle = pot;
        ctx.beginPath();
        ctx.moveTo(x + 9, y + 18);
        ctx.lineTo(x + 23, y + 18);
        ctx.lineTo(x + 21, y + 29);
        ctx.lineTo(x + 11, y + 29);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#a85f39';
        ctx.fillRect(x + 8, y + 16, 16, 3);
        const leaves = [[16, 6, 0], [9, 11, -0.9], [23, 11, 0.9], [12, 4, -0.4], [20, 4, 0.4], [16, 12, 0]];
        leaves.forEach(([lx, ly, angle], index) => {
          ctx.fillStyle = index % 2 ? '#3f8f4f' : '#56a863';
          ctx.beginPath();
          ctx.ellipse(x + lx, y + ly + 4, 3.2, 7, angle, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      case 'shelf':
      case 'bookcase':
        ctx.fillStyle = '#6b4a32';
        ctx.fillRect(x + 1, y + 2, w - 2, h - 4);
        for (let i = 0; i < item.w * 4; i++) {
          ctx.fillStyle = ['#c0504d', '#4f81bd', '#9bbb59', '#f2c94c', '#8064a2'][i % 5];
          ctx.fillRect(x + 4 + i * 7, y + 6, 5, 18);
        }
        break;
      case 'sofa':
        drawSofa(ctx, item, x, y, w, h);
        break;
      case 'fridge':
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 4, y + h - 3, w - 8, 3);
        ctx.fillStyle = '#eef0f2';
        roundRect(ctx, x + 4, y + 1, w - 8, h - 3, 3);
        ctx.fill();
        ctx.strokeStyle = '#b8bec6';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 12);
        ctx.lineTo(x + w - 4, y + 12);
        ctx.stroke();
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(x + w - 9, y + 4, 2, 6);
        ctx.fillRect(x + w - 9, y + 15, 2, 9);
        for (const [mx, my, color] of [[9, 17, '#ef4444'], [13, 22, '#3b82f6'], [11, 5, '#22c55e']]) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + mx, y + my, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'counter': {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, y + h - 3, w, 4);
        ctx.fillStyle = '#e9e4da';
        roundRect(ctx, x, y + 2, w, h - 4, 3);
        ctx.fill();
        ctx.fillStyle = '#cfc7b8';
        ctx.fillRect(x, y + h - 8, w, 6);
        for (let i = 0; i < item.w; i++) {
          ctx.strokeStyle = '#b6ad9c';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + i * TILE + 3, y + h - 8, TILE - 6, 5);
        }
        ctx.fillStyle = '#9fb3c8';
        roundRect(ctx, x + TILE + 6, y + 6, 20, 13, 4);
        ctx.fill();
        ctx.fillStyle = '#8a9aab';
        ctx.fillRect(x + TILE + 15, y + 3, 2, 5);
        ctx.fillStyle = '#2b2f36';
        roundRect(ctx, x + 3 * TILE + 4, y + 5, 24, 15, 2);
        ctx.fill();
        ctx.strokeStyle = '#596170';
        for (const [bx, by] of [[10, 9], [22, 9], [10, 16], [22, 16]]) {
          ctx.beginPath();
          ctx.arc(x + 3 * TILE + bx, y + by, 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#2b2f36';
        roundRect(ctx, x + 5 * TILE + 6, y, 18, 20, 3);
        ctx.fill();
        ctx.fillStyle = '#9ae6b4';
        ctx.fillRect(x + 5 * TILE + 10, y + 4, 4, 2);
        ctx.fillStyle = '#f8fafc';
        roundRect(ctx, x + 5 * TILE + 11, y + 12, 7, 6, 1.5);
        ctx.fill();
        break;
      }
      case 'island':
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        roundRect(ctx, x + 3, y + 6, w - 2, h - 4, 4);
        ctx.fill();
        woodTop(ctx, x + 1, y + 3, w - 2, h - 8, '#efe9df', '#d9d0c1');
        ctx.fillStyle = '#b9ac97';
        ctx.fillRect(x + 1, y + h - 6, w - 2, 3);
        ctx.fillStyle = '#d64545';
        ctx.beginPath();
        ctx.arc(x + 20, y + 14, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.arc(x + 28, y + 13, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        roundRect(ctx, x + w - 30, y + 9, 7, 6, 1.5);
        ctx.fill();
        break;
      case 'stool':
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 20, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(x + 15, y + 12, 2, 8);
        ctx.fillStyle = '#c2410c';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 11, 6.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(x + 15, y + 10, 3.5, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'cafetable':
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x + 17, y + 22, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(x + 15, y + 14, 3, 8);
        ctx.fillStyle = '#c49a6c';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 13, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9c7449';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        roundRect(ctx, x + 10, y + 9, 6, 5, 1.5);
        ctx.fill();
        break;
      case 'armchair': {
        const facesRight = item.back === 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        roundRect(ctx, x + 3, y + 5, w - 4, h - 4, 6);
        ctx.fill();
        ctx.fillStyle = '#2f6f73';
        roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
        ctx.fill();
        ctx.fillStyle = '#245a5d';
        roundRect(ctx, facesRight ? x + 2 : x + w - 10, y + 2, 8, h - 4, 5);
        ctx.fill();
        ctx.fillStyle = '#3e8a8f';
        roundRect(ctx, facesRight ? x + 10 : x + 5, y + 7, w - 17, h - 14, 4);
        ctx.fill();
        break;
      }
      case 'beanbag':
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.beginPath();
        ctx.ellipse(x + 17, y + 22, 13, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = item.x % 2 ? '#d97757' : '#e3b23c';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 13, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(x + 13, y + 12, 6, 3.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'watercooler':
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.fillRect(x + 8, y + 26, 16, 4);
        ctx.fillStyle = '#e5e7eb';
        roundRect(ctx, x + 9, y + 12, 14, 16, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(147,197,253,0.85)';
        roundRect(ctx, x + 10, y, 12, 13, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + 12, y + 2, 2, 8);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x + 12, y + 17, 3, 2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x + 17, y + 17, 3, 2);
        break;
      case 'cabinet':
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(x + 3, y + 1, w - 6, h - 3);
        ctx.fillStyle = '#9ca3af';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 6, y + 4 + i * 9, w - 12, 7);
        ctx.fillStyle = '#4b5563';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + w / 2 - 3, y + 7 + i * 9, 6, 1.5);
        ctx.fillStyle = '#b91c1c';
        ctx.font = '900 9px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X', x + w / 2 + 8, y + 8);
        break;
      case 'corkboard': {
        ctx.fillStyle = '#a0703f';
        ctx.fillRect(x + 4, y + 6, w - 8, h - 8);
        ctx.strokeStyle = '#6b4423';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 6, w - 8, h - 8);
        const pins = [[14, 12], [38, 22], [60, 11], [80, 21], [26, 24], [70, 26]];
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + pins[0][0], y + pins[0][1]);
        for (const [px, py] of [pins[1], pins[2], pins[3], pins[5], pins[4], pins[0]]) ctx.lineTo(x + px, y + py);
        ctx.stroke();
        pins.forEach(([px, py], index) => {
          ctx.fillStyle = index % 2 ? '#f8fafc' : '#fef3c7';
          ctx.fillRect(x + px - 4, y + py - 3, 8, 6);
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(x + px, y + py - 3, 1.3, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      case 'whiteboard':
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 2, y + 6, w - 4, h - 12);
        ctx.strokeStyle = '#64748b';
        ctx.strokeRect(x + 2, y + 6, w - 4, h - 12);
        ctx.strokeStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 16);
        ctx.lineTo(x + 50, y + 12);
        ctx.lineTo(x + 80, y + 20);
        ctx.stroke();
        break;
      default:
        break;
    }
  }

  function drawSofa(ctx, item, x, y, w, h) {
    const base = '#7c4d8f';
    const cushion = '#9a6aab';
    const back = item.back || 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    roundRect(ctx, x + 3, y + 5, w - 4, h - 5, 7);
    ctx.fill();
    ctx.fillStyle = base;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 5, 7);
    ctx.fill();
    const vertical = back === 'left' || back === 'right';
    let cx;
    let cy;
    let cw;
    let ch;
    if (!vertical) {
      cx = x + 8;
      cw = w - 16;
      cy = back === 'top' ? y + 11 : y + 5;
      ch = h - 5 - 13;
    } else {
      cy = y + 8;
      ch = h - 16;
      cx = back === 'left' ? x + 11 : x + 5;
      cw = w - 4 - 13;
    }
    ctx.fillStyle = shade(base, -18);
    if (back === 'top') roundRect(ctx, x + 2, y + 2, w - 4, 9, 6);
    else if (back === 'bottom') roundRect(ctx, x + 2, y + h - 12, w - 4, 9, 6);
    else if (back === 'left') roundRect(ctx, x + 2, y + 2, 9, h - 5, 6);
    else roundRect(ctx, x + w - 11, y + 2, 9, h - 5, 6);
    ctx.fill();
    ctx.fillStyle = cushion;
    const parts = Math.max(1, Math.round((vertical ? ch : cw) / 30));
    for (let i = 0; i < parts; i++) {
      if (!vertical) roundRect(ctx, cx + (i * cw) / parts + 1, cy, cw / parts - 2, ch, 4);
      else roundRect(ctx, cx, cy + (i * ch) / parts + 1, cw, ch / parts - 2, 4);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    if (!vertical) ctx.fillRect(cx + 2, cy + 1, cw - 4, 2);
    else ctx.fillRect(cx + 1, cy + 2, 2, ch - 4);
  }

  function woodTop(ctx, x, y, w, h, light, dark) {
    const top = ctx.createLinearGradient(0, y, 0, y + h);
    top.addColorStop(0, light);
    top.addColorStop(1, dark);
    ctx.fillStyle = top;
    roundRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 1.5);
    ctx.lineTo(x + w - 3, y + 1.5);
    ctx.stroke();
  }

  function deskProp(desk) {
    return ((desk.x * 73856093) ^ (desk.y * 19349663)) >>> 0;
  }

  function drawDesk(ctx, desk, agent, time) {
    const anchorX = desk.x * TILE + TILE;
    const anchorY = desk.y * TILE + TILE;
    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.scale(FIGURE_SCALE, FIGURE_SCALE);
    ctx.translate(-anchorX, -anchorY);
    drawDeskBody(ctx, desk, agent, time);
    ctx.restore();
  }

  function drawDeskBody(ctx, desk, agent, time) {
    const x = desk.x * TILE;
    const y = desk.y * TILE;
    const w = TILE * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    roundRect(ctx, x + 3, y + 9, w - 2, TILE - 6, 4);
    ctx.fill();
    ctx.fillStyle = '#6e4a2f';
    ctx.fillRect(x + 3, y + TILE - 7, 3, 6);
    ctx.fillRect(x + w - 6, y + TILE - 7, 3, 6);
    woodTop(ctx, x + 1, y + 6, w - 2, TILE - 11, '#c08c5f', '#a06d45');
    ctx.fillStyle = '#7f5435';
    ctx.fillRect(x + 1, y + TILE - 6, w - 2, 3);

    let screen = '#151b26';
    if (agent) {
      if (agent.status === 'working') screen = `hsl(150, 55%, ${30 + 8 * Math.sin(time / 300)}%)`;
      else if (agent.status === 'blocked') screen = '#b4471a';
      else if (agent.status === 'done') screen = '#2456c9';
      else screen = '#2a3446';
    }
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x + 31, y + 14, 3, 5);
    ctx.beginPath();
    ctx.ellipse(x + 32.5, y + 19, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1f26';
    roundRect(ctx, x + 18, y, 29, 16, 2.5);
    ctx.fill();
    ctx.save();
    if (agent && agent.status !== 'idle') {
      ctx.shadowColor = screen;
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = screen;
    roundRect(ctx, x + 20, y + 2, 25, 11.5, 1.5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 20, y + 2, 25, 4);
    if (agent && agent.status === 'working') {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 3; i++) {
        const width = 6 + ((Math.floor(time / 200) + i * 7) % 11);
        ctx.fillRect(x + 22, y + 4 + i * 3, width, 1.4);
      }
    }
    ctx.fillStyle = '#d4d7dc';
    roundRect(ctx, x + 22, y + 20, 19, 4, 1);
    ctx.fill();
    ctx.fillStyle = '#e8eaee';
    ctx.beginPath();
    ctx.ellipse(x + 45, y + 22, 2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    const prop = deskProp(desk) % 4;
    if (prop === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(x + 9, y + 15, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b3f22';
      ctx.beginPath();
      ctx.arc(x + 9, y + 15, 2.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop === 1) {
      ctx.fillStyle = '#c97a4f';
      ctx.fillRect(x + 6, y + 13, 6, 6);
      ctx.fillStyle = '#56a863';
      ctx.beginPath();
      ctx.arc(x + 9, y + 11, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop === 2) {
      ctx.fillStyle = '#f8fafc';
      ctx.save();
      ctx.translate(x + 9, y + 15);
      ctx.rotate(-0.2);
      ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-3.5, -2, 7, 1);
      ctx.fillRect(-3.5, 0.5, 5, 1);
      ctx.restore();
    }
  }

  function drawBossDesk(ctx, world) {
    const { bossDesk } = world;
    const x = bossDesk.x * TILE;
    const y = bossDesk.y * TILE;
    const w = bossDesk.w * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, x + 4, y + 8, w, TILE - 4, 5);
    ctx.fill();
    woodTop(ctx, x, y + 3, w, TILE - 7, '#7a5236', '#5a3c26');
    ctx.fillStyle = '#4a311f';
    ctx.fillRect(x, y + TILE - 5, w, 4);
    ctx.fillStyle = '#1c1f26';
    roundRect(ctx, x + 50, y - 2, 30, 17, 2.5);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = '#d97757';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#d97757';
    roundRect(ctx, x + 52, y, 26, 12.5, 1.5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x + 63.5, y + 15, 3, 4);
    ctx.fillStyle = '#f8fafc';
    ctx.save();
    ctx.translate(x + 118, y + 15);
    ctx.rotate(0.15);
    ctx.fillRect(-9, -6, 18, 12);
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 3; i++) ctx.fillRect(-6, -3 + i * 3, 11 - i * 2, 1);
    ctx.restore();
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(x + 18, y + 6, 2, 12);
    ctx.save();
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 8);
    ctx.lineTo(x + 26, y + 8);
    ctx.lineTo(x + 22, y + 1);
    ctx.lineTo(x + 16, y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMeetingTable(ctx, world) {
    drawTable(ctx, world.meetingTable);
  }

  function drawTable(ctx, { x, y, w, h }) {
    const left = x * TILE + 2;
    const top = y * TILE + 2;
    const width = w * TILE - 4;
    const height = h * TILE - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    roundRect(ctx, left + 3, top + 5, width, height, Math.min(16, height / 2));
    ctx.fill();
    const wood = ctx.createLinearGradient(0, top, 0, top + height);
    wood.addColorStop(0, '#e2cfa9');
    wood.addColorStop(1, '#c9b083');
    ctx.fillStyle = wood;
    roundRect(ctx, left, top, width, height, Math.min(16, height / 2));
    ctx.fill();
    ctx.strokeStyle = '#a88e62';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, left + 12, top + 8, width - 24, 8, 4);
    ctx.fill();
    for (const offset of w > 3 ? [0.25, 0.5, 0.75] : [0.5]) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(left + width * offset - 6, top + height / 2 - 4, 12, 9);
    }
  }

  function drawRoomSigns(ctx, world, scale) {
    ctx.save();
    ctx.font = `600 ${10 / scale}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const sign of world.signs) {
      const x = sign.x * TILE;
      const y = sign.y * TILE;
      {
        const width = ctx.measureText(sign.text).width + 14 / scale;
        const height = 16 / scale;
        ctx.fillStyle = 'rgba(20,22,28,0.85)';
        roundRect(ctx, x - width / 2, y - height / 2, width, height, 4 / scale);
        ctx.fill();
      }
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(sign.text, x, y);
    }
    ctx.restore();
  }

  function drawUfo(ctx, x, y, time, beamTo, beamAlpha) {
    if (beamTo !== null && beamAlpha > 0) {
      const flicker = 0.85 + 0.15 * Math.sin(time / 40);
      const gradient = ctx.createLinearGradient(0, y, 0, beamTo);
      gradient.addColorStop(0, `rgba(190,255,190,${0.55 * beamAlpha * flicker})`);
      gradient.addColorStop(1, `rgba(190,255,190,${0.12 * beamAlpha * flicker})`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 4);
      ctx.lineTo(x + 9, y + 4);
      ctx.lineTo(x + 22, beamTo);
      ctx.lineTo(x - 22, beamTo);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(190,255,190,${0.35 * beamAlpha})`;
      ctx.beginPath();
      ctx.ellipse(x, beamTo, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(186,230,253,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 8, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, 20, 3.5, 0, 0, Math.PI);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(time / 150 + i) % 2 === 0;
      ctx.fillStyle = on ? '#fde047' : '#a16207';
      ctx.beginPath();
      ctx.arc(x - 14 + i * 7, y + 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, v));
    const r = clamp((value >> 16) + amount);
    const g = clamp(((value >> 8) & 0xff) + amount);
    const b = clamp((value & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  window.Sprites = {
    STATUS_COLORS,
    looksFromSeed,
    drawCharacter,
    drawChair,
    chairBackInFront,
    drawLabel,
    drawBubble,
    drawZzz,
    drawFloorAndWalls,
    drawGlassWalls,
    drawTable,
    drawUfo,
    drawSpaceAreas,
    drawPartitions,
    drawSpaceSigns,
    drawDecor,
    drawDesk,
    drawBossDesk,
    drawMeetingTable,
    drawRoomSigns,
    setLegendCounts,
    drawDeskRug,
    drawEmptyCubicle,
    drawPlayerMarker,
  };
})();
