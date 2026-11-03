/* Secrets in the world, the Under City doors, the notebook and the full map. Never shows what is still undiscovered. */
(function () {
  var TR = window.TR = window.TR || {};
  var D = window.TRD.districts;
  var nb = TR.notebook = {
    spots: [], doors: [], clues: [], holding: 0, lightMesh: null, passed: {}, open: null, fadeEl: null,

    /** Builds this run's markers, wherever the seed put them. */
    setRun: function (run) {
      nb.run = run; nb.clues = []; nb.passed = {}; nb.spots = [];
      var g = new TR.Geo(), n = new TR.Geo(), lights = new TR.Geo();
      Object.keys(run.secrets).forEach(function (id) {
        var s = run.secrets[id];
        if (!s.pos) return;
        nb.spots.push({ id: id, s: s, x: s.pos.x, y: s.pos.y, z: s.pos.z });
        nb.marker(g, n, lights, s);
      });
      nb.doors = [];
      D.DISTRICTS.under.entrances.forEach(function (e) {
        nb.doors.push({ x: e.surface.x, y: 0, z: e.surface.z, to: { x: e.x, y: D.UNDER_Y, z: e.z + 3 }, label: 'Way down', down: true, id: e.id });
        nb.doors.push({ x: e.x, y: D.UNDER_Y, z: e.z - 3, to: { x: e.surface.x, y: 0, z: e.surface.z + 5 }, label: 'Way up', id: e.id });
        g.box(e.x, D.UNDER_Y, e.z - 6, 7, 6, 0.6, 0x3a2360);
        n.box(e.x, D.UNDER_Y + 6, e.z - 5.6, 7.6, 0.6, 0.3, 0xc77dff);
      });
      nb.doors.push({ x: 0, y: D.DEEP_Y, z: -160, to: { x: 0, y: D.UNDER_Y, z: -116 }, label: 'Climb back up', deep: true });
      n.box(0, D.DEEP_Y, -158, 6, 5, 0.4, 0x7dffea);
      if (g.count) TR.world.runMesh(g, TR.world.solid, true);
      if (n.count) TR.world.runMesh(n, TR.world.neonMat);
      nb.lightMesh = lights.count ? TR.world.runMesh(lights, TR.world.neonMat) : null;
    },
    marker: function (g, n, lights, s) {
      var p = s.pos, x = p.x, y = p.y, z = p.z;
      switch (s.look) {
        case 'door': g.box(x, y, z, 3, 4.6, 0.5, 0x5a4636); g.box(x, y + 2, z + 0.3, 0.3, 0.3, 0.2, 0xffd24a); n.box(x, y + 4.6, z, 3.4, 0.2, 0.7, 0xff5a5a); break;
        case 'poster': g.box(x, y, z, 0.3, 3, 0.3, 0x555555); n.box(x, y + 3, z, 2.4, 1.6, 0.14, 0xfff0a0); break;
        case 'light': n.box(x, y, z, 0.1, 0.1, 0.1, 0xffffff); lights.box(22, 24.8, -212, 1.4, 5, 1.4, 0xfff0a0); lights.cyl(22, 29.8, -212, 2.4, 1.6, 0xffd24a, 8); break;
        case 'ladder': g.box(x + 11, 24.8, z - 10, 1, 3, 1, 0x7d4a2c); break;
        case 'book': g.box(x, y, z, 1.6, 1.3, 1.2, 0x7d4a2c); n.box(x, y + 1.3, z, 1.2, 0.2, 0.9, 0xfff0e0); break;
        case 'vault': g.box(x, y, z, 9, 5, 9, 0x8a8f96); n.box(x, y + 1, z + 4.6, 3, 3, 0.2, 0xffc53d); break;
        case 'telescope': g.box(x, y, z, 1.4, 2, 1.4, 0x666a70); g.box(x, y + 2, z, 0.8, 0.8, 3.4, 0x333338); break;
        case 'crate': g.box(x, y, z, 2.2, 2, 2.2, 0xb07f4a); n.box(x, y + 2, z, 2.4, 0.1, 0.4, 0xffd24a); break;
        case 'phone': g.box(x, y, z, 2, 4, 2, 0x2f6fd6); n.box(x, y + 4, z, 2.2, 0.3, 2.2, 0xffffff); break;
        case 'grate': n.box(x, y + 0.03, z, 3, 0.05, 3, 0x333338); for (var i = 0; i < 4; i++) n.box(x - 1.1 + i * 0.75, y + 0.06, z, 0.2, 0.05, 2.8, 0x777777); break;
        case 'painting': n.box(x, y + 2, z, 6, 4, 0.2, 0xa66b2d); n.box(x, y + 2.3, z + 0.12, 5, 3.3, 0.1, 0x3d6cb9); break;
        case 'radar': g.box(x, y, z, 3, 1, 3, 0x333338); n.cyl(x, y + 1, z, 1.4, 0.1, 0x3ddc6e, 12); break;
        case 'hedge': [[-8, -8, 16, 1], [-8, 8, 16, 1], [-8, -8, 1, 16]].forEach(function (h) { g.box(x + h[0] + h[2] / 2, y, z + h[1] + h[3] / 2, h[2], 3, h[3], 0x2f7f3f); }); n.box(x, y + 0.02, z, 2, 0.05, 2, 0x7a5230); break;
        case 'wall': break;
        case 'overheard':
          g.box(x, y + 1, z, 1.1, 1.3, 0.7, 0xd6547c).box(x, y, z, 0.9, 1, 0.5, 0x222233).box(x, y + 2.3, z, 0.9, 0.9, 0.9, 0xffe0b8).box(x, y + 3.2, z, 1, 0.5, 1, 0x222222);
          break;
      }
    },
    update: function (dt, sess, pos) {
      var me = sess.view.me, hour = sess.view.hour, inp = TR.input;
      if (nb.lightMesh) nb.lightMesh.visible = hour >= 20 || hour < 5;
      // places the player has passed near, for the Phone Company map
      nb.spots.forEach(function (sp) { if (sp.y > -30 && sp.x < 3000 && Math.hypot(sp.x - pos.x, sp.z - pos.z) < 40) nb.passed[sp.id] = true; });
      var best = null, bd = 1e9;
      nb.spots.forEach(function (sp) {
        if (me.flags['s:' + sp.id]) return;
        var look = sp.s.look, xz = Math.hypot(sp.x - pos.x, sp.z - pos.z), dy = Math.abs(sp.y - pos.y);
        if (look === 'overheard') {
          if (xz < 8 && dy < 6 && !sp.asked) { sp.asked = true; TR.app.tryDiscover(sp.id); }
          return;
        }
        if (look === 'ladder' || look === 'auto') return;
        var reach = look === 'vault' ? 9 : look === 'wall' ? 7 : 3.4, tall = look === 'vault' ? 16 : 5;
        if (xz < reach && dy < tall && xz < bd) { bd = xz; best = sp; }
      });
      var door = null;
      if (me.flags.under || me.flags.deep) nb.doors.forEach(function (d) {
        if (d.down && !me.flags.under) return;
        if (Math.hypot(d.x - pos.x, d.z - pos.z) < 6 && Math.abs(d.y - pos.y) < 5) door = d;
      });
      if (best) {
        var fail = sess.gateFails(best.s.gate);
        if (fail) { TR.hud.prompt('Something odd here', fail.why || 'Locked.'); nb.holding = 0; return; }
        nb.holdE(dt, 'Something odd here', 'Hold E to look closer', function () { TR.app.tryDiscover(best.id); });
        return;
      }
      nb.holding = 0;
      // a way down or up works like any door: walk into it. It re-arms once you have stepped away.
      nb.doorCool = Math.max(0, (nb.doorCool || 0) - dt);
      if (door && !TR.vehicles.current) {
        var near = Math.hypot(door.x - pos.x, door.z - pos.z), moving = Math.hypot(TR.player.vel.x, TR.player.vel.z) > 1;
        if (near < 2.4 && moving && nb.doorCool <= 0) { nb.doorCool = 1.5; nb.travel(door.to); return; }
        if (!TR.hud.pOn) TR.hud.prompt(door.label, 'Walk in');
      }
    },
    holdE: function (dt, title, sub, fn) {
      if (TR.input.down('KeyE')) {
        nb.holding += dt;
        if (nb.holding >= 0.4) { nb.holding = 0; TR.input.keys.KeyE = false; fn(); return; }
      } else nb.holding = 0;
      TR.hud.prompt(title, sub, nb.holding / 0.4);
    },
    /** A quick dip to black, so a door feels like a door. */
    fadeFlash: function () {
      var f = document.createElement('div');
      f.style.cssText = 'position:absolute;inset:0;background:#0a0618;opacity:.9;transition:opacity .28s;pointer-events:none';
      TR.hud.root.appendChild(f);
      requestAnimationFrame(function () { requestAnimationFrame(function () { f.style.opacity = 0; }); });
      setTimeout(function () { f.remove(); }, 330);
    },
    /** The brief elevator ride between the surface and the Under City. */
    travel: function (to) {
      if (TR.interiors.current) TR.interiors.exit(TR.player);
      if (TR.vehicles.current) TR.vehicles.leave();
      var f = nb.fadeEl || (nb.fadeEl = document.createElement('div'));
      f.style.cssText = 'position:absolute;inset:0;background:#0a0618;opacity:1;transition:opacity .45s;pointer-events:none';
      TR.hud.root.appendChild(f);
      TR.audio.door(); TR.audio.boom(0.15);
      TR.player.teleport(to.x, to.y, to.z, 0);
      TR.world.setSpace(to.y < -20 ? 'under' : 'surface');
      TR.app.lastSafe = null;
      setTimeout(function () { f.style.opacity = 0; setTimeout(function () { f.remove(); }, 480); }, 60);
    },
    addClue: function (title, text, pos) {
      nb.clues.unshift({ title: title, text: text, x: pos.x, z: pos.z, pinned: false });
    },

    // ───── notebook panel ─────
    toggle: function () { if (nb.open === 'book') nb.close(); else nb.showBook(); },
    close: function () { if (nb.panel) nb.panel.remove(); nb.panel = null; nb.open = null; },
    panelEl: function () {
      nb.close();
      var p = nb.panel = document.createElement('div'); p.className = 'journal';
      TR.hud.root.appendChild(p);
      if (document.pointerLockElement) document.exitPointerLock();
      return p;
    },
    showBook: function () {
      var p = nb.panelEl(), notes = TR.save.get('notebook', {}), keys = Object.keys(notes); nb.open = 'book';
      var h = '<h2>My Notebook</h2><h3>Today</h3>';
      if (!nb.clues.length) h += '<p class="dim">Nothing yet. Look on a roof, follow a rumour, open an odd door.</p>';
      nb.clues.forEach(function (c, i) { h += '<div class="clue"><b>' + c.title + '</b><br>' + c.text + (TR.app.session.online ? '' : ' <button data-pin="' + i + '" class="pin">' + (c.pinned ? 'Pinned' : 'Pin to map') + '</button>') + '</div>'; });
      h += '<h3>Things I have worked out</h3>';
      if (!keys.length) h += '<p class="dim">I do not know anything yet.</p>';
      keys.forEach(function (k) { h += '<div class="note">' + notes[k] + '</div>'; });
      h += '<div class="row"><button class="btn alt" id="nb-close">Close (N)</button></div>';
      p.innerHTML = h;
      p.querySelector('#nb-close').onclick = nb.close;
      p.querySelectorAll('[data-pin]').forEach(function (b) {
        b.onclick = function () {
          var c = nb.clues[+b.getAttribute('data-pin')]; c.pinned = true;
          TR.map.pins.push({ x: c.x, z: c.z });
          b.textContent = 'Pinned';
        };
      });
    },
    // ───── full map ─────
    toggleMap: function () { if (nb.open === 'map') nb.close(); else nb.showMap(); },
    showMap: function () {
      var p = nb.panelEl(), me = TR.app.session.view.me; nb.open = 'map';
      var h = '<h2>The City</h2><canvas id="fullmap" width="480" height="480"></canvas>';
      if (me.powers.fastTravel) {
        h += '<div class="row small">';
        Object.keys(D.DISTRICTS).forEach(function (k) { if (me.visited[k]) h += '<button class="btn alt" data-go="' + k + '">' + D.DISTRICTS[k].name + '</button>'; });
        h += '</div><p class="dim">Your Airline flies to anywhere you have been' + (me.travelCd > 0 ? '. Next flight in ' + Math.ceil(me.travelCd / 1000) + 's.' : '.') + '</p>';
      }
      h += '<div class="row"><button class="btn alt" id="nb-close">Close (M)</button></div>';
      p.innerHTML = h;
      var g = p.querySelector('#fullmap').getContext('2d');
      TR.map.paint(g, 480, TR.player.pos.y < -20, { dots: nb.mapDots(me) });
      var x = TR.map.w2c(TR.player.pos.x, 480), y = TR.map.w2c(TR.player.pos.z, 480);
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke();
      p.querySelector('#nb-close').onclick = nb.close;
      p.querySelectorAll('[data-go]').forEach(function (b) {
        b.onclick = function () {
          var r = TR.app.session.fastTravel(b.getAttribute('data-go'));
          if (r.error) { TR.hud.toast(r.error, 'bad'); return; }
          nb.close();
          nb.travel(r.to);
          TR.hud.toast('Your flight has landed.', 'gold');
        };
      });
    },
    /** Powers that add to the map. Each only ever adds what it promises. */
    mapDots: function (me) {
      var dots = [], under = TR.player.pos.y < -20;
      nb.spots.forEach(function (sp) {
        if (me.flags['s:' + sp.id] || sp.x > 3000 || (sp.y < -30 && sp.y > -70) !== under) return;
        if (TR.app.showSecrets) dots.push({ x: sp.x, z: sp.z, c: '#ff3bd4', label: sp.id });
        else if (me.powers.phoneMap && nb.passed[sp.id]) dots.push({ x: sp.x, z: sp.z, c: '#7dd8ff' });
        else if (me.powers.observatory && ['door', 'crate', 'vault'].indexOf(sp.s.look) >= 0 && sp.y >= -22) dots.push({ x: sp.x, z: sp.z, c: '#ffd24a' });
      });
      var board = TR.app.session.view.board;
      if (board) board.forEach(function (b) { if (b.id !== me.id && !b.inv) dots.push({ x: b.x, z: b.z, c: '#ff5a5a', label: b.name, r: 4 }); });
      return dots;
    }
  };
})();
