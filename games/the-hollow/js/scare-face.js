/* Local static adaptation of the supplied Creepy_Face widget's ringed eyes and
 * jagged grin. Original concept/source: Isaac Daniel Cotera (2026).
 * Bundled source has no license grant; public distribution remains uncleared.
 * This renderer uses native Canvas only, without the widget's CDN, event handlers,
 * globals, random full-screen glitches or continuous animation loop. */
(function (g) {
  'use strict';
  function draw(canvas) {
    canvas.width = 640; canvas.height = 360;
    var x = canvas.getContext('2d'); if (!x) return false;
    var shade = x.createRadialGradient(320, 185, 15, 320, 185, 280);
    shade.addColorStop(0, '#1a1421'); shade.addColorStop(1, '#030408');
    x.fillStyle = shade; x.fillRect(0, 0, 640, 360);
    // Asymmetric concentric eyes, the central motif of the supplied widget.
    [[233,135,42],[405,141,46]].forEach(function (eye, side) {
      x.save(); x.translate(eye[0], eye[1]); x.rotate(side ? .16 : -.18);
      for (var ring = 0; ring < 5; ring++) {
        x.beginPath();
        for (var i = 0; i <= 64; i++) {
          var a = i / 64 * Math.PI * 2, r = eye[2] - ring * 7 + Math.sin(a * 5 + ring) * 2;
          var px = Math.cos(a) * r, py = Math.sin(a) * r * .8;
          if (!i) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.strokeStyle = ring % 2 ? '#251b2e' : '#d8d1d0'; x.lineWidth = ring ? 2 : 5; x.stroke();
      }
      x.fillStyle = '#05050a'; x.beginPath(); x.ellipse(0, 0, 10, 24, 0, 0, Math.PI * 2); x.fill(); x.restore();
    });
    x.beginPath(); x.moveTo(194,215); x.quadraticCurveTo(320,279,450,213); x.quadraticCurveTo(322,324,194,215);
    x.fillStyle = '#020206'; x.fill(); x.strokeStyle = '#bbb2ba'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#d5cdd0';
    for (var tooth = 0; tooth < 19; tooth++) {
      var t = tooth / 18, px = 204 + t * 235, py = 220 + Math.sin(t * Math.PI) * 30;
      x.beginPath(); x.moveTo(px - 4, py); x.lineTo(px + 4, py + 1); x.lineTo(px, py + 15 + Math.sin(t * 10) * 5); x.fill();
    }
    return true;
  }
  g.HollowScareFace = { draw: draw };
})(window);
