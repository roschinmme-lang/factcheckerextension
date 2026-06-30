/**
 * TRUTHLENS - CONTENT SCRIPT v3.0
 * Features: Draggable FAB, History log, URL/Text fact-check,
 * Export as image, Multi-language, Source credibility badges.
 */

// ── LANGUAGE DETECTION ────────────────────────────────────────────────────────
const USER_LANG = (navigator.language || "en").split("-")[0];

// ── INJECT FAB ────────────────────────────────────────────────────────────────
const fab = document.createElement("button");
fab.className = "tl-fab";
fab.setAttribute("aria-label", "Open TruthLens fact checker");
fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
document.body.appendChild(fab);

// ── DRAGGABLE FAB ─────────────────────────────────────────────────────────────
(function makeDraggable() {
  let dragging = false, hasDragged = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  // Restore saved position
  chrome.storage.local.get("tl_fab_pos", ({ tl_fab_pos }) => {
    if (tl_fab_pos) {
      fab.style.right  = "auto";
      fab.style.bottom = "auto";
      fab.style.left   = tl_fab_pos.left + "px";
      fab.style.top    = tl_fab_pos.top  + "px";
    }
  });

  fab.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging  = true;
    hasDragged = false;
    const rect = fab.getBoundingClientRect();
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = rect.left;
    startTop  = rect.top;
    fab.style.right  = "auto";
    fab.style.bottom = "auto";
    fab.style.transition = "none";
    fab.style.left = startLeft + "px";
    fab.style.top  = startTop  + "px";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
    const newLeft = Math.max(0, Math.min(window.innerWidth  - 56, startLeft + dx));
    const newTop  = Math.max(0, Math.min(window.innerHeight - 56, startTop  + dy));
    fab.style.left = newLeft + "px";
    fab.style.top  = newTop  + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    fab.style.transition = "";
    if (hasDragged) {
      const rect = fab.getBoundingClientRect();
      chrome.storage.local.set({ tl_fab_pos: { left: rect.left, top: rect.top } });
      menu.style.left   = "auto";
      menu.style.right  = "auto";
      menu.style.bottom = "auto";
      menu.style.top    = "auto";
      positionMenu();
    }
  });

  // Position menu relative to FAB
  window.positionMenu = function () {
    const fabRect = fab.getBoundingClientRect();
    const menuW   = 240;
    const menuH   = menu.offsetHeight || 420;
    let left = fabRect.left + fabRect.width / 2 - menuW / 2;
    let top  = fabRect.top - menuH - 8;
    if (left + menuW > window.innerWidth  - 8) left = window.innerWidth  - menuW - 8;
    if (left < 8)                              left = 8;
    if (top < 8)                               top  = fabRect.bottom + 8;
    menu.style.left   = left + "px";
    menu.style.top    = top  + "px";
    menu.style.right  = "auto";
    menu.style.bottom = "auto";
  };
})();

