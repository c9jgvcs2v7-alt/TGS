const AppUtils = window.App || {};
const getUserId = AppUtils.getUserId || (() => "0");
const setUserId = AppUtils.setUserId || (() => {});
const getApiBase = AppUtils.getApiBase || (() => "http://localhost:8000");
const getTelegramUser = AppUtils.getTelegramUser || (() => null);
const setupBottomNavShared = AppUtils.setupBottomNav || null;

function setupUserId() {
  const input = document.getElementById("userIdInput");
  if (!input) return;
  const tgUser = getTelegramUser();
  if (tgUser && tgUser.id != null) {
    input.value = String(tgUser.id);
    input.disabled = true;
    input.title = "Telegram user id";
    return;
  }
  input.value = getUserId();

  input.addEventListener("input", () => {
    const next = String(input.value || "").trim();
    setUserId(next || "0");
  });
}

function setupApiBase() {
  const input = document.getElementById("apiBaseInput");
  if (!input) return;
  input.value = getApiBase();

  input.addEventListener("input", () => {
    const next = String(input.value || "").trim();
    try {
      localStorage.setItem("api_base_url", next || "http://localhost:8000");
    } catch (_) {}
  });
}

function setupBottomNavFallback() {
  document.querySelectorAll(".navItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.dataset.route;
      if (route === "profile") return;

      if (route === "catalog") window.location.href = "./catalog.html";
      if (route === "my") window.location.href = "./my.html";
    });
  });
}

setupUserId();
setupApiBase();
if (setupBottomNavShared) {
  setupBottomNavShared("profile");
} else {
  setupBottomNavFallback();
}
