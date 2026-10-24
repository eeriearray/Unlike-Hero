/*
 * Dragon Forge — build a dragon: a big animated preview, visual cards, a 100-point budget and live validation.
 * Fighting style (costs points, changes combat) and appearance (free, never changes combat) are separate tabs.
 */
(function () {
  'use strict';
  var App = window.DCApp, D = window.DC.Data, Build = window.DC.Build, Art = window.DCArt, Anim = window.DCAnim;
  var esc = App.esc;

  var SLOT_COLORS = { body: '#ff7a2f', mobility: '#3de0d0', signature: '#ffcf3a', ability: '#c86aff', upgrade: '#5af08a' };

  App.screens.forge = {
    enter: function (arg) {
      var mine = App.myBuilds();
      var b = arg && arg.build ? JSON.parse(JSON.stringify(arg.build)) : mine[0] ? JSON.parse(JSON.stringify(mine[0])) : newBuild();
      var tab = 'style';
      var dirty = false;

      function newBuild() {
        var nb = Build.presetBuild('emberfang-hd');
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
          '<div class="saved">' + mineNow.map(function (m) { return '<button class="chip' + (m.id === b.id ? ' on' : '') + '" data-act="load" data-id="' + esc(m.id) + '">' + App.elIcon(m.element) + ' ' + esc(m.name) + '</button>'; }).join('') +
          '<button class="chip" data-act="new">＋ New</button></div></div>' +
          '<div class="forge">' +
          '<div style="display:grid;gap:12px;align-content:start">' +
          '<div class="stage-card"><canvas data-preview></canvas>' +
          '<div class="elem-badge">' + App.elIcon(b.element, 22) + '' + D.ELEMENTS[b.element].name + ' · ' + esc(D.BODIES[b.body].name) + '</div>' +
          '<div class="web-card" title="Type web: green arrows are what you beat, red are what beat you">' + App.wheel(b.element, 170) + '</div>' +
          '</div>' +
          '<div class="panel budget">' + budgetHtml(v) + '</div>' +
          '<div class="panel">' + statsHtml(v) + '</div>' +
          '</div>' +
          '<div class="panel scroll" style="max-height:calc(100vh - 120px)">' +
          '<div class="row"><input class="text grow" maxlength="18" data-name value="' + esc(b.name) + '" placeholder="Name your dragon">' +
          '<button class="btn hot" data-act="save"' + (v.ok ? '' : ' disabled') + '>Save</button>' +
          (mineNow.some(function (m) { return m.id === b.id; }) ? '<button class="btn ghost small" data-act="dup">Copy</button><button class="btn ghost small" data-act="del">Delete</button>' : '') + '</div>' +
          (v.ok ? '<div class="ok-text" style="margin-top:6px">Valid build · ' + v.cost + ' / ' + D.BUDGET + ' points' + (dirty ? ' · unsaved' : '') + '</div>' : '<div class="errors" style="margin-top:6px">' + v.errors.map(esc).join(' ') + '</div>') +
          '<div class="tabs" style="margin-top:12px"><button data-act="tab" data-tab="style" class="' + (tab === 'style' ? 'on' : '') + '">Fighting style</button><button data-act="tab" data-tab="look" class="' + (tab === 'look' ? 'on' : '') + '">Appearance</button></div>' +
          (tab === 'style' ? styleHtml() : lookHtml()) +
          '</div></div></div>';
        var cv = ui().querySelector('[data-preview]');
        App.mini(cv, b, 'idle', { scale: 1.3, facing: 1, ground: 70, hd: true });
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
        return '<div class="section-title">Element <small>Beats ' + App.elIcon(D.BEATS[el]) + ' ' + D.ELEMENTS[D.BEATS[el]].name + ' · weak to ' + weakTo(el) + ' (elemental damage only)</small></div>' +
          '<div class="cards" style="grid-template-columns:repeat(5,1fr)">' +
          D.ELEMENT_ORDER.map(function (e) { var E = D.ELEMENTS[e]; return '<button class="card el' + (el === e ? ' on' : '') + '" data-act="element" data-id="' + e + '" style="' + (el === e ? 'box-shadow:inset 0 0 0 999px ' + Art.alpha(E.color, 0.18) : '') + '"><span class="big">' + App.elIcon(e, 34) + '</span><b>' + E.name + '</b></button>'; }).join('') +
          '</div>' + App.matchupList(el) +
          '<div class="section-title">Body <small>durability vs size and speed</small></div>' + cards(D.BODIES, 'body') +
          '<div class="section-title">Mobility</div>' + cards(D.MOBILITY, 'mobility') +
          '<div class="section-title">Signature move <small><kbd>L</kbd> / B button</small></div>' + cards(D.SIGNATURES, 'signature', function (s) { return s.element === el; }) +
          '<div class="section-title">Elemental ability <small>Down + <kbd>L</kbd></small></div>' + cards(D.ABILITIES, 'ability', function (s) { return s.element === el; }) +
          '<div class="section-title">Upgrade <small>pick one</small></div>' + cards(D.UPGRADES, 'upgrade');
      }

      function weakTo(el) { for (var k in D.BEATS) if (D.BEATS[k] === el) return App.elIcon(k) + ' ' + D.ELEMENTS[k].name; return ''; }

      function lookHtml() {
        var L = b.look;
        var chips = function (slot, label) {
          return '<div class="section-title">' + label + '</div><div class="chips">' + Object.keys(D.PARTS[slot]).map(function (k) {
            return '<button class="chip' + (L[slot] === k ? ' on' : '') + '" data-act="part" data-slot="' + slot + '" data-id="' + k + '">' + esc(D.PARTS[slot][k]) + '</button>';
          }).join('') + '</div>';
        };
        // HD dragons are painted, so their look is the art, a recolour, a finish and the aura (all cosmetic)
        var art = Object.keys(D.SPRITES).map(function (id) {
          var p = D.PRESETS.filter(function (x) { return x.look.sprite === id; })[0];
          return '<button class="card' + (L.sprite === id ? ' on' : '') + '" data-act="art" data-id="' + id + '"><b>' + App.elIcon(p.element, 16) + ' ' + esc(D.SPRITES[id]) + '</b><small>' + D.ELEMENTS[p.element].name + ' painting</small></button>';
        }).join('');
        var tints = Object.keys(D.TINTS).map(function (k) {
          var T = D.TINTS[k], on = (L.tint || 'none') === k;
          return '<button class="sw' + (on ? ' on' : '') + '" title="' + esc(T.name) + '" style="background:' + (T.color || 'conic-gradient(#e0661c,#e8c040,#2fae6a,#2f7ad8,#8a3ad8,#e0661c)') + '" data-act="tint" data-id="' + k + '"></button>';
        }).join('');
        var shades = Object.keys(D.SHADES).map(function (k) { return '<button class="chip' + ((L.shade || 'none') === k ? ' on' : '') + '" data-act="shade" data-id="' + k + '">' + esc(D.SHADES[k].name) + '</button>'; }).join('');
        return '<p class="dim" style="margin:10px 0 0">Looks are free and never change how your dragon fights.</p>' +
          '<div class="section-title">Dragon <small>any painting, whatever your element</small></div><div class="cards">' + art + '</div>' +
          '<div class="section-title">Scale colour <small>' + esc(D.TINTS[L.tint || 'none'].name) + '</small></div><div class="swatches">' + tints + '</div>' +
          '<div class="section-title">Finish</div><div class="chips">' + shades + '</div>' +
          chips('aura', 'Element aura');
      }

      function ui() { return App.ui; }

      App.on(App.ui, {
        back: function () {
          if (!dirty) { App.show('title'); return; }
          var ok = Build.validateBuild(b).ok, leave = function () { App.show('title'); };
          App.ask('Leave the Forge?', b.name + ' has unsaved changes.', (ok ? [{ label: 'Save and leave', cls: 'hot', fn: function () { saveIt(); leave(); } }] : [])
            .concat([{ label: 'Leave without saving', fn: leave }, { label: 'Stay', cls: 'ghost' }]));
        },
        tab: function (el) { tab = el.dataset.tab; render(); },
        element: function (el) {
          var oldEl = b.element;
          b.element = el.dataset.id;
          // Switching element brings that element's painting, unless a different one was picked on purpose
          var prevDefault = D.PRESETS.filter(function (x) { return x.look.sprite === b.look.sprite; })[0];
          if (!b.look.sprite || (prevDefault && prevDefault.element === oldEl)) { b.look.sprite = null; App.hdLook(b); }
          var sig = Object.keys(D.SIGNATURES).filter(function (k) { return D.SIGNATURES[k].element === b.element; });
          var ab = Object.keys(D.ABILITIES).filter(function (k) { return D.ABILITIES[k].element === b.element; });
          b.signature = sig[0]; b.ability = ab[0]; dirty = true; render();
        },
        pick: function (el) { b[el.dataset.slot] = el.dataset.id; dirty = true; render(); },
        part: function (el) { b.look[el.dataset.slot] = el.dataset.id; dirty = true; render(); },
        color: function (el) { b.look[el.dataset.key] = el.dataset.c; dirty = true; render(); },
        art: function (el) { b.look.sprite = el.dataset.id; dirty = true; render(); },
        tint: function (el) { if (el.dataset.id === 'none') delete b.look.tint; else b.look.tint = el.dataset.id; dirty = true; render(); },
        shade: function (el) { if (el.dataset.id === 'none') delete b.look.shade; else b.look.shade = el.dataset.id; dirty = true; render(); },
        'preset-look': function (el) { var p = D.PRESETS.filter(function (x) { return x.id === el.dataset.id; })[0]; b.look = JSON.parse(JSON.stringify(p.look)); dirty = true; render(); },
        save: function () { if (saveIt()) render(); },
        load: function (el) {
          var go = function () { var m = App.myBuilds().filter(function (x) { return x.id === el.dataset.id; })[0]; if (m) { b = JSON.parse(JSON.stringify(m)); dirty = false; render(); } };
          if (dirty) App.confirmAsk('Discard unsaved changes?', 'Discard', go); else go();
        },
        new: function () { var go = function () { b = newBuild(); dirty = true; render(); }; if (dirty) App.confirmAsk('Discard unsaved changes?', 'Discard', go); else go(); },
        dup: function () { b = JSON.parse(JSON.stringify(b)); b.id = 'b' + Date.now().toString(36); b.name = (b.name + ' 2').slice(0, 18); dirty = true; render(); },
        del: function () { App.confirmAsk('Delete ' + b.name + '?', 'Delete', function () {
          App.saveBuilds(App.myBuilds().filter(function (m) { return m.id !== b.id; }));
          var rest = App.myBuilds(); b = rest[0] ? JSON.parse(JSON.stringify(rest[0])) : newBuild(); dirty = false; render();
        }); },
      });

      function saveIt() {
        var v = Build.validateBuild(b);
        if (!v.ok) { App.toast(v.errors[0]); return false; }
        var list = App.myBuilds().filter(function (m) { return m.id !== b.id; });
        list.unshift(Build.sanitize(b));
        App.saveBuilds(list.slice(0, 24));
        dirty = false;
        App.toast('Saved ' + b.name);
        window.DCAudio.play('select');
        return true;
      }
      render();
    },
  };
})();
