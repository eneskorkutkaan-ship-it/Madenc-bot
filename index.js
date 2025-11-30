const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const GoalBlock = require('mineflayer-pathfinder').goals.GoalBlock;
const autoeat = require('mineflayer-auto-eat').plugin;
const collectBlock = require('mineflayer-collectblock').plugin;
const { GoalGetToBlock } = require('mineflayer-pathfinder').goals;

// =========================================================================
// ⚠️ 1. AYARLAR: LÜTFEN SADECE AŞAĞIDAKİ BİLGİLERİ DOLDURUN
// =========================================================================

const SUNUCU_ADRESI = 'SUNUCU_IPSI_BURAYA_GELECEK'; 
const BOT_VERSION = 'SUNUCU_SURUMU_BURAYA_GELECEK'; 
const MAIN_PLAYER_NAME = 'LUTFEN_KENDI_OYUNCU_ADINIZI_GIRIN'; // KORUNACAK KİŞİ ADI (Gerekli değil ama güvenlik için ekli)

// BU BOTA AİT HESAP BİLGİLERİ (3. Hesap)
const BOT_HESABI_EMAIL = 'madencibot3@gmail.com'; 
const BOT_HESABI_SIFRE = 'bot3sifre';

// GÖREV KOORDİNATLARI
let SANDIK_KOORDINAT = null; // /sandık ayarla ile eşya bırakılacak yer
let MADEN_ALANI_BLOK_ISMI = 'coal_ore'; // Madencilik hedefi
let MADEN_ALANI_YARI_CAP = 10; // Botun ne kadar uzağa gideceği (512MB RAM için küçük tutuldu)

// =========================================================================
// 2. BOT DURUM YÖNETİMİ
// =========================================================================

const STATE = {
    MINING: 'madencilik',
    HUNTING: 'avlanma',
    EMPTYING: 'bosaltma',
    IDLE: 'bos'
};

let current_state = STATE.IDLE;

// =========================================================================
// 3. ÇEKİRDEK GÖREVLER
// =========================================================================

// Sandık Koordinatına git ve boşaltma
async function startEmptying(bot) {
    if (!SANDIK_KOORDINAT) {
        bot.chat('HATA: Sandık koordinatları ayarlanmamış!');
        return startMining(bot); 
    }
    
    current_state = STATE.EMPTYING;
    bot.chat('Envanter dolu, sandığa boşaltmaya gidiyorum.');

    // Sandığa git
    await bot.pathfinder.goto(new GoalBlock(SANDIK_KOORDINAT.x, SANDIK_KOORDINAT.y, SANDIK_KOORDINAT.z));

    const sandikBlok = bot.blockAt(SANDIK_KOORDINAT);
    if (!sandikBlok || !sandikBlok.name.includes('chest')) {
        bot.chat('HATA: Sandık yok!');
        return startMining(bot);
    }

    const sandik = await bot.openContainer(sandikBlok);
    
    // Yemeği tut, gerisini boşalt
    for (const item of bot.inventory.items()) {
        if (!item.name.includes('cooked_') && !item.name.includes('steak')) { 
            await sandik.deposit(item.type, item.metadata, item.count);
        }
    }
    await sandik.close();
    bot.chat('Envanter temizlendi. Madenciliğe devam.');
    startMining(bot);
}

// Madencilik ve Malzeme Toplama
async function startMining(bot) {
    if (bot.inventory.emptySlotCount() <= 2) {
        return startEmptying(bot);
    }
    current_state = STATE.MINING;
    
    // Yakında MADEN_ALANI_BLOK_ISMI ara
    const hedefBlok = bot.findBlock({
        matching: (block) => block.name === MADEN_ALANI_BLOK_ISMI,
        maxDistance: MADEN_ALANI_YARI_CAP,
        count: 1
    });

    if (!hedefBlok) {
        bot.chat('Yakında hedef cevher bulunamadı. Başka bir yere gidiyorum.');
        // Rastgele bir yere kısa mesafe git
        const rastgeleHedef = bot.entity.position.offset(Math.random() * 5 - 2.5, 0, Math.random() * 5 - 2.5);
        await bot.pathfinder.goto(new GoalGetToBlock(rastgeleHedef.x, rastgeleHedef.y, rastgeleHedef.z));
        return setTimeout(() => startMining(bot), 5000); // 5 saniye sonra tekrar dene
    }

    bot.chat(`${hedefBlok.name} bloğunu kazmaya başlıyorum.`);
    // Blok kazma (CollectBlock eklentisi kullanılıyor)
    await bot.collectBlock.collect(hedefBlok, { ignorePath: false, count: 1 });
    
    startMining(bot); // Kazma bitince devam et
}

