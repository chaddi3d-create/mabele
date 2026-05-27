const TELEGRAM_DEFAULT = "https://t.me/Mabelle_Showroom_New";
const EMBEDDED_CATALOG = {
  settings: {
    brandName: "MA BELLE",
    brandSub: "showroom",
    slogan: "Женственная мода с душой — закажите любимый образ в Telegram",
    telegramUrl: TELEGRAM_DEFAULT,
    contactEmail: "hello@mabelle.show",
    deliveryNote: "Доставка по России и СНГ. Сроки и стоимость уточняем в Telegram после заказа.",
    returnNote: "Возврат в течение 14 дней при сохранении бирок и товарного вида.",
  },
  categories: [
    { id: "all", label: "Все" },
    { id: "obrazy", label: "Образы" },
    { id: "platya", label: "Платья" },
    { id: "kostyumy", label: "Костюмы" },
    { id: "aksessuary", label: "Аксессуары" },
  ],
  looks: [
    {
      id: "look-k",
      title: "Шоколадный knit-комплект",
      category: "kostyumy",
      description: "Каждую вещь можно заказать отдельно.",
      heroImage: "k.png",
      gallery: ["k.png", "k1.png"],
      published: true,
      sortOrder: 1,
      pieces: [
        { id: "piece-k", code: "k", name: "Топ knit pointelle", sku: "MB-K-01", price: 5900, sizes: ["XS", "S", "M", "L"], image: "k.png" },
        { id: "piece-k1", code: "k1", name: "Поло-топ knit", sku: "MB-K-02", price: 6200, sizes: ["XS", "S", "M", "L"], image: "k1.png" },
        { id: "piece-k2", code: "k2", name: "Шорты knit", sku: "MB-K-03", price: 4900, sizes: ["XS", "S", "M", "L"], image: "k1.png" },
      ],
    },
    {
      id: "look-w",
      title: "Образ quiet luxury",
      category: "kostyumy",
      description: "Кремовый total look с чёрным жакетом и акцентами.",
      heroImage: "w5.png",
      gallery: ["w5.png", "w4.png", "w3.png", "w2.png", "w.png"],
      published: true,
      sortOrder: 2,
      pieces: [
        { id: "piece-w", code: "w", name: "Босоножки кожаные", sku: "MB-W-01", price: 6800, sizes: ["36", "37", "38", "39", "40"], image: "w.png" },
        { id: "piece-w1", code: "w1", name: "Жакет укороченный чёрный", sku: "MB-W-02", price: 8900, sizes: ["XS", "S", "M", "L"], image: "w4.png" },
        { id: "piece-w2", code: "w2", name: "Сумка crossbody чёрная", sku: "MB-W-03", price: 4500, sizes: ["ONE"], image: "w2.png" },
      ],
    },
    {
      id: "look-b",
      title: "Платье с розами",
      category: "platya",
      description: "Воздушное платье с вышивкой роз.",
      heroImage: "b2.png",
      gallery: ["b2.png", "b1.png", "b.png"],
      published: true,
      sortOrder: 3,
      pieces: [
        { id: "piece-b2", code: "b2", name: "Платье макси с вышивкой", sku: "MB-B-01", price: 12500, sizes: ["XS", "S", "M", "L"], image: "b2.png" },
      ],
    },
    {
      id: "look-p",
      title: "Лавандовый романтик",
      category: "obrazy",
      description: "Блуза с рюшами и юбка с цветочным принтом.",
      heroImage: "p3.png",
      gallery: ["p3.png", "p2.png", "p1.png", "p.png"],
      published: true,
      sortOrder: 4,
      pieces: [
        { id: "piece-p1", code: "p1", name: "Блуза лавандовая с рюшами", sku: "MB-P-01", price: 7800, sizes: ["XS", "S", "M", "L"], image: "p1.png" },
        { id: "piece-p2", code: "p2", name: "Юбка макси цветочная", sku: "MB-P-02", price: 6900, sizes: ["XS", "S", "M", "L"], image: "p2.png" },
      ],
    },
  ],
};

let catalog = null;
let activeLook = null;
let activeFilter = "all";
const selectedPieces = new Map();

const $ = (sel) => document.querySelector(sel);

async function loadCatalog() {
  try {
    const res = await fetch("api/catalog");
    if (res.ok) {
      catalog = await res.json();
    }
  } catch {
    /* offline / static */
  }
  if (!catalog) {
    const local = localStorage.getItem("mabelle_catalog");
    if (local) {
      catalog = JSON.parse(local);
    } else {
      try {
        const res = await fetch("data/catalog.json");
        catalog = await res.json();
      } catch {
        catalog = EMBEDDED_CATALOG;
      }
    }
  }
  applySettings();
  renderFilters();
  renderGrid();
}

