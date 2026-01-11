function getParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

async function loadTemplates() {
  const res = await fetch("../data/cards.json", { cache: "no-store" });
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
}

function yesNo(v) {
  if (v === true) return "Да";
  if (v === false) return "Нет";
  return "—";
}

(async () => {
  const id = getParam("id");
  if (!id) return;

  const items = await loadTemplates();
  const item = items.find((x) => String(x.id) === String(id));
  if (!item) return;

  lottie.loadAnimation({
    container: document.getElementById("lottie"),
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: item.lottiePath,
  });

  document.getElementById("colors").textContent = item.colorsCount ?? "—";
  document.getElementById("logo").textContent = yesNo(item.hasLogo);
  document.getElementById("gradients").textContent = yesNo(item.hasGradients);

  document.getElementById("configureBtn").addEventListener("click", () => {
    window.location.href = "./editor.html?id=" + encodeURIComponent(id);
  });
})();
