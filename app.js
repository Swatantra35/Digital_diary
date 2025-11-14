/* Digital Diary — app.js
   Stores everything in localStorage.
   Passwords hashed with SHA-256 via WebCrypto.
*/

const LS_USER = "diary_user_v1";
const LS_ENTRIES = "diary_entries_v1";
const AUTO_SAVE_INTERVAL = 2000; // ms

// ---------- Utils ----------
async function sha256(text) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  // convert to hex
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nowISO() {
  return new Date().toISOString();
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

// ---------- Storage helpers ----------
function saveUser(user) {
  localStorage.setItem(LS_USER, JSON.stringify(user));
}
function loadUser() {
  const s = localStorage.getItem(LS_USER);
  return s ? JSON.parse(s) : null;
}

function saveEntries(entries) {
  localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
}
function loadEntries() {
  const s = localStorage.getItem(LS_ENTRIES);
  return s ? JSON.parse(s) : [];
}

// ---------- DOM refs ----------
const authCard = document.getElementById("auth");
const registerBox = document.getElementById("registerBox");
const loginBox = document.getElementById("loginBox");
const pinBox = document.getElementById("pinBox");

const btnRegister = document.getElementById("btnRegister");
const btnLogin = document.getElementById("btnLogin");
const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");

const btnPin = document.getElementById("btnPin");
const logoutFromPin = document.getElementById("logoutFromPin");

const mainUI = document.getElementById("main");
const notesList = document.getElementById("notesList");
const noteTitle = document.getElementById("noteTitle");
const noteBody = document.getElementById("noteBody");
const btnSave = document.getElementById("btnSave");
const btnDelete = document.getElementById("btnDelete");
const newNoteBtn = document.getElementById("newNote");
const searchInput = document.getElementById("search");

const btnExport = document.getElementById("btnExport");
const btnImport = document.getElementById("btnImport");
const importFile = document.getElementById("importFile");
const btnToggleDark = document.getElementById("btnToggleDark");
const btnLock = document.getElementById("btnLock");
const btnLogout = document.getElementById("btnLogout");
const meta = document.getElementById("meta");

// inputs
const regUser = document.getElementById("regUser");
const regPass = document.getElementById("regPass");
const regPin = document.getElementById("regPin");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const pinInput = document.getElementById("pinInput");

let entries = loadEntries();
let currentId = null;
let autosaveTimer = null;
let currentUser = loadUser();
let locked = false;

// ---------- Auth flow ----------
showLogin.addEventListener("click", (e) => {
  e.preventDefault();
  registerBox.classList.add("hidden");
  loginBox.classList.remove("hidden");
});
showRegister.addEventListener("click", (e) => {
  e.preventDefault();
  loginBox.classList.add("hidden");
  registerBox.classList.remove("hidden");
});

btnRegister.addEventListener("click", async () => {
  const username = regUser.value.trim();
  const pass = regPass.value;
  const pin = regPin.value.trim();

  if (!username || !pass) {
    showNotification("⚠️ Please enter username and password", "warning");
    return;
  }
  if (currentUser) {
    showNotification("⚠️ Account already exists. Please use Login.", "warning");
    return;
  }

  // Add loading animation
  btnRegister.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
  btnRegister.disabled = true;

  setTimeout(async () => {
    const passHash = await sha256(pass);
    const user = { username, passHash, pin: pin || null, created: nowISO() };
    saveUser(user);
    currentUser = user;

    btnRegister.innerHTML = '<i class="fas fa-check"></i> Account Created!';

    setTimeout(() => {
      showNotification(
        `🎉 Welcome ${username}! Your account has been created.`,
        "success"
      );
      showMain();
    }, 1000);
  }, 1500);
});

btnLogin.addEventListener("click", async () => {
  const username = loginUser.value.trim();
  const pass = loginPass.value;

  if (!currentUser) {
    showNotification("⚠️ No account found. Please register first.", "warning");
    return;
  }

  if (!username || !pass) {
    showNotification("⚠️ Please enter both username and password", "warning");
    return;
  }

  // Add loading animation
  btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  btnLogin.disabled = true;

  setTimeout(async () => {
    const passHash = await sha256(pass);
    if (
      username !== currentUser.username ||
      passHash !== currentUser.passHash
    ) {
      btnLogin.innerHTML = '<i class="fas fa-times"></i> Invalid credentials';
      btnLogin.style.background = "var(--danger-gradient)";

      setTimeout(() => {
        btnLogin.innerHTML = '<i class="fas fa-door-open"></i> Login';
        btnLogin.style.background = "var(--primary-gradient)";
        btnLogin.disabled = false;
      }, 2000);

      showNotification("⛔ Invalid username or password", "error");
      return;
    }

    btnLogin.innerHTML = '<i class="fas fa-check"></i> Welcome back!';

    setTimeout(() => {
      showNotification(`😊 Welcome back, ${username}!`, "success");
      showMain();
    }, 1000);
  }, 1500);
});

btnPin.addEventListener("click", () => {
  const p = pinInput.value.trim();
  if (!currentUser || !currentUser.pin) {
    alert("No PIN set");
    return;
  }
  if (p === currentUser.pin) {
    unlockFromPin();
  } else {
    alert("Wrong PIN");
  }
});
logoutFromPin.addEventListener("click", (e) => {
  e.preventDefault();
  logout();
});

// ---------- Main UI ----------
function showMain() {
  authCard.style.animation = "fadeOut 0.5s ease-out";
  setTimeout(() => {
    authCard.classList.add("hidden");
    mainUI.classList.remove("hidden");
    mainUI.style.animation = "slideInFromBottom 0.6s ease-out";
  }, 500);

  renderNotesList();
  selectFirst();

  // Add welcome animation
  setTimeout(() => {
    const header = document.querySelector(".app-header");
    if (header) {
      header.style.animation = "bounceIn 0.8s ease-out";
    }
  }, 600);
}

function logout() {
  // no real server session; just show auth
  mainUI.classList.add("hidden");
  authCard.classList.remove("hidden");
  loginBox.classList.remove("hidden");
  registerBox.classList.add("hidden");
  pinBox.classList.add("hidden");
  currentId = null;
  locked = false;
  document.body.classList.remove("dark");
}

// Lock
btnLock.addEventListener("click", () => {
  if (currentUser && currentUser.pin) {
    // go to pin screen
    authCard.classList.remove("hidden");
    pinBox.classList.remove("hidden");
    registerBox.classList.add("hidden");
    loginBox.classList.add("hidden");
    mainUI.classList.add("hidden");
    locked = true;
  } else {
    alert("Set a 4-digit PIN in Register (optional) to use quick lock.");
  }
});

function unlockFromPin() {
  authCard.classList.add("hidden");
  pinBox.classList.add("hidden");
  mainUI.classList.remove("hidden");
  locked = false;
}

// Logout
btnLogout.addEventListener("click", () => {
  if (confirm("Logout?")) logout();
});

// Dark toggle with animation
btnToggleDark.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark");

  // Add transition effect
  document.body.style.transition = "all 0.5s ease";

  document.body.classList.toggle("dark");

  // Update button icon and text
  const icon = btnToggleDark.querySelector("i");
  if (document.body.classList.contains("dark")) {
    icon.className = "fas fa-sun";
    btnToggleDark.title = "Switch to Light Mode";
    showNotification("🌙 Dark mode activated", "success");
  } else {
    icon.className = "fas fa-moon";
    btnToggleDark.title = "Switch to Dark Mode";
    showNotification("☀️ Light mode activated", "success");
  }

  // Add button animation
  btnToggleDark.style.transform = "scale(0.9) rotate(180deg)";
  setTimeout(() => {
    btnToggleDark.style.transform = "scale(1) rotate(0deg)";
  }, 300);
});