// ── INJECT MENU ───────────────────────────────────────────────────────────────
const menu = document.createElement("div");
menu.className = "tl-menu";
menu.setAttribute("role", "dialog");
menu.setAttribute("aria-label", "TruthLens options");
menu.innerHTML = `
  <div class="tl-menu-header">
    <div class="tl-menu-brand">
      <svg class="tl-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      TruthLens
    </div>
    <p class="tl-menu-sub">Verify any post, image, or claim</p>
  </div>

  <!-- Step 1: Mode -->
  <div id="tl-step-1">
    <p class="tl-section-label">Check type</p>
    <button class="tl-menu-btn" id="tl-btn-factcheck">
      <span class="tl-btn-icon tl-icon-fact">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <span class="tl-btn-text">
        <span class="tl-btn-label">Fact check image</span>
        <span class="tl-btn-desc">True, Fake, or Misleading</span>
      </span>
    </button>
    <button class="tl-menu-btn" id="tl-btn-aidetection">
      <span class="tl-btn-icon tl-icon-ai">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
      </span>
      <span class="tl-btn-text">
        <span class="tl-btn-label">Detect AI image</span>
        <span class="tl-btn-desc">Real vs. AI-generated</span>
      </span>
    </button>
    <button class="tl-menu-btn" id="tl-btn-textcheck">
      <span class="tl-btn-icon tl-icon-text">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
      </span>
      <span class="tl-btn-text">
        <span class="tl-btn-label">Check text / URL</span>
        <span class="tl-btn-desc">Paste a claim or link</span>
      </span>
    </button>
    <div class="tl-divider"></div>
    <button class="tl-menu-btn" id="tl-btn-history">
      <span class="tl-btn-icon tl-icon-history">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </span>
      <span class="tl-btn-text">
        <span class="tl-btn-label">History</span>
        <span class="tl-btn-desc">Your recent checks</span>
      </span>
    </button>
    <div class="tl-divider"></div>
    <div class="tl-platform-row">
      <span class="tl-platform-chip">FB</span><span class="tl-platform-chip">X</span>
      <span class="tl-platform-chip">IG</span><span class="tl-platform-chip">TT</span>
      <span class="tl-platform-chip">YT</span><span class="tl-platform-chip">Reddit</span>
      <span class="tl-platform-chip">+more</span>
    </div>
  </div>

  <!-- Step 2: Input method (image modes) -->
  <div id="tl-step-2" class="tl-hidden">
    <p class="tl-section-label">Input method</p>
    <button class="tl-menu-btn" id="tl-btn-snip">
      <span class="tl-btn-icon tl-icon-snip">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>
      </span>
      <span class="tl-btn-text">
        <span class="tl-btn-label">Snip screen</span>
        <span class="tl-btn-desc">Draw a selection area</span>
      </span>
    </button>
    <button class="tl-menu-btn" id="tl-btn-upload">
      <span class="tl-btn-icon tl-icon-upload">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
      </span>
      <span class="tl-btn-text">
        <span class="tl-btn-label">Upload image</span>
        <span class="tl-btn-desc">From your device</span>
      </span>
    </button>
    <input type="file" id="tl-file-input" accept="image/*" style="display:none;">
    <div class="tl-divider"></div>
    <button class="tl-back-btn" id="tl-btn-back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </button>
  </div>

  <!-- Step 3: Text / URL input -->
  <div id="tl-step-3" class="tl-hidden">
    <p class="tl-section-label">Paste text or URL</p>
    <div class="tl-text-input-wrap">
      <textarea id="tl-text-input" class="tl-textarea" placeholder="Paste a claim, headline, or URL to fact-check…" rows="4" spellcheck="false"></textarea>
    </div>
    <div class="tl-text-actions">
      <button class="tl-btn-check-text" id="tl-btn-submit-text">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Check now
      </button>
    </div>
    <div class="tl-divider" style="margin-top:6px;"></div>
    <button class="tl-back-btn" id="tl-btn-back-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </button>
  </div>

  <!-- Step 4: History panel -->
  <div id="tl-step-4" class="tl-hidden">
    <div class="tl-history-header">
      <p class="tl-section-label" style="padding:0;">Recent checks</p>
      <button class="tl-clear-btn" id="tl-btn-clear-history">Clear all</button>
    </div>
    <div id="tl-history-list" class="tl-history-list">
      <div class="tl-history-empty">No checks yet. Start by analyzing a post.</div>
    </div>
    <div class="tl-divider"></div>
    <button class="tl-back-btn" id="tl-btn-back-4">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </button>
  </div>

  <div class="tl-divider"></div>
  <button class="tl-theme-btn" id="tl-btn-theme">
    <svg class="tl-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
    <span id="tl-theme-label">Dark mode</span>
    <div class="tl-toggle" id="tl-toggle"><div class="tl-toggle-thumb"></div></div>
  </button>
`;
document.body.appendChild(menu);

// ── STATE ─────────────────────────────────────────────────────────────────────
let overlay = null, selection = null;
let startX = 0, startY = 0, isDragging = false;
let currentMode = null;

// ── FAB + MENU TOGGLE ─────────────────────────────────────────────────────────
fab.addEventListener("click", (e) => {
  if (e._wasDrag) return; // suppress click after drag
  const isOpen = menu.classList.toggle("tl-show");
  fab.setAttribute("aria-expanded", isOpen);
  if (isOpen) { resetToStep1(); positionMenu(); }
});

