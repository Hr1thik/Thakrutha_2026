// Chendamelam Percussion Web Audio Synthesizer Engine
(function() {
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // 1. Uruttu Chenda (High pitch resonant snare/skin hit)
  function playUruttuChenda() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);

    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  }

  // 2. Veekku Chenda (Deep bass drum hit)
  function playVeekkuChenda() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.25);

    gain.gain.setValueAtTime(1.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  }

  // 3. Ilathalam (Brass Cymbals Clash)
  function playIlathalam() {
    initAudio();
    const bufferSize = audioCtx.sampleRate * 0.3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btnUruttu = document.getElementById('drumUruttu');
    const btnVeekku = document.getElementById('drumVeekku');
    const btnIlathalam = document.getElementById('drumIlathalam');

    btnUruttu?.addEventListener('click', () => {
      playUruttuChenda();
      triggerDrumVisual(btnUruttu);
    });

    btnVeekku?.addEventListener('click', () => {
      playVeekkuChenda();
      triggerDrumVisual(btnVeekku);
    });

    btnIlathalam?.addEventListener('click', () => {
      playIlathalam();
      triggerDrumVisual(btnIlathalam);
    });
  });

  function triggerDrumVisual(el) {
    el.style.transform = 'scale(0.95)';
    setTimeout(() => el.style.transform = 'scale(1)', 100);

    const ripple = document.createElement('div');
    ripple.className = 'drum-ripple';
    el.style.position = 'relative';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }

  // Expose sound triggers globally
  window.playUruttuChenda = playUruttuChenda;
  window.playVeekkuChenda = playVeekkuChenda;
  window.playIlathalam = playIlathalam;
})();