// New note with animation
newNoteBtn.addEventListener("click", () => {
  const id = Date.now().toString();
  const n = { id, title: "", body: "", created: nowISO(), updated: nowISO() };
  entries.unshift(n);
  saveEntries(entries);

  // Add creation animation
  newNoteBtn.style.transform = "scale(0.95)";
  setTimeout(() => {
    newNoteBtn.style.transform = "scale(1)";
  }, 150);

  renderNotesList();
  selectNote(id);

  // Focus on title input with animation
  setTimeout(() => {
    noteTitle.focus();
    noteTitle.style.animation = "bounceIn 0.6s ease-out";
  }, 300);

  // Show success indicator
  showNotification("✨ New entry created!", "success");
});

// Save note with enhanced feedback
btnSave.addEventListener("click", () => {
  if (!currentId) {
    showNotification("⚠️ Select or create an entry first", "warning");
    return;
  }
  const note = entries.find((n) => n.id === currentId);
  if (!note) return;

  // Add save animation
  btnSave.style.transform = "scale(0.95)";
  btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  setTimeout(() => {
    note.title = noteTitle.value;
    note.body = noteBody.value;
    note.updated = nowISO();
    saveEntries(entries);
    renderNotesList();
    showMeta(note);

    btnSave.style.transform = "scale(1)";
    btnSave.innerHTML = '<i class="fas fa-check"></i> Saved!';

    setTimeout(() => {
      btnSave.innerHTML = '<i class="fas fa-save"></i> Save Entry';
    }, 1500);

    showNotification("✓ Entry saved successfully!", "success");
  }, 800);
});