// Suppress click if FAB was dragged
fab.addEventListener("mousedown", () => { fab._dragMoved = false; });
document.addEventListener("mousemove", () => { if (fab._dragMoved !== undefined) fab._dragMoved = true; });

document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && !fab.contains(e.target)) {
    menu.classList.remove("tl-show");
    fab.setAttribute("aria-expanded", "false");
  }
});

function goToStep(n) {
  ["tl-step-1","tl-step-2","tl-step-3","tl-step-4"].forEach((id, i) => {
    document.getElementById(id).classList.toggle("tl-hidden", i !== n - 1);
  });
  positionMenu();
}

function resetToStep1() { goToStep(1); }

// ── STEP 1: MODE SELECT ───────────────────────────────────────────────────────
document.getElementById("tl-btn-factcheck").addEventListener("click",    () => { currentMode = "factcheck";    goToStep(2); });
document.getElementById("tl-btn-aidetection").addEventListener("click",  () => { currentMode = "aidetection";  goToStep(2); });
document.getElementById("tl-btn-textcheck").addEventListener("click",    () => { currentMode = "textcheck";    goToStep(3); });
document.getElementById("tl-btn-history").addEventListener("click",      () => { loadHistory(); goToStep(4); });

// ── STEP 2: IMAGE INPUT ───────────────────────────────────────────────────────
document.getElementById("tl-btn-back").addEventListener("click", resetToStep1);

