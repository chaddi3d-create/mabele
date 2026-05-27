let token = sessionStorage.getItem("mabelle_admin_token");
let catalog = null;
let editingId = null;
let addPhotoFile = null;
let packPieceCounter = 0;
let apiAvailable = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function authHeaders(json = false) {
  const h = { Authorization: `Bearer ${token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function detectApi() {
  try {
    const res = await fetch("api/catalog", { method: "GET" });
    apiAvailable = res.ok;
  } catch {
    apiAvailable = false;
  }
  $("#serverHint").hidden = apiAvailable;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function showLogin() {
  $("#loginView").hidden = false;
  $("#adminView").hidden = true;
}

function showAdmin() {
  $("#loginView").hidden = true;
  $("#adminView").hidden = false;
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...authHeaders(), ...opts.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка");
  return data;
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginError").hidden = true;
  try {
    const password = $("#loginPassword").value;
    if (apiAvailable) {
      const data = await fetch("api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).then((r) => r.json());
      if (!data.token) throw new Error(data.error || "Неверный пароль");
      token = data.token;
    } else {
      const staticPassword = localStorage.getItem("mabelle_admin_password") || "mabelle2025";
      if (password !== staticPassword) throw new Error("Неверный пароль");
      token = "static-admin";
    }
    sessionStorage.setItem("mabelle_admin_token", token);
    showAdmin();
    await initAdmin();
  } catch (err) {
    $("#loginError").hidden = false;
    $("#loginError").textContent = err.message;
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  if (apiAvailable) {
    await fetch("api/auth/logout", { method: "POST", headers: authHeaders() }).catch(() => {});
  }
  sessionStorage.removeItem("mabelle_admin_token");
  token = null;
  showLogin();
});

async function initAdmin() {
  await loadCatalog();
  if (!$("#packPieces").children.length) addPackPieceRow();
}

async function loadCatalog() {
  if (apiAvailable) {
    const res = await fetch("api/catalog");
    if (!res.ok) throw new Error("Ошибка загрузки");
    catalog = await res.json();
  } else {
    const saved = localStorage.getItem("mabelle_catalog");
    if (saved) {
      catalog = JSON.parse(saved);
    } else {
      const res = await fetch("data/catalog.json");
      if (!res.ok) throw new Error("Не удалось открыть каталог");
      catalog = await res.json();
      localStorage.setItem("mabelle_catalog", JSON.stringify(catalog));
    }
  }
  renderGrid();
}

function imgSrc(file) {
  if (!file) return "images/logo.png";
  if (file.startsWith("data:") || file.startsWith("http://") || file.startsWith("https://")) {
    return file;
  }
  return `images/${encodeURIComponent(file)}`;
}

function formatPrice(n) {
  if (!n) return "Цена по запросу";
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

function piecePrice(look) {
  const prices = (look.pieces || []).map((p) => p.price).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

function saveLocalCatalog() {
  localStorage.setItem("mabelle_catalog", JSON.stringify(catalog));
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не удалось прочитать фото"));
    reader.readAsDataURL(file);
  });
}

/* ——— Вкладки ——— */
$$(".adm-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".adm-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $("#tabSingle").hidden = tab.dataset.tab !== "single";
    $("#tabPack").hidden = tab.dataset.tab !== "pack";
  });
});

/* ——— Пак: строки вещей ——— */
function addPackPieceRow(container = $("#packPieces"), data = {}) {
  const id = ++packPieceCounter;
  const row = document.createElement("div");
  row.className = "pack-row";
  row.dataset.rowId = id;
  row.innerHTML = `
    <label class="pack-row__photo">
      <input type="file" accept="image/*" hidden class="pack-photo-input" />
      <span class="pack-row__photo-box">
        <span class="pack-row__photo-placeholder">+ фото</span>
        <img class="pack-row__photo-img" hidden alt="" />
      </span>
    </label>
    <div class="pack-row__fields">
      <label class="adm-field">
        <span>Название вещи</span>
        <input type="text" class="pack-name" value="${escapeHtml(data.name || "")}" placeholder="Топ knit" required />
      </label>
      <label class="adm-field adm-field--short">
        <span>Цена, ₽</span>
        <input type="number" class="pack-price" min="0" step="100" value="${data.price || ""}" placeholder="5900" />
      </label>
    </div>
    <button type="button" class="pack-row__remove" title="Убрать">×</button>
  `;
  const input = row.querySelector(".pack-photo-input");
  const img = row.querySelector(".pack-row__photo-img");
  const ph = row.querySelector(".pack-row__photo-placeholder");
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (!f) return;
    row._file = f;
    img.src = URL.createObjectURL(f);
    img.hidden = false;
    ph.hidden = true;
  });
  row.querySelector(".pack-row__remove").addEventListener("click", () => {
    if (container.children.length <= 1) return toast("Минимум одна вещь");
    row.remove();
  });
  if (data._file) {
    row._file = data._file;
    img.src = URL.createObjectURL(data._file);
    img.hidden = false;
    ph.hidden = true;
  } else if (data.image) {
    img.src = imgSrc(data.image);
    img.hidden = false;
    ph.hidden = true;
  }
  container.appendChild(row);
}

$("#addPackPiece").addEventListener("click", () => addPackPieceRow());

function collectPackRows(container) {
  return [...container.querySelectorAll(".pack-row")].map((row, i) => ({
    row,
    name: row.querySelector(".pack-name").value.trim(),
    price: row.querySelector(".pack-price").value || "0",
    file: row._file,
    code: String(i + 1),
  }));
}

/* ——— Добавить одну вещь ——— */
const dropPreview = $("#dropPreview");
$("#dropZone").addEventListener("dragover", (e) => {
  e.preventDefault();
  $("#dropZone").classList.add("dragover");
});
$("#dropZone").addEventListener("dragleave", () => $("#dropZone").classList.remove("dragover"));
$("#dropZone").addEventListener("drop", (e) => {
  e.preventDefault();
  $("#dropZone").classList.remove("dragover");
  const f = e.dataTransfer.files?.[0];
  if (f?.type.startsWith("image/")) setAddPhoto(f);
});
$("#photoInput").addEventListener("change", () => {
  const f = $("#photoInput").files?.[0];
  if (f) setAddPhoto(f);
});

function setAddPhoto(file) {
  addPhotoFile = file;
  dropPreview.classList.add("has-image");
  dropPreview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" />`;
}

$("#addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#itemName").value.trim();
  if (!name || !addPhotoFile) return toast("Название и фото обязательны");
  const fd = new FormData();
  fd.append("name", name);
  fd.append("price", $("#itemPrice").value || "0");
  fd.append("photo", addPhotoFile);
  try {
    if (apiAvailable) {
      await api("api/items", { method: "POST", body: fd });
    } else {
      const now = Date.now();
      const dataUrl = await toDataUrl(addPhotoFile);
      catalog.looks.push({
        id: `look-${now}`,
        slug: `${slugify(name)}-${now}`,
        title: name,
        category: "obrazy",
        description: "",
        heroImage: dataUrl,
        gallery: [dataUrl],
        published: true,
        sortOrder: (catalog.looks?.length || 0) + 1,
        pieces: [
          {
            id: `piece-${now}`,
            code: "1",
            name,
            sku: `MB-${now.toString(36).slice(-6).toUpperCase()}`,
            price: Number($("#itemPrice").value || "0"),
            sizes: ["XS", "S", "M", "L"],
            image: dataUrl,
            type: "top",
            description: "",
          },
        ],
      });
      saveLocalCatalog();
    }
    toast("Добавлено в каталог");
    $("#addForm").reset();
    addPhotoFile = null;
    dropPreview.classList.remove("has-image");
    dropPreview.innerHTML = `<span class="adm-drop__icon">+</span><span class="adm-drop__text">Фото вещи</span>`;
    await loadCatalog();
  } catch (err) {
    toast(err.message);
  }
});