// Delete with enhanced confirmation
btnDelete.addEventListener("click", () => {
  if (!currentId) return;

  // Create custom confirmation dialog
  showCustomConfirm(
    "Delete Entry",
    "Are you sure you want to delete this entry? This action cannot be undone.",
    () => {
      const noteItem = document.querySelector(".note-item.active");
      if (noteItem) {
        noteItem.style.animation = "fadeOut 0.5s ease-out";
        setTimeout(() => {
          entries = entries.filter((n) => n.id !== currentId);
          saveEntries(entries);
          currentId = null;
          renderNotesList();
          clearEditor();
          showNotification("🗑️ Entry deleted", "error");
        }, 500);
      }
    }
  );
});

// Enhanced search with debouncing
let searchTimeout;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  const searchIcon = document.querySelector(".search-container i");
  searchIcon.className = "fas fa-spinner fa-spin";

  searchTimeout = setTimeout(() => {
    const query = searchInput.value.trim().toLowerCase();
    renderNotesList(query);
    searchIcon.className = "fas fa-search";

    // Show search results count
    if (query) {
      const resultsCount = entries.filter((n) => {
        return (
          (n.title || "").toLowerCase().includes(query) ||
          (n.body || "").toLowerCase().includes(query)
        );
      }).length;

      showNotification(
        `🔍 Found ${resultsCount} ${resultsCount === 1 ? "entry" : "entries"}`,
        "info"
      );
    }
  }, 500);
});

