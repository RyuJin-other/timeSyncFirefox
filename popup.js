// =======================================================
// File: popup.js
// =======================================================

const browserAPI =
  typeof chrome !== "undefined" && chrome.runtime
    ? chrome
    : typeof browser !== "undefined"
      ? browser
      : null;

const MIN_INTERVAL = 10;
const MAX_INTERVAL = 86400;
const SYNC_COOLDOWN = 1000;
const MAX_TIME_DIFF = 365 * 24 * 60 * 60 * 1000;

const state = {
  ntpServer: "time.now",
  syncInterval: 60,
  serverTime: null,
  lastSync: null,
  timeOffset: null,
  isAutoSync: false,
  countdown: 0,
  isSyncing: false,
  lastSyncTime: 0,
  customLocation: "",
  locationEnabled: false,
};

let clockInterval;

const elements = {
  serverTime: document.getElementById("serverTime"),
  serverDate: document.getElementById("serverDate"),
  serverHost: document.getElementById("serverHost"),
  pcTime: document.getElementById("pcTime"),
  pcDate: document.getElementById("pcDate"),
  status: document.getElementById("status"),
  statusDot: document.getElementById("statusDot"),
  syncBtn: document.getElementById("syncBtn"),
  syncBtnText: document.getElementById("syncBtnText"),
  autoBtn: document.getElementById("autoBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  themeToggle: document.getElementById("themeToggle"),
  detachBtn: document.getElementById("detachBtn"),
  modalOverlay: document.getElementById("modalOverlay"),
  closeModal: document.getElementById("closeModal"),
  ntpInput: document.getElementById("ntpInput"),
  intervalInput: document.getElementById("intervalInput"),
  locationInput: document.getElementById("locationInput"),
  locationDisplay: document.getElementById("locationDisplay"),
  locationToggle: document.getElementById("locationToggle"),
  saveStatus: document.getElementById("saveStatus"),
};

function isValidDomain(domain) {
  if (!domain || typeof domain !== "string") return false;
  domain = domain.trim();
  if (domain.length > 253 || domain.length < 3) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
    domain,
  );
}
function sanitizeNumber(value, min, max, defaultValue) {
  const num = parseInt(value);
  return isNaN(num) ? defaultValue : Math.min(Math.max(min, num), max);
}
function isValidTimestamp(ts) {
  return (
    typeof ts === "number" &&
    !isNaN(ts) &&
    Math.abs(ts - Date.now()) < MAX_TIME_DIFF
  );
}

function initTheme() {
  if (browserAPI && browserAPI.storage) {
    browserAPI.storage.local.get(["theme"], (result) => {
      const theme = result.theme || "dark";
      document.documentElement.setAttribute("data-theme", theme);
      if (elements.themeToggle)
        elements.themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    });
  }
}