document.getElementById("tl-btn-snip").addEventListener("click", () => {
  menu.classList.remove("tl-show");
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "tl-overlay";
  overlay.innerHTML = `<div class="tl-overlay-hint">Click and drag to select an area · <kbd>Esc</kbd> to cancel</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("mousedown", startSnip);
  overlay.addEventListener("mousemove", dragSnip);
  overlay.addEventListener("mouseup",   endSnip);
  document.addEventListener("keydown",  cancelSnipOnEsc);
});

document.getElementById("tl-btn-upload").addEventListener("click", () => {
  document.getElementById("tl-file-input").click();
});

document.getElementById("tl-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = "";
  menu.classList.remove("tl-show");
  const reader = new FileReader();
  reader.onload = (ev) => {
    showSpinner();
    chrome.runtime.sendMessage({
      action: "processManualUpload",
      base64: ev.target.result.split(",")[1],
      mode:   currentMode,
      lang:   USER_LANG
    });
  };
  reader.readAsDataURL(file);
});

// ── STEP 3: TEXT / URL CHECK ──────────────────────────────────────────────────
document.getElementById("tl-btn-back-3").addEventListener("click", resetToStep1);

document.getElementById("tl-btn-submit-text").addEventListener("click", () => {
  const raw = document.getElementById("tl-text-input").value.trim();
  if (!raw) return;
  const isURL = /^https?:\/\//i.test(raw);
  menu.classList.remove("tl-show");
  showSpinner();
  chrome.runtime.sendMessage({
    action:      "factCheckText",
    content:     raw,
    contentType: isURL ? "url" : "text",
    lang:        USER_LANG
  });
  document.getElementById("tl-text-input").value = "";
});

// Submit on Ctrl/Cmd + Enter
document.getElementById("tl-text-input").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    document.getElementById("tl-btn-submit-text").click();
  }
});

// ── STEP 4: HISTORY ───────────────────────────────────────────────────────────
document.getElementById("tl-btn-back-4").addEventListener("click", resetToStep1);

document.getElementById("tl-btn-clear-history").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "clearHistory" }, () => {
    document.getElementById("tl-history-list").innerHTML =
      `<div class="tl-history-empty">No checks yet. Start by analyzing a post.</div>`;
  });
});

function loadHistory() {
  chrome.runtime.sendMessage({ action: "getHistory" }, (res) => {
    const list = document.getElementById("tl-history-list");
    const history = res?.history || [];
    if (!history.length) {
      list.innerHTML = `<div class="tl-history-empty">No checks yet.</div>`;
      return;
    }
    list.innerHTML = history.map(entry => {
      const vk  = (entry.verdict || "unknown").toLowerCase().replace(/\s+/g, "-");
      const ago = timeAgo(entry.timestamp);
      const icon = entry.inputType === "url" ? "🔗" : entry.inputType === "text" ? "📝" : "🖼";
      const preview = entry.inputPreview
        ? `<div class="tl-hist-preview">${entry.inputPreview}</div>`
        : "";
      return `
        <div class="tl-hist-item" data-id="${entry.id}">
          <div class="tl-hist-top">
            <div class="tl-verdict-pill tl-pill-${vk}">
              <span class="tl-pill-dot"></span>${(entry.verdict || "Unknown").toUpperCase()}
            </div>
            <span class="tl-hist-meta">${icon} ${ago}</span>
          </div>
          ${preview}
          <div class="tl-hist-exp">${truncate(flattenToText(entry.explanation), 90)}</div>
        </div>`;
    }).join("");

    // Click history item to re-show full modal
    list.querySelectorAll(".tl-hist-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = parseInt(item.dataset.id);
        const entry = history.find(h => h.id === id);
        if (entry) { menu.classList.remove("tl-show"); showFullModal(entry); }
      });
    });
  });
}

// ── SNIP TOOL ─────────────────────────────────────────────────────────────────
function cancelSnipOnEsc(e) {
  if (e.key === "Escape" && overlay) { overlay.remove(); overlay = null; document.removeEventListener("keydown", cancelSnipOnEsc); }
}

function startSnip(e) {
  isDragging = true;
  startX = e.clientX; startY = e.clientY;
  selection = document.createElement("div");
  selection.className = "tl-selection";
  overlay.appendChild(selection);
  updateSelection(e.clientX, e.clientY);
}

function dragSnip(e) {
  if (!isDragging) return;
  updateSelection(e.clientX, e.clientY);
  // Show size hint
  let hint = overlay.querySelector(".tl-snip-size");
  if (!hint) { hint = document.createElement("div"); hint.className = "tl-snip-size"; overlay.appendChild(hint); }
  const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
  hint.textContent = `${w} × ${h}`;
  hint.style.left = (Math.min(e.clientX, startX) + w / 2 - 30) + "px";
  hint.style.top  = (Math.min(e.clientY, startY) + h + 6) + "px";
}

function updateSelection(x, y) {
  Object.assign(selection.style, {
    left:   Math.min(x, startX) + "px",
    top:    Math.min(y, startY) + "px",
    width:  Math.abs(x - startX) + "px",
    height: Math.abs(y - startY) + "px"
  });
}

function endSnip(e) {
  if (!isDragging) return;
  isDragging = false;
  document.removeEventListener("keydown", cancelSnipOnEsc);
  const rect = {
    x: Math.min(e.clientX, startX), y: Math.min(e.clientY, startY),
    w: Math.abs(e.clientX - startX), h: Math.abs(e.clientY - startY)
  };
  if (rect.w < 10 || rect.h < 10) { overlay.remove(); overlay = null; return; }
  overlay.remove(); overlay = null;
  showSpinner();
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: "captureAndAnalyze", rect, dpr: window.devicePixelRatio, mode: currentMode, lang: USER_LANG });
  }, 100);
}

// ── SPINNER ───────────────────────────────────────────────────────────────────
let spinner = null;

function showSpinner() {
  if (spinner) return;
  spinner = document.createElement("div");
  spinner.className = "tl-spinner-wrap";
  spinner.innerHTML = `
    <div class="tl-spinner" role="status" aria-label="Analyzing..."></div>
    <div>
      <div class="tl-spinner-title">Analyzing…</div>
      <div class="tl-spinner-sub">This may take a few seconds</div>
    </div>`;
  document.body.appendChild(spinner);
}

function removeSpinner() { if (spinner) { spinner.remove(); spinner = null; } }

// ── COMPACT CARD ──────────────────────────────────────────────────────────────
function showCompactCard(result) {
  removeSpinner();
  removeAllResults();
  const verdict    = (result.verdict || "Unknown").trim();
  const explanation = flattenToText(result.explanation);
  const isAI       = result.isAI || "";
  const confidence  = result.confidence != null ? Math.round(result.confidence) : null;
  const verdictKey  = verdict.toLowerCase().replace(/\s+/g, "-");
  const aiChip = isAI
    ? `<div class="tl-ai-chip tl-ai-${isAI.toLowerCase().includes("ai") ? "positive" : "negative"}">${isAI}</div>`
    : "";

  const card = document.createElement("div");
  card.className = `tl-compact-card tl-verdict-${verdictKey}`;
  card.setAttribute("role", "alert");
  card.innerHTML = `
    <div class="tl-card-stripe"></div>
    <div class="tl-card-body">
      <div class="tl-card-top">
        <div class="tl-verdict-pill tl-pill-${verdictKey}">
          <span class="tl-pill-dot"></span>${verdict.toUpperCase()}
        </div>
        ${confidence != null ? `<span class="tl-confidence">${confidence}%</span>` : ""}
      </div>
      <p class="tl-card-summary">${truncate(explanation, 120)}</p>
      ${aiChip}
      <div class="tl-card-actions">
        <button class="tl-btn-details">View details</button>
        <button class="tl-btn-export" title="Save as image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </button>
        <button class="tl-btn-dismiss">✕</button>
      </div>
    </div>`;

  document.body.appendChild(card);
  card.querySelector(".tl-btn-details").addEventListener("click", () => { card.remove(); showFullModal(result); });
  card.querySelector(".tl-btn-export").addEventListener("click",  () => exportAsImage(result));
  card.querySelector(".tl-btn-dismiss").addEventListener("click", () => card.remove());
}

// ── FULL MODAL ────────────────────────────────────────────────────────────────
function showFullModal(result) {
  removeAllResults();
  const verdict    = (result.verdict || "Unknown").trim();
  const explanation = flattenToText(result.explanation);
  const isAI       = result.isAI || "";
  const confidence  = result.confidence != null ? Math.round(result.confidence) : null;
  const tags        = Array.isArray(result.tags)       ? result.tags       : [];
  const references  = Array.isArray(result.references) ? result.references : [];
  const verdictKey  = verdict.toLowerCase().replace(/\s+/g, "-");

  const confHTML = confidence != null
    ? `<div class="tl-conf-bar-wrap" role="progressbar" aria-valuenow="${confidence}" aria-valuemin="0" aria-valuemax="100">
        <div class="tl-conf-bar tl-bar-${verdictKey}" style="width:${confidence}%"></div>
       </div>
       <span class="tl-conf-label">${confidence}%</span>`
    : "";

  const tagsHTML = tags.length
    ? `<div class="tl-tags">${tags.map(t => `<span class="tl-tag">${t}</span>`).join("")}</div>` : "";

  const inputBanner = result.inputPreview
    ? `<div class="tl-input-banner">
        <span class="tl-input-type-chip">${result.inputType === "url" ? "🔗 URL" : "📝 Text"}</span>
        <span class="tl-input-preview">${result.inputPreview}</span>
       </div>` : "";

  const aiHTML = isAI
    ? `<div class="tl-modal-section">
        <p class="tl-modal-section-title">AI image analysis</p>
        <div class="tl-ai-block tl-ai-block-${isAI.toLowerCase().includes("ai") ? "positive" : "negative"}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/></svg>
          ${isAI}
        </div>
       </div>` : "";

  // Build references with credibility badges
  const refsHTML = references.length
    ? `<div class="tl-modal-section">
        <p class="tl-modal-section-title">Sources &amp; references</p>
        <div class="tl-refs-list">
          ${references.map(ref => {
            let domain = ref.source || "Source";
            try { domain = new URL(ref.url).hostname.replace("www.", ""); } catch {}
            const initial = (ref.source || domain).charAt(0).toUpperCase();
            const cred = ref.credibility;
            const credBadge = cred
              ? `<span class="tl-cred-badge tl-cred-${cred.tier}">${credIcons[cred.tier] || ""} ${cred.label}</span>`
              : "";
            return `<a class="tl-ref-item" href="${ref.url}" target="_blank" rel="noopener noreferrer">
              <div class="tl-ref-fav">${initial}</div>
              <div class="tl-ref-text">
                <div class="tl-ref-source-row">
                  <span class="tl-ref-source">${ref.source || domain}</span>
                  ${credBadge}
                </div>
                <div class="tl-ref-title">${ref.title || "Read article"}</div>
              </div>
              <div class="tl-ref-arrow">↗</div>
            </a>`;
          }).join("")}
        </div>
       </div>` : "";

  const modal = document.createElement("div");
  modal.className = "tl-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="tl-modal-stripe tl-stripe-${verdictKey}"></div>
    <div class="tl-modal-header">
      <span class="tl-modal-title">Fact check result</span>
      <button class="tl-modal-close" aria-label="Close">&times;</button>
    </div>
    <div class="tl-modal-body">
      ${inputBanner}
      <div class="tl-modal-verdict-row">
        <div class="tl-verdict-pill tl-pill-${verdictKey}">
          <span class="tl-pill-dot"></span>${verdict.toUpperCase()}
        </div>
        ${confHTML}
      </div>
      ${tagsHTML}
      <div class="tl-modal-section">
        <p class="tl-modal-section-title">Summary</p>
        <p class="tl-modal-explanation">${explanation}</p>
      </div>
      ${aiHTML}
      ${refsHTML}
    </div>
    <div class="tl-modal-footer">
      <button class="tl-btn-primary tl-btn-export-modal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        Save image
      </button>
      <button class="tl-btn-secondary tl-btn-copy">Copy text</button>
      <button class="tl-btn-secondary tl-btn-close-modal">✕ Close</button>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector(".tl-modal-close").addEventListener("click",       () => modal.remove());
  modal.querySelector(".tl-btn-close-modal").addEventListener("click",   () => modal.remove());
  modal.querySelector(".tl-btn-export-modal").addEventListener("click",  () => exportAsImage(result));
  modal.querySelector(".tl-btn-copy").addEventListener("click", () => {
    const refs = references.map(r => `- ${r.source}: ${r.title} (${r.url})`).join("\n");
    const text = `TruthLens Verdict: ${verdict} (${confidence ?? "?"}% confidence)\n\n${explanation}${refs ? "\n\nSources:\n" + refs : ""}`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = modal.querySelector(".tl-btn-copy");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy text"; }, 2000);
    });
  });
  modal.querySelector(".tl-modal-close").focus();
}

const credIcons = { high: "✓", medium: "~", low: "⚠", satire: "😄" };

// ── EXPORT AS IMAGE ───────────────────────────────────────────────────────────
function exportAsImage(result) {
  const verdict    = (result.verdict || "Unknown").trim();
  const explanation = truncate(flattenToText(result.explanation), 200);
  const confidence  = result.confidence != null ? `${Math.round(result.confidence)}% confidence` : "";
  const isDark      = document.body.classList.contains("tl-dark");

  // Colors
  const colors = {
    bg:      isDark ? "#1c1c1a" : "#ffffff",
    surface: isDark ? "#252523" : "#f5f4f0",
    text:    isDark ? "#f0ede8" : "#1a1916",
    text2:   isDark ? "#9b9a94" : "#6b6960",
    border:  isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
    true:        "#16a34a", trueBg:     isDark ? "#052e16" : "#dcfce7",
    fake:        "#dc2626", fakeBg:     isDark ? "#450a0a" : "#fee2e2",
    misleading:  "#d97706", misleadBg:  isDark ? "#451a03" : "#fef3c7",
    ai:          "#7c3aed", aiBg:       isDark ? "#2e1065" : "#ede9fe",
  };

  const verdictColorMap = {
    true: colors.true, fake: colors.fake, misleading: colors.misleading,
    "likely-ai": colors.ai, "likely-real": "#0284c7", error: colors.fake, unknown: "#9b9a94"
  };
  const verdictBgMap = {
    true: colors.trueBg, fake: colors.fakeBg, misleading: colors.misleadBg,
    "likely-ai": colors.aiBg, "likely-real": isDark ? "#082f49" : "#e0f2fe",
    error: colors.fakeBg, unknown: colors.surface
  };

  const vk    = verdict.toLowerCase().replace(/\s+/g, "-");
  const vColor = verdictColorMap[vk] || "#9b9a94";
  const vBg    = verdictBgMap[vk]    || colors.surface;

  const W = 540, H = 300;
  const canvas = document.createElement("canvas");
  canvas.width  = W * 2;  // 2x for retina
  canvas.height = H * 2;
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  // Card background
  roundRect(ctx, 0, 0, W, H, 16, colors.bg);

  // Top accent stripe
  ctx.fillStyle = vColor;
  ctx.fillRect(0, 0, W, 4);

  // Brand
  ctx.fillStyle = colors.text2;
  ctx.font      = "500 12px 'DM Sans', system-ui, sans-serif";
  ctx.fillText("🔍 TruthLens", 20, 28);

  // Verdict pill
  const pillW = ctx.measureText(verdict.toUpperCase()).width + 36;
  roundRect(ctx, 20, 40, pillW, 26, 13, vBg);
  ctx.fillStyle = vColor;
  ctx.beginPath();
  ctx.arc(32, 53, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font      = "700 12px 'DM Sans', system-ui, sans-serif";
  ctx.fillStyle = vColor;
  ctx.fillText(verdict.toUpperCase(), 42, 57);

  // Confidence
  if (confidence) {
    ctx.fillStyle = colors.text2;
    ctx.font      = "500 11px 'DM Mono', monospace";
    ctx.fillText(confidence, 20 + pillW + 10, 57);
  }

  // Divider line
  ctx.strokeStyle = colors.border;
  ctx.lineWidth   = 0.5;
  ctx.beginPath(); ctx.moveTo(20, 76); ctx.lineTo(W - 20, 76); ctx.stroke();

  // Explanation
  ctx.fillStyle = colors.text;
  ctx.font      = "400 13px 'DM Sans', system-ui, sans-serif";
  wrapText(ctx, explanation, 20, 98, W - 40, 20);

  // Tags
  if (result.tags?.length) {
    let tagX = 20;
    result.tags.slice(0, 4).forEach(tag => {
      const tw = ctx.measureText(tag).width + 16;
      roundRect(ctx, tagX, H - 52, tw, 20, 10, colors.surface);
      ctx.fillStyle = colors.text2;
      ctx.font      = "500 10px 'DM Sans', system-ui, sans-serif";
      ctx.fillText(tag, tagX + 8, H - 37);
      tagX += tw + 6;
    });
  }

  // Footer
  ctx.fillStyle = colors.text2;
  ctx.font      = "400 10px 'DM Sans', system-ui, sans-serif";
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(`Analyzed ${dateStr} · truthlens.ext`, 20, H - 14);

  // Download
  canvas.toBlob((blob) => {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = `truthlens-${vk}-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, "image/png");
}

// Canvas helpers
function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineH;
      if (curY > 220) { ctx.fillText(line + "…", x, curY); return; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}

// ── MESSAGE LISTENER ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "showResult") showCompactCard(message.data);
});

// ── DARK MODE ─────────────────────────────────────────────────────────────────
const toggle     = document.getElementById("tl-toggle");
const themeLabel = document.getElementById("tl-theme-label");

function setTheme(dark) {
  document.body.classList.toggle("tl-dark", dark);
  toggle.classList.toggle("tl-toggle-on", dark);
  themeLabel.textContent = dark ? "Light mode" : "Dark mode";
  chrome.storage.local.set({ tl_theme: dark ? "dark" : "light" });
}

document.getElementById("tl-btn-theme").addEventListener("click", () => {
  setTheme(!document.body.classList.contains("tl-dark"));
});

chrome.storage.local.get("tl_theme", ({ tl_theme }) => {
  if (tl_theme === "dark") setTheme(true);
});

// ── UTILS ─────────────────────────────────────────────────────────────────────
function removeAllResults() {
  document.querySelectorAll(".tl-compact-card, .tl-modal").forEach(el => el.remove());
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

function flattenToText(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return Object.values(val).map(flattenToText).join(" ").trim();
  return String(val);
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}