function applySettings() {
  const s = catalog.settings;
  const tg = s.telegramUrl || TELEGRAM_DEFAULT;
  $("#heroSlogan").textContent = s.slogan || "";
  $("#footerDelivery").textContent = s.deliveryNote || "";
  $("#footerReturn").textContent = s.returnNote || "";
  $("#footerEmail").textContent = s.contactEmail || "";
  ["headerTelegram", "howTelegram", "footerTelegram", "fabTelegram"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.href = tg;
      if (id === "fabTelegram") el.textContent = "Заказать в Telegram";
    }
  });
}

function imgUrl(name) {
  if (!name) return "images/logo.png";
  if (name.startsWith("data:") || name.startsWith("http://") || name.startsWith("https://")) {
    return name;
  }
  return name ? `images/${encodeURIComponent(name)}` : "images/logo.png";
}

function formatPrice(n) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function publishedLooks() {
  return (catalog.looks || [])
    .filter((l) => l.published !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function renderFilters() {
  const wrap = $("#filters");
  wrap.innerHTML = "";
  (catalog.categories || []).forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter-btn${cat.id === activeFilter ? " active" : ""}`;
    btn.textContent = cat.label;
    btn.dataset.id = cat.id;
    btn.addEventListener("click", () => {
      activeFilter = cat.id;
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderGrid();
    });
    wrap.appendChild(btn);
  });
}

function filteredLooks() {
  const list = publishedLooks();
  if (activeFilter === "all") return list;
  return list.filter((l) => l.category === activeFilter);
}

function minPrice(look) {
  const prices = (look.pieces || []).map((p) => p.price).filter(Boolean);
  return prices.length ? Math.min(...prices) : 0;
}

function renderGrid() {
  const grid = $("#catalogGrid");
  const empty = $("#catalogEmpty");
  const looks = filteredLooks();
  grid.innerHTML = "";

  if (!looks.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  looks.forEach((look) => {
    const count = (look.pieces || []).length;
    const badge =
      count > 1
        ? `Образ · ${count} ${pieceWord(count)}`
        : "В каталоге";
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card__img-wrap">
        <span class="card__badge">${badge}</span>
        <img class="card__img" src="${imgUrl(look.heroImage)}" alt="${escapeHtml(look.title)}" loading="lazy" width="400" height="533" />
      </div>
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(look.title)}</h3>
        <div class="card__chips">
          ${(look.pieces || []).map((p) => `<span class="chip">${escapeHtml(p.name)}</span>`).join("")}
        </div>
        <p class="card__price">от ${formatPrice(minPrice(look))}</p>
        <p class="card__hint">${count > 1 ? "Можно заказать по отдельности" : ""}</p>
        <button type="button" class="btn btn--outline btn--sm card__open">Смотреть образ</button>
      </div>
    `;
    card.querySelector(".card__open").addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(look);
    });
    card.addEventListener("click", () => openModal(look));
    grid.appendChild(card);
  });
}

