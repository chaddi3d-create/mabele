import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "catalog.json");
const PUBLIC_DATA_PATH = path.join(__dirname, "public", "data", "catalog.json");
const IMAGES_DIR = path.join(__dirname, "public", "images");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: IMAGES_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const sessions = new Map();

async function readCatalog() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeCatalog(data) {
  delete data.users;
  const json = JSON.stringify(data, null, 2);
  await fs.mkdir(path.dirname(PUBLIC_DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, json, "utf8");
  const pub = JSON.parse(json);
  if (pub.settings) delete pub.settings.adminPassword;
  await fs.writeFile(PUBLIC_DATA_PATH, JSON.stringify(pub, null, 2), "utf8");
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-|-$/g, "") || "tovar"
  );
}

function getToken(req) {
  return req.headers.authorization?.replace("Bearer ", "");
}

function requireAuth(req, res, next) {
  const session = sessions.get(getToken(req));
  if (!session) return res.status(401).json({ error: "Войдите в админку" });
  next();
}

app.get("/api/catalog", async (_req, res) => {
  try {
    const data = await readCatalog();
    const { adminPassword, ...safeSettings } = data.settings || {};
    res.json({ ...data, settings: safeSettings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const password = (req.body?.password || "").trim();
  const data = await readCatalog();
  const expected = data.settings?.adminPassword || "mabelle2025";
  if (password !== expected) {
    return res.status(401).json({ error: "Неверный пароль" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { at: Date.now() });
  res.json({ token });
});

app.post("/api/auth/logout", (req, res) => {
  sessions.delete(getToken(req));
  res.json({ ok: true });
});

app.get("/api/auth/check", (req, res) => {
  res.json({ ok: sessions.has(getToken(req)) });
});

/** Одна вещь: название + цена + фото */
app.post("/api/items", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Введите название" });
    if (!req.file) return res.status(400).json({ error: "Выберите фото" });

    const data = await readCatalog();
    const id = `look-${Date.now()}`;
    const filename = req.file.filename;
    const price = Number(req.body.price) || 0;
    const category = req.body.category || "obrazy";

    const look = {
      id,
      slug: `${slugify(name)}-${Date.now()}`,
      title: name,
      category,
      description: "",
      heroImage: filename,
      gallery: [filename],
      published: true,
      sortOrder: data.looks.length + 1,
      pieces: [
        {
          id: `piece-${Date.now()}`,
          code: "1",
          name,
          sku: `MB-${Date.now().toString(36).slice(-6).toUpperCase()}`,
          price,
          sizes: ["XS", "S", "M", "L"],
          image: filename,
          type: "top",
          description: "",
        },
      ],
    };

    data.looks.push(look);
    await writeCatalog(data);
    res.json({ ok: true, look });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Образ (пак): как на сайте — несколько вещей с фото */
app.post("/api/looks", requireAuth, upload.array("photos", 12), async (req, res) => {
  try {
    const title = (req.body.title || "").trim();
    if (!title) return res.status(400).json({ error: "Введите название образа" });

    let piecesMeta = [];
    try {
      piecesMeta = JSON.parse(req.body.pieces || "[]");
    } catch {
      return res.status(400).json({ error: "Некорректные данные вещей" });
    }

    if (!piecesMeta.length) {
      return res.status(400).json({ error: "Добавьте хотя бы одну вещь" });
    }

    const files = req.files || [];
    if (files.length < piecesMeta.length) {
      return res.status(400).json({ error: "Загрузите фото для каждой вещи" });
    }

    const data = await readCatalog();
    const id = `look-${Date.now()}`;
    const category = req.body.category || "obrazy";
    const gallery = [];
    const pieces = piecesMeta.map((meta, i) => {
      const filename = files[i].filename;
      gallery.push(filename);
      return {
        id: `piece-${Date.now()}-${i}`,
        code: meta.code || String(i + 1),
        name: (meta.name || `Вещь ${i + 1}`).trim(),
        sku: meta.sku || `MB-${Date.now().toString(36).slice(-4).toUpperCase()}${i}`,
        price: Number(meta.price) || 0,
        sizes: ["XS", "S", "M", "L"],
        image: filename,
        type: meta.type || "top",
        description: "",
      };
    });

    const look = {
      id,
      slug: `${slugify(title)}-${Date.now()}`,
      title,
      category,
      description: "",
      heroImage: gallery[0],
      gallery: [...new Set(gallery)],
      published: true,
      sortOrder: data.looks.length + 1,
      pieces,
    };

    data.looks.push(look);
    await writeCatalog(data);
    res.json({ ok: true, look });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/items/:id", requireAuth, upload.any(), async (req, res) => {
  try {
    const data = await readCatalog();
    const look = data.looks.find((l) => l.id === req.params.id);
    if (!look) return res.status(404).json({ error: "Не найдено" });

    if (req.body.title?.trim()) look.title = req.body.title.trim();

    if (req.body.pieces) {
      const updates = JSON.parse(req.body.pieces);
      const files = req.files || [];
      let fileIdx = 0;
      look.pieces = updates.map((meta, i) => {
        const prev = look.pieces?.find((p) => p.id === meta.id) || look.pieces?.[i];
        let image = prev?.image || look.heroImage;
        if (meta.newPhoto === "1" && files[fileIdx]) {
          image = files[fileIdx++].filename;
        }
        return {
          id: meta.id || prev?.id || `piece-${Date.now()}-${i}`,
          code: meta.code || String(i + 1),
          name: (meta.name || "").trim() || `Вещь ${i + 1}`,
          sku: meta.sku || prev?.sku || `MB-${i}`,
          price: Number(meta.price) || 0,
          sizes: prev?.sizes || ["XS", "S", "M", "L"],
          image,
          type: prev?.type || "top",
          description: "",
        };
      });
      look.gallery = [...new Set(look.pieces.map((p) => p.image))];
      look.heroImage = look.gallery[0];
    } else {
      if (req.body.name?.trim()) {
        look.title = req.body.name.trim();
        if (look.pieces?.length === 1) look.pieces[0].name = look.title;
      }
      if (req.body.price !== undefined) {
        const price = Number(req.body.price) || 0;
        look.pieces?.forEach((p) => {
          p.price = price;
        });
      }
      const photo = (req.files || []).find((f) => f.fieldname === "photo");
      if (photo) {
        look.heroImage = photo.filename;
        look.gallery = [photo.filename, ...(look.gallery || [])];
        if (look.pieces?.length === 1) look.pieces[0].image = photo.filename;
      }
    }

    await writeCatalog(data);
    res.json({ ok: true, look });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const data = await readCatalog();
    const idx = data.looks.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Не найдено" });
    data.looks.splice(idx, 1);
    await writeCatalog(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`Сайт:  http://localhost:${PORT}`);
  console.log(`Админ: http://localhost:${PORT}/admin.html`);
});
