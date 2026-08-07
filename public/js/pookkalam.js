// Virtual Pookkalam Floral Designer Canvas with Touch Support for Mobile
(function() {
  let currentColor = '#FF7A00';

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pookkalamCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Draw initial base Pookkalam concentric guidelines
    function drawBase() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Concentric circles
      const radii = [140, 110, 80, 50, 20];
      const colors = ['#D4AF37', '#1B4D3E', '#FF7A00', '#FFA000', '#D4AF37'];

      radii.forEach((r, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = colors[idx];
        ctx.lineWidth = 3;
        ctx.stroke();
      });

      // Center Diya / Lamp motif
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#FF7A00';
      ctx.fill();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawBase();

    // Color palette selector
    const btns = document.querySelectorAll('.flower-palette-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentColor = e.target.getAttribute('data-color');
        btns.forEach(b => b.style.outline = 'none');
        e.target.style.outline = '3px solid #D4AF37';
      });
    });

    // Tap/Click to place flower petal cluster on canvas (Desktop Mouse)
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      drawPetalCluster(ctx, x, y, currentColor);
    });

    // Touch support for Mobile Phones
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      drawPetalCluster(ctx, x, y, currentColor);
    }, { passive: false });

    document.getElementById('clearPookkalamBtn')?.addEventListener('click', drawBase);
  });

  function drawPetalCluster(ctx, x, y, color) {
    const petals = 6;
    const r = 8;
    for (let i = 0; i < petals; i++) {
      const angle = (i * Math.PI * 2) / petals;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Petal center
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#D4AF37';
    ctx.fill();
  }
})();