/* ——— Добавить образ (пак) ——— */
$("#packForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#packTitle").value.trim();
  if (!title) return toast("Введите название образа");
  const rows = collectPackRows($("#packPieces"));
  if (!rows.every((r) => r.name && r.file)) {
    return toast("У каждой вещи: фото, название и цена");
  }
  const fd = new FormData();
  fd.append("title", title);
  fd.append("pieces", JSON.stringify(rows.map((r) => ({ name: r.name, price: r.price, code: r.code }))));
  rows.forEach((r) => fd.append("photos", r.file));
  try {
    if (apiAvailable) {
      await api("api/looks", { method: "POST", body: fd });
    } else {
      const now = Date.now();
      const pieces = [];
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const img = await toDataUrl(r.file);
        pieces.push({
          id: `piece-${now}-${i}`,
          code: String(i + 1),
          name: r.name,
          sku: `MB-${(now + i).toString(36).slice(-6).toUpperCase()}`,
          price: Number(r.price || "0"),
          sizes: ["XS", "S", "M", "L"],
          image: img,
          type: "top",
          description: "",
        });
      }
      catalog.looks.push({
        id: `look-${now}`,
        slug: `${slugify(title)}-${now}`,
        title,
        category: "obrazy",
        description: "",
        heroImage: pieces[0].image,
        gallery: pieces.map((p) => p.image),
        published: true,
        sortOrder: (catalog.looks?.length || 0) + 1,
        pieces,
      });
      saveLocalCatalog();
    }
    toast("Образ на сайте");
    $("#packTitle").value = "";
    $("#packPieces").innerHTML = "";
    addPackPieceRow();
    await loadCatalog();
  } catch (err) {
    toast(err.message);
  }
});

