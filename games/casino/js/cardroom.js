/* Neon Casino — the oval card-room table shared by Texas Hold'em and Teen Patti. Six seats around an oval; the table
   turns so you always sit at the bottom. Players on the far side sit behind the felt, players on the near side in
   front of it, seen from behind — so the room has depth. Games supply what goes in each seat and in the middle. */
(function () {
  'use strict';
  var UI = window.CasinoUI, html = UI.html, cx = UI.cx, money = UI.money;
  var K = window.CasinoKit, Character = K.Character, EmptyStool = K.EmptyStool, TimerBar = K.TimerBar;

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
        <linearGradient id="cr-rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a2a19" /><stop offset=".5" stopColor="#2b170d" /><stop offset="1" stopColor="#140a05" /></linearGradient>
        <radialGradient id="cr-lamp" cx="50%" cy="30%" r="70%"><stop offset="0" stopColor="#fff3d6" stopOpacity=".14" /><stop offset="1" stopColor="#fff3d6" stopOpacity="0" /></radialGradient>
        <filter id="cr-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="#000" floodOpacity=".7" /></filter>
      </defs>
      <ellipse cx=${CX} cy=${CY} rx=${RX + 34} ry=${RY + 30} fill="url(#cr-rail)" filter="url(#cr-shadow)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 34} ry=${RY + 30} fill="none" stroke="#6b4128" strokeOpacity=".7" strokeWidth="2" />
      <ellipse cx=${CX} cy=${CY} rx=${RX + 4} ry=${RY + 4} fill="#c9a45c" />
      <ellipse cx=${CX} cy=${CY} rx=${RX} ry=${RY} fill="url(#cr-felt)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX} ry=${RY} fill="url(#cr-lamp)" />
      <ellipse cx=${CX} cy=${CY} rx=${RX - 70} ry=${RY - 50} fill="none" stroke="var(--felt-ink)" strokeOpacity=".22" strokeWidth="1.5" />
      <text x=${CX} y=${CY + 52} textAnchor="middle" className="felt-print">${props.print}</text>
    </svg>`;
  }

  /**
   * props: view, state (engine view), table, n (seats), mySeat, turnPid, buttonSeat, buttonLabel,
   *        seatBody(pid, slot) -> cards/chips in front of the seat, plaqueExtra(pid) -> status line, center, print,
   *        canSit, onSit, now
   */
  function OvalScene(props) {
    var v = props.view, st = props.state, n = props.n;
    var seats = st.seats.map(function (pid, seat) { return { pid: pid, seat: seat, slot: slotOf(seat, props.mySeat, n) }; });
    function figure(s) {
      var p = s.pid && UI.byId(v, s.pid);
      var deg = SLOT_DEG[s.slot];
      var pos = at(far(s.slot) ? polar(RX + 44, RY + 64, deg) : polar(RX + 64, RY + 84, deg));
      var tilt = far(s.slot) ? 0 : (deg - 90) * 0.35;
      if (!p) {
        return html`<div key=${'f' + s.seat} className=${cx('cr-figure', 'empty', far(s.slot) && 'far')} style=${pos}>
          <div className="figure-body" style=${{ transform: 'rotate(' + tilt + 'deg)' }}><${EmptyStool} /></div>
          ${props.canSit ? html`<button type="button" className="seat-sit" onClick=${props.onSit}>Sit here</button>` : null}
        </div>`;
      }
      var onTurn = props.turnPid === s.pid;
      return html`<div key=${'f' + s.seat} className=${cx('cr-figure', far(s.slot) && 'far', s.pid === v.you && 'me', onTurn && 'on-turn', !p.connected && 'offline', props.dim && props.dim(s.pid) && 'dim')} style=${pos}>
        <div className="figure-body" style=${{ transform: 'rotate(' + tilt + 'deg)' }}><${Character} avatar=${p.avatar} seat=${'c' + s.seat} /></div>
        <div className="plaque">
          <span className="plaque-name"><span aria-hidden="true">${UI.AVATARS[p.avatar]}</span> ${p.name}${s.pid === v.you ? html` <em>you</em>` : null}</span>
          <span className="plaque-cash num">${money(p.cash)}</span>
          ${props.plaqueExtra ? props.plaqueExtra(s.pid) : null}
          ${onTurn ? html`<${TimerBar} timer=${st.timer} now=${props.now} />` : null}
        </div>
      </div>`;
    }
    var back = seats.filter(function (s) { return far(s.slot); });
    var front = seats.filter(function (s) { return !far(s.slot); });
    return html`<div className="cr-scene">
      ${back.map(figure)}
      <${Felt} print=${props.print} />
      ${seats.map(function (s) {
        if (!s.pid) return null;
        var body = props.seatBody(s.pid, s.slot);
        return body ? html`<div key=${'b' + s.seat} className=${cx('cr-seat', far(s.slot) && 'far')} style=${at(polar(RX * 0.64, RY * 0.66, SLOT_DEG[s.slot]))}>${body}</div>` : null;
      })}
      ${props.buttonSeat != null && props.buttonSeat >= 0 ? html`<div className="dealer-button" style=${at(polar(RX * 0.86, RY * 0.8, SLOT_DEG[slotOf(props.buttonSeat, props.mySeat, n)] + 14))} title="Dealer">${props.buttonLabel || 'D'}</div>` : null}
      <div className="cr-center" style=${at({ x: CX, y: CY - 28 })}>${props.center}</div>
      ${front.map(figure)}
    </div>`;
  }

  window.CasinoCardroom = { OvalScene: OvalScene };
})();
