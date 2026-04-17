const { Telegraf, Scenes, session, Markup } = require("telegraf");
const admin = require("firebase-admin");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const express = require("express");
const fs = require("fs");
const path = require("path");

function loadServiceAccount() {
  if (process.env.SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      parsed._source = "env";
      return parsed;
    } catch (error) {
      throw new Error(`SERVICE_ACCOUNT_JSON noto'g'ri JSON: ${error.message}`);
    }
  }

  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      "Service account topilmadi. SERVICE_ACCOUNT_JSON env yoki serviceAccountKey.json kerak.",
    );
  }

  const parsed = require(serviceAccountPath);
  parsed._source = "file";
  return parsed;
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const auth = new JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function getGoogleSheet() {
  const doc = new GoogleSpreadsheet(serviceAccount.spreadsheet_id, auth);
  await doc.loadInfo();
  return doc.sheetsByIndex[0];
}

async function saveToGoogleSheet(data) {
  const sheet = await getGoogleSheet();

  await sheet.addRow({
    ism: data.ism,
    izoh: data.izoh || "Yo'q",
    manba: data.manba,
    manzil: data.manzil,
    phone: data.phone,
    qiziqish: data.qiziqish,
    sinf: data.sinf,
  });

  console.log("Google Sheets-ga yozildi");
}

const phoneRegex = /^\+?998[0-9]{9}$/;

const contactScene = new Scenes.WizardScene(
  "REGISTRATION_SCENE",
  (ctx) => {
    ctx.wizard.state.formData = {};
    ctx.reply(
      "Assalomu alaykum! Ism va familiyangizni kiriting:\n(Masalan: Alisherov Vali)\n\nQayta boshlash uchun /start bosing.",
    );
    return ctx.wizard.next();
  },
  (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    if (!ctx.message?.text || ctx.message.text.trim().length < 3) {
      ctx.reply("Iltimos, ism va familiyangizni to'g'ri kiriting.");
      return;
    }

    ctx.wizard.state.formData.ism = ctx.message.text.trim();

    ctx.reply(
      "Iltimos, telefon raqamingizni yuboring.\nPastdagi \"Raqamni yuborish\" tugmasini bosing yoki nomeringizni yozib qoldiring.\nMasalan: +998901234567",
      Markup.keyboard([Markup.button.contactRequest("Raqamni yuborish")])
        .oneTime()
        .resize(),
    );

    return ctx.wizard.next();
  },
  (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    let phone = "";

    if (ctx.message?.contact?.phone_number) {
      phone = ctx.message.contact.phone_number.replace(/\s+/g, "");
    } else if (ctx.message?.text) {
      const typedPhone = ctx.message.text.replace(/\s+/g, "");
      if (phoneRegex.test(typedPhone)) {
        phone = typedPhone;
      }
    }

    if (!phone) {
      ctx.reply(
        "Noto'g'ri format. Iltimos, tugmani bosing yoki raqamni to'g'ri kiriting.\nMasalan: +998901234567",
      );
      return;
    }

    ctx.wizard.state.formData.phone = phone;

    ctx.reply(
      "Yashash manzilingizni kiriting:\n(Masalan: Beshariq tumani, Hamid Olimjon ko'chasi)",
      Markup.removeKeyboard(),
    );

    return ctx.wizard.next();
  },
  (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    if (!ctx.message?.text) {
      ctx.reply("Iltimos, manzilingizni yozing.");
      return;
    }

    ctx.wizard.state.formData.manzil = ctx.message.text.trim();

    ctx.reply(
      "Qaysi fanni o'rganmoqchisiz?",
      Markup.keyboard([
        ["Matematika", "Ingliz tili"],
        ["Informatika / IT", "Rus tili"],
        ["Huquq", "Boshqa fan"],
      ])
        .oneTime()
        .resize(),
    );

    return ctx.wizard.next();
  },
  (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    if (!ctx.message?.text) {
      ctx.reply("Iltimos, fanni tanlang yoki yozib yuboring.");
      return;
    }

    ctx.wizard.state.formData.qiziqish = ctx.message.text.trim();

    ctx.reply(
      "Nechanchi sinfda o'qiysiz?",
      Markup.keyboard([
        ["1-sinf", "2-sinf", "3-sinf", "4-sinf"],
        ["5-sinf", "6-sinf", "7-sinf", "8-sinf"],
        ["9-sinf", "10-sinf", "11-sinf"],
        ["Maktabni bitirganman"],
      ])
        .oneTime()
        .resize(),
    );

    return ctx.wizard.next();
  },
  (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    if (!ctx.message?.text) {
      ctx.reply("Iltimos, sinfingizni yozing yoki tanlang.");
      return;
    }

    ctx.wizard.state.formData.sinf = ctx.message.text.trim();

    ctx.reply(
      "Biz haqimizda qayerdan eshitdingiz?",
      Markup.keyboard([
        ["Instagram", "Telegram"],
        ["Tanishlarimdan", "Maktab banneridan"],
      ])
        .oneTime()
        .resize(),
    );

    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    if (!ctx.message?.text) {
      ctx.reply("Iltimos, javobni yozing yoki tanlang.");
      return;
    }

    const data = ctx.wizard.state.formData;
    data.manba = ctx.message.text.trim();
    data.chatId = ctx.chat.id;
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();

    try {
      await db.collection("leads").add(data);
      await ctx.reply(
        "Rahmat! Ma'lumotlaringiz qabul qilindi.",
        Markup.removeKeyboard(),
      );

      saveToGoogleSheet(data).catch((error) => {
        console.error("Sheets xatosi:", error);
      });
    } catch (error) {
      console.error("Leads saqlashda xatolik:", error);
      await ctx.reply("Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    }

    return ctx.scene.leave();
  },
);

const commentScene = new Scenes.WizardScene(
  "COMMENT_SCENE",
  (ctx) => {
    ctx.reply("Savolingizni yozing:");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/start") {
      return ctx.scene.enter("REGISTRATION_SCENE");
    }

    if (!ctx.message?.text) {
      ctx.reply("Iltimos, savolni matn ko'rinishida yuboring.");
      return;
    }

    const commentData = {
      chatId: ctx.chat.id,
      ism: ctx.from.first_name || "Noma'lum",
      izoh: ctx.message.text.trim(),
      manba: "Bot Comment bo'limi",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await db.collection("comments").add(commentData);
      await ctx.reply("Savolingiz qabul qilindi.");

      saveToGoogleSheet({
        ...commentData,
        phone: "-",
        manzil: "-",
        qiziqish: "-",
        sinf: "-",
      }).catch((error) => {
        console.error("Sheets xatosi:", error);
      });
    } catch (error) {
      console.error("Comment saqlashda xatolik:", error);
      await ctx.reply("Xatolik yuz berdi.");
    }

    return ctx.scene.leave();
  },
);

const BOT_TOKEN = process.env.BOT_TOKEN || serviceAccount.bot_token;
const PORT = Number(process.env.PORT) || 10000;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN?.trim();
const BOT_MODE = process.env.BOT_MODE?.trim().toLowerCase();
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD?.trim();

if (!BOT_TOKEN) {
  throw new Error("Bot token topilmadi. BOT_TOKEN yoki serviceAccount.bot_token kerak.");
}

const bot = new Telegraf(BOT_TOKEN);
const stage = new Scenes.Stage([contactScene, commentScene]);
const app = express();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleString("uz-UZ");
    }
    return new Date(value).toLocaleString("uz-UZ");
  } catch (_error) {
    return "-";
  }
}

