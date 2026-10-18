/* Neon Casino — the oval card-room table shared by Texas Hold'em and Teen Patti. Six seats around an oval; the table
   turns so you always sit at the bottom. Players on the far side sit behind the felt, players on the near side in
   front of it, seen from behind — so the room has depth. Games supply what goes in each seat and in the middle. */
(function () {
  'use strict';
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money;
  var K = window.CasinoKit, Character = K.Character, SeatOrb = K.SeatOrb, TimerBar = K.TimerBar;

  var W = 1000, H = 720, CX = 500, CY = 350, RX = 400, RY = 196;
  // Display slots, clockwise from the bottom centre (where you sit).
  var SLOT_DEG = [90, 148, 212, 270, 328, 32];
  function polar(rx, ry, deg) { var a = deg * Math.PI / 180; return { x: CX + rx * Math.cos(a), y: CY + ry * Math.sin(a) }; }
  function at(pt) { return { left: (pt.x / W) * 100 + '%', top: (pt.y / H) * 100 + '%' }; }
  var far = function (slot) { return slot >= 2 && slot <= 4; };

  function slotOf(seat, mySeat, n) { return mySeat >= 0 ? (seat - mySeat + n) % n : seat; }

  function Felt(props) {
    return html`<svg className="cr-svg" viewBox=${'0 0 ' + W + ' ' + H} aria-hidden="true">
      <defs>
        <radialGradient id="cr-felt" cx="50%" cy="40%" r="70%"><stop offset="0" style=${{ stopColor: 'var(--felt-hi)' }} /><stop offset=".6" style=${{ stopColor: 'var(--felt)' }} /><stop offset="1" style=${{ stopColor: 'var(--felt-lo)' }} /></radialGradient>
        <radialGradient id="cr-rail" cx="50%" cy="50%" r="50%"><stop offset=".86" stopColor="#4a2d1b" /><stop offset=".92" stopColor="#3a2215" /><stop offset=".97" stopColor="#24150c" /><stop offset="1" stopColor="#120904" /></radialGradient>
        <radialGradient id="cr-lamp" cx="50%" cy="30%" r="70%"><stop offset="0" stopColor="#fff3d6" stopOpacity=".14" /><stop offset="1" stopColor="#fff3d6" stopOpacity="0" /></radialGradient>
        <filter id="cr-soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="18" /></filter>
        <filter id="cr-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9" /></filter>
        <${K.TextureDefs} id="cr" />
        <clipPath id="cr-felt-clip"><ellipse cx=${CX} cy=${CY} rx=${RX} ry=${RY} /></clipPath>
      </defs>
      <ellipse cx=${CX} cy=${CY + 34} rx=${RX + 44} ry=${RY + 38} fill="#000" opacity=".75" filter="url(#cr-soft)" />
      <ellipse cx=${CX} cy=${CY + 22} rx=${RX + 34} ry=${RY + 30} fill="#2a170c" filter="url(#cr-tex-wood)" />
      <ellipse cx=${CX} cy=${CY + 22} rx=${RX + 34} ry=${RY + 30} fill="#000" opacity=".35" />
      <ellipse cx=${CX} cy=${CY + 11} rx=${RX + 34} ry=${RY + 30} fill="#6a3c20" filter="url(#cr-tex-wood)" />
      <ellipse cx=${CX} cy=${CY + 4} rx=${RX + 35} ry=${RY + 31} fill="none" stroke="url(#cr-brass)" strokeWidth="2.5" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 34} ry=${RY + 30} fill="url(#cr-rail)" filter="url(#cr-tex-leather)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 20} ry=${RY + 18} fill="none" stroke="#fff" strokeOpacity=".13" strokeWidth="12" filter="url(#cr-blur)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 27} ry=${RY + 24} fill="none" stroke="#e8cfa0" strokeOpacity=".4" strokeWidth="1.3" strokeDasharray="7 5" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 11} ry=${RY + 10} fill="none" stroke="#e8cfa0" strokeOpacity=".28" strokeWidth="1.3" strokeDasharray="7 5" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 33} ry=${RY + 29} fill="none" stroke="#a87048" strokeOpacity=".6" strokeWidth="1.5" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 5} ry=${RY + 5} fill="url(#cr-brass)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX} ry=${RY} fill="url(#cr-felt)" filter="url(#cr-tex-felt)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX} ry=${RY} fill="url(#cr-lamp)" />
      <g clipPath="url(#cr-felt-clip)"><ellipse cx=${CX} cy=${CY} rx=${RX} ry=${RY} fill="none" stroke="#000" strokeOpacity=".6" strokeWidth="46" filter="url(#cr-blur)" /></g>
      <ellipse cx=${CX} cy=${CY} rx=${RX - 70} ry=${RY - 50} fill="none" stroke="var(--felt-ink)" strokeOpacity=".22" strokeWidth="1.5" />
      <text x=${CX} y=${CY + 52} textAnchor="middle" className="felt-print">${props.print}</text>
    </svg>`;
  }

  /**
   * props: view, state (engine view), table, n (seats), mySeat, turnPid, buttonSeat, buttonLabel,
   *        seatBody(pid, slot) -> cards/chips in front of the seat, plaqueExtra(pid) -> status line, center, print,
   *        canSit, onSit, now
   */
  function OvalScene2D(props) {
    var v = props.view, st = props.state, n = props.n;
    var seats = st.seats.map(function (pid, seat) { return { pid: pid, seat: seat, slot: slotOf(seat, props.mySeat, n) }; });
    function figure(s) {
      var p = s.pid && UI.byId(v, s.pid);
      var deg = SLOT_DEG[s.slot];
      var pos = at(far(s.slot) ? polar(RX + 44, RY + 64, deg) : polar(RX + 64, RY + 84, deg));
      var tilt = far(s.slot) ? 0 : (deg - 90) * 0.35;
      if (!p) {
        return html`<div key=${'f' + s.seat} className=${cx('cr-figure', 'billboard', 'empty', far(s.slot) && 'far')} style=${pos}><${SeatOrb} canSit=${props.canSit} onSit=${props.onSit} /></div>`;
      }
      var onTurn = props.turnPid === s.pid;
      return html`<div key=${'f' + s.seat} className=${cx('cr-figure', 'billboard', far(s.slot) && 'far', s.pid === v.you && 'me', onTurn && 'on-turn', !p.connected && 'offline', props.dim && props.dim(s.pid) && 'dim')} style=${pos}>
        <div className="figure-body" style=${{ transform: 'rotate(' + tilt + 'deg)' }}><${Character} avatar=${p.avatar} seat=${'c' + s.seat} /></div>
        <div className="plaque">
          <span className="plaque-name">${p.name}${s.pid === v.you ? html` <em>you</em>` : null}</span>
          <span className="plaque-cash num">${money(p.cash)}</span>
          ${props.plaqueExtra ? props.plaqueExtra(s.pid) : null}
          ${onTurn ? html`<${TimerBar} timer=${st.timer} now=${props.now} />` : null}
        </div>
      </div>`;
    }
    var back = seats.filter(function (s) { return far(s.slot); });
    var front = seats.filter(function (s) { return !far(s.slot); });
    return html`<div className="cr-scene scene3d">
      <div className="stage3d"><div className="plane3d"><div className="floor3d" aria-hidden="true"></div>
      ${back.map(figure)}
      <${Felt} print=${props.print} />
      ${seats.map(function (s) {
        if (!s.pid) return null;
        var body = props.seatBody(s.pid, s.slot);
        var pt = polar(RX * 0.64, RY * 0.66, SLOT_DEG[s.slot]);
        return body ? html`<div key=${'b' + s.seat} className=${cx('cr-seat', far(s.slot) && 'far')} style=${Object.assign(at(pt), K.lightFrom(pt, CX, CY, 260))}>${body}</div>` : null;
      })}
      ${props.buttonSeat != null && props.buttonSeat >= 0 ? html`<div className="dealer-button" style=${at(polar(RX * 0.86, RY * 0.8, SLOT_DEG[slotOf(props.buttonSeat, props.mySeat, n)] + 14))} title="Dealer">${props.buttonLabel || 'D'}</div>` : null}
      <div className="cr-center" style=${at({ x: CX, y: CY - 28 })}>${props.center}</div>
      ${front.map(figure)}
      </div></div>
      <div className="spotlight" aria-hidden="true"></div>
    </div>`;
  }


  /**
   * The 3D room (js/gl-scene.js). Games supply plain data instead of markup:
   *   glHand(pid) -> { cards, bet, note, noteCls } | null     glStatus(pid) -> { text, cls } | null
   *   glKey (this hand's id), board[], pot, centerText, myHand (cards to show large in the HUD), theme{felt, ink, print, print2}
   */
  function glModel(props) {
    var v = props.view, st = props.state, n = props.n, last = st.last, tm = st.timer;
    var key = props.glKey || '';
    var turn = props.turnPid ? st.seats.indexOf(props.turnPid) : -1;
    var seats = st.seats.map(function (pid, i) {
      var p = pid && UI.byId(v, pid), res = null, net = pid && st.phase === 'results' && last && last.players && last.players[pid] ? last.players[pid].net : 0;
      if (net > 0) res = 'win'; else if (net < 0) res = 'lose';
      var stt = pid && props.glStatus ? props.glStatus(pid) : null;
      return p ? { pid: pid, name: p.name, avatar: p.avatar, cash: p.cash, me: pid === v.you, offline: !p.connected, folded: !!(props.dim && props.dim(pid)), status: stt && stt.text, statusCls: stt && stt.cls, result: res }
        : { pid: null, canSit: !!props.canSit };
    });
    var hands = [];
    st.seats.forEach(function (pid, i) { var g = pid && props.glHand ? props.glHand(pid) : null; if (g) hands.push({ id: key + ':' + i, seat: i, cards: g.cards, bet: g.bet, note: g.note, noteCls: g.noteCls }); });
    var left = tm ? (tm.endsAt ? Math.max(0, tm.endsAt - props.now) : tm.remainingMs || 0) : 0;
    return { n: n, mySeat: props.mySeat, theme: props.theme, seats: seats, turnSeat: turn, onSit: props.onSit, hands: hands, board: props.board || [], pot: props.pot || 0, potLabel: props.centerText,
      button: props.buttonSeat, buttonLabel: props.buttonLabel, timer: tm ? { pct: Math.max(0, Math.min(100, left / tm.ms * 100)), secs: Math.ceil(left / 1000), urgent: left < 5000 } : null };
  }
  function OvalScene(props) {
    var GL = window.CasinoGL;
    if (!(GL && GL.Stage && GL.supported())) return html`<${OvalScene2D} ...${props} />`;
    return html`<${GL.Stage} kind="oval" model=${glModel(props)} fallback=${html`<${OvalScene2D} ...${props} />`}>
      ${props.myHand && props.myHand.length ? html`<div className="gl-myhand" aria-label="Your cards"><${K.Cards} cards=${props.myHand} /></div>` : null}
    </${GL.Stage}>`;
  }

  window.CasinoCardroom = { OvalScene: OvalScene };
})();