// Export
btnExport.addEventListener("click", () => {
  const payload = {
    meta: { exportedAt: nowISO() },
    user: currentUser?.username || null,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "diary_backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Import
btnImport.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (Array.isArray(obj.entries)) {
        // merge by id: keep imported entries at top
        const incoming = obj.entries.filter(
          (i) => !entries.find((e) => e.id === i.id)
        );
        entries = incoming.concat(entries);
        saveEntries(entries);
        renderNotesList();
        alert("Import successful");
      } else alert("Invalid file");
    } catch (err) {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(f);
  e.target.value = "";
});

// ---------- Enhanced Render Functions ----------
function renderNotesList(filter = "") {
  const container = notesList;

  // Add loading animation
  container.style.opacity = "0.7";

  setTimeout(() => {
    container.innerHTML = "";
    const found = entries.filter((n) => {
      if (!filter) return true;
      return (
        (n.title || "").toLowerCase().includes(filter) ||
        (n.body || "").toLowerCase().includes(filter)
      );
    });

    if (found.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><i class="fas fa-feather-alt"></i><p>No entries found.<br><span class="small">Create your first entry to get started!</span></p></div>';

      // Add empty state styles
      const emptyStyles = `
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-light);
          opacity: 0;
          animation: fadeIn 0.5s ease-out 0.2s both;
        }
        .empty-state i {
          font-size: 48px;
          color: var(--accent);
          margin-bottom: 16px;
          opacity: 0.6;
        }
        .empty-state p {
          margin: 0;
          font-size: 16px;
          line-height: 1.5;
        }
        .empty-state .small {
          font-size: 14px;
          opacity: 0.7;
        }
      `;

      if (!document.querySelector("#empty-state-styles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "empty-state-styles";
        styleSheet.textContent = emptyStyles;
        document.head.appendChild(styleSheet);
      }
    } else {
      found.forEach((n, index) => {
        const div = document.createElement("div");
        div.className = "note-item" + (n.id === currentId ? " active" : "");

        const title = n.title
          ? n.title
          : n.body
          ? n.body.slice(0, 60)
          : "Untitled";
        const preview = n.body ? n.body.slice(0, 100) : "";

        div.innerHTML = `
          <strong>${escapeHtml(title)}</strong>
          ${
            preview
              ? `<div class="note-preview">${escapeHtml(preview)}${
                  n.body.length > 100 ? "..." : ""
                }</div>`
              : ""
          }
          <div class="note-meta">
            <small><i class="fas fa-clock"></i> ${fmtDate(
              n.updated || n.created
            )}</small>
            ${
              n.title
                ? `<small><i class="fas fa-file-alt"></i> ${n.body.length} chars</small>`
                : ""
            }
          </div>
        `;

        // Add animation delay for staggered effect
        div.style.opacity = "0";
        div.style.transform = "translateX(-20px)";
        div.style.transition = "all 0.3s ease";

        setTimeout(() => {
          div.style.opacity = "1";
          div.style.transform = "translateX(0)";
        }, index * 100 + 200);

        div.addEventListener("click", () => selectNote(n.id));
        container.appendChild(div);
      });
    }

    container.style.opacity = "1";
  }, 150);
}

function selectNote(id) {
  currentId = id;
  const note = entries.find((n) => n.id === id);
  if (!note) return;

  // Add transition effect to editor
  const editor = document.querySelector(".editor-body");
  editor.style.opacity = "0.5";
  editor.style.transform = "translateY(10px)";

  setTimeout(() => {
    noteTitle.value = note.title;
    noteBody.value = note.body;
    showMeta(note);

    editor.style.opacity = "1";
    editor.style.transform = "translateY(0)";

    // Auto-resize textarea
    autoResizeTextarea();
  }, 200);

  renderNotesList(searchInput.value.trim().toLowerCase());
}

// Auto-resize textarea function
function autoResizeTextarea() {
  noteBody.style.height = "auto";
  noteBody.style.height = Math.max(300, noteBody.scrollHeight) + "px";
}

function selectFirst() {
  if (entries.length > 0) selectNote(entries[0].id);
  else {
    clearEditor();
  }
}

function clearEditor() {
  noteTitle.value = "";
  noteBody.value = "";
  meta.innerText = "";
}

// Enhanced meta display
function showMeta(note) {
  const wordCount = note.body
    ? note.body
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
    : 0;
  const charCount = note.body ? note.body.length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200)); // Average reading speed

  meta.innerHTML = `
    <div class="meta-stats">
      <span><i class="fas fa-clock"></i> ${fmtDate(
        note.updated || note.created
      )}</span>
      <span><i class="fas fa-font"></i> ${wordCount} words</span>
      <span><i class="fas fa-eye"></i> ${readTime} min read</span>
    </div>
  `;

  // Add meta styles
  if (!document.querySelector("#meta-styles")) {
    const metaStyles = `
      .meta-stats {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        align-items: center;
        font-size: 13px;
        color: var(--text-light);
      }
      .meta-stats span {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .meta-stats i {
        color: var(--accent);
        font-size: 12px;
      }
      @media (max-width: 768px) {
        .meta-stats {
          justify-content: center;
          gap: 15px;
        }
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.id = "meta-styles";
    styleSheet.textContent = metaStyles;
    document.head.appendChild(styleSheet);
  }
}

// ---------- Enhanced Autosave with Visual Feedback ----------
noteTitle.addEventListener("input", () => {
  scheduleAutosave();
  updateSaveButton();
});

noteBody.addEventListener("input", () => {
  scheduleAutosave();
  autoResizeTextarea();
  updateSaveButton();
});

function updateSaveButton() {
  if (currentId) {
    btnSave.innerHTML = '<i class="fas fa-clock"></i> Auto-saving...';
    btnSave.style.opacity = "0.7";
  }
}

function scheduleAutosave() {
  if (!currentId) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    const note = entries.find((n) => n.id === currentId);
    if (!note) return;

    note.title = noteTitle.value;
    note.body = noteBody.value;
    note.updated = nowISO();
    saveEntries(entries);
    renderNotesList(searchInput.value.trim().toLowerCase());
    showMeta(note);

    // Update save button
    btnSave.innerHTML = '<i class="fas fa-check"></i> Saved';
    btnSave.style.opacity = "1";

    setTimeout(() => {
      btnSave.innerHTML = '<i class="fas fa-save"></i> Save Entry';
    }, 2000);
  }, AUTO_SAVE_INTERVAL);
}

// ---------- Enhanced Utility Functions ----------

// Notification System
function showNotification(message, type = "info") {
  // Remove any existing notifications
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  // Add styles
  const styles = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      min-width: 300px;
      max-width: 400px;
      padding: 16px 20px;
      border-radius: 12px;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: slideInRight 0.5s ease-out;
      font-family: inherit;
    }
    
    .notification-info { background: rgba(116, 185, 255, 0.9); color: white; }
    .notification-success { background: rgba(0, 184, 148, 0.9); color: white; }
    .notification-warning { background: rgba(253, 203, 110, 0.9); color: #2d3436; }
    .notification-error { background: rgba(232, 67, 147, 0.9); color: white; }
    
    .notification-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    
    .notification-message {
      font-weight: 500;
      font-size: 14px;
    }
    
    .notification-close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    
    .notification-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.9); }
    }
  `;

  // Add styles to document if not already added
  if (!document.querySelector("#notification-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "notification-styles";
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  document.body.appendChild(notification);

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "fadeOut 0.5s ease-out";
      setTimeout(() => notification.remove(), 500);
    }
  }, 4000);
}

