const { Telegraf, Scenes, session, Markup } = require("telegraf");
const admin = require("firebase-admin");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const express = require("express");
const serviceAccount = require("./serviceAccountKey.json");

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
  try {
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
  } catch (error) {
    console.error("Sheets xatosi:", error);
    throw error;
  }
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
      await saveToGoogleSheet(data);
      await ctx.reply(
        "Rahmat! Ma'lumotlaringiz qabul qilindi.",
        Markup.removeKeyboard(),
      );
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
      await saveToGoogleSheet({
        ...commentData,
        phone: "-",
        manzil: "-",
        qiziqish: "-",
        sinf: "-",
      });
      await ctx.reply("Savolingiz qabul qilindi.");
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

if (!BOT_TOKEN) {
  throw new Error("Bot token topilmadi. BOT_TOKEN yoki serviceAccount.bot_token kerak.");
}

const bot = new Telegraf(BOT_TOKEN);
const stage = new Scenes.Stage([contactScene, commentScene]);
const app = express();

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

  try {
    const sheet = await getGoogleSheet();
    console.log(`Google Sheets ulandi: ${sheet.title}`);
  } catch (error) {
    console.error("Google Sheets ulanishida xatolik:", error);
  }

  if (WEBHOOK_DOMAIN) {
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
  console.error("Botni ishga tushirishda xatolik:", error);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
