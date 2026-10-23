/* THE HOLLOW — sanity, injury and status presentation. View data is read-only.
 * Called at the stage's existing consequence beat, so effects never precede a roll. */
(function (g) {
  'use strict';
  var UI = g.HollowUI, FX = g.HollowFx, St = g.HollowStage, A = g.HollowArt, P = g.HollowFeedbackPolicy;
  var base = new URL('../', document.currentScript.src), config = { sanity: {}, damage: [] };
  var root = null, host = null, view = null, run = '', born = 0, cursor = null, used = false, pending = false;
  var hitTimer = null, scareTimer = null, hitToken = 0, sanityToken = 0, ticket = 0, lastHit = -Infinity, objectiveDone = null, completionShown = false;
  if (typeof FX.prefs.jumpScares !== 'boolean') FX.prefs.jumpScares = true;
  if (typeof FX.prefs.reducedScares !== 'boolean') FX.prefs.reducedScares = false;
  var ready = fetch(new URL('art/feedback.json', base)).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (c && c.version === 1 && c.sanity && Array.isArray(c.damage)) config = c;
    return g.HollowAssets.ready;
  }).then(function () { if (view) paint(view); }).catch(function () {});

  function mount() {
    var next = St.el(); if (!next || !next.isConnected) return false;
    if (root && host === next && root.isConnected) return true;
    host = next;
    root = document.createElement('div'); root.className = 'feedback-root'; root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<svg class="feedback-filter" width="0" height="0"><defs><filter id="hollow-fray" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".012 .018" numOctaves="1" seed="9" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale=".9" xChannelSelector="R" yChannelSelector="G" result="warped"/><feColorMatrix in="warped" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red"/><feOffset in="red" dx=".7" result="r"/><feColorMatrix in="warped" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb"/><feOffset in="gb" dx="-.6" result="b"/><feBlend in="r" in2="b" mode="screen"/></filter></defs></svg>' +
      '<div class="feedback-mist"></div><div class="feedback-dust"></div><div class="feedback-lantern"></div><div class="feedback-mirror"></div><div class="feedback-discovery"></div><div class="feedback-completion"></div><div class="feedback-sanity"></div><div class="feedback-aura"></div><div class="feedback-hit"></div><div class="feedback-sanity-hit"></div><div class="feedback-scare"></div>';
    host.appendChild(root); return true;
  }
  function clearScare() {
    ticket++; pending = false; clearTimeout(scareTimer);
    if (root) root.querySelector('.feedback-scare').classList.remove('on');
    g.HollowFeedbackAudio.stop();
  }
  function blocked() {
    var s = UI.S.ui || {};
    return s.modal || s.icard || s.map || s.drawer || (s.tab && s.tab !== 'act') ||
      !!document.querySelector('.modal, .icard, .ovp.hold, .cine.on');
  }
  function loadImage(el, id, accepts) {
    if (!id) return;
    g.HollowAssets.load(id).then(function (image) {
      if (!image || !el.isConnected || !accepts()) return;
      var img = image.cloneNode(); img.alt = ''; img.onerror = function () { img.remove(); };
      el.replaceChildren(img);
    });
  }
  function paint(v) {
    if (!mount() || !v.me) return;
    var profile = P.profile(v.me, FX.prefs, FX.reduced()), tier = profile.tier;
    root.dataset.sanity = tier; root.style.setProperty('--sanity-strength', profile.opacity);
    root.classList.toggle('feedback-pulse', profile.pulse);
    document.body.classList.toggle('feedback-panic', profile.distort);
    var statuses = (v.me.sts || []).filter(function (id) { return P.statuses[id]; });
    root.dataset.aura = ['bleeding', 'hunted', 'marked', 'cursed', 'blessed'].find(function (id) { return statuses.includes(id); }) || '';
    var layer = root.querySelector('.feedback-sanity'), id = config.sanity[tier];
    if (id && layer.dataset.asset !== id) {
      layer.dataset.asset = id;
      loadImage(layer, id, function () { return layer.dataset.asset === id; });
    }
    if (config.atmosphere) {
      var region = UI.S.cat && UI.S.cat.locations && UI.S.cat.locations[v.me.loc] && UI.S.cat.locations[v.me.loc].region;
      var layers = {
        mist: ['village', 'woods', 'crypt'].includes(region),
        dust: ['estate', 'abbey', 'crypt'].includes(region),
        lantern: (v.me.inv || []).some(function (item) { return item.id === 'lantern'; }),
        mirror: v.me.loc === 'mirror' && v.world && v.world.flags && v.world.flags.mirror_broken,
        discovery: true, completion: true
      };
      Object.keys(layers).forEach(function (name) {
        var layer = root.querySelector('.feedback-' + name), id = config.atmosphere[name];
        if (!layer) return;
        layer.hidden = !layers[name];
        if (layers[name] && id && layer.dataset.asset !== id) {
          layer.dataset.asset = id;
          loadImage(layer, id, function () { return layer.dataset.asset === id; });
        }
      });
    }
    if (FX.prefs.jumpScares && !P.gentle(FX.prefs, FX.reduced())) g.HollowFeedbackAudio.prepare(config.impact);
  }
  function badgeHtml(v) {
    if (!v || !v.me) return '';
    var catalog = UI.S.cat && UI.S.cat.statuses || {}, list = v.me.sts || [];
    var badges = list.filter(function (id) { return P.statuses[id]; }).map(function (id) {
      var meta = P.statuses[id], label = meta.name + ': ' + ((catalog[id] || {}).text || 'Active condition');
      return '<span class="feedback-condition status-' + id + '" tabindex="0" role="img" aria-label="' + A.esc(label) + '" title="' + A.esc(label) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + meta.path + '"/></svg><span>' + meta.name + '</span></span>';
    }).join('');
    return badges ? '<div class="feedback-conditions" aria-label="Your active conditions">' + badges + '</div>' : '';
  }
  var bar = g.HollowStory.bar;
  g.HollowStory.bar = function () { return bar.apply(this, arguments).replace('</header>', badgeHtml(UI.S.view) + '</header>'); };

  function react(kind) {
    if (!view || view.phase !== 'playing' || !mount()) return;
    if (kind === 'sanity') {
      var n = ++sanityToken, el = root.querySelector('.feedback-sanity-hit');
      el.classList.add('on'); setTimeout(function () { if (n === sanityToken) el.classList.remove('on'); }, 360); return;
    }
    var now = performance.now(); if (now - lastHit < 180) return; lastHit = now;
    var plan = P.damagePlan(FX.prefs, FX.reduced(), Math.random()), token = ++hitToken;
    var hit = root.querySelector('.feedback-hit'); hit.replaceChildren(); hit.style.setProperty('--hit-strength', plan.opacity);
    hit.classList.add('on'); clearTimeout(hitTimer);
    hitTimer = setTimeout(function () { if (token === hitToken) { hit.classList.remove('on'); hit.replaceChildren(); } }, plan.duration);
    if (plan.texture && config.damage.length) {
      var asset = config.damage[Math.floor(Math.random() * config.damage.length)];
      loadImage(hit, asset, function () { return token === hitToken && hit.classList.contains('on'); });
    }
  }
  var flash = St.flash;
  St.flash = function (name, ms) { flash.call(this, name, ms); if (name === 'fx-hurt') react('damage'); if (name === 'fx-san') react('sanity'); };

  function context(event, danger) {
    return { age: performance.now() - born, reduced: FX.reduced(), hidden: document.hidden,
      blocked: blocked(), used: used, danger: danger, event: event };
  }
  function claimRun() { try { return P.claim(g.localStorage, run); } catch (e) { return false; } }
  function scare(preview) {
    if (!view || !mount() || document.hidden || FX.prefs.jumpScares === false || P.gentle(FX.prefs, FX.reduced())) return false;
    if (!preview) {
      if (blocked() || used || !claimRun()) return false;
      used = true; // Persist BEFORE showing anything; reload cannot replay it.
    } else if (document.body.dataset.feedbackPreview !== 'true') return false;
    var el = root.querySelector('.feedback-scare'); el.replaceChildren();
    var face = document.createElement('canvas'); face.setAttribute('aria-hidden', 'true');
    if (g.HollowScareFace && g.HollowScareFace.draw(face)) el.appendChild(face);
    else el.innerHTML = A.enemy('whisperling');
    el.classList.add('on'); g.HollowFeedbackAudio.play();
    if (g.HollowAudio.settings().captions) {
      var captions = document.getElementById('captions');
      if (captions) { var caption = document.createElement('span'); caption.textContent = '(A sharp impact. A face in the mist.)'; captions.appendChild(caption); setTimeout(function () { caption.remove(); }, 2400); }
    }
    clearTimeout(scareTimer); scareTimer = setTimeout(clearScare, 560); return true;
  }
  function sync(v) {
    view = v;
    if (!v || !v.me || v.phase !== 'playing') { clearScare(); document.body.classList.remove('feedback-panic'); if (root) root.hidden = true; return; }
    var nextRun = P.runKey(v);
    if (nextRun !== run) { clearScare(); run = nextRun; born = performance.now(); cursor = null; used = false; objectiveDone = null; completionShown = false; }
    if (!mount()) return;
    paint(v); root.hidden = v.me.status !== 'alive';
    if (root.hidden) { clearScare(); document.body.classList.remove('feedback-panic'); return; }
    var done = !!(v.me.objective && v.me.objective.done);
    if (objectiveDone === null && done) completionShown = true; // Resuming never replays completion.
    if (objectiveDone === false && done && !completionShown) {
      completionShown = true;
      St.flash('fx-objective', 1500);
      if (g.HollowAudio && g.HollowAudio.sfx) g.HollowAudio.sfx('completion');
    }
    objectiveDone = done;
    var log = v.log || [], end = log.reduce(function (n, e) { return Math.max(n, e.n || 0); }, 0);
    if (cursor === null) { cursor = end; return; } // No replay of historical events on load/reconnect.
    var fresh = log.filter(function (e) { return e.n > cursor; }); cursor = Math.max(cursor, end);
    var danger = P.freshDanger(fresh, v);
    if (!pending && P.eligible(v, FX.prefs, context(end, danger))) {
      pending = true; var stamp = ++ticket;
      var attempt = function () {
        if (stamp !== ticket) return;
        pending = false;
        if (P.eligible(view, FX.prefs, context(end, danger))) scare(false);
      };
      if (g.HollowEvents && g.HollowEvents.busy()) g.HollowEvents.after(attempt);
      else setTimeout(attempt, 900);
    }
  }

  var settings = UI.settingsModal;
  UI.settingsModal = function () {
    var controls = '<fieldset class="feedback-settings"><legend>Scares &amp; screen effects</legend><div class="switch"><input type="checkbox" id="s-jumps" data-feedback-pref="jumpScares"' + (FX.prefs.jumpScares ? ' checked' : '') + '><label for="s-jumps">Rare jump scares (at most one per expedition)</label></div><div class="switch"><input type="checkbox" id="s-gentle" data-feedback-pref="reducedScares"' + (FX.prefs.reducedScares ? ' checked' : '') + '><label for="s-gentle">Reduced scares: gentler overlays, no jump scares</label></div><p class="small muted">Reduced motion also disables jump scares, shaking and distortion.</p></fieldset>';
    return settings.apply(this, arguments).replace('<hr class="div">', controls + '<hr class="div">');
  };
  var apply = FX.apply;
  FX.apply = function () {
    apply.apply(this, arguments); document.body.classList.toggle('reduced-scares', FX.prefs.reducedScares);
    if (P.gentle(FX.prefs, FX.reduced()) || !FX.prefs.jumpScares) clearScare();
    if (P.gentle(FX.prefs, FX.reduced()) && root) { hitToken++; clearTimeout(hitTimer); var hit = root.querySelector('.feedback-hit'); hit.classList.remove('on'); hit.replaceChildren(); }
    if (view) paint(view);
  };
  document.addEventListener('change', function (e) {
    var key = e.target.dataset && e.target.dataset.feedbackPref;
    if (!['jumpScares', 'reducedScares'].includes(key)) return;
    FX.prefs[key] = e.target.checked;
    if (document.body.dataset.feedbackPreview !== 'true') FX.save();
    FX.apply();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearScare(); });
  // Device-level motion changes must stop an effect immediately as well as on sync.
  var media = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)');
  if (media && media.addEventListener) media.addEventListener('change', function () { FX.apply(); });
  g.HollowFeedback = { ready: ready, sync: sync, react: react, badges: badgeHtml,
    previewScare: function () { return scare(true); } };
})(window);