function renderTableRows(items, fields) {
  if (!items.length) {
    return `<tr><td colspan="${fields.length}">Ma'lumot topilmadi</td></tr>`;
  }

  return items
    .map((item) => {
      const data = item.data();
      return `<tr>${fields
        .map((field) => `<td>${escapeHtml(field.format(data[field.key]))}</td>`)
        .join("")}</tr>`;
    })
    .join("");
}

function renderAdminPage(leads, comments) {
  const leadFields = [
    { key: "ism", label: "Ism", format: (v) => v || "-" },
    { key: "phone", label: "Telefon", format: (v) => v || "-" },
    { key: "manzil", label: "Manzil", format: (v) => v || "-" },
    { key: "qiziqish", label: "Qiziqish", format: (v) => v || "-" },
    { key: "sinf", label: "Sinf", format: (v) => v || "-" },
    { key: "manba", label: "Manba", format: (v) => v || "-" },
    { key: "createdAt", label: "Sana", format: formatDate },
  ];

  const commentFields = [
    { key: "ism", label: "Ism", format: (v) => v || "-" },
    { key: "izoh", label: "Izoh", format: (v) => v || "-" },
    { key: "manba", label: "Manba", format: (v) => v || "-" },
    { key: "createdAt", label: "Sana", format: formatDate },
  ];

  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ideal Bot Admin Panel</title>
  <style>
    :root {
      --bg: #f6f1e8;
      --card: #fffaf2;
      --line: #e3d6bf;
      --text: #1d2a35;
      --muted: #6e7781;
      --accent: #1f6f78;
      --accent-2: #f2a65a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Trebuchet MS", serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(242,166,90,.20), transparent 28%),
        linear-gradient(180deg, #f8f3ea 0%, var(--bg) 100%);
    }
    .wrap {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(31,111,120,.95), rgba(16,51,58,.95));
      color: white;
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 40px rgba(29,42,53,.18);
      margin-bottom: 22px;
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: 34px;
    }
    .hero p {
      margin: 0;
      color: rgba(255,255,255,.85);
      font-size: 16px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin: 20px 0 26px;
    }
    .stat {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
    }
    .stat b {
      display: block;
      font-size: 28px;
      margin-top: 10px;
    }
    .muted { color: var(--muted); }
    .section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 20px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .section h2 {
      margin: 0 0 14px;
      font-size: 24px;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: white;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 900px;
    }
    th, td {
      padding: 12px 14px;
      border-bottom: 1px solid #eee4d2;
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }
    th {
      background: #fcf7ef;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    tr:hover td {
      background: #fff8eb;
    }
    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: #fff1de;
      color: #8b520e;
      font-size: 12px;
      border: 1px solid #f1d1a9;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Ideal Bot Admin Panel</h1>
      <p>Telegram botdan kelgan Firebase ma'lumotlari shu yerda ko'rinadi.</p>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="muted">Jami arizalar</span>
        <b>${leads.length}</b>
      </div>
      <div class="stat">
        <span class="muted">Jami savollar</span>
        <b>${comments.length}</b>
      </div>
      <div class="stat">
        <span class="muted">Holat</span>
        <b><span class="badge">Firebase ulangan</span></b>
      </div>
    </div>

    <div class="section">
      <h2>Ro'yxatdan o'tganlar</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${leadFields.map((field) => `<th>${field.label}</th>`).join("")}</tr>
          </thead>
          <tbody>${renderTableRows(leads, leadFields)}</tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Izoh va savollar</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${commentFields.map((field) => `<th>${field.label}</th>`).join("")}</tr>
          </thead>
          <tbody>${renderTableRows(comments, commentFields)}</tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_PANEL_PASSWORD) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Panel"');
    return res.status(401).send("Admin login kerak");
  }

  const base64Credentials = authHeader.split(" ")[1] || "";
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [, password = ""] = credentials.split(":");

  if (password !== ADMIN_PANEL_PASSWORD) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Panel"');
    return res.status(401).send("Parol noto'g'ri");
  }

  return next();
}

