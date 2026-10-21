/*
 * Dragon Forge — build a dragon: a big animated preview, visual cards, a 100-point budget and live validation.
 * Fighting style (costs points, changes combat) and appearance (free, never changes combat) are separate tabs.
 */
(function () {
  'use strict';
  var App = window.DCApp, D = window.DC.Data, Build = window.DC.Build, Art = window.DCArt, Anim = window.DCAnim;
  var esc = App.esc;

  var PALETTE = ['#d8361c', '#ff7a2f', '#ffb02e', '#ffe14a', '#3c9a3a', '#7fd85a', '#0f8fa0', '#2fd3c8', '#5fb8ff', '#3d5ad8', '#5a3cc8', '#b46aff',
                 '#e84a9a', '#f2f2f2', '#8a6a4a', '#d8c08a', '#4a4a5a', '#1a1a24'];
  var SLOT_COLORS = { body: '#ff7a2f', mobility: '#3de0d0', signature: '#ffcf3a', ability: '#c86aff', upgrade: '#5af08a' };

  App.screens.forge = {
    enter: function (arg) {
      var mine = App.myBuilds();
      var b = arg && arg.build ? JSON.parse(JSON.stringify(arg.build)) : mine[0] ? JSON.parse(JSON.stringify(mine[0])) : newBuild();
      var tab = 'style', pose = 'idle', facing = 1;
      var dirty = false;

      function newBuild() {
        var nb = Build.presetBuild('emberfang');
        nb.id = 'b' + Date.now().toString(36);
        nb.name = 'My Dragon';
        delete nb.preset;
        return nb;
      }

      function render() {
        var v = Build.validateBuild(b);
        var mineNow = App.myBuilds();
        ui().innerHTML =
          '<div class="screen"><div class="topbar">' +
          '<button class="btn ghost small" data-act="back">← Back</button><h1>Dragon Forge</h1><div class="spacer"></div>' +
          '<div class="saved">' + mineNow.map(function (m) { return '<button class="chip' + (m.id === b.id ? ' on' : '') + '" data-act="load" data-id="' + esc(m.id) + '">' + D.ELEMENTS[m.element].icon + ' ' + esc(m.name) + '</button>'; }).join('') +
          '<button class="chip" data-act="new">＋ New</button></div></div>' +
          '<div class="forge">' +
          '<div style="display:grid;gap:12px;align-content:start">' +
          '<div class="stage-card"><canvas data-preview></canvas>' +
          '<div class="elem-badge"><span style="font-size:22px">' + D.ELEMENTS[b.element].icon + '</span>' + D.ELEMENTS[b.element].name + ' · ' + esc(D.BODIES[b.body].name) + '</div>' +
          '<div class="pose-bar">' + [['idle', 'Idle'], ['run', 'Run'], ['jump', 'Jump'], ['light', 'Jab'], ['attack', 'Heavy'], ['special', 'Special'], ['hit', 'Hit'], ['victory', 'Victory']].map(function (p) { return '<button data-act="pose" data-pose="' + p[0] + '" class="' + (p[0] === pose ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') +
          '<button data-act="flip">⇆</button></div></div>' +
          '<div class="panel budget">' + budgetHtml(v) + '</div>' +
          '<div class="panel">' + statsHtml(v) + '</div>' +
          '</div>' +
          '<div class="panel scroll" style="max-height:calc(100vh - 120px)">' +
          '<div class="row"><input class="text grow" maxlength="18" data-name value="' + esc(b.name) + '" placeholder="Name your dragon">' +
          '<button class="btn hot" data-act="save"' + (v.ok ? '' : ' disabled') + '>Save</button>' +
          (mineNow.some(function (m) { return m.id === b.id; }) ? '<button class="btn ghost small" data-act="dup">Copy</button><button class="btn ghost small" data-act="del">Delete</button>' : '') + '</div>' +
          (v.ok ? '<div class="ok-text" style="margin-top:6px">Valid build · ' + v.cost + ' / ' + D.BUDGET + ' points' + (dirty ? ' · unsaved' : '') + '</div>' : '<div class="errors" style="margin-top:6px">' + v.errors.map(esc).join(' ') + '</div>') +
          '<div class="tabs" style="margin-top:12px"><button data-act="tab" data-tab="style" class="' + (tab === 'style' ? 'on' : '') + '">⚔️ Fighting style</button><button data-act="tab" data-tab="look" class="' + (tab === 'look' ? 'on' : '') + '">🎨 Appearance</button></div>' +
          (tab === 'style' ? styleHtml() : lookHtml()) +
          '</div></div></div>';
        var cv = ui().querySelector('[data-preview]');
        App.mini(cv, b, pose, { scale: 1.55, facing: facing });
        var name = ui().querySelector('[data-name]');
        name.addEventListener('input', function () { b.name = name.value; dirty = true; var vv = Build.validateBuild(b); var s = ui().querySelector('[data-act=save]'); if (s) s.disabled = !vv.ok; });
        name.addEventListener('change', render);
        ui().querySelectorAll('input[type=color]').forEach(function (inp) {
          inp.addEventListener('input', function () { b.look[inp.dataset.color] = inp.value; dirty = true; });
          inp.addEventListener('change', render);
        });
      }

      function budgetHtml(v) {
        var rows = Build.costBreakdown(b);
        var over = v.cost > D.BUDGET;
        return '<div class="budget-head"><span>Build points</span><span class="' + (over ? 'over' : '') + '">' + v.cost + ' / ' + D.BUDGET + (over ? ' — over budget' : ' · ' + (D.BUDGET - v.cost) + ' left') + '</span></div>' +
          '<div class="budget-bar">' + rows.map(function (r) { return '<i title="' + esc(r.name) + ' ' + r.cost + '" style="width:' + (r.cost / Math.max(D.BUDGET, v.cost) * 100) + '%;background:' + SLOT_COLORS[r.slot] + '"></i>'; }).join('') + '</div>' +
          '<div class="row dim" style="font-size:12px;gap:10px">' + rows.map(function (r) { return '<span><span class="dot" style="background:' + SLOT_COLORS[r.slot] + '"></span> ' + esc(r.name) + ' ' + r.cost + '</span>'; }).join('') + '</div>';
      }

      function statsHtml(v) {
        if (!v.ok && v.errors.some(function (e) { return /Unknown|match/.test(e); })) return '';
        var s = Build.statBars(b), st = Build.deriveStats(b);
        var row = function (label, n) { return '<span>' + label + '</span><span class="pips">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= n ? 'on' : '') + '"></i>'; }).join('') + '</span>'; };
        return '<div class="row" style="align-items:flex-start"><div class="stats grow">' + row('Power', s.power) + row('Durability', s.durability) + row('Speed', s.speed) + row('Air', s.air) + row('Range', s.range) + '</div>' +
          '<div class="dim" style="font-size:12px;max-width:180px">Weight ' + st.weight + ' · ' + (1 + st.airJumps) + ' jumps' + (st.glide ? ' + glide' : '') + '<br>Signature every ' + (st.sigCd / 60).toFixed(1) + ' s<br>Ability every ' + (st.abilityCd / 60).toFixed(1) + ' s</div></div>';
      }

      function cards(table, slot, filter) {
        return '<div class="cards">' + Object.keys(table).filter(function (k) { return !filter || filter(table[k]); }).map(function (k) {
          var it = table[k];
          return '<button class="card' + (b[slot] === k ? ' on' : '') + '" data-act="pick" data-slot="' + slot + '" data-id="' + k + '"><span class="cost">' + it.cost + '</span><b>' + esc(it.name) + '</b><small>' + esc(it.desc) + '</small></button>';
        }).join('') + '</div>';
      }

      function styleHtml() {
        var el = b.element;
        return '<div class="section-title">Element <small>Beats ' + D.ELEMENTS[D.BEATS[el]].icon + ' ' + D.ELEMENTS[D.BEATS[el]].name + ' · weak to ' + weakTo(el) + ' (elemental damage ±10% only)</small></div>' +
          '<div class="row" style="align-items:center"><div class="cards grow" style="grid-template-columns:repeat(5,1fr)">' +
          D.ELEMENT_ORDER.map(function (e) { var E = D.ELEMENTS[e]; return '<button class="card el' + (el === e ? ' on' : '') + '" data-act="element" data-id="' + e + '" style="' + (el === e ? 'box-shadow:inset 0 0 0 999px ' + Art.alpha(E.color, 0.18) : '') + '"><span class="big">' + E.icon + '</span><b>' + E.name + '</b></button>'; }).join('') +
          '</div><div>' + App.wheel(el, 150) + '</div></div>' +
          '<div class="section-title">Body <small>durability vs size and speed</small></div>' + cards(D.BODIES, 'body') +
          '<div class="section-title">Mobility</div>' + cards(D.MOBILITY, 'mobility') +
          '<div class="section-title">Signature move <small><kbd>L</kbd> / B button</small></div>' + cards(D.SIGNATURES, 'signature', function (s) { return s.element === el; }) +
          '<div class="section-title">Elemental ability <small>Down + <kbd>L</kbd></small></div>' + cards(D.ABILITIES, 'ability', function (s) { return s.element === el; }) +
          '<div class="section-title">Upgrade <small>pick one</small></div>' + cards(D.UPGRADES, 'upgrade');
      }

      function weakTo(el) { for (var k in D.BEATS) if (D.BEATS[k] === el) return D.ELEMENTS[k].icon + ' ' + D.ELEMENTS[k].name; return ''; }

      function lookHtml() {
        var L = b.look;
        var chips = function (slot, label) {
          return '<div class="section-title">' + label + '</div><div class="chips">' + Object.keys(D.PARTS[slot]).map(function (k) {
            return '<button class="chip' + (L[slot] === k ? ' on' : '') + '" data-act="part" data-slot="' + slot + '" data-id="' + k + '">' + esc(D.PARTS[slot][k]) + '</button>';
          }).join('') + '</div>';
        };
        var colors = function (key, label) {
          return '<div class="row" style="margin:6px 0"><span style="width:84px;font-weight:800">' + label + '</span><div class="swatches">' +
            PALETTE.map(function (c) { return '<button class="sw' + (L[key] === c ? ' on' : '') + '" style="background:' + c + '" data-act="color" data-key="' + key + '" data-c="' + c + '"></button>'; }).join('') +
            '<input type="color" class="sw-input" data-color="' + key + '" value="' + L[key] + '"></div></div>';
        };
        return '<p class="dim" style="margin:10px 0 0">Looks are free and never change how your dragon fights.</p>' +
          '<div class="section-title">Start from an archetype</div><div class="chips">' + D.PRESETS.map(function (p) { return '<button class="chip" data-act="preset-look" data-id="' + p.id + '">' + D.ELEMENTS[p.element].icon + ' ' + esc(p.name) + '</button>'; }).join('') + '</div>' +
          '<div class="section-title">Colours</div>' + colors('primary', 'Scales') + colors('secondary', 'Horns & spikes') + colors('belly', 'Belly') + colors('eye', 'Eyes') +
          chips('head', 'Head & jaw') + chips('horns', 'Horns') + chips('wings', 'Wings') + chips('tail', 'Tail') + chips('spikes', 'Spikes') + chips('armor', 'Armour') +
          chips('eyes', 'Eye style') + chips('markings', 'Markings') + chips('accessory', 'Accessory') + chips('aura', 'Element aura');
      }

      function ui() { return App.ui; }

      App.on(App.ui, {
        back: function () { if (dirty && !confirm('Leave without saving?')) return; App.show('title'); },
        pose: function (el) { pose = el.dataset.pose; render(); },
        flip: function () { facing = -facing; render(); },
        tab: function (el) { tab = el.dataset.tab; render(); },
        element: function (el) {
          b.element = el.dataset.id;
          var sig = Object.keys(D.SIGNATURES).filter(function (k) { return D.SIGNATURES[k].element === b.element; });
          var ab = Object.keys(D.ABILITIES).filter(function (k) { return D.ABILITIES[k].element === b.element; });
          b.signature = sig[0]; b.ability = ab[0]; dirty = true; render();
        },
        pick: function (el) { b[el.dataset.slot] = el.dataset.id; dirty = true; if (el.dataset.slot === 'signature' || el.dataset.slot === 'ability') pose = 'special'; render(); },
        part: function (el) { b.look[el.dataset.slot] = el.dataset.id; dirty = true; render(); },
        color: function (el) { b.look[el.dataset.key] = el.dataset.c; dirty = true; render(); },
        'preset-look': function (el) { var p = D.PRESETS.filter(function (x) { return x.id === el.dataset.id; })[0]; b.look = JSON.parse(JSON.stringify(p.look)); dirty = true; render(); },
        save: function () {
          var v = Build.validateBuild(b);
          if (!v.ok) { App.toast(v.errors[0]); return; }
          var list = App.myBuilds().filter(function (m) { return m.id !== b.id; });
          list.unshift(Build.sanitize(b));
          App.saveBuilds(list.slice(0, 24));
          dirty = false;
          App.toast('Saved ' + b.name);
          window.DCAudio.play('select');
          render();
        },
        load: function (el) { if (dirty && !confirm('Discard unsaved changes?')) return; var m = App.myBuilds().filter(function (x) { return x.id === el.dataset.id; })[0]; if (m) { b = JSON.parse(JSON.stringify(m)); dirty = false; render(); } },
        new: function () { if (dirty && !confirm('Discard unsaved changes?')) return; b = newBuild(); dirty = true; render(); },
        dup: function () { b = JSON.parse(JSON.stringify(b)); b.id = 'b' + Date.now().toString(36); b.name = (b.name + ' 2').slice(0, 18); dirty = true; render(); },
        del: function () {
          if (!confirm('Delete ' + b.name + '?')) return;
          App.saveBuilds(App.myBuilds().filter(function (m) { return m.id !== b.id; }));
          var rest = App.myBuilds(); b = rest[0] ? JSON.parse(JSON.stringify(rest[0])) : newBuild(); dirty = false; render();
        },
      });
      render();
    },
  };
})();