// Avlanma ve Pişirme (Otonom Hayatta Kalma)
async function startHunting(bot) {
    current_state = STATE.HUNTING;
    bot.chat('Yemek stoğu kritik, avlanmaya gidiyorum.');

    // Yemek pişirme mantığı (RAM'i zorlamamak için basitleştirildi)
    const rawEt = bot.inventory.items().find(item => item.name.includes('_mutton') || item.name.includes('_porkchop'));

    if (rawEt) {
        bot.chat('Pişirme görevi şimdilik atlanmıştır (RAM optimizasyonu).');
    }
    
    const hedef = bot.nearestEntity((entity) => {
        return entity.name === 'pig' || entity.name === 'cow' || entity.name === 'chicken';
    });

    if (hedef) {
        bot.setControlState('forward', true); 
        bot.attack(hedef);
        setTimeout(() => bot.setControlState('forward', false), 2000); // 2 saniye saldır
    } else {
        bot.chat('Yakında av yok. Madenciliğe dönüyorum.');
        setTimeout(() => startMining(bot), 10000);
    }
}


// =========================================================================
// 4. BOT BAŞLATMA VE OLAY YÖNETİMİ
// =========================================================================

const bot = mineflayer.createBot({
    host: SUNUCU_ADRESI,
    port: 25565,
    username: BOT_HESABI_EMAIL,
    password: BOT_HESABI_SIFRE,
    auth: 'microsoft',
    version: BOT_VERSION
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(autoeat);
bot.loadPlugin(collectBlock);

bot.on('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
    
    bot.chat(`[Madenci Botu] Hazır! Cevher hedefi: ${MADEN_ALANI_BLOK_ISMI}`);
    startMining(bot); 
});

// Envanter/Açlık Kontrolü
bot.on('autoeat_stopped', () => {
    const yiyecek = bot.inventory.items().find(item => item.name.includes('cooked_') || item.name.includes('steak'));
    if (!yiyecek && current_state !== STATE.HUNTING) {
        startHunting(bot);
    }
});

bot.on('inventorySlotChanged', () => {
    if (bot.inventory.emptySlotCount() <= 2 && current_state !== STATE.EMPTYING) {
        startEmptying(bot);
    }
});

// Chat Komutları
bot.on('chat', (username, message) => {
    if (username !== MAIN_PLAYER_NAME) return;

    const msg = message.toLowerCase();
    
    if (msg.includes('sandık ayarla')) {
        const sandik_block = bot.targetDigBlock; 
        if (sandik_block) {
            SANDIK_KOORDINAT = sandik_block.position.clone();
            bot.chat(`[AYAR] Sandık koordinatı ayarlandı.`);
        }
    } else if (msg.includes('maden yap')) {
        startMining(bot);
    } else if (msg.includes('hedef')) {
        const parts = msg.split(' ');
        if (parts.length > 1) {
            MADEN_ALANI_BLOK_ISMI = parts[1];
            bot.chat(`[AYAR] Yeni hedef cevher: ${MADEN_ALANI_BLOK_ISMI}`);
            startMining(bot);
        }
    }
});

// Hata ve Yeniden Bağlanma Yönetimi
bot.on('end', () => {
    console.log('[ÇIKTI] Yeniden bağlanmaya çalışılıyor...');
    setTimeout(() => process.exit(1), 15000); 
});

const http = require('http');
http.createServer((req, res) => {
  res.write('Madenci botu calisiyor...');
  res.end();
}).listen(process.env.PORT || 3000);