/* ——— Список ——— */
function renderGrid() {
  const grid = $("#itemGrid");
  const looks = [...(catalog.looks || [])]
    .filter((l) => l.published !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  $("#itemCount").textContent = looks.length;
  $("#emptyList").hidden = looks.length > 0;
  grid.innerHTML = "";
  looks.forEach((look) => {
    const n = (look.pieces || []).length;
    const card = document.createElement("article");
    card.className = "adm-card";
    card.innerHTML = `
      <img class="adm-card__img" src="${imgSrc(look.heroImage)}" alt="" loading="lazy" />
      <div class="adm-card__body">
        ${n > 1 ? `<p class="adm-card__badge">Образ · ${n}</p>` : ""}
        <p class="adm-card__title">${escapeHtml(look.title)}</p>
        <p class="adm-card__price">${formatPrice(piecePrice(look))}</p>
      </div>
    `;
    card.addEventListener("click", () => openEdit(look.id));
    grid.appendChild(card);
  });
}

/* ——— Редактирование ——— */
const editDialog = $("#editDialog");
let editPhotoFile = null;

function openEdit(id) {
  const look = catalog.looks.find((l) => l.id === id);
  if (!look) return;
  editingId = id;
  editPhotoFile = null;
  const multi = (look.pieces || []).length > 1;

  $("#editSingle").hidden = multi;
  $("#editPack").hidden = !multi;
  $("#editDialogTitle").textContent = multi ? "Изменить образ" : "Изменить вещь";

  if (multi) {
    $("#editPackTitle").value = look.title;
    const wrap = $("#editPackPieces");
    wrap.innerHTML = "";
    look.pieces.forEach((p) => {
      addPackPieceRow(wrap, { name: p.name, price: p.price, image: p.image });
      const row = wrap.lastElementChild;
      row.dataset.pieceId = p.id;
      row.dataset.pieceImage = p.image;
      const img = row.querySelector(".pack-row__photo-img");
      const ph = row.querySelector(".pack-row__photo-placeholder");
      img.src = imgSrc(p.image);
      img.hidden = false;
      ph.hidden = true;
    });
  } else {
    $("#editName").value = look.title;
    $("#editPrice").value = piecePrice(look) || "";
    $("#editPreviewImg").src = imgSrc(look.heroImage);
  }
  editDialog.showModal();
}

$("#editClose").addEventListener("click", () => editDialog.close());
$("#editPhoto").addEventListener("change", () => {
  const f = $("#editPhoto").files?.[0];
  if (f) {
    editPhotoFile = f;
    $("#editPreviewImg").src = URL.createObjectURL(f);
  }
});

$("#editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;
  const look = catalog.looks.find((l) => l.id === editingId);
  const multi = (look?.pieces || []).length > 1;

  try {
    if (multi) {
      const rows = collectPackRows($("#editPackPieces"));
      if (!rows.every((r) => r.name)) return toast("Заполните названия");
      const fd = new FormData();
      fd.append("title", $("#editPackTitle").value.trim());
      const pieces = rows.map((r, i) => {
        const prev = look.pieces[i];
        const meta = {
          id: prev?.id || r.row.dataset.pieceId,
          name: r.name,
          price: r.price,
          code: prev?.code || String(i + 1),
          sku: prev?.sku,
          newPhoto: r.file ? "1" : "0",
        };
        if (r.file) fd.append("photos", r.file);
        return meta;
      });
      fd.append("pieces", JSON.stringify(pieces));
      if (apiAvailable) {
        await api(`api/items/${editingId}`, { method: "PATCH", body: fd });
      } else {
        look.title = $("#editPackTitle").value.trim() || look.title;
        const nextPieces = [];
        for (let i = 0; i < rows.length; i += 1) {
          const r = rows[i];
          const prev = look.pieces[i];
          const image = r.file ? await toDataUrl(r.file) : prev?.image || r.row.dataset.pieceImage;
          nextPieces.push({
            ...prev,
            id: prev?.id || `piece-${Date.now()}-${i}`,
            code: prev?.code || String(i + 1),
            name: r.name || `Вещь ${i + 1}`,
            price: Number(r.price || "0"),
            image,
          });
        }
        look.pieces = nextPieces;
        look.gallery = nextPieces.map((p) => p.image);
        look.heroImage = look.gallery[0];
        saveLocalCatalog();
      }
    } else {
      const fd = new FormData();
      fd.append("name", $("#editName").value.trim());
      fd.append("price", $("#editPrice").value || "0");
      if (editPhotoFile) fd.append("photo", editPhotoFile);
      if (apiAvailable) {
        await api(`api/items/${editingId}`, { method: "PATCH", body: fd });
      } else {
        look.title = $("#editName").value.trim() || look.title;
        const price = Number($("#editPrice").value || "0");
        look.pieces.forEach((p) => {
          p.price = price;
          if (look.pieces.length === 1) p.name = look.title;
        });
        if (editPhotoFile) {
          const image = await toDataUrl(editPhotoFile);
          look.heroImage = image;
          look.gallery = [image];
          if (look.pieces.length === 1) look.pieces[0].image = image;
        }
        saveLocalCatalog();
      }
    }
    toast("Сохранено");
    editDialog.close();
    await loadCatalog();
  } catch (err) {
    toast(err.message);
  }
});

$("#editDelete").addEventListener("click", async () => {
  if (!editingId || !confirm("Удалить?")) return;
  try {
    if (apiAvailable) {
      await api(`api/items/${editingId}`, { method: "DELETE" });
    } else {
      catalog.looks = catalog.looks.filter((l) => l.id !== editingId);
      saveLocalCatalog();
    }
    toast("Удалено");
    editDialog.close();
    await loadCatalog();
  } catch (err) {
    toast(err.message);
  }
});

async function boot() {
  await detectApi();
  if (!token) {
    showLogin();
    return;
  }
  if (!apiAvailable) {
    if (token !== "static-admin") {
      sessionStorage.removeItem("mabelle_admin_token");
      token = null;
      showLogin();
      return;
    }
    showAdmin();
    await initAdmin();
    return;
  }
  try {
    const check = await fetch("api/auth/check", { headers: authHeaders() }).then((r) => r.json());
    if (!check.ok) throw new Error();
    showAdmin();
    await initAdmin();
  } catch {
    sessionStorage.removeItem("mabelle_admin_token");
    token = null;
    showLogin();
  }
}

boot();
