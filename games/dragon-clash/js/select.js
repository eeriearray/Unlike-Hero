/*
 * Dragon Select — before every Versus match, each player picks a dragon and its loadout, Tekken-style.
 * Every human player drives their own panel with their own controls (keyboard layout or gamepad):
 *   up / down   choose a row (Dragon, Size, Instinct, Ability, Ready)
 *   left/right  change it (options you can't afford with the 30 gear points are skipped)
 *   light/jump  confirm (ready)      heavy  back (unready)
 * Mouse works on every arrow too. Gear changes how the dragon fights; Build.validateBuild checks it like any build.
 */
(function () {
  'use strict';
  var App = window.DCApp, D = window.DC.Data, Build = window.DC.Build, Input = window.DCInput, Audio = window.DCAudio;
  var B = window.DC.Sim.BTN;
  var esc = App.esc;

  // Palettes, only used to tell identical dragons apart on opposing teams. 'Original' keeps the build's own colours.
  var PALETTES = [
    { name: 'Original' },
    { name: 'Crimson',  tint: 'crimson', primary: '#b8261c', secondary: '#ffc14a', belly: '#ff9a6a', eye: '#ffe14a' },
    { name: 'Obsidian', shade: 'shadow', primary: '#2a2a36', secondary: '#9a6bff', belly: '#5a5a70', eye: '#c89aff' },
    { name: 'Jade',     tint: 'jade', primary: '#2f8a5a', secondary: '#e8d68a', belly: '#9fd8a6', eye: '#ffe96a' },
    { name: 'Azure',    tint: 'azure', primary: '#2a6ad8', secondary: '#dff4ff', belly: '#9cc8ff', eye: '#bff6ff' },
    { name: 'Gilded',   shade: 'gilded', primary: '#c8962a', secondary: '#fff1b0', belly: '#ffdc8a', eye: '#ff6a3a' },
    { name: 'Violet',   tint: 'violet', primary: '#6a2a9a', secondary: '#ff8ad8', belly: '#c08ae8', eye: '#ffd1f4' },
    { name: 'Ashen',    shade: 'bone', primary: '#8a8a94', secondary: '#2a2a30', belly: '#d0d0d8', eye: '#ff3b3b' },
  ];
  var ROWS = ['dragon', 'size', 'instinct', 'ability', 'ready'];
  var ROW_LABEL = { dragon: 'Dragon', size: 'Size', instinct: 'Instinct', ability: 'Ability', ready: 'Ready' };
  var TABLE = { size: D.SIZES, instinct: D.INSTINCTS, ability: D.GEAR_ABILITIES };

  function roster() { return App.presets().concat(App.myBuilds()); }

  /** The build a player ends up with: the picked dragon wearing their loadout. */
  function composeBuild(p) {
    var base = Build.withGear(p.roster[p.pick], p.gear);
    var pal = PALETTES[p.palette];
    if (pal.primary) ['primary', 'secondary', 'belly', 'eye'].forEach(function (k) { base.look[k] = pal[k]; });
    // HD dragons show the palette as a recolour (the rig colours above don't apply to painted sprites)
    if (pal.tint) base.look.tint = pal.tint;
    if (pal.shade) base.look.shade = pal.shade;
    return base;
  }

  function gearCostOf(p, gear) { return Build.gearCost(Build.withGear(p.roster[p.pick], gear)); }

  /** A new dragon starts bare at its own size (the instinct is kept: it is the player's style, not the dragon's). */
  function adoptLook(p) {
    var b = p.roster[p.pick];
    p.gear = { size: Build.sizeOf(b.body), instinct: (p.gear && p.gear.instinct) || 'fury', ability: 'none' };
    p.palette = 0;
  }

  /** Step a gear slot, skipping options the 30 points can't cover with the rest of the loadout. */
  function stepGear(p, key, dir) {
    var opts = Object.keys(TABLE[key]), k = opts.indexOf(p.gear[key]);
    for (var n = 1; n < opts.length; n++) {
      var g = Object.assign({}, p.gear); g[key] = opts[(k + dir * n + opts.length * n) % opts.length];
      if (gearCostOf(p, g) <= D.GEAR_BUDGET) { p.gear = g; return true; }
    }
    return false;
  }

  /** A random loadout that fits the budget (CPU players). */
  function randomGear(p) {
    var pick = function (t) { var o = Object.keys(t); return o[Math.floor(Math.random() * o.length)]; };
    for (var tries = 0; tries < 40; tries++) {
      var g = { size: Math.random() < 0.6 ? p.gear.size : pick(D.SIZES), instinct: pick(D.INSTINCTS), ability: pick(D.GEAR_ABILITIES) };
      if (gearCostOf(p, g) <= D.GEAR_BUDGET) { p.gear = g; return; }
    }
  }

  /**
   * arg: { slots: [{ ctrl, build, team, label }], onReady(builds[]), onBack() }
   * Returns builds in slot order.
   */
  App.screens.select = {
    enter: function (arg) {
      var R = roster();
      var players = arg.slots.map(function (s, i) {
        var idx = Math.max(0, R.map(function (b) { return b.id; }).indexOf(s.build));
        var cpu = s.ctrl.indexOf('cpu') === 0;
        if (cpu && !s.keep) idx = Math.floor(Math.random() * App.presets().length);
        var p = { i: i, ctrl: s.ctrl, cpu: cpu, team: s.team, label: s.label, roster: R, pick: idx, row: 0, ready: cpu, prev: 0 };
        adoptLook(p);
        if (s.gear && gearCostOf(p, s.gear) <= D.GEAR_BUDGET && Build.validateBuild(Build.withGear(R[idx], s.gear)).ok) p.gear = Object.assign({}, s.gear);
        else if (cpu && !s.keep) randomGear(p);
        return p;
      });
      var alive = true, raf = 0;
      Audio.init();
      setTimeout(function () { Audio.voice('vChampion'); }, 250);

      function change(p, row, dir) {
        if (p.ready) return;
        var key = ROWS[row];
        if (key === 'dragon') { p.pick = (p.pick + dir + R.length) % R.length; keepGear(p); }
        else if (TABLE[key]) { if (!stepGear(p, key, dir)) { Audio.play('denied'); return; } }
        else if (key === 'ready') { p.ready = true; Audio.play('select'); checkDone(); render(); return; }
        Audio.play('ui');
        render();
      }

      // Switching dragons keeps the loadout when it still fits, else starts bare
      function keepGear(p) {
        var g = p.gear;
        adoptLook(p);
        var kept = { size: p.gear.size, instinct: g.instinct, ability: g.ability };
        if (gearCostOf(p, kept) <= D.GEAR_BUDGET) p.gear = kept;
      }

      function checkDone() {
        if (!players.every(function (p) { return p.ready; })) return;
        alive = false;
        cancelAnimationFrame(raf);
        var builds = players.map(composeBuild);
        // Mirror match: identical dragon and colours on opposing teams get told apart by palette
        for (var a = 0; a < players.length; a++) for (var b = a + 1; b < players.length; b++) {
          if (players[a].team === players[b].team) continue;
          if (JSON.stringify(builds[a].look) === JSON.stringify(builds[b].look)) {
            players[b].palette = (players[b].palette + 4) % PALETTES.length || 1;
            builds[b] = composeBuild(players[b]);
          }
        }
        builds.forEach(function (bd) { if (!Build.validateBuild(bd).ok) throw new Error('Invalid pick'); });
        var picks = players.map(function (p) { return { build: p.roster[p.pick].id, gear: Object.assign({}, p.gear) }; });
        setTimeout(function () { arg.onReady(builds, picks); }, 350);
      }

      // One action for a player: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back'
      function act(p, a) {
        if (a === 'confirm') { if (!p.ready) { p.row = ROWS.indexOf('ready'); change(p, p.row, 1); } return; }
        if (a === 'back') {
          if (p.ready) { p.ready = false; Audio.play('uiBack'); render(); }
          else if (p.row > 0) { p.row = 0; render(); }
          else if (players.filter(function (q) { return !q.cpu; })[0] === p) { alive = false; arg.onBack(); }
          return;
        }
        if (p.ready) return;
        if (a === 'up' || a === 'down') { p.row = (p.row + (a === 'up' ? ROWS.length - 1 : 1)) % ROWS.length; Audio.play('ui'); render(); }
        else change(p, p.row, a === 'left' ? -1 : 1);
      }
      var ACT = { up: 'up', down: 'down', left: 'left', right: 'right', light: 'confirm', jump: 'confirm', heavy: 'back', dodge: 'back' };

      // Keyboards: every keydown counts, so quick taps are never missed whatever the frame rate
      function onKey(e) {
        if (!alive || App.screen !== 'select' || e.repeat) return;
        var binds = Input.binds(), soloKb1 = !players.some(function (q) { return q.ctrl === 'kb2'; });
        players.forEach(function (p) {
          if (p.cpu) return;
          var pBinds = binds[p.ctrl] || (p.ctrl === 'touch' ? binds.kb1 : null);
          if (!pBinds) return;
          for (var name in ACT) {
            var codes = pBinds[name] || [];
            var alt = (p.ctrl === 'kb1' || p.ctrl === 'touch') && soloKb1 && { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[name];
            if (codes.indexOf(e.code) >= 0 || e.code === alt) { e.preventDefault(); act(p, ACT[name]); return; }
          }
        });
      }

      // Gamepads have no events: poll them, edge-triggered
      function poll() {
        if (!alive || App.screen !== 'select') return;
        players.forEach(function (p) {
          if (p.cpu || p.ctrl.indexOf('pad') !== 0) return;
          var h = Input.read(p.ctrl), pr = h & ~p.prev;
          p.prev = h;
          if (pr & (B.light | B.jump)) act(p, 'confirm');
          else if (pr & (B.heavy | B.dodge)) act(p, 'back');
          else if (pr & B.up) act(p, 'up');
          else if (pr & B.down) act(p, 'down');
          else if (pr & B.left) act(p, 'left');
          else if (pr & B.right) act(p, 'right');
        });
        raf = requestAnimationFrame(poll);
      }

      function valueOf(p, key) {
        var b = p.roster[p.pick];
        if (key === 'dragon') return b.name;
        if (key === 'ready') return p.ready ? 'READY!' : (p.ctrl === 'touch' && window.DCTouch && window.DCTouch.isTouchDevice()) ? 'Tap here when ready' : 'Press ' + confirmKey(p) + ' when ready';
        return TABLE[key][p.gear[key]].name;
      }

      function iconOf(p, key) {
        if (key === 'dragon') return App.elIcon(p.roster[p.pick].element, 16);
        if (key === 'ready') return '';
        return window.DCIcons.svg(TABLE[key][p.gear[key]].icon, key === 'instinct' ? '#ffcf3a' : '#d8d0f0', 16);
      }

      // Points an option costs (size: growth over the dragon's own frame)
      function costOf(p, key) {
        if (key === 'size') { var one = { size: p.gear.size, instinct: p.gear.instinct, ability: 'none' }; return gearCostOf(p, one); }
        return TABLE[key][p.gear[key]].cost || 0;
      }

      function describe(p) {
        var key = ROWS[p.row];
        if (key === 'dragon') { var b = p.roster[p.pick]; return D.SIGNATURES[b.signature].name + ' · ' + D.ABILITIES[b.ability].name; }
        if (TABLE[key]) return TABLE[key][p.gear[key]].desc + (key === 'ability' && p.gear.ability !== 'none' ? ' Key: ' + gearKey(p) + '.' : '');
        return 'Ready when you are.';
      }

      function gearKey(p) {
        if (p.ctrl.indexOf('pad') === 0) return 'LB';
        var bd = Input.binds()[p.ctrl] || Input.binds().kb1;
        return bd && bd.gear ? Input.keyName(bd.gear[0]) : 'gear';
      }

      function confirmKey(p) {
        if (p.ctrl === 'touch' && window.DCTouch && window.DCTouch.isTouchDevice()) return 'tap here';
        if (p.ctrl.indexOf('pad') === 0) return 'A';
        var bd = Input.binds()[p.ctrl] || Input.binds().kb1;
        return bd ? Input.keyName(bd.light[0]) : 'light';
      }

      function render() {
        if (App.screen !== 'select') return;
        var html = '<div class="screen select-screen"><div class="topbar"><button class="btn ghost small" data-act="back">← Back</button>' +
          '<h1>Choose your dragons</h1><div class="spacer"></div><div class="dim">Pick with your own controls: ↑↓ row · ←→ change · light to ready · heavy back</div></div>' +
          '<div class="select-panels">' + players.map(function (p) {
            var b = composeBuild(p), col = D.TEAM_COLORS[p.team % 4], el = D.ELEMENTS[b.element];
            var s = Build.statBars(b), stats = ['power', 'durability', 'speed', 'air', 'range'].map(function (k) {
              return '<span class="sp-stat">' + k.slice(0, 3) + '<i style="width:' + s[k] * 20 + '%"></i></span>';
            }).join('');
            var used = Build.gearCost(b), left = D.GEAR_BUDGET - used;
            var meter = '<div class="sp-budget"><span>Gear</span><div class="sp-meter"><i style="width:' + Math.round(used / D.GEAR_BUDGET * 100) + '%"></i></div><b>' + used + ' / ' + D.GEAR_BUDGET + '</b></div>';
            return '<div class="sp' + (p.ready ? ' ready' : '') + '" style="--team:' + col + '">' +
              '<div class="sp-head"><b>' + esc(p.label) + '</b><span class="dim">' + (p.cpu ? 'CPU' : esc(Input.DEVICE_NAMES[p.ctrl] || p.ctrl)) + '</span></div>' +
              '<div class="sp-stage"><canvas data-sel="' + p.i + '"></canvas><div class="sp-elem">' + App.elIcon(b.element, 16) + ' ' + el.name + '</div>' + (p.ready ? '<div class="sp-ready">READY</div>' : '') + '</div>' +
              '<div class="sp-stats">' + stats + '</div>' + meter +
              (p.cpu ? '<div class="sp-cpu">' + ROWS.slice(1, 4).map(function (key) { return '<span title="' + esc(ROW_LABEL[key]) + '">' + iconOf(p, key) + ' ' + esc(valueOf(p, key)) + '</span>'; }).join('') + '</div>' : ROWS.map(function (key, r) {
                var arrows = key !== 'ready';
                return '<div class="sp-row' + (p.row === r && !p.ready ? ' on' : '') + (key === 'ready' ? ' sp-go' : '') + '" data-act="row" data-p="' + p.i + '" data-r="' + r + '">' +
                  '<span class="sp-label">' + ROW_LABEL[key] + '</span>' +
                  (arrows ? '<button class="sp-arrow" data-act="prev" data-p="' + p.i + '" data-r="' + r + '">◀</button>' : '') +
                  '<span class="sp-val">' + iconOf(p, key) + ' ' + esc(valueOf(p, key)) + (TABLE[key] && costOf(p, key) ? ' <em>' + costOf(p, key) + '</em>' : '') + '</span>' +
                  (arrows ? '<button class="sp-arrow" data-act="next" data-p="' + p.i + '" data-r="' + r + '">▶</button>' : '') + '</div>';
              }).join('') + '<div class="sp-desc">' + esc(describe(p)) + (left > 0 && !p.ready ? ' <span class="dim">' + left + (left === 1 ? ' point' : ' points') + ' left.</span>' : '') + '</div>') + '</div>';
          }).join('') + '</div>' +
          '<div class="select-roster">' + R.map(function (b, k) {
            var marks = players.filter(function (p) { return !p.cpu && p.pick === k; }).map(function (p) { return '<i style="background:' + D.TEAM_COLORS[p.team % 4] + '">' + esc(p.label) + '</i>'; }).join('');
            return '<button class="sr' + (marks ? ' on' : '') + '" data-act="pick" data-k="' + k + '"><canvas data-ros="' + k + '"></canvas><span>' + App.elIcon(b.element, 15) + ' ' + esc(b.name) + '</span><div class="sr-marks">' + marks + '</div></button>';
          }).join('') + '</div></div>';
        App.ui.innerHTML = html;
        players.forEach(function (p) { App.mini(App.ui.querySelector('[data-sel="' + p.i + '"]'), composeBuild(p), p.ready ? 'victory' : 'idle', { scale: 1.65, facing: p.team % 2 ? -1 : 1, offset: p.i, hd: true }); });
        R.forEach(function (b, k) { App.mini(App.ui.querySelector('[data-ros="' + k + '"]'), b, 'idle', { scale: 1.2, offset: k * 0.7 }); });
      }

      var firstHuman = function () { return players.filter(function (p) { return !p.cpu && !p.ready; })[0]; };
      App.on(App.ui, {
        back: function () { alive = false; arg.onBack(); },
        prev: function (el, e) { e.stopPropagation(); var p = players[+el.dataset.p]; p.row = +el.dataset.r; change(p, p.row, -1); },
        next: function (el, e) { e.stopPropagation(); var p = players[+el.dataset.p]; p.row = +el.dataset.r; change(p, p.row, 1); },
        row: function (el) { var p = players[+el.dataset.p]; if (p.ready) { p.ready = false; render(); return; } p.row = +el.dataset.r; if (ROWS[p.row] === 'ready') change(p, p.row, 1); else render(); },
        pick: function (el) { var p = firstHuman(); if (!p) return; p.pick = +el.dataset.k; keepGear(p); p.row = 0; render(); },
      });
      var unKey = Input.onKey(function (e) { if (e.code === 'Escape' && App.screen === 'select') { alive = false; arg.onBack(); return; } onKey(e); });
      this.leave = function () { alive = false; cancelAnimationFrame(raf); unKey(); };
      render();
      // Don't let the button press that opened this screen count as a confirm
      players.forEach(function (p) { if (!p.cpu) p.prev = Input.read(p.ctrl); });
      raf = requestAnimationFrame(poll);
    },
  };

  App.PALETTES = PALETTES;
})();
