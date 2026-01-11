(function (global) {
  const App = global.App || {};

  const USER_ID_KEY = "user_id_v1";
  const API_BASE_KEY = "api_base_url";
  const MY_EMOJIS_KEY = "my_emojis_v1";
  const TG_REGISTERED_KEY = "tg_user_registered_v1";

  function getTelegramUser() {
    const tg = global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
    return tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
  }

  function applyTelegramInsets() {
    const tg = global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
    if (!tg || !document || !document.documentElement) return;
    const inset = tg.safeAreaInset || tg.contentSafeAreaInset || null;
    if (!inset) return;

    const root = document.documentElement;
    if (typeof inset.top === "number") {
      root.style.setProperty("--tg-safe-area-inset-top", `${inset.top}px`);
    }
    if (typeof inset.bottom === "number") {
      root.style.setProperty("--tg-safe-area-inset-bottom", `${inset.bottom}px`);
    }

    const platform = tg.platform || "";
    const baseTop = platform === "ios" ? 44 : platform === "android" ? 24 : 0;
    const safeTop = typeof inset.top === "number" ? inset.top : 0;
    const extraTop = Math.max(baseTop - safeTop, 0);
    root.style.setProperty("--tg-header-offset", `${extraTop}px`);
    root.classList.add("tg-app");
  }

  function getUserId() {
    const tgUser = getTelegramUser();
    if (tgUser && tgUser.id != null) return String(tgUser.id);
    try {
      return localStorage.getItem(USER_ID_KEY) || "0";
    } catch (_) {
      return "0";
    }
  }

  function setUserId(value) {
    try {
      localStorage.setItem(USER_ID_KEY, value);
    } catch (_) {}
  }

  function getApiBase() {
    try {
      return localStorage.getItem(API_BASE_KEY) || "http://localhost:8000";
    } catch (_) {
      return "http://localhost:8000";
    }
  }

  function readMyEmojis() {
    try {
      const raw = localStorage.getItem(MY_EMOJIS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function writeMyEmojis(items) {
    try {
      localStorage.setItem(MY_EMOJIS_KEY, JSON.stringify(items || []));
    } catch (_) {}
  }

  function addLocalEmoji(payload) {
    const items = readMyEmojis();
    const now = Date.now();
    const id = payload?.id || `local_${now}_${Math.random().toString(16).slice(2, 6)}`;
    const record = {
      id,
      userId: getUserId(),
      templateId: payload?.templateId || null,
      status: payload?.status || "draft",
      createdAt: now,
      lottieJson: payload?.lottieJson || null,
      lottiePath: payload?.lottiePath || "",
      localOnly: true,
    };
    items.unshift(record);
    writeMyEmojis(items);
    return record;
  }

  function ensureUserRegistered() {
    const tgUser = getTelegramUser();
    if (!tgUser || tgUser.id == null) return;
    const userId = String(tgUser.id);
    let lastRegistered = null;
    try {
      lastRegistered = localStorage.getItem(TG_REGISTERED_KEY);
    } catch (_) {}
    if (lastRegistered === userId) return;

    const payload = {
      userId,
      firstName: tgUser.first_name || "",
      lastName: tgUser.last_name || "",
      username: tgUser.username || "",
      photoUrl: tgUser.photo_url || "",
    };

    fetch(`${getApiBase()}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return;
        try {
          localStorage.setItem(TG_REGISTERED_KEY, userId);
        } catch (_) {}
      })
      .catch(() => {});
  }

  function setupBottomNav(currentRoute) {
    document.querySelectorAll(".navItem").forEach((btn) => {
      btn.addEventListener("click", () => {
        const route = btn.dataset.route;
        if (!route || route === currentRoute) return;
        if (route === "catalog") window.location.href = "./catalog.html";
        if (route === "my") window.location.href = "./my.html";
        if (route === "profile") window.location.href = "./profile.html";
      });
    });
  }

  App.getUserId = App.getUserId || getUserId;
  App.setUserId = App.setUserId || setUserId;
  App.getApiBase = App.getApiBase || getApiBase;
  App.getTelegramUser = App.getTelegramUser || getTelegramUser;
  App.applyTelegramInsets = App.applyTelegramInsets || applyTelegramInsets;
  App.ensureUserRegistered = App.ensureUserRegistered || ensureUserRegistered;
  App.readMyEmojis = App.readMyEmojis || readMyEmojis;
  App.writeMyEmojis = App.writeMyEmojis || writeMyEmojis;
  App.addLocalEmoji = App.addLocalEmoji || addLocalEmoji;
  App.setupBottomNav = App.setupBottomNav || setupBottomNav;

  global.App = App;

  applyTelegramInsets();
  try {
    const tg = global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
    tg?.onEvent?.("viewportChanged", applyTelegramInsets);
  } catch (_) {}
  ensureUserRegistered();
})(window);
