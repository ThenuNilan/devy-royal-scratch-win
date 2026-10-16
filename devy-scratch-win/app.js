"use strict";

(() => {
  const CONFIG = window.DEVY_CONFIG;

  const $ = (id) => document.getElementById(id);

  const ui = {
    customerPanel: $("customerPanel"),
    customerForm: $("customerForm"),
    customerName: $("customerName"),
    customerAddress: $("customerAddress"),
    customerConsent: $("customerConsent"),

    scratchPanel: $("scratchPanel"),
    customerNumber: $("customerNumber"),
    card: $("scratchCard"),
    canvas: $("scratchCanvas"),
    prompt: $("scratchPrompt"),

    visibleCardNumber: $("visibleCardNumber"),
    progressTitle: $("progressTitle"),
    progressStatus: $("progressStatus"),
    progressFill: $("progressFill"),

    prizeFace: $("prizeFace"),
    prizeIcon: $("prizeIcon"),
    prizeKicker: $("prizeKicker"),
    prizeTitle: $("prizeTitle"),
    prizeDescription: $("prizeDescription"),

    nextButton: $("nextCardButton"),
    resultsButton: $("resultsButton"),

    resultsPanel: $("resultsPanel"),
    resultsHeading: $("resultsHeading"),
    resultsSubheading: $("resultsSubheading"),
    summaryGrid: $("summaryGrid"),
    resultGuestNumber: $("resultGuestNumber"),
    resultsList: $("resultsList"),
    redemptionBox: $("redemptionBox"),
    redemptionCode: $("redemptionCode"),
    restartButton: $("restartButton"),

    toast: $("toast"),
    celebrationLayer: $("celebrationLayer")
  };

  const context = ui.canvas.getContext("2d", {
    willReadFrequently: true
  });

  let currentCustomer = null;
  let cardIndex = 0;
  let isPointerDown = false;
  let activePointerId = null;
  let previousPoint = null;
  let totalDragDistance = 0;
  let revealing = false;
  let lastCoverageCheck = 0;
  let toastTimer = null;
  let phoenixOverlay = null;
  let phoenixAnimationFrame = null;
  let phoenixParticles = [];
  let phoenixCloseTimer = null;
  let activePhoenixCard = null;

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Storage read failed:", error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Storage write failed:", error);
      notify("Browser storage is unavailable. Your demo may not be saved.");
      return false;
    }
  }

  function getCustomers() {
    const value = readJSON(CONFIG.storageKey, []);
    return Array.isArray(value) ? value : [];
  }

  function getStock() {
    const saved = readJSON(CONFIG.stockKey, {});
    const result = {};

    CONFIG.prizes.forEach((prize) => {
      const savedQuantity = Number(saved[prize.id]);
      result[prize.id] =
        Number.isInteger(savedQuantity) && savedQuantity >= 0
          ? savedQuantity
          : prize.quantity;
    });

    return result;
  }

  function money(value) {
    return "LKR " + Number(value || 0).toLocaleString("en-LK");
  }

  function makeCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "DEVY-";

    for (let i = 0; i < 6; i += 1) {
      result += characters[Math.floor(Math.random() * characters.length)];
    }

    return result;
  }

  function notify(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      ui.toast.classList.remove("show");
    }, 3300);
  }

  function setStep(number) {
    document.querySelectorAll(".stepper .step").forEach((step) => {
      const current = Number(step.dataset.step);
      step.classList.toggle("active", current === number);
      step.classList.toggle("completed", current < number);
    });
  }

  function showPanel(panel) {
    [ui.customerPanel, ui.scratchPanel, ui.resultsPanel].forEach((item) => {
      item.classList.toggle("hidden", item !== panel);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getNextNumber() {
    const customers = getCustomers();

    const largestNumber = customers.reduce((largest, customer) => {
      return Math.max(largest, Number(customer.customerNumber) || 0);
    }, 0);

    let savedNumber = 1;

    try {
      savedNumber = Number(localStorage.getItem(CONFIG.nextNumberKey)) || 1;
    } catch (_) {}

    return Math.max(savedNumber, largestNumber + 1);
  }

  function setNextNumber(value) {
    try {
      localStorage.setItem(CONFIG.nextNumberKey, String(value));
    } catch (_) {}
  }

  function choosePosition(customerNumber) {
    const configured = CONFIG.positions[customerNumber];

    if (Array.isArray(configured) && configured.length) {
      return configured.slice();
    }

    return [((customerNumber * 7 + 2) % CONFIG.cardCount) + 1];
  }

  function choosePrize(stock) {
    const available = CONFIG.prizes.filter((prize) => {
      return Number(stock[prize.id]) > 0;
    });

    if (!available.length) return null;

    const selected = available[Math.floor(Math.random() * available.length)];
    stock[selected.id] -= 1;

    return { ...selected };
  }

  function allocateCards(customerNumber) {
    const stock = getStock();
    const positions = choosePosition(customerNumber);
    const special = customerNumber % CONFIG.specialInterval === 0;

    const cards = Array.from({ length: CONFIG.cardCount }, (_, index) => ({
      cardNumber: index + 1,
      type: "oops",
      label: "OOPS",
      prizeId: null,
      prizeName: "Not this time",
      value: 0,
      icon: "✧",
      redemptionCode: null,
      effect: null,
      revealed: false
    }));

    const prizePosition = positions[0] || 1;
    const prize = choosePrize(stock);

    if (prize) {
      cards[prizePosition - 1] = {
        cardNumber: prizePosition,
        type: "prize",
        label: "YOU WON",
        prizeId: prize.id,
        prizeName: prize.name,
        value: prize.value,
        icon: prize.icon,
        redemptionCode: makeCode(),
        effect: CONFIG.effects[(customerNumber - 1) % CONFIG.effects.length],
        revealed: false
      };
    } else {
      cards[prizePosition - 1] = {
        ...cards[prizePosition - 1],
        type: "soldout",
        label: "THANK YOU",
        prizeName: "Thank you for joining",
        icon: "✦"
      };
    }

    // Key Tag inventory has not been confirmed.
    // Reserve a festive placeholder instead of claiming an unverified prize.
    if (special) {
      let specialPosition = positions[1] || (prizePosition === 5 ? 1 : 5);

      if (specialPosition === prizePosition) {
        specialPosition = prizePosition === 5 ? 1 : prizePosition + 1;
      }

      cards[specialPosition - 1] = {
        cardNumber: specialPosition,
        type: "special-pending",
        label: "FESTIVE SURPRISE",
        prizeId: null,
        prizeName: "A festive surprise",
        value: 0,
        icon: "✦",
        redemptionCode: null,
        effect: CONFIG.effects[(customerNumber + 4) % CONFIG.effects.length],
        revealed: false
      };
    }

    if (!writeJSON(CONFIG.stockKey, stock)) {
      throw new Error("Could not save prize inventory.");
    }

    return {
      cards,
      special,
      createdAt: new Date().toISOString()
    };
  }

  function makeCustomer(name, address, number) {
    const allocation = allocateCards(number);

    return {
      id: `GUEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerNumber: number,
      name,
      address,
      createdAt: allocation.createdAt,
      cards: allocation.cards,
      special: allocation.special,
      completed: false,
      redeemedCodes: [],
      redeemed: false
    };
  }

  /* Floating background particles */

  function createAmbientParticles() {
    const host = $("particles");
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 22; i += 1) {
      const particle = document.createElement("span");
      particle.className = "ambient-particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.setProperty("--duration", `${9 + Math.random() * 12}s`);
      particle.style.setProperty("--delay", `${Math.random() * -18}s`);
      particle.style.setProperty("--drift", `${Math.random() * 120 - 60}px`);
      fragment.appendChild(particle);
    }

    host.appendChild(fragment);
  }

  /* Scratch surface */

  function drawCover() {
    const bounds = ui.canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    ui.canvas.width = Math.round(width * ratio);
    ui.canvas.height = Math.round(height * ratio);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#fff0b9");
    gradient.addColorStop(.18, "#d0a83a");
    gradient.addColorStop(.36, "#f9e8a8");
    gradient.addColorStop(.56, "#b68b29");
    gradient.addColorStop(.77, "#f8e6a0");
    gradient.addColorStop(1, "#c49b31");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = .18;
    context.lineWidth = 1;

    for (let x = -height; x < width + height; x += 36) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + height * .7, height);
      context.strokeStyle = "#fff9df";
      context.stroke();
    }

    context.restore();

    context.strokeStyle = "rgba(76,43,15,.42)";
    context.lineWidth = 1;
    context.strokeRect(12, 12, width - 24, height - 24);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#543818";
    context.font = "700 10px DM Sans, Arial, sans-serif";
    context.fillText("THE DEVY ROYAL REVEAL", width / 2, height / 2 - 17);

    context.fillStyle = "rgba(70,43,17,.85)";
    context.font = "9px DM Sans, Arial, sans-serif";
    context.fillText("RUB GENTLY TO DISCOVER", width / 2, height / 2 + 7);

    context.fillStyle = "rgba(255,249,225,.9)";
    context.font = "8px DM Sans, Arial, sans-serif";
    context.fillText("YOUR GOLDEN MOMENT", width / 2, height / 2 + 29);

    totalDragDistance = 0;
    previousPoint = null;
    isPointerDown = false;
    activePointerId = null;
    revealing = false;

    ui.canvas.classList.remove("scratched");
    ui.canvas.style.pointerEvents = "auto";
    ui.prompt.classList.remove("hidden");
    ui.nextButton.classList.add("hidden");
    ui.resultsButton.classList.add("hidden");
    ui.progressStatus.textContent = "Ready to reveal";
  }

  function pointerPosition(event) {
    const bounds = ui.canvas.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top))
    };
  }

  function eraseStroke(start, end) {
    const bounds = ui.canvas.getBoundingClientRect();

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(36, Math.min(bounds.width, bounds.height) * .12);

    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.restore();

    totalDragDistance += Math.hypot(end.x - start.x, end.y - start.y);
  }

  function measureCoverage() {
    const width = ui.canvas.width;
    const height = ui.canvas.height;

    if (!width || !height) return 0;

    try {
      const pixels = context.getImageData(0, 0, width, height).data;
      let transparent = 0;
      let sampled = 0;
      const stride = 4 * 8;

      for (let i = 3; i < pixels.length; i += stride) {
        sampled += 1;
        if (pixels[i] < 80) transparent += 1;
      }

      return sampled ? transparent / sampled : 0;
    } catch (error) {
      console.warn("Could not measure scratch coverage.", error);
      return 0;
    }
  }

  function handlePointerDown(event) {
    if (revealing || ui.canvas.classList.contains("scratched")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();

    isPointerDown = true;
    activePointerId = event.pointerId;
    previousPoint = pointerPosition(event);

    try {
      ui.canvas.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handlePointerMove(event) {
    if (!isPointerDown || revealing) return;

    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();

    const point = pointerPosition(event);

    if (previousPoint) {
      eraseStroke(previousPoint, point);
    }

    previousPoint = point;
    ui.prompt.classList.add("hidden");

    const now = performance.now();

    if (now - lastCoverageCheck >= 100) {
      lastCoverageCheck = now;

      const coverage = measureCoverage();
      const percent = Math.min(100, Math.round(coverage * 100));

      ui.progressStatus.textContent = `${percent}% revealed`;

      if (
        coverage >= CONFIG.scratchRevealThreshold &&
        totalDragDistance > 70
      ) {
        revealCard();
      }
    }
  }

  function endPointer(event) {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;

    isPointerDown = false;
    previousPoint = null;
    activePointerId = null;
  }

  function attachScratchHandlers() {
    ui.canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
    ui.canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
    ui.canvas.addEventListener("pointerup", endPointer);
    ui.canvas.addEventListener("pointercancel", endPointer);

    ui.canvas.addEventListener("lostpointercapture", () => {
      isPointerDown = false;
      previousPoint = null;
      activePointerId = null;
    });
  }

  function currentCard() {
    return currentCustomer ? currentCustomer.cards[cardIndex] : null;
  }

  function renderPrize(card) {
    const winner = card.type === "prize" || card.type === "keytag";
    const pending = card.type === "special-pending";

    ui.prizeFace.classList.toggle("winner", winner);
    ui.prizeIcon.textContent = card.icon || "✧";

    if (winner) {
      ui.prizeKicker.textContent = "CONGRATULATIONS";
      ui.prizeTitle.textContent = card.prizeName;
      ui.prizeDescription.textContent = `You have won ${card.prizeName}.`;
    } else if (pending) {
      ui.prizeKicker.textContent = "FESTIVE SURPRISE";
      ui.prizeTitle.textContent = "A little festive magic";
      ui.prizeDescription.textContent =
        "Please check with the DEVY team about this special campaign reward.";
    } else if (card.type === "soldout") {
      ui.prizeKicker.textContent = "THANK YOU";
      ui.prizeTitle.textContent = "Thank you for joining";
      ui.prizeDescription.textContent =
        "Thank you for being part of this festive experience.";
    } else {
      ui.prizeKicker.textContent = "KEEP THE MAGIC";
      ui.prizeTitle.textContent = "Not this time";
      ui.prizeDescription.textContent =
        "Thank you for being part of the DEVY experience.";
    }
  }

  function renderCard() {
    const card = currentCard();
    if (!card) return;

    ui.visibleCardNumber.textContent =
      `CARD NO. ${String(card.cardNumber).padStart(2, "0")}`;

    ui.progressTitle.textContent =
      `CARD ${String(card.cardNumber).padStart(2, "0")} OF 05`;

    ui.progressFill.style.width =
      `${(cardIndex / CONFIG.cardCount) * 100}%`;

    renderPrize(card);
    drawCover();
  }

  /* Particle effects */

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function addConfetti(count) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = ["#f5de91","#d4af37","#fff2c6","#b58a27"][i % 4];
      piece.style.setProperty("--fall", `${randomBetween(1.7,3.3)}s`);
      piece.style.setProperty("--drift", `${randomBetween(-90,90)}px`);
      fragment.appendChild(piece);
      setTimeout(() => piece.remove(), 3600);
    }

    ui.celebrationLayer.appendChild(fragment);
  }

  function addBurst(count, symbol = "✦") {
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement("span");
      star.className = "burst-star";
      star.textContent = ["✦","✧","✺",symbol][i % 4];
      star.style.left = `${randomBetween(42,58)}%`;
      star.style.top = `${randomBetween(40,56)}%`;
      star.style.setProperty("--x", `${randomBetween(-230,230)}px`);
      star.style.setProperty("--y", `${randomBetween(-240,240)}px`);
      ui.celebrationLayer.appendChild(star);
      setTimeout(() => star.remove(), 1300);
    }
  }

  function addRings(count) {
    for (let i = 0; i < count; i += 1) {
      const ring = document.createElement("span");
      ring.className = "magic-ring";
      ring.style.animationDelay = `${i * .16}s`;
      ring.style.borderColor = i % 2 ? "#d4af37" : "#fff2c6";
      ui.celebrationLayer.appendChild(ring);
      setTimeout(() => ring.remove(), 1400);
    }
  }

  function addHearts(count) {
    for (let i = 0; i < count; i += 1) {
      const heart = document.createElement("span");
      heart.className = "burst-star";
      heart.textContent = "♥";
      heart.style.left = `${randomBetween(40,60)}%`;
      heart.style.top = `${randomBetween(40,60)}%`;
      heart.style.setProperty("--x", `${randomBetween(-180,180)}px`);
      heart.style.setProperty("--y", `${randomBetween(-230,230)}px`);
      ui.celebrationLayer.appendChild(heart);
      setTimeout(() => heart.remove(), 1300);
    }
  }

  function addShootingStars(count) {
    for (let i = 0; i < count; i += 1) {
      const star = document.createElement("span");
      star.className = "burst-star";
      star.textContent = "✦";
      star.style.left = `${randomBetween(15,85)}%`;
      star.style.top = `${randomBetween(12,60)}%`;
      star.style.setProperty("--x", `${randomBetween(100,230)}px`);
      star.style.setProperty("--y", `${randomBetween(50,150)}px`);
      ui.celebrationLayer.appendChild(star);
      setTimeout(() => star.remove(), 1300);
    }
  }

  function runEffect(name) {
    ui.card.classList.remove("effect-flash","effect-flip","effect-wave");
    void ui.card.offsetWidth;

    switch (name) {
      case "golden-explosion":
        ui.card.classList.add("effect-flash");
        addBurst(30);
        break;
      case "royal-spotlight":
        ui.card.classList.add("effect-flash");
        addRings(2);
        addConfetti(18);
        break;
      case "gold-confetti-rain":
        addConfetti(75);
        break;
      case "fireworks-pop":
        addBurst(40);
        setTimeout(() => addBurst(25), 230);
        break;
      case "magic-ring":
        addRings(4);
        break;
      case "golden-ribbon-swirl":
        addConfetti(45);
        addBurst(15,"✧");
        break;
      case "shooting-star":
        addShootingStars(10);
        break;
      case "gold-card-flip":
        ui.card.classList.add("effect-flip");
        addConfetti(24);
        break;
      case "golden-heart-burst":
        addHearts(22);
        break;
      case "golden-wave-reveal":
        ui.card.classList.add("effect-wave");
        addRings(2);
        break;
      default:
        addBurst(18);
    }

    setTimeout(() => {
      ui.card.classList.remove("effect-flash","effect-flip","effect-wave");
    }, 1200);
  }

  /* Phoenix Gold Rise signature effect */

  function createPhoenixOverlay() {
    if (phoenixOverlay) return phoenixOverlay;

    phoenixOverlay = document.createElement("div");
    phoenixOverlay.className = "phoenix-overlay";
    phoenixOverlay.setAttribute("role", "dialog");
    phoenixOverlay.setAttribute("aria-modal", "true");
    phoenixOverlay.setAttribute("aria-label", "DEVY Phoenix Gold Rise prize reveal");

    phoenixOverlay.innerHTML = `
      <canvas class="phoenix-canvas" aria-hidden="true"></canvas>
      <div class="phoenix-flash" aria-hidden="true"></div>

      <div class="phoenix-content">
        <div class="phoenix-aura" aria-hidden="true"></div>

        <svg class="phoenix-bird" viewBox="0 0 360 300" role="img" aria-label="Golden phoenix rising">
          <defs>
            <linearGradient id="phoenixGoldGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#fff4bd"/>
              <stop offset="35%" stop-color="#f5de91"/>
              <stop offset="68%" stop-color="#d4af37"/>
              <stop offset="100%" stop-color="#a56a16"/>
            </linearGradient>
            <linearGradient id="phoenixWingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fff0b3"/>
              <stop offset="100%" stop-color="#d4af37"/>
            </linearGradient>
          </defs>

          <g class="phoenix-wing" fill="url(#phoenixWingGradient)">
            <path d="M177 161 C142 120 100 87 18 32 C43 78 68 116 105 148 C73 133 48 125 8 120 C49 159 88 183 140 193 C115 190 91 198 69 211 C108 224 143 216 174 193 Z"/>
            <path d="M183 161 C218 120 260 87 342 32 C317 78 292 116 255 148 C287 133 312 125 352 120 C311 159 272 183 220 193 C245 190 269 198 291 211 C252 224 217 216 186 193 Z"/>
          </g>

          <g class="phoenix-core">
            <path d="M180 48 C166 64 168 78 180 89 C192 78 194 64 180 48 Z"/>
            <path d="M180 82 C158 107 152 140 163 168 L180 203 L197 168 C208 140 202 107 180 82 Z"/>
            <path d="M163 158 C147 176 138 192 135 213 C154 205 168 194 180 178 C192 194 206 205 225 213 C222 192 213 176 197 158 L180 190 Z"/>
            <path d="M170 200 C163 224 147 245 128 261 C153 253 171 242 180 226 C189 242 207 253 232 261 C213 245 197 224 190 200 Z"/>
          </g>

          <g fill="#fff0b3">
            <circle cx="180" cy="55" r="3"/>
            <circle cx="105" cy="148" r="2.5"/>
            <circle cx="255" cy="148" r="2.5"/>
            <circle cx="140" cy="193" r="2"/>
            <circle cx="220" cy="193" r="2"/>
          </g>
        </svg>

        <div class="phoenix-prize">
          <p class="phoenix-eyebrow">DEVY ROYAL REWARD</p>
          <h2 class="phoenix-title">YOU WON!</h2>
          <p class="phoenix-value"></p>
          <p class="phoenix-code"></p>
        </div>

        <button type="button" class="phoenix-dismiss">CONTINUE</button>
        <p class="phoenix-status">A golden moment, made for you.</p>
      </div>
    `;

    document.body.appendChild(phoenixOverlay);

    phoenixOverlay.querySelector(".phoenix-dismiss").addEventListener("click", closePhoenixEffect);

    return phoenixOverlay;
  }

  function resizePhoenixCanvas() {
    if (!phoenixOverlay) return;

    const canvas = phoenixOverlay.querySelector(".phoenix-canvas");
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function createPhoenixParticles() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const amount = Math.min(145, Math.max(55, Math.floor((width * height) / 8000)));

    phoenixParticles = [];

    for (let i = 0; i < amount; i += 1) {
      phoenixParticles.push({
        x: width * .5 + (Math.random() - .5) * width * .7,
        y: height + Math.random() * height * .35,
        size: .8 + Math.random() * 3.2,
        speedY: .8 + Math.random() * 2.6,
        speedX: (Math.random() - .5) * 1.5,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: .015 + Math.random() * .035,
        alpha: .5 + Math.random() * .5,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - .5) * .08
      });
    }
  }

  function animatePhoenixParticles() {
    if (!phoenixOverlay || !phoenixOverlay.classList.contains("active")) {
      return;
    }

    const canvas = phoenixOverlay.querySelector(".phoenix-canvas");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const width = window.innerWidth;
    const height = window.innerHeight;

    phoenixParticles.forEach((particle) => {
      particle.y -= particle.speedY;
      particle.x += particle.speedX + Math.sin(particle.sway) * .55;
      particle.sway += particle.swaySpeed;
      particle.rotation += particle.rotationSpeed;

      if (particle.y < -10) {
        particle.y = height + Math.random() * 100;
        particle.x = width * .5 + (Math.random() - .5) * width * .8;
      }

      if (particle.x < -20) particle.x = width + 10;
      if (particle.x > width + 20) particle.x = -10;

      const flicker = .65 + Math.sin(particle.sway * 4) * .3;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = Math.max(.12, Math.min(1, particle.alpha * flicker));
      ctx.shadowBlur = particle.size * 5;
      ctx.shadowColor = "#f5c84b";
      ctx.fillStyle = Math.random() > .18 ? "#f5de91" : "#ffffff";

      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    phoenixAnimationFrame = requestAnimationFrame(animatePhoenixParticles);
  }

  function playPhoenixGoldRise(card) {
    const overlay = createPhoenixOverlay();

    activePhoenixCard = card;

    overlay.querySelector(".phoenix-title").textContent = card.prizeName;
    overlay.querySelector(".phoenix-value").textContent =
      card.value > 0 ? `Prize value: ${money(card.value)}` : "A special DEVY reward";

    overlay.querySelector(".phoenix-code").textContent =
      card.redemptionCode ? `CODE: ${card.redemptionCode}` : "";

    const prizePanel = overlay.querySelector(".phoenix-prize");
    const button = overlay.querySelector(".phoenix-dismiss");

    prizePanel.classList.remove("visible");
    button.classList.remove("visible");

    if (phoenixCloseTimer) {
      clearTimeout(phoenixCloseTimer);
      phoenixCloseTimer = null;
    }

    if (phoenixAnimationFrame) {
      cancelAnimationFrame(phoenixAnimationFrame);
      phoenixAnimationFrame = null;
    }

    resizePhoenixCanvas();
    createPhoenixParticles();

    void overlay.offsetWidth;
    overlay.classList.add("active");
    animatePhoenixParticles();

    window.setTimeout(() => {
      if (!overlay.classList.contains("active")) return;

      prizePanel.classList.add("visible");
      button.classList.add("visible");
    }, 1850);

    phoenixCloseTimer = window.setTimeout(closePhoenixEffect, 9000);
  }

  function closePhoenixEffect() {
    if (!phoenixOverlay) return;

    phoenixOverlay.classList.remove("active");

    if (phoenixAnimationFrame) {
      cancelAnimationFrame(phoenixAnimationFrame);
      phoenixAnimationFrame = null;
    }

    if (phoenixCloseTimer) {
      clearTimeout(phoenixCloseTimer);
      phoenixCloseTimer = null;
    }

    if (activePhoenixCard) {
      activePhoenixCard = null;
    }
  }

  window.addEventListener("resize", () => {
    if (phoenixOverlay && phoenixOverlay.classList.contains("active")) {
      resizePhoenixCanvas();
    }
  });

  /* Reveal card */

  function revealCard() {
    if (revealing) return;

    revealing = true;

    const card = currentCard();

    if (!card) {
      revealing = false;
      return;
    }

    isPointerDown = false;
    previousPoint = null;
    activePointerId = null;

    const bounds = ui.canvas.getBoundingClientRect();

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.restore();

    ui.canvas.classList.add("scratched");
    ui.canvas.style.pointerEvents = "none";
    ui.prompt.classList.add("hidden");

    ui.progressStatus.textContent = "Reveal complete";
    ui.progressFill.style.width = `${((cardIndex + 1) / CONFIG.cardCount) * 100}%`;

    card.revealed = true;
    renderPrize(card);

    // Save the revealed card result in this browser demo.
    const savedCustomers = getCustomers();
    const savedIndex = savedCustomers.findIndex((record) => record.id === currentCustomer.id);

    if (savedIndex >= 0) {
      savedCustomers[savedIndex].cards[cardIndex] = card;
      writeJSON(CONFIG.storageKey, savedCustomers);
    }

    const winning = card.type === "prize" || card.type === "keytag";

    if (winning) {
      // Phoenix Gold Rise is the signature effect for every real winning card.
      playPhoenixGoldRise(card);

      // Keep the assigned effect as a subtle secondary flourish.
      runEffect(card.effect);
    } else if (card.type === "special-pending") {
      runEffect("golden-wave-reveal");
    } else {
      ui.card.classList.add("effect-wave");
      setTimeout(() => ui.card.classList.remove("effect-wave"), 1000);
    }

    setTimeout(() => {
      revealing = false;

      if (cardIndex < CONFIG.cardCount - 1) {
        ui.nextButton.classList.remove("hidden");
        ui.resultsButton.classList.add("hidden");
      } else {
        ui.nextButton.classList.add("hidden");
        ui.resultsButton.classList.remove("hidden");
      }
    }, winning ? 900 : 750);
  }

  /* Customer entry */

  function startExperience(event) {
    event.preventDefault();

    const name = ui.customerName.value.trim();
    const address = ui.customerAddress.value.trim();

    if (name.length < 2) {
      notify("Please enter your full name.");
      ui.customerName.focus();
      return;
    }

    if (address.length < 5) {
      notify("Please enter your complete address.");
      ui.customerAddress.focus();
      return;
    }

    if (!ui.customerConsent.checked) {
      notify("Please confirm that your details are correct.");
      return;
    }

    const number = getNextNumber();
    let customer;

    try {
      customer = makeCustomer(name, address, number);
    } catch (error) {
      console.error(error);
      notify("Could not prepare this entry. Please try again.");
      return;
    }

    const records = getCustomers();
    records.push(customer);

    if (!writeJSON(CONFIG.storageKey, records)) {
      notify("The customer record could not be saved.");
      return;
    }

    currentCustomer = customer;
    setNextNumber(number + 1);
    cardIndex = 0;

    ui.customerNumber.textContent = String(number).padStart(2, "0");

    showPanel(ui.scratchPanel);
    setStep(2);
    renderCard();
  }

  function nextCard() {
    if (revealing || phoenixOverlay?.classList.contains("active")) return;
    if (cardIndex >= CONFIG.cardCount - 1) return;

    cardIndex += 1;
    renderCard();
  }

  /* Results */

  function appendText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;

    if (className) element.className = className;

    parent.appendChild(element);
    return element;
  }

  function renderResults() {
    const cards = currentCustomer.cards;

    const wins = cards.filter((card) => {
      return card.type === "prize" || card.type === "keytag";
    });

    const totalValue = wins.reduce((sum, card) => sum + Number(card.value || 0), 0);

    ui.resultsHeading.textContent = wins.length
      ? "A golden moment, made for you."
      : "Thank you for celebrating.";

    ui.resultsSubheading.textContent = wins.length
      ? "Your DEVY reveal is complete. Here are your results."
      : "Thank you for being part of this festive experience.";

    ui.resultGuestNumber.textContent =
      String(currentCustomer.customerNumber).padStart(2, "0");

    ui.summaryGrid.innerHTML = "";

    [
      { label: "Cards revealed", value: `${cards.length} / ${CONFIG.cardCount}` },
      { label: "Total prize value", value: money(totalValue) }
    ].forEach((item) => {
      const summary = document.createElement("div");
      summary.className = "summary-card";
      appendText(summary, "span", item.label);
      appendText(summary, "strong", item.value);
      ui.summaryGrid.appendChild(summary);
    });

    ui.resultsList.innerHTML = "";

    cards.forEach((card) => {
      const winner = card.type === "prize" || card.type === "keytag";
      const row = document.createElement("div");

      row.className = `result-row${winner ? " won" : ""}`;

      appendText(row, "span", card.icon || "✧", "result-icon");

      const details = document.createElement("div");
      details.className = "result-details";

      appendText(
        details,
        "strong",
        `Card ${String(card.cardNumber).padStart(2, "0")} · ${card.prizeName}`
      );

      appendText(
        details,
        "small",
        winner
          ? money(card.value)
          : card.type === "special-pending"
            ? "Festive surprise — pending confirmation"
            : card.type === "soldout"
              ? "Thank you for playing"
              : "Thank you for playing"
      );

      row.appendChild(details);

      appendText(row, "span", winner ? "WINNER" : "REVEALED", "result-status");
      ui.resultsList.appendChild(row);
    });

    const codes = wins
      .filter((card) => card.redemptionCode)
      .map((card) => card.redemptionCode);

    if (codes.length) {
      ui.redemptionBox.classList.remove("hidden");
      ui.redemptionCode.textContent = codes.join(" · ");
    } else {
      ui.redemptionBox.classList.add("hidden");
    }
  }

  function completeExperience() {
    if (!currentCustomer) return;

    currentCustomer.completed = true;
    currentCustomer.completedAt = new Date().toISOString();

    const records = getCustomers();
    const index = records.findIndex((record) => record.id === currentCustomer.id);

    if (index >= 0) {
      records[index] = currentCustomer;
      writeJSON(CONFIG.storageKey, records);
    }

    renderResults();
    showPanel(ui.resultsPanel);
    setStep(3);

    if (currentCustomer.cards.some((card) => card.type === "prize" || card.type === "keytag")) {
      addConfetti(48);
    }
  }

  function restartExperience() {
    closePhoenixEffect();

    currentCustomer = null;
    cardIndex = 0;
    isPointerDown = false;
    activePointerId = null;
    previousPoint = null;
    revealing = false;

    ui.customerForm.reset();

    showPanel(ui.customerPanel);
    setStep(1);
  }

  function initialize() {
    createAmbientParticles();
    attachScratchHandlers();

    ui.customerForm.addEventListener("submit", startExperience);
    ui.nextButton.addEventListener("click", nextCard);
    ui.resultsButton.addEventListener("click", completeExperience);
    ui.restartButton.addEventListener("click", restartExperience);

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(() => {
        if (
          !ui.scratchPanel.classList.contains("hidden") &&
          !ui.canvas.classList.contains("scratched")
        ) {
          drawCover();
        }
      });

      observer.observe(ui.card);
    } else {
      window.addEventListener("resize", () => {
        if (
          !ui.scratchPanel.classList.contains("hidden") &&
          !ui.canvas.classList.contains("scratched")
        ) {
          drawCover();
        }
      });
    }

    setStep(1);
  }

  initialize();
})();
