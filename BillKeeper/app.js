// Bill Keeper - simple SPA using localStorage
// Pages: splash, home, newPayment, settings

const STORAGE_KEY = "billKeeper.v1";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function money(n) {
  if (n === null || n === undefined || isNaN(n)) return "$0.00";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      userName: "",
      bills: [], // { id, name, lastPaidAmt, lastPaidDate }
      lastUpdated: null // { billId, billName, amount, date }
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      userName: "",
      bills: [],
      lastUpdated: null
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const appEl = document.getElementById("app");

let state = loadState();
let route = "splash";

// settings draft (so Back can discard)
let draft = null;

function setRoute(next) {
  route = next;
  render();
}

function render() {
  if (route === "splash") return renderSplash();
  if (route === "home") return renderHome();
  if (route === "newPayment") return renderNewPayment();
  if (route === "settings") return renderSettings();
  renderSplash();
}

function renderSplash() {
  appEl.innerHTML = `
    <div class="screen">
      <div class="center">
        <div style="width: 100%;">
          <div class="splashTitle">Bill Keeper</div>
          <div style="display:flex; justify-content:center;">
            <button id="enterBtn" style="min-width:140px;">Enter</button>
          </div>
          <div class="spacer"></div>
          <div class="small" style="text-align:center;">
            Tip: on iPhone Safari, Share → Add to Home Screen
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("enterBtn").onclick = () => setRoute("home");
}

function renderHome() {
  const name = (state.userName || "").trim();
  const greet = name ? `Hello ${escapeHtml(name)}!` : `Hello!`;

  let lastUpdatedText = `No updates yet.`;
  if (state.lastUpdated) {
    lastUpdatedText = `Last updated: ${escapeHtml(state.lastUpdated.billName)} had ${money(state.lastUpdated.amount)} paid on ${escapeHtml(state.lastUpdated.date)}.`;
  }

  const billsHtml = state.bills.length
    ? state.bills.map(b => {
        const hasPaid = b.lastPaidDate && (b.lastPaidAmt !== null && b.lastPaidAmt !== undefined);
        const meta = hasPaid
          ? `${money(b.lastPaidAmt)} was paid on ${escapeHtml(b.lastPaidDate)}.`
          : `No payment recorded yet.`;
        return `
          <div class="billItem">
            <div class="billLine">
              <div class="billName">${escapeHtml(b.name)}</div>
            </div>
            <div class="billMeta">${meta}</div>
          </div>
        `;
      }).join("")
    : `<div class="small">No bills added yet. Hit Settings and add a few bill names.</div>`;

  appEl.innerHTML = `
    <div class="screen">
      <div class="header">${greet}</div>

      <div class="card">
        <div class="label">Most recent updated bill</div>
        <div style="margin-top:8px;">${lastUpdatedText}</div>
      </div>

      <div class="spacer"></div>

      <div style="display:flex; justify-content:center;">
        <button id="goNewPaymentBtn" style="min-width:220px;">Enter New Bill Amount</button>
      </div>

      <div class="spacer"></div>

      <div class="billList">
        ${billsHtml}
      </div>

      <div class="settingsDock">
        <button id="settingsBtn">Settings</button>
      </div>
    </div>
  `;

  document.getElementById("goNewPaymentBtn").onclick = () => setRoute("newPayment");
  document.getElementById("settingsBtn").onclick = () => {
    draft = deepCopy(state);
    setRoute("settings");
  };
}

function renderNewPayment() {
  const options = state.bills.length
    ? state.bills.map(b => `<option value="${escapeAttr(b.id)}">${escapeHtml(b.name)}</option>`).join("")
    : `<option value="">(No bills yet)</option>`;

  appEl.innerHTML = `
    <div class="screen">
      <div class="header">New Bill Amount</div>

      <div class="card column">
        <div class="label">Select Bill Name</div>
        <select id="billSelect" class="input" ${state.bills.length ? "" : "disabled"}>
          ${options}
        </select>

        <div class="spacer"></div>

        <div class="label">Enter amount</div>
        <input id="amountInput" class="input" type="number" inputmode="decimal" placeholder="0.00" step="0.01" min="0" />

        <div class="small" id="newPayMsg" style="min-height:18px;"></div>
      </div>

      <div class="footerRow">
        <button id="backBtn">Back</button>
        <button id="confirmBtn">Confirm</button>
      </div>
    </div>
  `;

  document.getElementById("backBtn").onclick = () => setRoute("home");

  document.getElementById("confirmBtn").onclick = () => {
    const msgEl = document.getElementById("newPayMsg");
    msgEl.textContent = "";

    if (!state.bills.length) {
      msgEl.textContent = "Add bill names in Settings first.";
      return;
    }

    const billId = document.getElementById("billSelect").value;
    const amtRaw = document.getElementById("amountInput").value;
    const amount = Number(amtRaw);

    if (!billId) {
      msgEl.textContent = "Pick a bill.";
      return;
    }
    if (!amtRaw || isNaN(amount) || amount <= 0) {
      msgEl.textContent = "Enter a valid amount greater than 0.";
      return;
    }

    const bill = state.bills.find(b => b.id === billId);
    if (!bill) {
      msgEl.textContent = "That bill wasn't found.";
      return;
    }

    const date = todayISO();

    bill.lastPaidAmt = Number(amount.toFixed(2));
    bill.lastPaidDate = date;

    state.lastUpdated = {
      billId: bill.id,
      billName: bill.name,
      amount: bill.lastPaidAmt,
      date
    };

    saveState(state);
    setRoute("home");
  };
}

function renderSettings() {
  // Work on draft; only commit to state on Confirm
  if (!draft) draft = deepCopy(state);

  const nameVal = (draft.userName || "");

  const billPreview = draft.bills.length
    ? draft.bills.map(b => `<div class="billItem"><div class="billName">${escapeHtml(b.name)}</div></div>`).join("")
    : `<div class="small">No bills yet.</div>`;

  const deleteOptions = draft.bills.length
    ? draft.bills.map(b => `<option value="${escapeAttr(b.id)}">${escapeHtml(b.name)}</option>`).join("")
    : `<option value="">(No bills)</option>`;

  appEl.innerHTML = `
    <div class="screen">
      <div class="header">Settings</div>

      <div class="card column">
        <div class="label">Username</div>
        <input id="nameInput" class="input" type="text" placeholder="Enter here..." value="${escapeAttr(nameVal)}" />

        <div class="spacer"></div>

        <div class="row">
          <button id="addBillBtn" style="min-width:200px;">Enter New Bill Name</button>
          <input id="newBillInput" class="input" type="text" placeholder="Bill name..." />
        </div>

        <div class="small" id="settingsMsg" style="min-height:18px;"></div>

        <div class="spacer"></div>

        <div class="label">Bills (preview)</div>
        <div class="billList">
          ${billPreview}
        </div>

        <div class="spacer"></div>

        <div class="label">Select Bill Name (delete)</div>
        <div class="row">
          <select id="deleteSelect" class="input" ${draft.bills.length ? "" : "disabled"}>
            ${deleteOptions}
          </select>
          <button id="deleteBtn">Delete</button>
        </div>
      </div>

      <div class="footerRow">
        <button id="backBtn">Back</button>
        <button id="confirmBtn">Confirm</button>
      </div>
    </div>
  `;

  const msgEl = document.getElementById("settingsMsg");

  // Add bill
  document.getElementById("addBillBtn").onclick = () => {
    msgEl.textContent = "";
    const input = document.getElementById("newBillInput");
    const name = (input.value || "").trim();

    if (!name) {
      msgEl.textContent = "Enter a bill name first.";
      return;
    }

    const exists = draft.bills.some(b => b.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      msgEl.textContent = "That bill name already exists.";
      return;
    }

    draft.bills.push({
      id: uid(),
      name,
      lastPaidAmt: null,
      lastPaidDate: ""
    });

    input.value = "";
    renderSettings();
  };

  // Delete bill
  document.getElementById("deleteBtn").onclick = () => {
    msgEl.textContent = "";
    if (!draft.bills.length) {
      msgEl.textContent = "No bills to delete.";
      return;
    }

    const id = document.getElementById("deleteSelect").value;
    if (!id) {
      msgEl.textContent = "Pick a bill to delete.";
      return;
    }

    const bill = draft.bills.find(b => b.id === id);
    draft.bills = draft.bills.filter(b => b.id !== id);

    // If lastUpdated pointed at this bill, clear it in draft
    if (draft.lastUpdated && draft.lastUpdated.billId === id) {
      draft.lastUpdated = null;
    }

    msgEl.textContent = bill ? `Deleted: ${bill.name}` : "Deleted.";
    renderSettings();
  };

  // Back without saving
  document.getElementById("backBtn").onclick = () => {
    draft = null;
    setRoute("home");
  };

  // Confirm (save changes)
  document.getElementById("confirmBtn").onclick = () => {
    const newName = (document.getElementById("nameInput").value || "").trim();
    draft.userName = newName;

    state = deepCopy(draft);
    saveState(state);

    draft = null;
    setRoute("home");
  };
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("\n", " ");
}

// Start on splash
render();
