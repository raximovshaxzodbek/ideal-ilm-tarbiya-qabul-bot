const { Telegraf, Scenes, session, Markup } = require('telegraf');
const admin = require('firebase-admin');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const serviceAccount = require('./serviceAccountKey.json'); //

// 1. Firebase ulanishi
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Google Sheets ulanishi sozlamalari
const SPREADSHEET_ID = '1lXdNvA91QaYG4pAhvtSZgSrlO-VywlhkKVqH3nikiUw'; //
const auth = new JWT({
    email: serviceAccount.client_email, //
    key: serviceAccount.private_key,    //
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const http = require('http');
http.createServer((req, res) => res.end('Bot is running!')).listen(process.env.PORT || 3000);

async function saveToGoogleSheet(data) {
    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Sheet1
        
        await sheet.addRow({
            ism: data.ism,
            izoh: data.izoh || "Yo'q",
            manba: data.manba,
            manzil: data.manzil,
            phone: data.phone,
            qiziqish: data.qiziqish,
            sinf: data.sinf
        });
        console.log("✅ Google Sheets-ga yozildi");
    } catch (e) {
        console.error("❌ Sheets xatosi:", e);
    }
}

// Telefon raqam to'g'riligini tekshirish uchun Regex formula (faqat O'zbekiston raqamlari)
const phoneRegex = /^\+?998[0-9]{9}$/;

const contactScene = new Scenes.WizardScene(
    'REGISTRATION_SCENE',
    
    // 1-QADAM: Ism so'rash
    (ctx) => {
        ctx.reply("👋 Assalomu alaykum! Ism va familiyangizni kiriting:\n(Masalan: Alisherov Vali)");
        ctx.wizard.state.formData = {};
        return ctx.wizard.next();
    },

    // 2-QADAM: Ismni tekshirish va Raqam so'rash
    (ctx) => {
        // Agar foydalanuvchi matn emas, rasm yoki stiker yuborsa:
        if (!ctx.message || !ctx.message.text || ctx.message.text.length < 3) {
            ctx.reply("❌ Iltimos, ismingizni to'g'ri harflar bilan kiriting.");
            return; // Keyingi qadamga o'tkazmaymiz
        }
        ctx.wizard.state.formData.ism = ctx.message.text;

        // Raqamni tugma orqali so'rash
        ctx.reply(
            "📞 Iltimos, telefon raqamingizni yuboring.\nBuning uchun pastdagi **«📱 Raqamni yuborish»** tugmasini bosing:",
            Markup.keyboard([
                Markup.button.contactRequest("📱 Raqamni yuborish")
            ]).oneTime().resize()
        );
        return ctx.wizard.next();
    },

    // 3-QADAM: Raqamni tekshirish va Manzil so'rash
    (ctx) => {
        let phone = "";
        
        // Agar tugmani bosib yuborgan bo'lsa
        if (ctx.message && ctx.message.contact) {
            phone = ctx.message.contact.phone_number;
        } 
        // Agar qo'lda yozgan bo'lsa (regex orqali tekshiramiz)
        else if (ctx.message && ctx.message.text) {
            const typedPhone = ctx.message.text.replace(/\s+/g, ''); // Bo'shliqlarni olib tashlash
            if (phoneRegex.test(typedPhone)) {
                phone = typedPhone;
            }
        }

        // Agar raqam xato bo'lsa
        if (!phone) {
            ctx.reply("❌ Noto'g'ri format! Iltimos, pastdagi tugmani bosing yoki raqamni to'g'ri kiriting (+998901234567).");
            return;
        }

        ctx.wizard.state.formData.phone = phone;
        
        // Tugmalarni yo'qotib, keyingi savolni berish
        ctx.reply("📍 Yashash manzilingizni kiriting:\n(Masalan: Beshariq tumani, Hamid Olimjon ko'chasi)", Markup.removeKeyboard());
        return ctx.wizard.next();
    },

    // 4-QADAM: Manzilni saqlash va Fanlarni tugmada chiqarish
    (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            ctx.reply("❌ Iltimos, manzilingizni matn ko'rinishida yozing.");
            return;
        }
        ctx.wizard.state.formData.manzil = ctx.message.text;

        ctx.reply(
            "📘 Qaysi fanni o'rganmoqchisiz? Quyidagilardan birini tanlang:",
            Markup.keyboard([
                ["🧮 Matematika", "🇬🇧 Ingliz tili"],
                ["💻 Informatika / IT", "🇷🇺 Rus tili"],
                ["⚖️ Huquq", "Boshqa fan"]
            ]).oneTime().resize()
        );
        return ctx.wizard.next();
    },

    // 5-QADAM: Fanni saqlash va Sinfni tugmada chiqarish
    (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            ctx.reply("❌ Iltimos, tugmalardan birini tanlang yoki fanni yozing.");
            return;
        }
        ctx.wizard.state.formData.qiziqish = ctx.message.text;

        ctx.reply(
            "🏫 Nechanchi sinfda o'qiysiz?",
            Markup.keyboard([
                ["1-sinf", "2-sinf", "3-sinf", "4-sinf"],
                ["5-sinf", "6-sinf", "7-sinf", "8-sinf"],
                ["9-sinf", "10-sinf", "11-sinf"],
                ["Maktabni bitirganman"]
            ]).oneTime().resize()
        );
        return ctx.wizard.next();
    },

    // 6-QADAM: Sinfni saqlash va Manbani so'rash
    (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            ctx.reply("❌ Iltimos, tugmalardan birini tanlang.");
            return;
        }
        ctx.wizard.state.formData.sinf = ctx.message.text;

        ctx.reply(
            "📢 Biz haqimizda qayerdan eshitdingiz?",
            Markup.keyboard([
                ["📱 Instagram", "✈️ Telegram"],
                ["🗣 Tanishlarimdan", "🏫 Maktab banneridan"]
            ]).oneTime().resize()
        );
        return ctx.wizard.next();
    },

    // 7-QADAM: Yakunlash va Bazaga yozish
    async (ctx) => {
        if (!ctx.message || !ctx.message.text) {
            ctx.reply("❌ Iltimos, tugmalardan birini tanlang.");
            return;
        }
        
        const data = ctx.wizard.state.formData;
        data.manba = ctx.message.text;
        data.chatId = ctx.chat.id;
        data.createdAt = admin.firestore.FieldValue.serverTimestamp();

        try {
            // Firestore-ga saqlash
            await db.collection('leads').add(data);
            
            // Google Sheets-ga saqlash (Sizdagi oldingi kod)
            await saveToGoogleSheet(data);

            // Yakuniy xabar va tugmalarni tozalash
            ctx.reply(
                "✅ Rahmat! Ma'lumotlaringiz muvaffaqiyatli qabul qilindi. Tez orada administratorlarimiz siz bilan bog'lanishadi.",
                Markup.removeKeyboard()
            );
        } catch (err) {
            ctx.reply("❌ Xatolik yuz berdi, tizimda muammo. Iltimos keyinroq qaytadan urinib ko'ring.", Markup.removeKeyboard());
            console.error(err);
        }
        return ctx.scene.leave();
    }
);

// 4. Botni ishga tushirish
const bot = new Telegraf('8660010731:AAEjuLzqQHxJYnNytZCNMM-3jS8oOtNFq3c'); // Tokenni bu yerga qo'ying
const stage = new Scenes.Stage([contactScene]);

bot.use(session());
bot.use(stage.middleware());

bot.command('start', (ctx) => ctx.scene.enter('REGISTRATION_SCENE'));

bot.launch().then(() => console.log("Bot ishga tushdi..."));

// Xavfsiz to'xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));