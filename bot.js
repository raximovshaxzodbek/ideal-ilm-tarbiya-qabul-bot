const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// Firebase kalitini ulash
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const token = '8660010731:AAEjuLzqQHxJYnNytZCNMM-3jS8oOtNFq3c';
const bot = new TelegramBot(token, { polling: true });

// Debug startup log
console.log('Bot initialized, starting polling...');

// Log polling errors explicitly so they don't appear to silently fail
bot.on('polling_error', (err) => {
    console.error('Polling error:', err);
});

// Global error handlers to make sure we print any uncaught issues
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

// Graceful shutdown handler for Ctrl+C during development
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully.');
    try { bot.stopPolling(); } catch (e) {}
    process.exit();
});

let userState = {};
``
// Telefon raqamini tekshirish uchun Regex (O'zbekiston formatida)
const phoneRegex = /^\+998\d{9}$/;

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        userState[chatId] = { step: 'ism', data: {} };
        return bot.sendMessage(chatId, "Assalomu alaykum! Ismingizni kiriting:");
    }

    let state = userState[chatId];
    if (!state) return;

    try {
        switch (state.step) {
            case 'ism':
                if (text.length < 3) return bot.sendMessage(chatId, "Ism juda qisqa. Iltimos, to'liq ismingizni yozing:");
                state.data.ism = text;
                state.step = 'phone';
                // Telefon yuborish tugmasi bilan so'rash
                bot.sendMessage(chatId, "Telefon raqamingizni yuboring (+998XXXXXXXXX formatida yoki quyidagi tugmani bosing):", {
                    reply_markup: {
                        keyboard: [[{ text: "Raqamni ulash", contact: true }]],
                        one_time_keyboard: true,
                        resize_keyboard: true
                    }
                });
                break;

            case 'phone':
                let phone;
                if (msg.contact) {
                    phone = msg.contact.phone_number.startsWith('+') ? msg.contact.phone_number : '+' + msg.contact.phone_number;
                } else if (phoneRegex.test(text)) {
                    phone = text;
                } else {
                    return bot.sendMessage(chatId, "⚠️ Xato! Telefon raqami +998901234567 formatida bo'lishi kerak. Iltimos, qaytadan kiriting:");
                }
                
                state.data.phone = phone;
                state.step = 'sinf';
                bot.sendMessage(chatId, "Sinfingizni kiriting (masalan: 9-sinf):", { reply_markup: { remove_keyboard: true } });
                break;

            case 'sinf':
                state.data.sinf = text;
                state.step = 'manzil';
                bot.sendMessage(chatId, "Yashash manzilingizni kiriting:");
                break;

            case 'manzil':
                state.data.manzil = text;
                state.step = 'qiziqish';
                bot.sendMessage(chatId, "Qaysi fanga qiziqasiz?");
                break;

            case 'qiziqish':
                state.data.qiziqish = text;
                state.step = 'manba';
                bot.sendMessage(chatId, "Biz haqimizda qayerdan eshitdingiz?");
                break;

            case 'manba':
                state.data.manba = text;
                state.step = 'izoh';
                bot.sendMessage(chatId, "Qo'shimcha izohingiz bo'lsa yozing (yoki 'yo'q' deb yozing):");
                break;

            case 'izoh':
                state.data.izoh = text;
                
                // FIRESTORE'GA SAQLASH (Leads kolleksiyasi)
                await db.collection("leads").add({
                    ...state.data,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    chatId: chatId
                });

                bot.sendMessage(chatId, "✅ Tabriklaymiz! Arizangiz qabul qilindi. Siz bilan tez orada bog'lanamiz.");
                delete userState[chatId];
                break;
        }
    } catch (e) {
        console.error("Xatolik:", e);
        bot.sendMessage(chatId, "Tizimda xatolik yuz berdi. Iltimos, keyinroq urunib ko'ring.");
    }
});