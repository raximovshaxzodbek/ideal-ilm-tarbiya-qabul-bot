const { Telegraf, Scenes, session, Markup } = require("telegraf");
const admin = require("firebase-admin");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const express = require("express"); // Expressni tepaga chiqaramiz
const serviceAccount = require("./serviceAccountKey.json");

// 0. PORTNI ANIQLASH (Eng muhimi)
const PORT = process.env.PORT || 10000;

// 1. Firebase ulanishi
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// 2. Google Sheets ulanishi sozlamalari
const auth = new JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function saveToGoogleSheet(data) {
  try {
    // serviceAccount ichida spreadsheet_id borligiga ishonch hosil qiling
    const doc = new GoogleSpreadsheet(serviceAccount.spreadsheet_id, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      ism: data.ism,
      izoh: data.izoh || "Yo'q",
      manba: data.manba,
      manzil: data.manzil,
      phone: data.phone,
      qiziqish: data.qiziqish,
      sinf: data.sinf,
    });
    console.log("✅ Google Sheets-ga yozildi");
  } catch (e) {
    console.error("❌ Sheets xatosi:", e);
  }
}

const phoneRegex = /^\+?998[0-9]{9}$/;

// RO'YXATDAN O'TISH SCENASI

const contactScene = new Scenes.WizardScene(
  "REGISTRATION_SCENE",

  // 1-QADAM

  (ctx) => {
    ctx.reply(
      "👋 Assalomu alaykum! Ism va familiyangizni kiriting:\n(Masalan: Alisherov Vali)\n\n🔄 Qayta boshlash uchun /start bosing.",
    );

    ctx.wizard.state.formData = {};

    return ctx.wizard.next();
  },

  // 2-QADAM

  (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE"); // /start tekshiruvi

    if (!ctx.message || !ctx.message.text || ctx.message.text.length < 3) {
      ctx.reply("❌ Iltimos, ismingizni to'g'ri harflar bilan kiriting.");

      return;
    }

    ctx.wizard.state.formData.ism = ctx.message.text;

    ctx.reply(
      "📞 Iltimos, telefon raqamingizni yuboring.\nBuning uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing yoki nomeringizni yozib qoldiring. \n Masalan: +998901234567",

      Markup.keyboard([Markup.button.contactRequest("📱 Raqamni yuborish")])
        .oneTime()
        .resize(),
    );

    return ctx.wizard.next();
  },

  // 3-QADAM

  (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE");
    let phone = "";

    if (ctx.message && ctx.message.contact) {
      phone = ctx.message.contact.phone_number;
    } else if (ctx.message && ctx.message.text) {
      const typedPhone = ctx.message.text.replace(/\s+/g, "");
      if (phoneRegex.test(typedPhone)) phone = typedPhone;
    }

    if (!phone) {
      ctx.reply(
        "❌ Noto'g'ri format! Iltimos, pastdagi tugmani bosing yoki raqamni to'g'ri kiriting.\n Masalan: +998901234567",
      );
      return;
    }

    ctx.wizard.state.formData.phone = phone;
    ctx.reply(
      "📍 Yashash manzilingizni kiriting:\n(Masalan: Beshariq tumani, Hamid Olimjon ko'chasi)",
      Markup.removeKeyboard(),
    );
    return ctx.wizard.next();
  },

  // 4-QADAM

  (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE");

    if (!ctx.message || !ctx.message.text) {
      ctx.reply("❌ Iltimos, manzilingizni yozing.");
      return;
    }

    ctx.wizard.state.formData.manzil = ctx.message.text;

    ctx.reply(
      "📘 Qaysi fanni o'rganmoqchisiz?",
      Markup.keyboard([
        ["🧮 Matematika", "🇬🇧 Ingliz tili"],
        ["💻 Informatika / IT", "🇷🇺 Rus tili"],
        ["⚖️ Huquq", "Boshqa fan"],
      ])
        .oneTime()
        .resize(),
    );
    return ctx.wizard.next();
  },

  // 5-QADAM

  (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE");
    ctx.wizard.state.formData.qiziqish = ctx.message.text;
    ctx.reply(
      "🏫 Nechanchi sinfda o'qiysiz?",
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

  // 6-QADAM

  (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE");
    ctx.wizard.state.formData.sinf = ctx.message.text;
    ctx.reply(
      "📢 Biz haqimizda qayerdan eshitdingiz?",

      Markup.keyboard([
        ["📱 Instagram", "✈️ Telegram"],
        ["🗣 Tanishlarimdan", "🏫 Maktab banneridan"],
      ])
        .oneTime()
        .resize(),
    );

    return ctx.wizard.next();
  },

  // 7-QADAM

  async (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE");
    const data = ctx.wizard.state.formData;
    data.manba = ctx.message.text;
    data.chatId = ctx.chat.id;
    data.createdAt = admin.firestore.FieldValue.serverTimestamp();

    try {
      await db.collection("leads").add(data);
      await saveToGoogleSheet(data);

      ctx.reply(
        "✅ Rahmat! Ma'lumotlaringiz qabul qilindi.",
        Markup.removeKeyboard(),
      );
    } catch (err) {
      ctx.reply("❌ Xatolik yuz berdi.");
    }

    return ctx.scene.leave();
  },
);

const commentScene = new Scenes.WizardScene(
  "COMMENT_SCENE",
  (ctx) => {
    ctx.reply("✍️ Savolingizni yozing:");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message?.text === "/start")
      return ctx.scene.enter("REGISTRATION_SCENE");
    const commentData = {
      chatId: ctx.chat.id,
      ism: ctx.from.first_name || "Noma'lum",
      izoh: ctx.message.text,
      manba: "Bot Comment bo'limi",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
      await db.collection("comments").add(commentData);
      await saveToGoogleSheet({
        ...commentData,
        phone: "-",
        manzil: "-",
        qiziqish: "-",
        sinf: "-",
      });
      ctx.reply("✅ Savolingiz qabul qilindi.");
    } catch (err) {
      ctx.reply("❌ Xatolik.");
    }
    return ctx.scene.leave();
  },
);

// 3. BOT VA SERVERNI SOZLASH
const bot = new Telegraf(serviceAccount.bot_token);
const stage = new Scenes.Stage([contactScene, commentScene]);

bot.use(session());
bot.use(stage.middleware());

// KOMANDALAR
bot.command("start", (ctx) => ctx.scene.enter("REGISTRATION_SCENE"));
bot.command("info", (ctx) =>
  ctx.reply("📍 Manzil: O‘zbekiston tumani, Yakkatut MFY\n📞: 93-301-62-76"),
);
bot.command("comment", (ctx) => ctx.scene.enter("COMMENT_SCENE"));

// 4. WEBHOOK VA EXPRESS
const app = express();
app.use(express.json());

const WEBHOOK_PATH = `/bot${serviceAccount.bot_token}`;
const WEBHOOK_URL = `https://ideal-bot-qqbc.onrender.com${WEBHOOK_PATH}`;

bot.telegram.setWebhook(WEBHOOK_URL);

app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.get("/", (req, res) => {
  res.send("Bot Status: Online ✅");
});

// SERVERNI ISHGA TUSHIRISH
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// bot.launch() KERAK EMAS (Webhook ishlatilganda)
