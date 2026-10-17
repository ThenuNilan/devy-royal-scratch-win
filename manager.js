"use strict";

(() => {
  const C = window.DEVY_CONFIG;
  const $ = (id) => document.getElementById(id);

  if (!C) {
    alert("DEVY configuration could not load.");
    return;
  }

  const CUSTOMER_KEY = `${C.demo.storagePrefix}_customers`;
  const STOCK_KEY = `${C.demo.storagePrefix}_stock`;
  const REDEMPTION_KEY = `${C.demo.storagePrefix}_redeemed`;

  /*
   * Demo password only. This is not secure authentication.
   * Production login must use Supabase Auth and server-side
   * manager role checks.
   */
  const DEMO_PASSWORD = "DEVY-DEMO-2026";

  const loginPanel = $("loginPanel");
  const dashboard = $("dashboardPanel");
  const loginForm = $("loginForm");
  const loginError = $("loginError");
  const searchInput = $("customerSearch");

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      alert("Could not save demo data in this browser.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function customers() {
    const value = readJSON(CUSTOMER_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function redemptions() {
    const value = readJSON(REDEMPTION_KEY, {});
    return value && typeof value === "object" ? value : {};
  }

  function stock() {
    const value = readJSON(STOCK_KEY, null);

    if (value && typeof value === "object") return value;

    const initial = {};

    C.prizes.forEach((prize) => {
      initial[prize.id] = prize.quantity;
    });

    initial[C.keyTag.id] = Number.isInteger(C.keyTag.quantity)
      ? C.keyTag.quantity
      : null;

    return initial;
  }

  function renderInventory() {
    const currentStock = stock();
    const items = C.prizes.map((prize) => {
      const quantity = currentStock[prize.id];

      return `
        <div class="inventory-item">
          <strong>${escapeHTML(prize.name)}</strong>
          <span>${Number.isInteger(quantity) ? quantity + " remaining in demo" : "Stock unavailable"}</span>
        </div>
      `;
    });

    items.push(`
      <div class="inventory-item">
        <strong>DEVY Key Tag</strong>
        <span>${Number.isInteger(currentStock[C.keyTag.id])
          ? currentStock[C.keyTag.id] + " remaining in demo"
          : "Quantity not confirmed"}</span>
      </div>
    `);

    $("inventoryList").innerHTML = items.join("");

    const total = C.prizes.reduce((sum, prize) => {
      const amount = currentStock[prize.id];
      return sum + (Number.isInteger(amount) ? amount : 0);
    }, 0);

    $("remainingStock").textContent = total;
  }

  function renderStats(list, redeemed) {
    $("totalCustomers").textContent = list.length;

    $("totalWinners").textContent = list.filter((customer) =>
      Array.isArray(customer.results) &&
      customer.results.some((result) => result.type !== "oops")
    ).length;

    $("totalRedeemed").textContent = Object.values(redeemed)
      .filter(Boolean).length;
  }

  function renderRecords() {
    const list = customers();
    const redeemed = redemptions();
    const query = searchInput.value.trim().toLowerCase();

    const filtered = list.filter((customer) => {
      const text = [
        customer.number,
        customer.name,
        customer.address
      ].join(" ").toLowerCase();

      return text.includes(query);
    }).reverse();

    const root = $("recordsList");

    if (!filtered.length) {
      root.innerHTML = `
        <div class="empty-state">
          No customer records found in this browser.
        </div>
      `;
    } else {
      root.innerHTML = filtered.map((customer) => {
        const isRedeemed = Boolean(redeemed[customer.number]);
        const results = Array.isArray(customer.results)
          ? customer.results
          : [];

        const resultMarkup = results.length
          ? results.map((result) => {
              const title = result.prizeName || "Oops";
              const status = result.revealed ? "Revealed" : "Not revealed";
              const code = result.redemptionCode
                ? ` · Demo reference: ${result.redemptionCode}`
                : "";

              return `
                <div class="result-line">
                  Card ${Number(result.cardNumber)}:
                  ${escapeHTML(title)} — ${escapeHTML(status)}
                  ${escapeHTML(code)}
                </div>
              `;
            }).join("")
          : '<div class="record-meta">Scratch results not available yet.</div>';

        const registered = customer.registeredAt
          ? new Date(customer.registeredAt).toLocaleString()
          : "Unknown";

        return `
          <article class="record-card">
            <div class="record-heading">
              <div>
                <h3>Customer #${escapeHTML(customer.number)} — ${escapeHTML(customer.name)}</h3>
                <p class="record-meta">${escapeHTML(customer.address)}</p>
                <p class="record-meta">Registered: ${escapeHTML(registered)}</p>
              </div>
              <span class="status ${isRedeemed ? "redeemed" : "pending"}">
                ${isRedeemed ? "Redeemed" : "Not redeemed"}
              </span>
            </div>

            <div class="result-list">${resultMarkup}</div>

            <div class="record-actions">
              <label>
                <input type="checkbox"
                       data-customer="${escapeHTML(customer.number)}"
                       ${isRedeemed ? "checked" : ""}>
                Mark demo record redeemed
              </label>
              <span class="record-meta">Demo only</span>
            </div>
          </article>
        `;
      }).join("");
    }

    renderStats(list, redeemed);
    renderInventory();
  }

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if ($("managerPassword").value !== DEMO_PASSWORD) {
      loginError.textContent = "Incorrect demo password.";
      return;
    }

    loginError.textContent = "";
    $("managerPassword").value = "";
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    renderRecords();
  });

  $("logoutButton").addEventListener("click", () => {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    searchInput.value = "";
  });

  searchInput.addEventListener("input", renderRecords);

  $("recordsList").addEventListener("change", (event) => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) return;

    const number = input.dataset.customer;
    if (!number) return;

    const redeemed = redemptions();

    if (input.checked) redeemed[number] = true;
    else delete redeemed[number];

    if (writeJSON(REDEMPTION_KEY, redeemed)) {
      renderRecords();
    } else {
      input.checked = !input.checked;
    }
  });

  console.info("DEVY demo manager loaded.");
})();