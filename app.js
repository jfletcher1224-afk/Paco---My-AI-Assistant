(() => {
  const canvas = document.getElementById('hud');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;

  const statusEl = document.getElementById('status');
  const transcriptEl = document.getElementById('transcript');
  const talkBtn = document.getElementById('talkBtn');
  const textForm = document.getElementById('textForm');
  const textInput = document.getElementById('textInput');

  const settingsBtn = document.getElementById('settingsBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const closeSettingsBtn = document.getElementById('closeSettings');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const clearKeyBtn = document.getElementById('clearKey');
  const apiKeyInput = document.getElementById('apiKey');
  const apiKeyPreview = document.getElementById('apiKeyPreview');
  const modelSelect = document.getElementById('model');
  const voiceSelect = document.getElementById('voice');

  const SYSTEM_PROMPT = "You are Paco, a witty and loyal personal AI assistant in the spirit of a sci-fi HUD companion. Keep replies SHORT and conversational (1-4 sentences) since they are read aloud via text-to-speech. No markdown, no bullet lists, no headers. Be warm, a little dry-witted, and direct.";

  let state = 'idle'; // idle | listening | thinking | speaking | error
  let history = [];
  let apiKey = localStorage.getItem('paco_api_key') || '';
  let model = localStorage.getItem('paco_model') || 'claude-sonnet-5';
  let voiceName = localStorage.getItem('paco_voice') || '';

  modelSelect.value = model;

   <script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBG0_JSfjYyD-JUth0-tD5-GHCpyX9VtPE",
    authDomain: "paco---my-ai-assistant.firebaseapp.com",
    projectId: "paco---my-ai-assistant",
    storageBucket: "paco---my-ai-assistant.firebasestorage.app",
    messagingSenderId: "813461861331",
    appId: "1:813461861331:web:9deaf3fb206cb7c05db526"
  };
  
  // ---------- Settings ----------
  function maskKey(k) {
    if (!k) return 'No key saved.';
    if (k.length <= 12) return 'Saved key: ' + k[0] + '***' + ' (' + k.length + ' chars — looks too short for a real key)';
    return 'Saved key: ' + k.slice(0, 10) + '…' + k.slice(-4) + ' (' + k.length + ' chars)';
  }
  function openSettings() {
    apiKeyInput.value = apiKey;
    voiceSelect.value = voiceName;
    apiKeyPreview.textContent = maskKey(apiKey);
    settingsOverlay.classList.remove('hidden');
  }
  function closeSettings() {
    settingsOverlay.classList.add('hidden');
  }
  settingsBtn.onclick = openSettings;
  closeSettingsBtn.onclick = closeSettings;
  apiKeyInput.addEventListener('input', () => {
    apiKeyPreview.textContent = maskKey(apiKeyInput.value.trim());
  });
  saveSettingsBtn.onclick = () => {
    apiKey = apiKeyInput.value.trim();
    model = modelSelect.value;
    voiceName = voiceSelect.value;
    localStorage.setItem('paco_api_key', apiKey);
    localStorage.setItem('paco_model', model);
    localStorage.setItem('paco_voice', voiceName);
    closeSettings();
    setStatus('idle');
  };
  clearKeyBtn.onclick = () => {
    apiKey = '';
    apiKeyInput.value = '';
    apiKeyPreview.textContent = maskKey('');
    localStorage.removeItem('paco_api_key');
  };

  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Default';
    voiceSelect.appendChild(def);
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = v.name + ' (' + v.lang + ')';
      voiceSelect.appendChild(opt);
    });
    voiceSelect.value = voiceName;
  }
  if ('speechSynthesis' in window) {
    populateVoices();
    speechSynthesis.onvoiceschanged = populateVoices;
  }

  // ---------- Transcript ----------
  function logLine(who, text) {
    const div = document.createElement('div');
    div.className = who;
    const prefix = who === 'you' ? 'You: ' : who === 'paco' ? 'Paco: ' : '';
    div.textContent = prefix + text;
    transcriptEl.appendChild(div);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  // ---------- State / status ----------
  function setStatus(s) {
    state = s;
    const labels = { idle: 'IDLE', listening: 'LISTENING…', thinking: 'THINKING…', speaking: 'SPEAKING…', error: 'ERROR' };
    statusEl.textContent = labels[s] || s;
  }
  setStatus('idle');

  // ---------- Speech recognition ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let finalTranscript = '';
  let interimTranscript = '';

  if (SR) {
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }
      if (state === 'listening') {
        const live = (finalTranscript + interimTranscript).trim();
        statusEl.textContent = 'LISTENING… ' + (live || '(no speech detected yet)');
      }
    };
    recognition.onerror = (e) => {
      console.error('recognition error', e.error);
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        logLine('err', 'Voice recognition error: ' + e.error);
      }
    };
    recognition.onend = () => {
      stopMicVisualizer();
      talkBtn.classList.remove('active');
      // a held phrase often hasn't been finalized yet when the button is
      // released, since the recognizer only finalizes after a pause — fall
      // back to whatever interim transcript we have.
      const text = (finalTranscript || interimTranscript).trim();
      finalTranscript = '';
      interimTranscript = '';
      if (text) {
        sendToPaco(text);
      } else if (state === 'listening') {
        setStatus('idle');
      }
    };
  } else {
    talkBtn.disabled = true;
    talkBtn.textContent = 'VOICE NOT SUPPORTED — USE TEXT BELOW';
  }

  function startListening() {
    if (!recognition || state === 'listening') return;
    if (!apiKey) { openSettings(); return; }
    finalTranscript = '';
    interimTranscript = '';
    talkBtn.classList.add('active');
    setStatus('listening');
    startMicVisualizer();
    try {
      recognition.start();
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        logLine('err', 'Could not start voice recognition: ' + err.message);
      }
    }
  }
  function stopListening() {
    if (!recognition) return;
    if (state === 'listening') recognition.stop();
  }

  talkBtn.addEventListener('mousedown', startListening);
  talkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startListening(); });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev =>
    talkBtn.addEventListener(ev, stopListening)
  );

  textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    if (!apiKey) { openSettings(); return; }
    sendToPaco(text);
  });

  // ---------- Mic visualizer ----------
  let audioCtx = null, analyser = null, micSource = null, micStream = null, freqData = null;

  async function startMicVisualizer() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
    } catch (err) {
      logLine('err', 'Microphone access denied or unavailable.');
      setStatus('idle');
      talkBtn.classList.remove('active');
    }
  }
  function stopMicVisualizer() {
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();
    audioCtx = null; analyser = null; micSource = null; micStream = null; freqData = null;
  }

  // ---------- Claude API ----------
  async function sendToPaco(text) {
    logLine('you', text);
    history.push({ role: 'user', content: text });
    if (history.length > 20) history = history.slice(-20);
    setStatus('thinking');

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: history
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
      const reply = (data.content || []).map(b => b.text || '').join(' ').trim() || '...';
      history.push({ role: 'assistant', content: reply });
      logLine('paco', reply);
      speak(reply);
    } catch (err) {
      logLine('err', err.message);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }

  // ---------- Text to speech ----------
  function speak(text) {
    if (!('speechSynthesis' in window)) { setStatus('idle'); return; }
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceName) {
      const v = speechSynthesis.getVoices().find(v => v.name === voiceName);
      if (v) utter.voice = v;
    }
    utter.onstart = () => setStatus('speaking');
    utter.onend = () => setStatus('idle');
    utter.onerror = () => setStatus('idle');
    speechSynthesis.speak(utter);
  }

  // ================= HUD RENDERING (reactive orb + waveform + digital rain) =================
  const t0 = performance.now();
  let lastTime = 0;
  const ORB_Y = 0.4;
  const WAVE_Y = 0.68;
  const WAVE_BARS = 22;
  const WAVE_HALF_W = 150;

  function colorForState() {
    switch (state) {
      case 'listening': return { hue: '#5ad8ff' };
      case 'thinking': return { hue: '#ffb347' };
      case 'speaking': return { hue: '#8be9ff' };
      case 'error': return { hue: '#ff5a5a' };
      default: return { hue: '#5ad8ff' };
    }
  }

  function micLevel() {
    if (!(analyser && freqData)) return 0;
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) sum += freqData[i];
    return sum / freqData.length / 255;
  }

  function drawGlowSpot(nx, ny, radius, hue, alpha) {
    const x = W * nx, y = H * ny;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, hue);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighten';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawOrb(hue, radius, ringAlpha) {
    const cx = W * 0.5, cy = H * ORB_Y;
    drawGlowSpot(0.5, ORB_Y, radius * 1.8, hue, 0.5);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, hue);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hue;
    ctx.globalAlpha = ringAlpha;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawThinkingRing(hue, t) {
    const cx = W * 0.5, cy = H * ORB_Y;
    const segments = 5;
    const segAngle = (Math.PI * 2) / segments;
    ctx.strokeStyle = hue;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < segments; i++) {
      const start = t * 3 + i * segAngle;
      ctx.beginPath();
      ctx.arc(cx, cy, 96, start, start + segAngle * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWaveform(hue, levels) {
    const cy = H * WAVE_Y;
    const n = levels.length;
    const spacing = (WAVE_HALF_W * 2) / (n - 1);
    ctx.fillStyle = hue;
    for (let i = 0; i < n; i++) {
      const x = W * 0.5 - WAVE_HALF_W + i * spacing;
      const h = Math.max(3, levels[i] * 70);
      ctx.globalAlpha = 0.55 + levels[i] * 0.45;
      ctx.fillRect(x - 2, cy - h / 2, 4, h);
    }
    ctx.globalAlpha = 1;
  }

  // word-like open/close rhythm rather than a single smooth pulse, so speech
  // reactivity reads as talking rather than a single blob pulsing
  function talkEnvelope(t) {
    const words = Math.abs(Math.sin(t * 2.1));
    const gate = words > 0.25 ? 1 : words / 0.25;
    const flap = 0.5 + 0.5 * Math.sin(t * 14 + Math.sin(t * 5) * 3);
    return Math.max(0, Math.min(1, flap * gate));
  }

  // ---- matrix-style digital rain (falling 1s and 0s) ----
  let rainCols = [];
  function initRain() {
    const colW = 18;
    const n = Math.floor(W / colW);
    rainCols = [];
    for (let i = 0; i < n; i++) {
      rainCols.push({
        x: i * colW + colW / 2,
        y: -Math.random() * H,
        speed: 60 + Math.random() * 90,
        len: 10 + Math.floor(Math.random() * 14)
      });
    }
  }
  initRain();

 function drawRain(alphaMul, hue, speedMul, dt) { const rowH = 20; ctx.font = '16px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; rainCols.forEach(col => { if (!col.chars) col.chars = Array.from({ length: 24 }, () => Math.random() < 0.5 ? '0' : '1'); if (dt > 0) { col.y += col.speed * speedMul * dt; if (col.y - col.len * rowH > H) { col.y = -Math.random() * 200; col.speed = 60 + Math.random() * 90; col.len = 10 + Math.floor(Math.random() * 14); col.chars = Array.from({ length: 24 }, () => Math.random() < 0.5 ? '0' : '1'); } } for (let r = 0; r < col.len; r++) { const cy = col.y - r * rowH; if (cy < -rowH || cy > H + rowH) continue;
const a = (1 - r / col.len) * alphaMul; if (a <= 0.02) continue; ctx.globalAlpha = a; ctx.fillStyle = hue; ctx.fillText(col.chars[r % col.chars.length], col.x, cy); } }); ctx.globalAlpha = 1; }

  function draw(now) {
    if (lastTime === 0) lastTime = now;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const t = (now - t0) / 1000;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, W, H);

    const { hue } = colorForState();
    const level = state === 'listening' ? micLevel() : 0;
    const speedMul = state === 'thinking' ? 1.9 : state === 'error' ? 2.4 : state === 'listening' ? 1.3 : state === 'speaking' ? 1.15 : 1;

    drawRain(0.55, hue, speedMul, dt);

    const levels = new Array(WAVE_BARS).fill(0);
    let orbR = 70 + Math.sin(t * 1.3) * 4;
    let ringA = 0.25;

    if (state === 'listening' && analyser && freqData) {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < WAVE_BARS; i++) {
        const bin = Math.floor((i / WAVE_BARS) * freqData.length);
        levels[i] = freqData[bin] / 255;
      }
      orbR = 70 + level * 30;
      ringA = 0.4 + level * 0.4;
    } else if (state === 'thinking') {
      for (let i = 0; i < WAVE_BARS; i++) {
        levels[i] = (Math.sin(t * 10 + i) + 1) / 2 * 0.4;
      }
      orbR = 70 + Math.sin(t * 6) * 6;
    } else if (state === 'speaking') {
      const amount = talkEnvelope(t);
      for (let i = 0; i < WAVE_BARS; i++) {
        levels[i] = Math.abs(Math.sin(t * 8 + i * 0.7)) * amount;
      }
      orbR = 74 + amount * 18;
      ringA = 0.35 + amount * 0.3;
    } else if (state === 'error') {
      const blink = 0.5 + 0.5 * Math.abs(Math.sin(t * 10));
      levels.fill(0.3 * blink);
      orbR = 70 + blink * 10;
      ringA = 0.5 * blink;
    }

    drawOrb(hue, orbR, ringA);
    if (state === 'thinking') drawThinkingRing(hue, t);
    drawWaveform(hue, levels);

    drawRain(0.2, hue, speedMul, 0);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
