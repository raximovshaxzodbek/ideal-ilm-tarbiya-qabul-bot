const { Telegraf, Scenes, session } = require('telegraf');
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

// 3. Bot sahnalari (WizardScene)
const contactScene = new Scenes.WizardScene(
    'REGISTRATION_SCENE',
    (ctx) => {
        ctx.reply("Assalomu alaykum! Ismingizni kiriting:");
        ctx.wizard.state.formData = {};
        return ctx.wizard.next();
    },
    (ctx) => {
        ctx.wizard.state.formData.ism = ctx.message.text;
        ctx.reply("Telefon raqamingizni yuboring:");
        return ctx.wizard.next();
    },
    (ctx) => {
        ctx.wizard.state.formData.phone = ctx.message.text;
        ctx.reply("Manzilingizni kiriting (tuman, ko'cha):");
        return ctx.wizard.next();
    },
    (ctx) => {
        ctx.wizard.state.formData.manzil = ctx.message.text;
        ctx.reply("Qaysi fanga qiziqasiz?");
        return ctx.wizard.next();
    },
    (ctx) => {
        ctx.wizard.state.formData.qiziqish = ctx.message.text;
        ctx.reply("Sinfingizni kiriting:");
        return ctx.wizard.next();
    },
    (ctx) => {
        ctx.wizard.state.formData.sinf = ctx.message.text;
        ctx.reply("Biz haqimizda qayerdan eshitdingiz?");
        return ctx.wizard.next();
    },
    async (ctx) => {
        const data = ctx.wizard.state.formData;
        data.manba = ctx.message.text;
        data.chatId = ctx.chat.id;
        data.createdAt = admin.firestore.FieldValue.serverTimestamp();

        try {
            // Firestore-ga saqlash
            await db.collection('leads').add(data);
            
            // Google Sheets-ga saqlash
            await saveToGoogleSheet(data);

            ctx.reply("Rahmat! Ma'lumotlaringiz qabul qilindi. Tez orada bog'lanamiz.");
        } catch (err) {
            ctx.reply("Xatolik yuz berdi, qaytadan urinib ko'ring.");
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