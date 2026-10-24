/* NetCmd arka planı: hafif "matrix" yağmuru + hareketli ağ topolojisi (düğümler, linkler, paketler).
   - prefers-reduced-motion: tek statik kare çizilir, animasyon başlamaz
   - sekme gizliyken durur; mobilde daha az düğüm kullanır */
(function () {
  'use strict';
  var rain = document.getElementById('bg-rain');
  var net = document.getElementById('bg-net');
  if (!rain || !net || !rain.getContext || !net.getContext) return;
  var rc = rain.getContext('2d');
  var nc = net.getContext('2d');
  if (!rc || !nc) return;

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var GLYPHS = '0123456789abcdef:/.#$>_';
  var FS = 16;
  var W = 0, H = 0, dpr = 1;
  var cols = [];
  var nodes = [];
  var packets = [];
  var mouse = { x: -9999, y: -9999 };
  var running = false;
  var lastNet = 0, lastRain = 0, lastPkt = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    [rain, net].forEach(function (c) {
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    });
    rc.setTransform(dpr, 0, 0, dpr, 0, 0);
    nc.setTransform(dpr, 0, 0, dpr, 0, 0);
    rc.clearRect(0, 0, W, H);

    var nCols = Math.ceil(W / FS);
    cols = [];
    for (var i = 0; i < nCols; i++) {
      cols.push({ row: Math.floor(rnd(-40, H / FS)), speed: rnd(0.35, 1), acc: 0 });
    }

    var count = Math.round(Math.min(70, Math.max(22, (W * H) / 26000)));
    if (W < 640) count = Math.min(count, 28);
    nodes = [];
    for (var j = 0; j < count; j++) {
      nodes.push({
        x: rnd(0, W), y: rnd(0, H),
        vx: rnd(-0.22, 0.22), vy: rnd(-0.22, 0.22),
        sw: Math.random() < 0.28
      });
    }
    packets = [];
  }

  function drawRainStep() {
    rc.fillStyle = 'rgba(5,10,15,0.085)';
    rc.fillRect(0, 0, W, H);
    rc.font = FS + 'px ui-monospace,Menlo,Consolas,monospace';
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      c.acc += c.speed;
      if (c.acc < 1) continue;
      c.acc = 0;
      c.row++;
      var y = c.row * FS;
      if (y > H && Math.random() > 0.975) { c.row = Math.floor(rnd(-20, 0)); continue; }
      if (y < 0 || y > H + FS) continue;
      var ch = GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
      rc.fillStyle = Math.random() < 0.06 ? 'rgba(200,255,225,0.95)' : 'rgba(57,255,156,0.8)';
      rc.fillText(ch, i * FS, y);
    }
  }

  function stepNodes() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx = -n.vx;
      if (n.y < 0 || n.y > H) n.vy = -n.vy;
    }
  }

  var LINK = 150;

  function drawNet(now) {
    nc.clearRect(0, 0, W, H);
    var i, j, a, b, dx, dy, d, alpha;
    var links = [];
    nc.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = a.x - b.x; dy = a.y - b.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          alpha = (1 - d / LINK) * 0.55;
          nc.strokeStyle = 'rgba(61,224,255,' + alpha.toFixed(3) + ')';
          nc.beginPath(); nc.moveTo(a.x, a.y); nc.lineTo(b.x, b.y); nc.stroke();
          links.push([a, b]);
        }
      }
      dx = a.x - mouse.x; dy = a.y - mouse.y;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d < 180) {
        alpha = (1 - d / 180) * 0.7;
        nc.strokeStyle = 'rgba(57,255,156,' + alpha.toFixed(3) + ')';
        nc.beginPath(); nc.moveTo(a.x, a.y); nc.lineTo(mouse.x, mouse.y); nc.stroke();
      }
    }
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (a.sw) {
        nc.fillStyle = 'rgba(57,255,156,0.9)';
        nc.fillRect(a.x - 2.5, a.y - 2.5, 5, 5);
      } else {
        nc.fillStyle = 'rgba(61,224,255,0.85)';
        nc.beginPath(); nc.arc(a.x, a.y, 1.8, 0, 6.2832); nc.fill();
      }
    }
    // paket animasyonu
    if (!reduce && links.length && now - lastPkt > 380 && packets.length < 14) {
      var l = links[(Math.random() * links.length) | 0];
      packets.push({ a: l[0], b: l[1], t: 0, sp: rnd(0.012, 0.03) });
      lastPkt = now;
    }
    for (i = packets.length - 1; i >= 0; i--) {
      var p = packets[i];
      p.t += p.sp;
      if (p.t >= 1) { packets.splice(i, 1); continue; }
      var x = p.a.x + (p.b.x - p.a.x) * p.t;
      var y = p.a.y + (p.b.y - p.a.y) * p.t;
      nc.fillStyle = 'rgba(57,255,156,0.25)';
      nc.beginPath(); nc.arc(x, y, 5, 0, 6.2832); nc.fill();
      nc.fillStyle = 'rgba(210,255,235,0.95)';
      nc.beginPath(); nc.arc(x, y, 2, 0, 6.2832); nc.fill();
    }
  }

  function loop(now) {
    if (!running) return;
    if (now - lastRain > 66) { lastRain = now; drawRainStep(); }
    if (now - lastNet > 28) { lastNet = now; stepNodes(); drawNet(now); }
    window.requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduce) return;
    running = true;
    window.requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  function staticFrame() {
    for (var k = 0; k < 90; k++) drawRainStep();
    drawNet(0);
  }

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (reduce) staticFrame(); }, 150);
  });
  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', function () { mouse.x = -9999; mouse.y = -9999; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  resize();
  if (reduce) { staticFrame(); } else { start(); }
})();