// Custom Confirmation Dialog
function showCustomConfirm(title, message, onConfirm) {
  const dialog = document.createElement("div");
  dialog.className = "custom-dialog";
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>${title}</h3>
        </div>
        <div class="dialog-body">
          <p>${message}</p>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn dialog-cancel">
            <i class="fas fa-times"></i> Cancel
          </button>
          <button class="dialog-btn dialog-confirm">
            <i class="fas fa-check"></i> Confirm
          </button>
        </div>
      </div>
    </div>
  `;

  // Add dialog styles
  const dialogStyles = `
    .custom-dialog {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease-out;
    }
    
    .dialog-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(5px);
    }
    
    .dialog-content {
      position: relative;
      background: var(--card);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      max-width: 400px;
      width: 90%;
      box-shadow: var(--shadow);
      border: 1px solid rgba(255, 255, 255, 0.2);
      animation: bounceIn 0.5s ease-out;
    }
    
    .dialog-header {
      padding: 20px 20px 0;
      text-align: center;
    }
    
    .dialog-header h3 {
      margin: 0;
      color: var(--text);
      font-size: 1.4em;
    }
    
    .dialog-body {
      padding: 20px;
      text-align: center;
    }
    
    .dialog-body p {
      margin: 0;
      color: var(--text-light);
      line-height: 1.5;
    }
    
    .dialog-footer {
      padding: 0 20px 20px;
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    
    .dialog-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: var(--transition);
      font-family: inherit;
    }
    
    .dialog-cancel {
      background: var(--muted);
      color: white;
    }
    
    .dialog-confirm {
      background: var(--danger-gradient);
      color: white;
    }
    
    .dialog-btn:hover {
      transform: translateY(-2px);
    }
  `;

  if (!document.querySelector("#dialog-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "dialog-styles";
    styleSheet.textContent = dialogStyles;
    document.head.appendChild(styleSheet);
  }

  document.body.appendChild(dialog);

  // Event handlers
  dialog.querySelector(".dialog-cancel").onclick = () => dialog.remove();
  dialog.querySelector(".dialog-confirm").onclick = () => {
    dialog.remove();
    onConfirm();
  };
  dialog.querySelector(".dialog-overlay").onclick = (e) => {
    if (e.target === e.currentTarget) dialog.remove();
  };
}

// ---------- Original Helper Functions ----------
function escapeHtml(s) {
  if (!s) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Enhanced initialization
window.addEventListener("DOMContentLoaded", () => {
  // Add loading animation to auth card
  const authCard = document.getElementById("auth");
  if (authCard) {
    authCard.style.opacity = "0";
    authCard.style.transform = "translateY(20px)";

    setTimeout(() => {
      authCard.style.transition = "all 0.6s ease-out";
      authCard.style.opacity = "1";
      authCard.style.transform = "translateY(0)";
    }, 200);
  }

  if (currentUser) {
    // show login box by default
    registerBox.classList.add("hidden");
    loginBox.classList.remove("hidden");
    authCard.classList.remove("hidden");

    // Pre-fill username for convenience
    loginUser.value = currentUser.username;
    loginPass.focus();
  } else {
    // show register
    loginBox.classList.add("hidden");
    registerBox.classList.remove("hidden");
    authCard.classList.remove("hidden");

    regUser.focus();
  }

  // Add tooltips to action buttons
  const tooltipButtons = document.querySelectorAll("[title]");
  tooltipButtons.forEach((button) => {
    button.addEventListener("mouseenter", (e) => {
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.textContent = button.title;
      document.body.appendChild(tooltip);

      const rect = button.getBoundingClientRect();
      tooltip.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 10}px;
        left: ${rect.left + rect.width / 2}px;
        transform: translateX(-50%);
        background: var(--text);
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        animation: fadeIn 0.2s ease-out 0.5s both;
      `;
    });

    button.addEventListener("mouseleave", () => {
      const tooltip = document.querySelector(".tooltip");
      if (tooltip) tooltip.remove();
    });
  });

  // Show app version info
  console.log(
    "%c✨ Digital Diary v2.0 - Enhanced Edition ✨",
    "color: #6c5ce7; font-size: 16px; font-weight: bold;"
  );
  console.log(
    "%cFeatures: Glass morphism UI, smooth animations, auto-save, dark mode, keyboard shortcuts",
    "color: #74b9ff; font-size: 12px;"
  );
});