function updateLocationDisplay() {
  if (!elements.locationDisplay) return;

  // --- PINTU GERBANG PRIVASI ---
  if (!state.locationEnabled) {
    elements.locationDisplay.textContent = "LOC: Nonaktif";
    return;
  }

  // PRIORITAS 1: Cek Input Manual
  if (state.customLocation && state.customLocation.trim() !== "") {
    elements.locationDisplay.textContent = `LOC: ${state.customLocation}`;
    return;
  }

  elements.locationDisplay.textContent = "LOC: Mendeteksi...";

  // PRIORITAS 4 (CARA TERAKHIR): Jalur Udara / IP API
  const useIPLocation = async () => {
    try {
      const response = await fetch("https://get.geojs.io/v1/ip/geo.json");
      if (!response.ok) throw new Error("API diblokir");
      const data = await response.json();
      if (data.city && data.country) {
        elements.locationDisplay.textContent = `LOC: ${data.city}, ${data.country}`;
      } else {
        elements.locationDisplay.textContent = "LOC: Tidak Diketahui";
      }
    } catch (err) {
      elements.locationDisplay.textContent = "LOC: Tidak Diketahui";
    }
  };

  // PRIORITAS 3: Fallback ke Timezone OS (Cepat, Tanpa Internet, Anti-CORS)
  const useFallbackTimezone = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        alert(
          "Akses lokasi diblokir oleh browser. Silakan izinkan akses lokasi di pengaturan privasi browser Anda.",
        );

        const areaName = tz.replace(/_/g, " ");
        elements.locationDisplay.textContent = `LOC: ${areaName}`;
      } else {
        // Jika timezone juga gagal terbaca, baru panggil cara terakhir (IP API)
        useIPLocation();
      }
    } catch (e) {
      useIPLocation(); // Lempar ke cara terakhir
    }
  };

  // PRIORITAS 2: Percobaan Utama (Navigator GPS / Jalur Darat)
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
          );
          if (!response.ok) throw new Error("API Peta Gagal");

          const data = await response.json();
          const exactLocation =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.county ||
            "GPS Lokasi";
          const countryCode = data.address.country_code
            ? data.address.country_code.toUpperCase()
            : "ID";
          elements.locationDisplay.textContent = `LOC: ${exactLocation}, ${countryCode}`;
        } catch (err) {
          // Gagal ubah koordinat jadi teks? Langsung pakai Timezone OS

          useFallbackTimezone();
        }
      },
      (error) => {
        // User menolak GPS atau sistem menolak? Langsung pakai Timezone OS
        useFallbackTimezone();
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  } else {
    // Browser sangat jadul? Pakai Timezone OS

    useFallbackTimezone();
  }
}

function loadSettings() {
  if (browserAPI && browserAPI.storage) {
    browserAPI.storage.local.get(
      ["ntpServer", "syncInterval", "customLocation", "locationEnabled"],
      (result) => {
        state.ntpServer =
          result.ntpServer && isValidDomain(result.ntpServer)
            ? result.ntpServer
            : "time.now";
        state.syncInterval = sanitizeNumber(
          result.syncInterval,
          MIN_INTERVAL,
          MAX_INTERVAL,
          60,
        );
        state.customLocation = result.customLocation || "";
        state.locationEnabled =
          result.locationEnabled !== undefined ? result.locationEnabled : false;

        if (elements.ntpInput) elements.ntpInput.value = state.ntpServer;
        if (elements.intervalInput)
          elements.intervalInput.value = state.syncInterval;
        if (elements.locationInput)
          elements.locationInput.value = state.customLocation;
        if (elements.locationToggle)
          elements.locationToggle.checked = state.locationEnabled;

        updateLocationDisplay();
      },
    );
  }
}

function saveSettings() {
  if (browserAPI && browserAPI.storage) {
    browserAPI.storage.local.set({
      ntpServer: state.ntpServer,
      syncInterval: state.syncInterval,
      customLocation: state.customLocation,
      locationEnabled: state.locationEnabled,
    });
  }
  if (elements.saveStatus) {
    elements.saveStatus.textContent = "✔️ Saved";
    setTimeout(() => (elements.saveStatus.textContent = ""), 1000);
  }
}

// --- FITUR DETACH (FIREFOX & CHROMIUM COMPATIBLE) ---
if (elements.detachBtn) {
  elements.detachBtn.addEventListener("click", () => {
    const windowUrl = browserAPI.runtime.getURL("window.html");

    if (browserAPI && browserAPI.windows) {
      // Firefox: windows.create() returns a Promise
      // Chromium: windows.create() uses callback, but also supports Promise
      const createPromise = browserAPI.windows.create({
        url: windowUrl,
        type: "popup",
        width: 380,
        height: 300,
        focused: true,
      });
      // Handle both Promise (Firefox) and callback-based (Chromium)
      const closePopup = () =>
        setTimeout(() => {
          if (window.close) window.close();
        }, 100);
      if (createPromise && typeof createPromise.then === "function") {
        createPromise.then(closePopup).catch(closePopup);
      } else {
        closePopup();
      }
    } else {
      window.open(
        windowUrl,
        "TimeSyncWindow",
        "width=380,height=300,left=100,top=100",
      );
      setTimeout(() => {
        if (window.close) window.close();
      }, 100);
    }
  });
}

