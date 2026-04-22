// =======================================================
// File: popup.js (INDUK EXTENSION)
// =======================================================

const browserAPI =
  typeof chrome !== "undefined" && chrome.runtime
    ? chrome
    : typeof browser !== "undefined" && browser.runtime
      ? browser
      : null;

const MIN_INTERVAL = 10;
const MAX_INTERVAL = 86400;
const SYNC_COOLDOWN = 1000;
const MAX_TIME_DIFF = 365 * 24 * 60 * 60 * 1000;

const state = {
  ntpServer: "worldtimeapi.org",
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

// --- API Helpers ---
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

// --- Settings & Location ---
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

  if (!state.locationEnabled) {
    elements.locationDisplay.textContent = "LOC: Nonaktif";
    return;
  }

  if (state.customLocation && state.customLocation.trim() !== "") {
    elements.locationDisplay.textContent = `LOC: ${state.customLocation}`;
    return;
  }

  elements.locationDisplay.textContent = "LOC: Mendeteksi...";

  const useFallbackTimezone = () => {
    let areaName = "Indonesia";
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) areaName = tz.replace(/_/g, " ");
    } catch (e) {}
    elements.locationDisplay.textContent = `LOC: ${areaName}`;
  };

  const useIPLocation = async () => {
    try {
      // Menggunakan GeoJS yang sangat ramah terhadap ekstensi browser
      const response = await fetch("https://get.geojs.io/v1/ip/geo.json");
      if (!response.ok) throw new Error("API diblokir");
      const data = await response.json();

      // GeoJS mengembalikan data 'city' dan 'country' secara langsung
      if (data.city && data.country) {
        elements.locationDisplay.textContent = `LOC: ${data.city}, ${data.country}`;
      } else {
        useFallbackTimezone();
      }
    } catch (err) {
      useFallbackTimezone();
    }
  };

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
            data.address.county ||
            "GPS Lokasi";
          const countryCode = data.address.country_code
            ? data.address.country_code.toUpperCase()
            : "ID";
          elements.locationDisplay.textContent = `LOC: ${exactLocation}, ${countryCode}`;
        } catch (err) {
          useIPLocation();
        }
      },
      (error) => {
        useIPLocation();
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  } else {
    useIPLocation();
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
            : "worldtimeapi.org";
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

// --- FITUR DETACH (HANYA DI POPUP) ---
if (elements.detachBtn) {
  elements.detachBtn.addEventListener("click", () => {
    const windowUrl = "window.html";
    if (browserAPI && browserAPI.windows) {
      browserAPI.windows.create(
        {
          url: windowUrl,
          type: "popup",
          width: 380,
          height: 300,
          focused: true,
        },
        (newWindow) => {
          setTimeout(() => {
            if (window.close) window.close();
          }, 100);
        },
      );
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

// --- Time Format ---
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

// --- Core Sync ---
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
    const urls = [
      "https://worldtimeapi.org/api/timezone/Etc/UTC",
      "https://timeapi.io/api/time/current/zone?timeZone=UTC",
    ];

    for (const url of urls) {
      if (serverDateTime) break;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          const ts = data.unixtime
            ? data.unixtime * 1000
            : new Date(data.dateTime + "Z").getTime();
          if (isValidTimestamp(ts)) serverDateTime = new Date(ts);
        }
      } catch (e) {}
    }

    if (serverDateTime) {
      const localDateTime = new Date();
      state.timeOffset = (serverDateTime - localDateTime) / 1000;
      state.lastSync = localDateTime;
      const diff = Math.abs(state.timeOffset);
      if (diffInSeconds <= 0.499) {
        statusElement.innerHTML = "● Synced Perfectly";
        statusElement.style.color = "#4ade80"; // Hijau
      } else if (diffInSeconds <= 1.0) {
        statusElement.innerHTML = "● Acceptable";
        statusElement.style.color = "#60a5fa"; // Biru
      } else {
        statusElement.innerHTML = `● Time Late: ${diff.toFixed(3)}s`;
        statusElement.style.color = "#fb923c"; // Oranye
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

// --- Event Listeners ---
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

if (elements.settingsBtn) {
  elements.settingsBtn.addEventListener("click", () => {
    if (elements.modalOverlay) elements.modalOverlay.classList.add("active");
  });
}

if (elements.closeModal) {
  elements.closeModal.addEventListener("click", () => {
    if (elements.modalOverlay) elements.modalOverlay.classList.remove("active");
  });
}

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
    browserAPI.storage.local.set({ locationEnabled: state.locationEnabled });
    updateLocationDisplay();
  });
}

if (elements.ntpInput) {
  elements.ntpInput.addEventListener("input", (e) => {
    const value = e.target.value.trim();
    if (value === "" || isValidDomain(value)) {
      elements.ntpInput.style.borderColor = "";
      state.ntpServer = value || "worldtimeapi.org";
      saveSettings();
    } else {
      elements.ntpInput.style.borderColor = "#EF4444";
    }
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

// --- Init ---
loadSettings();
initTheme();
clockInterval = setInterval(updateClock, 1000);
updateClock();
setTimeout(() => syncNow(true), 500);