bot.use(session());
bot.use(stage.middleware());

bot.catch((error) => {
  console.error("Bot xatosi:", error);
});

bot.command("start", (ctx) => ctx.scene.enter("REGISTRATION_SCENE"));
bot.command("info", (ctx) =>
  ctx.reply("Manzil: Yakkatut MFY\nTelefon: 93-301-62-76"),
);
bot.command("comment", (ctx) => ctx.scene.enter("COMMENT_SCENE"));

async function startBot() {
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.send("Bot is running...");
  });

  app.get("/admin", requireAdminAuth, async (_req, res) => {
    try {
      const [leadsSnapshot, commentsSnapshot] = await Promise.all([
        db.collection("leads").orderBy("createdAt", "desc").limit(200).get(),
        db.collection("comments").orderBy("createdAt", "desc").limit(200).get(),
      ]);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(
        renderAdminPage(leadsSnapshot.docs, commentsSnapshot.docs),
      );
    } catch (error) {
      console.error("Admin panel xatosi:", error);
      res.status(500).send("Admin panelni yuklashda xatolik yuz berdi.");
    }
  });

  console.log(`Service account manbasi: ${serviceAccount._source}`);

  try {
    const sheet = await getGoogleSheet();
    console.log(`Google Sheets ulandi: ${sheet.title}`);
  } catch (error) {
    console.error("Google Sheets ulanishida xatolik:", error);
  }

  const useWebhook = BOT_MODE === "webhook" || Boolean(WEBHOOK_DOMAIN);

  if (useWebhook) {
    if (!WEBHOOK_DOMAIN) {
      throw new Error("BOT_MODE=webhook bo'lsa, WEBHOOK_DOMAIN ham kerak.");
    }

    app.post("/bot", (req, res) => {
      bot.handleUpdate(req.body, res);
    });

    app.listen(PORT, async () => {
      console.log(`Server ${PORT}-portda ishlamoqda`);
      try {
        await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}/bot`);
        console.log("Webhook muvaffaqiyatli o'rnatildi");
      } catch (error) {
        console.error("Webhook xatosi:", error);
      }
    });
    return;
  }

  await new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`Server ${PORT}-portda ishlamoqda`);
      resolve();
    });
  });

  await bot.telegram.deleteWebhook({ drop_pending_updates: false });
  await bot.launch();
  console.log("Bot polling rejimida ishga tushdi");
}

startBot().catch((error) => {
  if (error?.response?.error_code === 409) {
    console.error(
      "409 conflict: bir xil bot token bilan boshqa joyda ham polling ishlayapti. Bitta instance qoldiring yoki Render'da webhook ishlating.",
    );
  }
  console.error("Botni ishga tushirishda xatolik:", error);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