function formatJustTime(d) {
  return d
    ? d.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";
}
function formatJustDate(d) {
  return d
    ? d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Loading...";
}
function formatJustTimeUTC(d) {
  return d
    ? d.toLocaleTimeString("en-US", {
        timeZone: "UTC",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";
}
function formatJustDateUTC(d) {
  return d
    ? d.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Loading...";
}

function updateClock() {
  const now = new Date();
  if (elements.pcTime) elements.pcTime.textContent = formatJustTime(now);
  if (elements.pcDate) elements.pcDate.textContent = formatJustDate(now);
  if (elements.serverHost)
    elements.serverHost.textContent = `HOST: ${state.ntpServer}`;

  if (state.timeOffset !== null && state.lastSync !== null) {
    const elapsed = (now - state.lastSync) / 1000;
    const serverTime = new Date(
      state.lastSync.getTime() + (elapsed + state.timeOffset) * 1000,
    );
    if (elements.serverTime)
      elements.serverTime.textContent = formatJustTimeUTC(serverTime);
    if (elements.serverDate)
      elements.serverDate.textContent = formatJustDateUTC(serverTime);
  }

  if (state.isAutoSync && state.countdown > 0) {
    state.countdown--;
    if (elements.autoBtn)
      elements.autoBtn.textContent =
        state.countdown > 60
          ? `Auto (${Math.floor(state.countdown / 60)}m)`
          : `Auto (${state.countdown}s)`;
    if (state.countdown === 0) {
      syncNow(true);
      state.countdown = state.syncInterval;
    }
  }
}

function setStatus(text, color) {
  if (elements.status) {
    elements.status.textContent = text;
    elements.status.style.color = color;
  }
  if (elements.statusDot) elements.statusDot.style.backgroundColor = color;
}

async function syncNow(silent = false) {
  const now = Date.now();
  if (now - state.lastSyncTime < SYNC_COOLDOWN) return;
  state.lastSyncTime = now;

  if (!silent) {
    state.isSyncing = true;
    if (elements.syncBtn) elements.syncBtn.disabled = true;
    if (elements.syncBtnText) elements.syncBtnText.textContent = "SYNCING...";
    setStatus("● Connecting...", "#ffc107");
  }

  try {
    let serverDateTime = null;
    const sources = [
      // PRIMARY: time.now — schema identik WorldTimeAPI, field unixtime tersedia
      {
        url: "https://time.now/developer/api/timezone/Etc/UCT",
        parse: (data) => (data.unixtime ? data.unixtime * 1000 : null),
      },
      // FALLBACK 1: timeapi.io /timezone/zone
      {
        url: "https://timeapi.io/api/v1/timezone/zone?timeZone=Etc%2FUCT",
        parse: (data) => {
          const raw = data.currentLocalTime || data.dateTime;
          return raw
            ? new Date(raw.endsWith("Z") ? raw : raw + "Z").getTime()
            : null;
        },
      },
      // FALLBACK 2: timeapi.io /time/current/zone
      {
        url: "https://timeapi.io/api/time/current/zone?timeZone=Etc%2FUCT",
        parse: (data) => {
          const raw = data.currentLocalTime || data.dateTime;
          return raw
            ? new Date(raw.endsWith("Z") ? raw : raw + "Z").getTime()
            : null;
        },
      },
    ];

    for (const source of sources) {
      if (serverDateTime) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(source.url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          const ts = source.parse(data);
          if (ts && isValidTimestamp(ts)) {
            serverDateTime = new Date(ts);
            serverDateTime._fromTimeNow = source.url.includes("time.now");
          }
        }
      } catch (e) {}
    }

    if (serverDateTime) {
      const localDateTime = new Date();
      state.timeOffset = (serverDateTime - localDateTime) / 1000;
      state.lastSync = localDateTime;
      const diff = Math.abs(state.timeOffset);
      if (diff <= 0.499) {
        setStatus("● Sync Successful", "#4ade80");
      } else if (diff <= 1.0) {
        setStatus("● Acceptable", "#60a5fa");
      } else {
        setStatus(`● Time Late: ${diff.toFixed(3)}s`, "#fb923c");
      }
    } else throw new Error("Servers failed");
  } catch (error) {
    setStatus("● Sync failed", "#EF4444");
  } finally {
    if (!silent) {
      state.isSyncing = false;
      if (elements.syncBtn) elements.syncBtn.disabled = false;
      if (elements.syncBtnText) elements.syncBtnText.textContent = "FORCE SYNC";
    }
  }
}

// Event Listeners with Safety Wrappers
if (elements.syncBtn)
  elements.syncBtn.addEventListener("click", () => syncNow(false));

if (elements.autoBtn) {
  elements.autoBtn.addEventListener("click", () => {
    state.isAutoSync = !state.isAutoSync;
    if (state.isAutoSync) {
      state.countdown = state.syncInterval;
      elements.autoBtn.className = "btn-success";
      syncNow(true);
    } else {
      elements.autoBtn.className = "btn-outline";
      elements.autoBtn.textContent = "Auto Sync";
    }
  });
}

if (elements.settingsBtn)
  elements.settingsBtn.addEventListener("click", () => {
    if (elements.modalOverlay) elements.modalOverlay.classList.add("active");
  });
if (elements.closeModal)
  elements.closeModal.addEventListener("click", () => {
    if (elements.modalOverlay) elements.modalOverlay.classList.remove("active");
  });
if (elements.themeToggle) {
  elements.themeToggle.addEventListener("click", () => {
    const newTheme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    elements.themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
    if (browserAPI && browserAPI.storage)
      browserAPI.storage.local.set({ theme: newTheme });
  });
}
if (elements.locationToggle) {
  elements.locationToggle.addEventListener("change", (e) => {
    state.locationEnabled = e.target.checked;
    if (browserAPI && browserAPI.storage)
      browserAPI.storage.local.set({ locationEnabled: state.locationEnabled });
    updateLocationDisplay();
  });
}
if (elements.ntpInput) {
  elements.ntpInput.addEventListener("input", (e) => {
    const value = e.target.value.trim();
    if (value === "" || isValidDomain(value)) {
      elements.ntpInput.style.borderColor = "";
      state.ntpServer = value || "time.now";
      saveSettings();
    } else elements.ntpInput.style.borderColor = "#EF4444";
  });
}
if (elements.intervalInput) {
  elements.intervalInput.addEventListener("input", (e) => {
    state.syncInterval = sanitizeNumber(
      e.target.value,
      MIN_INTERVAL,
      MAX_INTERVAL,
      60,
    );
    saveSettings();
  });
}
if (elements.locationInput) {
  elements.locationInput.addEventListener("input", (e) => {
    const safeValue = (str) =>
      str ? str.replace(/[<>]/g, "").substring(0, 40) : "";
    e.target.value = safeValue(e.target.value);
    state.customLocation = e.target.value;
    updateLocationDisplay();
    saveSettings();
  });
}
document.querySelectorAll(".quick-select-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const server = e.currentTarget.getAttribute("data-server");
    if (isValidDomain(server)) {
      state.ntpServer = server;
      if (elements.ntpInput) elements.ntpInput.value = state.ntpServer;
      saveSettings();
      setStatus(`● Syncing with ${state.ntpServer}...`, "#F59E0B");
      setTimeout(() => syncNow(true), 500);
    }
  });
});

loadSettings();
initTheme();
clockInterval = setInterval(updateClock, 1000);
updateClock();
setTimeout(() => syncNow(true), 500);