function pieceWord(n) {
  const m = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return "вещей";
  if (m === 1) return "вещь";
  if (m >= 2 && m <= 4) return "вещи";
  return "вещей";
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function openModal(look) {
  activeLook = look;
  selectedPieces.clear();
  $("#selectAllPieces").hidden = false;
  $("#modalTitle").textContent = look.title;
  $("#modalDesc").textContent = look.description || "";
  const gallery = look.gallery?.length ? look.gallery : [look.heroImage];
  $("#modalMainImg").src = imgUrl(gallery[0]);
  $("#modalMainImg").alt = look.title;

  const thumbs = $("#modalThumbs");
  thumbs.innerHTML = "";
  gallery.forEach((img, i) => {
    const t = document.createElement("img");
    t.src = imgUrl(img);
    t.className = `modal__thumb${i === 0 ? " active" : ""}`;
    t.alt = "";
    t.loading = "lazy";
    t.addEventListener("click", () => {
      $("#modalMainImg").src = imgUrl(img);
      thumbs.querySelectorAll(".modal__thumb").forEach((el) => el.classList.remove("active"));
      t.classList.add("active");
    });
    t.addEventListener("dblclick", () => openLightbox(imgUrl(img)));
    thumbs.appendChild(t);
  });

  $("#modalMainImg").onclick = () => openLightbox($("#modalMainImg").src);

  const pieceCount = (look.pieces || []).length;
  $("#piecesTitle").textContent = pieceCount > 1 ? "Состав образа" : "Заказ";
  $("#selectAllPieces").hidden = pieceCount <= 1;
  if (pieceCount === 1) {
    const p = look.pieces[0];
    selectedPieces.set(p.id, { piece: p, size: p.sizes?.[0] || "M" });
  }
  renderPieces();
  $("#modalOverlay").classList.add("open");
  $("#modalOverlay").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function renderPieces() {
  const list = $("#piecesList");
  list.innerHTML = "";
  const single = (activeLook.pieces || []).length === 1;
  (activeLook.pieces || []).forEach((piece) => {
    const id = piece.id;
    const row = document.createElement("div");
    row.className = "piece";
    const defaultSize = piece.sizes?.[0] || "M";
    row.innerHTML = `
      <img class="piece__img" src="${imgUrl(piece.image)}" alt="" loading="lazy" />
      <div>
        <div class="piece__top">
          <input type="checkbox" class="piece__check" id="chk-${id}" data-id="${id}" />
          <div>
            <div class="piece__name">${escapeHtml(piece.name)}</div>
            <div class="piece__sku">Арт. ${escapeHtml(piece.sku)} · код ${escapeHtml(piece.code)}</div>
            <div class="piece__price">${formatPrice(piece.price)}</div>
          </div>
        </div>
        <div class="piece__size">
          <label for="size-${id}">Размер</label>
          <select id="size-${id}" data-id="${id}">
            ${(piece.sizes || ["M"]).map((s) => `<option value="${s}">${s}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
    const chk = row.querySelector(".piece__check");
    const sel = row.querySelector("select");
    if (single) {
      chk.checked = true;
      row.classList.add("selected");
      chk.closest(".piece__top")?.querySelector(".piece__check")?.setAttribute("hidden", "");
    }
    chk.addEventListener("change", () => {
      if (chk.checked) {
        selectedPieces.set(id, { piece, size: sel.value });
        row.classList.add("selected");
      } else {
        selectedPieces.delete(id);
        row.classList.remove("selected");
      }
      updateTotal();
    });
    sel.addEventListener("change", () => {
      if (selectedPieces.has(id)) {
        selectedPieces.set(id, { piece, size: sel.value });
      }
    });
    list.appendChild(row);
  });
  updateTotal();
}

function updateTotal() {
  let sum = 0;
  selectedPieces.forEach(({ piece }) => {
    sum += piece.price || 0;
  });
  const n = selectedPieces.size;
  $("#orderTotal").textContent =
    n === 0 ? "Выберите вещи для заказа" : `Итого: ${formatPrice(sum)} · ${n} ${pieceWord(n)}`;
}

function buildTelegramMessage() {
  if (!activeLook || selectedPieces.size === 0) return null;
  const lines = [
    "Здравствуйте! Хочу заказать:",
    "",
    `📌 Образ: «${activeLook.title}»`,
  ];
  let sum = 0;
  selectedPieces.forEach(({ piece, size }) => {
    lines.push(`• ${piece.name} (${piece.sku}), размер ${size} — ${formatPrice(piece.price)}`);
    sum += piece.price || 0;
  });
  lines.push("", `Итого: ${formatPrice(sum)}`);
  return lines.join("\n");
}

function telegramLink(text) {
  const base = catalog?.settings?.telegramUrl || TELEGRAM_DEFAULT;
  if (!text) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}text=${encodeURIComponent(text)}`;
}

function closeModal() {
  $("#modalOverlay").classList.remove("open");
  $("#modalOverlay").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  activeLook = null;
}

function openLightbox(src) {
  $("#lightboxImg").src = src;
  $("#lightbox").classList.add("open");
}

function closeLightbox() {
  $("#lightbox").classList.remove("open");
}

$("#modalClose").addEventListener("click", closeModal);
$("#modalOverlay").addEventListener("click", (e) => {
  if (e.target === $("#modalOverlay")) closeModal();
});

$("#selectAllPieces").addEventListener("click", () => {
  document.querySelectorAll(".piece__check").forEach((chk) => {
    if (!chk.checked) {
      chk.checked = true;
      chk.dispatchEvent(new Event("change"));
    }
  });
});

$("#orderSelected").addEventListener("click", () => {
  const msg = buildTelegramMessage();
  if (!msg) {
    alert("Отметьте хотя бы одну вещь и выберите размер");
    return;
  }
  window.open(telegramLink(msg), "_blank", "noopener");
});

$("#orderLookPhoto").addEventListener("click", () => {
  openLightbox($("#modalMainImg").src);
});

$("#lightboxClose").addEventListener("click", closeLightbox);
$("#lightbox").addEventListener("click", (e) => {
  if (e.target === $("#lightbox")) closeLightbox();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeLightbox();
  }
});

loadCatalog().catch(() => {
  $("#catalogGrid").innerHTML =
    '<p class="empty">Не удалось загрузить каталог. Запустите сервер: npm start</p>';
});
