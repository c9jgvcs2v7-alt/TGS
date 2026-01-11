// ===== helpers =====
      function getParam(name) {
        return new URL(window.location.href).searchParams.get(name);
      }

async function loadTemplates() {
  const res = await fetch("../data/cards.json", { cache: "no-store" });
        if (!res.ok) throw new Error("cards.json not found");
        const data = await res.json();
        return Array.isArray(data) ? data : data.items || [];
      }

      function showError(msg) {
        const el = document.createElement("div");
        el.className = "error";
        el.textContent = msg;
        document.body.prepend(el);
        el.style.display = "block";
      }

      function clamp01(x) {
        const v = Number(x);
        if (Number.isNaN(v)) return 0;
        return Math.max(0, Math.min(1, v));
      }

      function rgb01ToHex(rgb) {
        const to255 = (v) => Math.round(Math.max(0, Math.min(1, Number(v))) * 255);
        const r = to255(rgb[0]).toString(16).padStart(2, "0");
        const g = to255(rgb[1]).toString(16).padStart(2, "0");
        const b = to255(rgb[2]).toString(16).padStart(2, "0");
        return "#" + r + g + b;
      }

      function hexToRgb01(hex) {
        const h = String(hex || "").replace("#", "").trim();
        if (h.length !== 6) return null;
        const r = parseInt(h.slice(0, 2), 16) / 255;
        const g = parseInt(h.slice(2, 4), 16) / 255;
        const b = parseInt(h.slice(4, 6), 16) / 255;
        return [r, g, b];
      }

      function normalizeHex(hex) {
        const raw = String(hex || "").trim().replace("#", "");
        if (raw.length === 3) {
          const r = raw[0] + raw[0];
          const g = raw[1] + raw[1];
          const b = raw[2] + raw[2];
          return ("#" + r + g + b).toUpperCase();
        }
        if (raw.length !== 6) return null;
        const h = raw.toUpperCase();
        if (!/^[0-9A-F]{6}$/.test(h)) return null;
        return "#" + h;
      }

      function hsvToRgb01(h, s, v) {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0;
        let g = 0;
        let b = 0;

        if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];

        return [r + m, g + m, b + m];
      }

      function rgb01ToHsv(rgb) {
        const r = rgb[0];
        const g = rgb[1];
        const b = rgb[2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;

        if (d === 0) h = 0;
        else if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);

        if (h < 0) h += 360;
        const s = max === 0 ? 0 : d / max;
        const v = max;
        return { h, s, v };
      }

      function deepCopyValue(v) {
        if (Array.isArray(v)) return v.slice();
        return v;
      }

      function valuesEqual(a, b) {
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) {
            if (Number(a[i]) !== Number(b[i])) return false;
          }
          return true;
        }
        return Number(a) === Number(b);
      }

      function getByPath(root, path) {
        let cur = root;
        for (const k of path) cur = cur[k];
        return cur;
      }

      function setByPath(root, path, value) {
        let cur = root;
        for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
        cur[path[path.length - 1]] = value;
      }

      function isStaticValue(node) {
        if (typeof node === "number") return true;
        if (Array.isArray(node) && node.length && node.every((x) => typeof x === "number")) return true;
        return false;
      }

      function getStaticK(prop) {
        if (prop && typeof prop === "object" && "k" in prop) {
          const k = prop.k;
          if (prop.a === 0 && isStaticValue(k)) return k;
          return null;
        }

        if (isStaticValue(prop)) return prop;
        return null;
      }

      function findColorsWithOpacity(lottieObj) {
        const out = [];

        function walk(node, path) {
          if (node && typeof node === "object" && !Array.isArray(node)) {
            const ty = node.ty;
            if (ty === "fl" || ty === "st") {
              const cK = getStaticK(node.c);
              const oK = getStaticK(node.o);

              if (Array.isArray(cK) && cK.length >= 3) {
                out.push({
                  id: out.length + 1,
                  kind: ty === "fl" ? "fill" : "stroke",
                  color: [Number(cK[0]), Number(cK[1]), Number(cK[2])],
                  color_path: path.concat(["c", "k"]),
                  opacity: typeof oK === "number" ? Number(oK) : null,
                  opacity_path: typeof oK === "number" ? path.concat(["o", "k"]) : null,
                  nm: node.nm || null,
                });
              }
            }

            for (const [k, v] of Object.entries(node)) {
              walk(v, path.concat([k]));
            }
            return;
          }

          if (Array.isArray(node)) {
            node.forEach((v, i) => walk(v, path.concat([i])));
          }
        }

        walk(lottieObj, []);
        return out;
      }

      function findGradients(lottieObj) {
        const out = [];

        function getGradientInfo(node, path) {
          if (!node || !node.g) return null;
          const points = Number(node.g.p);
          if (!Number.isFinite(points) || points <= 0) return null;

          let kPath = null;
          let values = null;
          const kProp = node.g.k;

          if (kProp && typeof kProp === "object" && "k" in kProp) {
            const kVal = getStaticK(kProp);
            if (Array.isArray(kVal)) {
              values = kVal;
              kPath = path.concat(["g", "k", "k"]);
            }
          } else if (Array.isArray(kProp)) {
            values = kProp;
            kPath = path.concat(["g", "k"]);
          }

          if (!Array.isArray(values) || !kPath) return null;
          return { points, kPath, values };
        }

        function walk(node, path) {
          if (node && typeof node === "object" && !Array.isArray(node)) {
            const ty = node.ty;
            if (ty === "gf" || ty === "gs") {
              const info = getGradientInfo(node, path);
              if (info) {
                const stops = [];
                const totalStops = Math.min(info.points, Math.floor(info.values.length / 4));

                for (let i = 0; i < totalStops; i++) {
                  const base = i * 4;
                  const pos = Number(info.values[base]);
                  const rgb = [Number(info.values[base + 1]), Number(info.values[base + 2]), Number(info.values[base + 3])];
                  stops.push({ index: i, pos, rgb, baseIndex: base });
                }

                out.push({
                  id: out.length + 1,
                  kind: ty === "gf" ? "fill" : "stroke",
                  name: node.nm || null,
                  points: info.points,
                  kPath: info.kPath,
                  stops,
                });
              }
            }

            for (const [k, v] of Object.entries(node)) {
              walk(v, path.concat([k]));
            }
            return;
          }

          if (Array.isArray(node)) {
            node.forEach((v, i) => walk(v, path.concat([i])));
          }
        }

        walk(lottieObj, []);
        return out;
      }

      // ===== storage =====
      const USER_ID_KEY = "user_id_v1";
      const API_BASE_KEY = "api_base_url";
      const PENDING_KEY = "editor_pending_result";

      function getUserId() {
        try {
          return localStorage.getItem(USER_ID_KEY) || "0";
        } catch (_) {
          return "0";
        }
      }

      function getApiBase() {
        try {
          return localStorage.getItem(API_BASE_KEY) || "http://localhost:8000";
        } catch (_) {
          return "http://localhost:8000";
        }
      }

      function readPending() {
        try {
          const raw = localStorage.getItem(PENDING_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (_) {
          return null;
        }
      }

      // ===== editor state =====
      const undoStack = [];
      const redoStack = [];
      const pendingSession = new Map();

      let lottieInstance = null;
      let lastLottieObject = null;
      let currentTemplateId = null;
      let colorItems = [];
      let groups = [];
      let groupMode = false;
      let gradientItems = [];
      let mixGroupMode = false;

      const colorsList = document.getElementById("colorsList");
      const colorsMeta = document.getElementById("colorsMeta");
      const groupToggle = document.getElementById("groupToggle");
      const gradientsList = document.getElementById("gradientsList");
      const gradientsMeta = document.getElementById("gradientsMeta");
      const mixList = document.getElementById("mixList");
      const mixMeta = document.getElementById("mixMeta");
      const mixGroupToggle = document.getElementById("mixGroupToggle");
      const doneBtn = document.getElementById("doneBtn");
      const undoBtn = document.getElementById("undoBtn");
      const redoBtn = document.getElementById("redoBtn");
      const tabs = document.querySelectorAll(".tab");
      const gradientsTab = document.querySelector('.tab[data-tab="gradients"]');
      const logoTab = document.querySelector('.tab[data-tab="logo"]');
      const settingsPanel = document.getElementById("settingsPanel");
      const settingsHandle = document.getElementById("settingsHandle");
      const settingsHeader = document.getElementById("settingsHeader");
      const panels = {
        colors: document.getElementById("colorsPanel"),
        logo: document.getElementById("logoPanel"),
        gradients: document.getElementById("gradientsPanel"),
        mix: document.getElementById("mixPanel"),
      };
      const SETTINGS_HEIGHT_KEY = "editor_settings_height";

      function setUndoState() {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
      }

      function setActiveTab(tabId) {
        tabs.forEach((tab) => {
          tab.setAttribute("aria-selected", String(tab.dataset.tab === tabId));
        });
        Object.entries(panels).forEach(([id, el]) => {
          el.style.display = id === tabId ? "block" : "none";
        });
        if (tabId === "mix") {
          renderMixUI();
        }
      }

      function updateTabsVisibility({ hasLogo, hasGradients }) {
        if (gradientsTab) gradientsTab.style.display = hasGradients ? "" : "none";
        if (logoTab) logoTab.style.display = hasLogo ? "" : "none";
        if (!hasGradients && panels.gradients) panels.gradients.style.display = "none";
        if (!hasLogo && panels.logo) panels.logo.style.display = "none";

        const activeTab = Array.from(tabs).find((tab) => tab.getAttribute("aria-selected") === "true");
        const isHidden = activeTab && getComputedStyle(activeTab).display === "none";
        if (isHidden) setActiveTab("colors");
      }

      function beginSession(rowId, label, targets) {
        const key = String(rowId);
        if (pendingSession.has(key)) return;

        const beforeMap = new Map();
        for (const it of targets) {
          const cBefore = deepCopyValue(getByPath(lastLottieObject, it.color_path));
          beforeMap.set(JSON.stringify(it.color_path), cBefore);

          if (it.opacity_path) {
            const oBefore = deepCopyValue(getByPath(lastLottieObject, it.opacity_path));
            beforeMap.set(JSON.stringify(it.opacity_path), oBefore);
          }
        }

        pendingSession.set(key, { label, beforeMap });
      }

      function beginSessionPaths(rowId, label, paths) {
        const key = String(rowId);
        if (pendingSession.has(key)) return;

        const beforeMap = new Map();
        paths.forEach((path) => {
          const before = deepCopyValue(getByPath(lastLottieObject, path));
          beforeMap.set(JSON.stringify(path), before);
        });

        pendingSession.set(key, { label, beforeMap });
      }

      function commitSession(rowId) {
        const key = String(rowId);
        const sess = pendingSession.get(key);
        if (!sess) return;

        const changes = [];
        for (const [pkey, before] of sess.beforeMap.entries()) {
          const path = JSON.parse(pkey);
          const now = deepCopyValue(getByPath(lastLottieObject, path));
          if (!valuesEqual(before, now)) {
            changes.push({ path, before, after: now });
          }
        }

        if (changes.length) {
          undoStack.push({ label: sess.label, changes });
          redoStack.length = 0;
        }
        pendingSession.delete(key);
        setUndoState();
        if (groupMode && changes.length) {
          renderColorsUI();
        }
      }

      function undoLast() {
        if (!undoStack.length || !lastLottieObject) return;
        const action = undoStack.pop();
        for (const ch of action.changes) {
          setByPath(lastLottieObject, ch.path, deepCopyValue(ch.before));
        }

        redoStack.push(action);
        colorItems = findColorsWithOpacity(lastLottieObject);
        gradientItems = findGradients(lastLottieObject);
        renderPreview(lastLottieObject);
        renderColorsUI();
        renderGradientsUI();
        renderMixUI();
        setUndoState();
      }

      function redoLast() {
        if (!redoStack.length || !lastLottieObject) return;
        const action = redoStack.pop();
        for (const ch of action.changes) {
          setByPath(lastLottieObject, ch.path, deepCopyValue(ch.after));
        }

        undoStack.push(action);
        colorItems = findColorsWithOpacity(lastLottieObject);
        gradientItems = findGradients(lastLottieObject);
        renderPreview(lastLottieObject);
        renderColorsUI();
        renderGradientsUI();
        renderMixUI();
        setUndoState();
      }

      function destroyPreview() {
        if (lottieInstance) {
          try {
            lottieInstance.destroy();
          } catch (_) {}
          lottieInstance = null;
        }
      }

      function renderPreview(lottieJson) {
        destroyPreview();
        if (!lottieJson) return;

        const container = document.getElementById("lottieContainer");
        container.innerHTML = "";
        lottieInstance = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: lottieJson,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
      }

      function applyToItem(item, newHex) {
        const rgb = hexToRgb01(newHex);
        if (!rgb) return false;

        const newColor = [rgb[0], rgb[1], rgb[2]];
        setByPath(lastLottieObject, item.color_path, newColor);
        item.color = newColor;
        return true;
      }

      function computeGroups() {
        const map = new Map();

        for (const it of colorItems) {
          const hex = normalizeHex(rgb01ToHex(it.color || [0, 0, 0])) || "#000000";
          const key = hex;

          if (!map.has(key)) map.set(key, { key, hex, items: [] });
          map.get(key).items.push(it);
        }

        groups = Array.from(map.values())
          .map((g) => ({ key: g.key, hex: g.hex, count: g.items.length, items: g.items }))
          .sort((a, b) => b.count - a.count);
      }

function buildRowHTML({ rowId, hex, labelText, countText }) {
  const badge = countText ? `<span class="badge">${countText}</span>` : "";
  const safeHex = normalizeHex(hex) || "#000000";

        return `
          <div class="colorRow" data-row-id="${rowId}" data-hex="${safeHex}">
            <button class="pickerBtn colorCardBtn" type="button" aria-label="Выбрать цвет">
              <span class="pickerMain">
                <span class="pickerSwatch" style="background:${safeHex};"></span>
                <span class="pickerHex">${safeHex}</span>
              </span>
              ${badge}
            </button>
          </div>
        `;
      }

      function getTargetsForRow(rowId) {
        const [type, idRaw] = String(rowId).split(":");
        if (type === "item") {
          const id = Number(idRaw);
          const item = colorItems.find((x) => x.id === id);
          return item ? [item] : [];
        }

        if (type === "group") {
          const idx = Number(idRaw);
          const group = groups[idx];
          return group ? group.items : [];
        }

        return [];
      }

      function applyToTargets(targets, newHex) {
        for (const it of targets) {
          applyToItem(it, newHex);
        }
      }

      function setRowHex(row, hex) {
        const safeHex = normalizeHex(hex) || "#000000";
        row.dataset.hex = safeHex;
        const btn = row.querySelector(".pickerBtn");
        if (btn) btn.dataset.hex = safeHex;
        const btnSwatch = row.querySelector(".pickerSwatch");
        if (btnSwatch) btnSwatch.style.background = safeHex;
        const hexLabel = row.querySelector(".pickerHex");
        if (hexLabel) hexLabel.textContent = safeHex;
        return safeHex;
      }

      function buildGradientStopsCss(grad) {
        const stopsSorted = [...grad.stops].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        const fallbackStep = stopsSorted.length > 1 ? 1 / (stopsSorted.length - 1) : 0;
        return stopsSorted
          .map((s, idx) => {
            const hex = normalizeHex(rgb01ToHex(s.rgb || [0, 0, 0])) || "#000000";
            const pos = Number.isFinite(s.pos) ? s.pos : idx * fallbackStep;
            const pct = Math.round(pos * 100);
            return `${hex} ${pct}%`;
          })
          .join(", ");
      }

      const picker = {
        el: document.getElementById("colorPicker"),
        sv: document.getElementById("cpSV"),
        hue: document.getElementById("cpHue"),
        svCursor: document.getElementById("cpSVCursor"),
        hueCursor: document.getElementById("cpHueCursor"),
        hexInput: document.getElementById("cpHex"),
        active: null,
        hsv: { h: 0, s: 1, v: 1 },
        isTyping: false,
      };

      function updatePickerUI() {
        const { h, s, v } = picker.hsv;
        const hueColor = rgb01ToHex(hsvToRgb01(h, 1, 1));
        picker.sv.style.background = `linear-gradient(to right, #fff, ${hueColor})`;

        const svRect = picker.sv.getBoundingClientRect();
        const x = s * svRect.width;
        const y = (1 - v) * svRect.height;
        picker.svCursor.style.left = `${x}px`;
        picker.svCursor.style.top = `${y}px`;

        const hueRect = picker.hue.getBoundingClientRect();
        const hy = (h / 360) * hueRect.height;
        picker.hueCursor.style.top = `${hy}px`;

        if (!picker.isTyping) {
          const hex = normalizeHex(rgb01ToHex(hsvToRgb01(h, s, v)));
          if (hex) picker.hexInput.value = hex;
        }
      }

      function setPickerHSVFromHex(hex) {
        const safeHex = normalizeHex(hex);
        if (!safeHex) return false;
        const rgb = hexToRgb01(safeHex);
        if (!rgb) return false;
        picker.hsv = rgb01ToHsv(rgb);
        return true;
      }

      function applyPickerColor() {
        const { h, s, v } = picker.hsv;
        const hex = normalizeHex(rgb01ToHex(hsvToRgb01(h, s, v)));
        if (hex && picker.active?.onChange) picker.active.onChange(hex);
      }

      function openPicker(anchorEl, initialHex, onChange, onCommit) {
        picker.active = { onChange, onCommit };
        setPickerHSVFromHex(initialHex);
        picker.el.classList.remove("is-hidden");
        picker.el.setAttribute("aria-hidden", "false");
        picker.isTyping = false;
        updatePickerUI();

        const rect = anchorEl.getBoundingClientRect();
        const pickerRect = picker.el.getBoundingClientRect();
        let left = rect.left - pickerRect.width + rect.width;
        let top = rect.bottom + 8;
        if (left < 8) left = 8;
        if (left + pickerRect.width > window.innerWidth - 8) {
          left = window.innerWidth - pickerRect.width - 8;
        }
        if (top + pickerRect.height > window.innerHeight - 8) {
          top = rect.top - pickerRect.height - 8;
        }
        picker.el.style.left = `${left}px`;
        picker.el.style.top = `${top}px`;
      }

      function closePicker(commit = true) {
        if (picker.active?.onCommit && commit) picker.active.onCommit();
        picker.active = null;
        picker.el.classList.add("is-hidden");
        picker.el.setAttribute("aria-hidden", "true");
      }

      function bindPickerDrag(el, onUpdate) {
        el.addEventListener("pointerdown", (e) => {
          el.setPointerCapture(e.pointerId);
          onUpdate(e);
          applyPickerColor();

          const onMove = (ev) => {
            onUpdate(ev);
            applyPickerColor();
          };

          const onUp = (ev) => {
            el.releasePointerCapture(ev.pointerId);
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerup", onUp);
            el.removeEventListener("pointercancel", onUp);
            closePicker(true);
          };

          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerup", onUp);
          el.addEventListener("pointercancel", onUp);
        });
      }

      if (picker.el) {
        bindPickerDrag(picker.sv, (e) => {
          const rect = picker.sv.getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
          picker.hsv.s = x / rect.width;
          picker.hsv.v = 1 - y / rect.height;
          updatePickerUI();
        });

        bindPickerDrag(picker.hue, (e) => {
          const rect = picker.hue.getBoundingClientRect();
          const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
          picker.hsv.h = (y / rect.height) * 360;
          updatePickerUI();
        });

        picker.hexInput.addEventListener("focus", () => {
          picker.isTyping = true;
        });

        picker.hexInput.addEventListener("blur", () => {
          picker.isTyping = false;
          const safeHex = normalizeHex(picker.hexInput.value);
          if (safeHex) {
            picker.hexInput.value = safeHex;
            setPickerHSVFromHex(safeHex);
            updatePickerUI();
            applyPickerColor();
          }
        });

        picker.hexInput.addEventListener("input", () => {
          const raw = picker.hexInput.value.trim();
          const safeHex = normalizeHex(raw);
          if (!safeHex) return;
          setPickerHSVFromHex(safeHex);
          updatePickerUI();
          applyPickerColor();
        });

        picker.hexInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            closePicker(true);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            closePicker(false);
          }
        });

        document.addEventListener("mousedown", (e) => {
          if (picker.el.classList.contains("is-hidden")) return;
          if (picker.el.contains(e.target)) return;
          closePicker(true);
        });

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && !picker.el.classList.contains("is-hidden")) {
            closePicker(false);
          }
        });
      }

      function applyGradientStop(gradient, stopIndex, newHex) {
        const rgb = hexToRgb01(newHex);
        if (!rgb) return false;

        const stop = gradient.stops.find((s) => s.index === stopIndex);
        if (!stop) return false;

        const base = stop.baseIndex;
        const kPath = gradient.kPath;
        setByPath(lastLottieObject, kPath.concat([base + 1]), rgb[0]);
        setByPath(lastLottieObject, kPath.concat([base + 2]), rgb[1]);
        setByPath(lastLottieObject, kPath.concat([base + 3]), rgb[2]);
        stop.rgb = rgb;
        return true;
      }

      function setGroupMode(on) {
        groupMode = !!on;
        if (groupToggle) groupToggle.checked = groupMode;
        renderColorsUI();
        try {
          localStorage.setItem("editor_group_mode", groupMode ? "1" : "0");
        } catch (_) {}
      }

      function setMixGroupMode(on) {
        mixGroupMode = !!on;
        if (mixGroupToggle) mixGroupToggle.checked = mixGroupMode;
        renderMixUI();
        try {
          localStorage.setItem("editor_mix_group_mode", mixGroupMode ? "1" : "0");
        } catch (_) {}
      }

      function clampValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function setSettingsHeight(px) {
        const safePx = Math.round(px);
        document.documentElement.style.setProperty("--settingsH", `${safePx}px`);
        try {
          localStorage.setItem(SETTINGS_HEIGHT_KEY, String(safePx));
        } catch (_) {}
      }

      function initSettingsHeight() {
        if (!settingsPanel) return;
        const minH = 220;
        const maxH = Math.round(window.innerHeight * 0.85);
        let initial = null;
        try {
          const raw = localStorage.getItem(SETTINGS_HEIGHT_KEY);
          if (raw) initial = Number(raw);
        } catch (_) {}
        if (!Number.isFinite(initial)) return;
        const next = clampValue(initial, minH, maxH);
        setSettingsHeight(next);
      }

      function setupSettingsDrag() {
        if (!settingsPanel || !settingsHandle) return;
        const minH = 220;

        function startDrag(e) {
          if (e.target.closest(".tab")) return;
          settingsHandle.setPointerCapture(e.pointerId);
          const startY = e.clientY;
          const startHeight = settingsPanel.getBoundingClientRect().height;

          const onMove = (ev) => {
            const maxH = Math.round(window.innerHeight * 0.85);
            const delta = startY - ev.clientY;
            const next = clampValue(startHeight + delta, minH, maxH);
            setSettingsHeight(next);
          };

          const onUp = (ev) => {
            settingsHandle.releasePointerCapture(ev.pointerId);
            settingsHandle.removeEventListener("pointermove", onMove);
            settingsHandle.removeEventListener("pointerup", onUp);
            settingsHandle.removeEventListener("pointercancel", onUp);
          };

          settingsHandle.addEventListener("pointermove", onMove);
          settingsHandle.addEventListener("pointerup", onUp);
          settingsHandle.addEventListener("pointercancel", onUp);
        }

        settingsHandle.addEventListener("pointerdown", startDrag);
        if (settingsHeader) {
          settingsHeader.addEventListener("pointerdown", (e) => {
            if (e.target === settingsHandle) return;
            startDrag(e);
          });
        }

        window.addEventListener("resize", () => {
          const maxH = Math.round(window.innerHeight * 0.85);
          const current = settingsPanel.getBoundingClientRect().height;
          if (current > maxH) setSettingsHeight(maxH);
        });
      }

      function renderColorsUI() {
        if (!colorItems.length) {
          colorsMeta.textContent = "0";
          colorsList.innerHTML = `<div class="panelNote">В этом шаблоне нет статических цветов Fill/Stroke.</div>`;
          return;
        }

        if (groupMode) {
          computeGroups();
          colorsMeta.textContent = `${groups.length} групп • ${colorItems.length} узлов`;
        } else {
          colorsMeta.textContent = `${colorItems.length} шт.`;
        }

        let html = "";
        if (!groupMode) {
          html = colorItems
            .map((it) => {
              const hex = normalizeHex(rgb01ToHex(it.color || [0, 0, 0])) || "#000000";
            const label = `${hex}`;

            return buildRowHTML({
              rowId: `item:${it.id}`,
              hex,
              labelText: label,
              countText: "",
            });
            })
            .join("");
        } else {
          html = groups
            .map((g, idx) => {
              const label = `${g.hex}`;

              return buildRowHTML({
                rowId: `group:${idx}`,
                hex: g.hex,
                labelText: label,
                countText: String(g.count),
              });
            })
            .join("");
        }

        colorsList.innerHTML = html;

        colorsList.querySelectorAll(".colorRow").forEach((row) => {
          const rowId = row.getAttribute("data-row-id");
          const pickerBtn = row.querySelector(".pickerBtn");

          function updateRowUI(hex) {
            setRowHex(row, hex);
          }

          if (pickerBtn) {
            pickerBtn.addEventListener("click", () => {
              const initialHex = row.dataset.hex || "#000000";
              openPicker(
                pickerBtn,
                initialHex,
                (nextHex) => {
                  if (!lastLottieObject) return;
                  const targets = getTargetsForRow(rowId);
                  if (!targets.length) return;
                  beginSession(rowId, groupMode ? "Change group" : "Change color", targets);
                  applyToTargets(targets, nextHex);
                  renderPreview(lastLottieObject);
                  updateRowUI(nextHex);
                },
                () => {
                  commitSession(rowId);
                }
              );
            });
          }
        });
      }

      function renderGradientsUI() {
        if (!gradientItems.length) {
          gradientsMeta.textContent = "0";
          gradientsList.innerHTML = `<div class="panelNote">В этом шаблоне нет градиентов.</div>`;
          return;
        }

        gradientsMeta.textContent = `${gradientItems.length} шт.`;

        gradientsList.innerHTML = gradientItems
          .map((g) => {
            const title = g.name ? `${g.name}` : "Градиент";
            const gradStops = buildGradientStopsCss(g);
            const stopsHtml = g.stops
              .map((s) => {
                const hex = normalizeHex(rgb01ToHex(s.rgb || [0, 0, 0])) || "#000000";
                const posPct = Number.isFinite(s.pos) ? Math.round(s.pos * 100) : null;
                const badgeText = posPct === null ? `S${s.index + 1}` : `${posPct}%`;
                return `
            <div class="stopRow" data-grad-id="${g.id}" data-stop-index="${s.index}">
              <button class="pickerBtn colorCardBtn" type="button" data-hex="${hex}" aria-label="Выбрать цвет">
                <span class="pickerMain">
                  <span class="pickerSwatch" style="background:${hex};"></span>
                  <span class="pickerHex">${hex}</span>
                </span>
                <span class="badge">${badgeText}</span>
              </button>
            </div>
          `;
              })
              .join("");

            return `
        <div class="gradientCard">
          <div class="gradientHeader">
            <span class="gradientTitle">${title}</span>
            <span class="badge">${g.points}</span>
          </div>
          <div class="gradientPreview" style="background: linear-gradient(90deg, ${gradStops});"></div>
          <div class="gradientStops">${stopsHtml}</div>
        </div>
      `;
          })
          .join("");

        gradientsList.querySelectorAll(".stopRow").forEach((row) => {
          const gradId = Number(row.getAttribute("data-grad-id"));
          const stopIndex = Number(row.getAttribute("data-stop-index"));
          const pickerBtn = row.querySelector(".pickerBtn");

          if (pickerBtn) {
            pickerBtn.addEventListener("click", () => {
              const initialHex = pickerBtn.dataset.hex || "#000000";
              openPicker(
                pickerBtn,
                initialHex,
                (nextHex) => {
                  if (!lastLottieObject) return;
                  const grad = gradientItems.find((g) => g.id === gradId);
                  if (!grad) return;

                  const stop = grad.stops.find((s) => s.index === stopIndex);
                  if (!stop) return;
                  const base = stop.baseIndex;
                  const paths = [
                    grad.kPath.concat([base + 1]),
                    grad.kPath.concat([base + 2]),
                    grad.kPath.concat([base + 3]),
                  ];

                  beginSessionPaths(`grad:${gradId}:${stopIndex}`, "Change gradient stop", paths);
                  if (!applyGradientStop(grad, stopIndex, nextHex)) return;
                  setRowHex(row, nextHex);
                  const preview = row.closest(".gradientCard")?.querySelector(".gradientPreview");
                  if (preview) {
                    preview.style.background = `linear-gradient(90deg, ${buildGradientStopsCss(grad)})`;
                  }
                  renderPreview(lastLottieObject);
                },
                () => {
                  commitSession(`grad:${gradId}:${stopIndex}`);
                }
              );
            });
          }
        });
      }

      function renderMixUI() {
        const colorCount = colorItems.length;
        const stopCount = gradientItems.reduce((sum, g) => sum + g.stops.length, 0);

        if (!colorCount && !stopCount) {
          mixMeta.textContent = "0";
          mixList.innerHTML = `<div class="panelNote">В этом шаблоне нет цветов или градиентов.</div>`;
          return;
        }

        mixMeta.textContent = `${colorCount} цветов • ${stopCount} стопов`;

        const mixItems = [];

        colorItems.forEach((it) => {
          const hex = normalizeHex(rgb01ToHex(it.color || [0, 0, 0])) || "#000000";
          mixItems.push({
            id: `mix-color:${it.id}`,
            hex,
            label: `${hex}`,
          });
        });

        gradientItems.forEach((g) => {
          g.stops.forEach((s) => {
            const hex = normalizeHex(rgb01ToHex(s.rgb || [0, 0, 0])) || "#000000";
            mixItems.push({
              id: `mix-grad:${g.id}:${s.index}`,
              hex,
              label: `${hex}`,
            });
          });
        });

        let html = "";

        if (!mixGroupMode) {
          html = mixItems
            .map((it) =>
              buildRowHTML({
                rowId: it.id,
                hex: it.hex,
                labelText: it.label,
                countText: "",
              })
            )
            .join("");
        } else {
          const groupMap = new Map();
          mixItems.forEach((it) => {
            const key = it.hex;
            if (!groupMap.has(key)) groupMap.set(key, { hex: it.hex, items: [] });
            groupMap.get(key).items.push(it);
          });

          const groupsArr = Array.from(groupMap.values()).sort((a, b) => b.items.length - a.items.length);
          mixMeta.textContent = `${groupsArr.length} групп • ${colorCount} цветов • ${stopCount} стопов`;

          html = groupsArr
            .map((g, idx) =>
              buildRowHTML({
                rowId: `mix-group:${idx}`,
                hex: g.hex,
                labelText: `${g.hex}`,
                countText: String(g.items.length),
              })
            )
            .join("");

          mixList.dataset.groups = JSON.stringify(
            groupsArr.map((g) => ({
              hex: g.hex,
              items: g.items.map((it) => it.id),
            }))
          );
        }

        mixList.innerHTML = html;

        mixList.querySelectorAll(".colorRow").forEach((row) => {
          const rowId = row.getAttribute("data-row-id");
          const pickerBtn = row.querySelector(".pickerBtn");

          function updateRowUI(hex) {
            setRowHex(row, hex);
          }

          if (pickerBtn) {
            pickerBtn.addEventListener("click", () => {
              const initialHex = row.dataset.hex || pickerBtn.dataset.hex || "#000000";
              openPicker(
                pickerBtn,
                initialHex,
                (nextHex) => {
                  if (!lastLottieObject) return;
                  if (rowId.startsWith("mix-group:")) {
                    const groupsRaw = mixList.dataset.groups ? JSON.parse(mixList.dataset.groups) : [];
                    const idx = Number(rowId.split(":")[1]);
                    const group = groupsRaw[idx];
                    if (!group) return;

                    const paths = [];
                    group.items.forEach((id) => {
                      if (id.startsWith("mix-color:")) {
                        const colorId = Number(id.split(":")[1]);
                        const item = colorItems.find((x) => x.id === colorId);
                        if (item) paths.push(item.color_path);
                      } else if (id.startsWith("mix-grad:")) {
                        const parts = id.split(":");
                        const gradId = Number(parts[1]);
                        const stopIndex = Number(parts[2]);
                        const grad = gradientItems.find((g) => g.id === gradId);
                        if (!grad) return;
                        const stop = grad.stops.find((s) => s.index === stopIndex);
                        if (!stop) return;
                        const base = stop.baseIndex;
                        paths.push(grad.kPath.concat([base + 1]));
                        paths.push(grad.kPath.concat([base + 2]));
                        paths.push(grad.kPath.concat([base + 3]));
                      }
                    });

                    beginSessionPaths(rowId, "Change group", paths);

                    group.items.forEach((id) => {
                      if (id.startsWith("mix-color:")) {
                        const colorId = Number(id.split(":")[1]);
                        const item = colorItems.find((x) => x.id === colorId);
                        if (item) applyToItem(item, nextHex);
                      } else if (id.startsWith("mix-grad:")) {
                        const parts = id.split(":");
                        const gradId = Number(parts[1]);
                        const stopIndex = Number(parts[2]);
                        const grad = gradientItems.find((g) => g.id === gradId);
                        if (grad) applyGradientStop(grad, stopIndex, nextHex);
                      }
                    });

                    renderPreview(lastLottieObject);
                    updateRowUI(nextHex);
                    return;
                  }

                  if (rowId.startsWith("mix-color:")) {
                    const id = Number(rowId.split(":")[1]);
                    const item = colorItems.find((x) => x.id === id);
                    if (!item) return;
                    beginSession(rowId, "Change color", [item]);
                    applyToItem(item, nextHex);
                    renderPreview(lastLottieObject);
                    updateRowUI(nextHex);
                    return;
                  }

                  if (rowId.startsWith("mix-grad:")) {
                    const parts = rowId.split(":");
                    const gradId = Number(parts[1]);
                    const stopIndex = Number(parts[2]);
                    const grad = gradientItems.find((g) => g.id === gradId);
                    if (!grad) return;
                    const stop = grad.stops.find((s) => s.index === stopIndex);
                    if (!stop) return;
                    const base = stop.baseIndex;
                    const paths = [
                      grad.kPath.concat([base + 1]),
                      grad.kPath.concat([base + 2]),
                      grad.kPath.concat([base + 3]),
                    ];
                    beginSessionPaths(rowId, "Change gradient stop", paths);
                    if (!applyGradientStop(grad, stopIndex, nextHex)) return;
                    renderPreview(lastLottieObject);
                    updateRowUI(nextHex);
                  }
                },
                () => {
                  commitSession(rowId);
                }
              );
            });
          }
        });
      }

      // ===== init =====
      (async () => {
        try {
          const id = getParam("id");
          if (!id) throw new Error("Missing template id");
          currentTemplateId = String(id);

          const items = await loadTemplates();
          const item = items.find((x) => String(x.id) === String(id));
          if (!item || !item.lottiePath) throw new Error("Template not found");

          tabs.forEach((tab) => {
            tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
          });
          setActiveTab("colors");

          undoBtn.addEventListener("click", undoLast);
          redoBtn.addEventListener("click", redoLast);
          setUndoState();

          doneBtn.addEventListener("click", () => {
            if (!lastLottieObject) return;
            try {
              localStorage.setItem(
                "editor_pending_result",
                JSON.stringify({
                  templateId: currentTemplateId || "unknown",
                  lottieJson: lastLottieObject,
                })
              );
            } catch (_) {}
            window.location.href = "./preview.html";
          });

          try {
            const v = localStorage.getItem("editor_group_mode");
            if (v === "1") groupMode = true;
          } catch (_) {}
          setGroupMode(groupMode);
          if (groupToggle) {
            groupToggle.addEventListener("change", () => setGroupMode(groupToggle.checked));
          }

          try {
            const v = localStorage.getItem("editor_mix_group_mode");
            if (v === "1") mixGroupMode = true;
          } catch (_) {}
          setMixGroupMode(mixGroupMode);
          if (mixGroupToggle) {
            mixGroupToggle.addEventListener("change", () => setMixGroupMode(mixGroupToggle.checked));
          }

          // Back behavior with safety for unsaved changes (stub)
          document.getElementById("backBtn").addEventListener("click", () => {
            // later: check dirty state
            window.history.back();
          });

          const pending = readPending();
          if (pending?.templateId && String(pending.templateId) === String(currentTemplateId) && pending.lottieJson) {
            lastLottieObject = pending.lottieJson;
          } else {
            const res = await fetch(item.lottiePath, { cache: "no-store" });
            if (!res.ok) throw new Error("Lottie JSON not found");
            lastLottieObject = await res.json();
          }

          undoStack.length = 0;
          redoStack.length = 0;
          pendingSession.clear();
          setUndoState();

          renderPreview(lastLottieObject);
          colorItems = findColorsWithOpacity(lastLottieObject);
          renderColorsUI();
          gradientItems = findGradients(lastLottieObject);
          updateTabsVisibility({ hasLogo: !!item.hasLogo, hasGradients: gradientItems.length > 0 });
          renderGradientsUI();
          renderMixUI();
          initSettingsHeight();
          setupSettingsDrag();
        } catch (e) {
          showError(e.message || e);
        }
      })();
