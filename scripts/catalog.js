async function loadTemplates() {
  const res = await fetch("../data/cards.json", { cache: "no-store" });
  if (!res.ok) throw new Error("cards.json not found");
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items || [];
  if (!Array.isArray(items)) throw new Error("Invalid cards.json format");

  return items
    .filter((x) => x && x.lottiePath)
    .map((x, i) => {
      const id = x.id ?? `item-${i}`;
      return {
        id,
        lottiePath: x.lottiePath,
        href: `./template.html?id=${encodeURIComponent(String(id))}`,
        hasLogo: typeof x.hasLogo === "boolean" ? x.hasLogo : null,
        colorsCount: Number.isFinite(Number(x.colorsCount)) ? Number(x.colorsCount) : null,
        collection: (x.collection || "Без коллекции").trim(),
      };
    });
}

const FILTERS = [
  { id: "all", label: "Все", fn: () => true },
  { id: "logo_yes", label: "С логотипом", fn: (t) => t.hasLogo === true },
  { id: "logo_no", label: "Без логотипа", fn: (t) => t.hasLogo === false },
];

let allTemplates = [];
let activeFilterId = "all";
let viewMode = "all";
let activeCollection = null;
let collections = [];

function renderChips() {
  const chips = document.getElementById("chips");
  chips.innerHTML = "";

  FILTERS.forEach((f) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = f.label;
    btn.setAttribute("aria-selected", String(f.id === activeFilterId));

    btn.addEventListener("click", () => {
      if (activeFilterId === f.id) return;
      activeFilterId = f.id;
      renderChips();
      renderGrid();
    });

    chips.appendChild(btn);
  });
}

function getFilteredTemplates() {
  const f = FILTERS.find((x) => x.id === activeFilterId) ?? FILTERS[0];
  return allTemplates.filter(f.fn);
}

function buildCollections(items) {
  const map = new Map();
  items.forEach((item) => {
    const name = item.collection || "Без коллекции";
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(item);
  });
  return Array.from(map.entries()).map(([name, items]) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    count: items.length,
    items,
  }));
}

const animByEl = new WeakMap();
const loadedEl = new WeakSet();

function ensureAnimation(el, path) {
  if (loadedEl.has(el)) return;
  loadedEl.add(el);

  const anim = lottie.loadAnimation({
    container: el,
    renderer: "svg",
    loop: true,
    autoplay: false,
    path,
    rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
  });

  anim.addEventListener?.("data_failed", () => {
    try {
      anim.destroy();
    } catch (_) {}
    el.innerHTML = "";
  });

  animByEl.set(el, anim);
}

function play(el) {
  const anim = animByEl.get(el);
  if (anim) anim.play();
}

function pause(el) {
  const anim = animByEl.get(el);
  if (anim) anim.pause();
}

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const el = entry.target;
      const path = el.getAttribute("data-path");
      if (!path) continue;

      if (entry.isIntersecting) {
        ensureAnimation(el, path);
        play(el);
      } else {
        pause(el);
      }
    }
  },
  { root: null, rootMargin: "120px 0px", threshold: 0.15 }
);

function renderGrid() {
  const grid = document.getElementById("grid");
  const status = document.getElementById("status");
  let visible = [];
  if (viewMode === "all") {
    visible = getFilteredTemplates();
    status.textContent = String(visible.length);
  } else if (activeCollection) {
    visible = activeCollection.items || [];
    status.textContent = String(visible.length);
  } else {
    status.textContent = String(collections.length);
  }

  io.disconnect();
  grid.innerHTML = "";
  if (!visible.length) return;

  visible.forEach((t) => {
    const card = document.createElement("a");
    card.className = "card";
    card.href = t.href;
    card.setAttribute("aria-label", "Открыть шаблон");

    card.innerHTML = `
      <div class="stage">
        <div class="lottie" data-path="${t.lottiePath}"></div>
      </div>
    `;

    grid.appendChild(card);

    const lottieEl = card.querySelector(".lottie");
    io.observe(lottieEl);
  });
}

function renderCollectionsList() {
  const list = document.getElementById("collections");
  if (!list) return;
  list.innerHTML = "";

  collections.forEach((col) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "collectionItem";
    row.innerHTML = `
      <div class="collectionThumb">${col.name.slice(0, 2).toUpperCase()}</div>
      <div>
        <div class="collectionName">${col.name}</div>
      </div>
      <div class="collectionCount">${col.count}</div>
    `;
    row.addEventListener("click", () => {
      activeCollection = col;
      updateViewMode("collections");
    });
    list.appendChild(row);
  });
}

function updateViewMode(nextMode) {
  viewMode = nextMode;
  const chips = document.getElementById("chips");
  const grid = document.getElementById("grid");
  const list = document.getElementById("collections");
  const header = document.getElementById("collectionHeader");
  const title = document.getElementById("collectionTitle");

  document.querySelectorAll(".modeTab").forEach((btn) => {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === viewMode));
  });

  if (viewMode === "all") {
    activeCollection = null;
    if (chips) chips.style.display = "";
    if (list) list.style.display = "none";
    if (header) header.style.display = "none";
    if (grid) grid.style.display = "grid";
    renderGrid();
    return;
  }

  if (chips) chips.style.display = "none";
  if (grid) grid.style.display = activeCollection ? "grid" : "none";
  if (list) list.style.display = activeCollection ? "none" : "flex";
  if (header) header.style.display = activeCollection ? "flex" : "none";
  if (title) title.textContent = activeCollection ? activeCollection.name : "Коллекции";
  if (!activeCollection) renderCollectionsList();
  renderGrid();
}

function showError(msg) {
  const el = document.getElementById("error");
  el.style.display = "block";
  el.textContent = String(msg);
}

function setupBottomNav() {
  if (window.App?.setupBottomNav) {
    window.App.setupBottomNav("catalog");
    return;
  }
  document.querySelectorAll(".navItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.dataset.route;
      if (route === "catalog") return;

      if (route === "my") window.location.href = "./my.html";
      if (route === "profile") window.location.href = "./profile.html";
    });
  });
}

(async () => {
  try {
    setupBottomNav();
    renderChips();
    allTemplates = await loadTemplates();
    collections = buildCollections(allTemplates);
    renderGrid();
    updateViewMode("all");

    document.querySelectorAll(".modeTab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        if (mode === viewMode) return;
        updateViewMode(mode);
      });
    });

    const backBtn = document.getElementById("collectionBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        activeCollection = null;
        updateViewMode("collections");
      });
    }
  } catch (e) {
    showError(e?.message || e);
    document.getElementById("status").textContent = "—";
  }
})();
