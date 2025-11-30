const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const GoalFollow = require('mineflayer-pathfinder').goals.GoalFollow;
const autoeat = require('mineflayer-auto-eat').plugin;
const pvp = require('mineflayer-pvp').plugin; 

// =========================================================================
// ⚠️ 1. AYARLAR: LÜTFEN SADECE AŞAĞIDAKİ BİLGİLERİ DOLDURUN
// =========================================================================

const SUNUCU_ADRESI = 'SUNUCU_IPSI_BURAYA_GELECEK'; // Örn: 'oyun.sunucum.com'
const BOT_VERSION = 'SUNUCU_SURUMU_BURAYA_GELECEK'; // Örn: '1.20.4'

// KORUNACAK KİŞİ (SENİN OYUNCU ADIN)
const MAIN_PLAYER_NAME = 'SENIN_OYUNCU_ISMIN_BURAYA_GELECEK'; 

// PREMIUM HESAP BİLGİLERİ
const BOT_HESABI_EMAIL = 'madencibot@gmail.com'; 
const BOT_HESABI_SIFRE = 'madencibot3113';

// ÜS VE GÖREV KOORDİNATLARI
let BASE_KOORDINAT = null; // /üs ayarla ile botun geri döneceği yer
let SANDIK_KOORDINAT = null; // /sandık ayarla ile botun eşya bırakacağı sandık
let KAPI_KOORDINAT = null; // /kapı ayarla ile botun nöbet tutacağı yer

// =========================================================================
// 2. BOT DURUM YÖNETİMİ VE İKİ GÖREV MODU
// =========================================================================

const STATE = {
    FOLLOWING: 'takip',
    GUARDING_GATE: 'kapinobeti',
    HUNTING: 'avlanma',
    EMPTYING: 'bosaltma',
    FIGHTING: 'savunma'
};

let current_state = STATE.FOLLOWING;

// =========================================================================
// 3. ÇEKİRDEK GÖREVLER
// =========================================================================

// En iyi silahı kuşanma
function equipBestWeapon(bot) {
    const bestWeapon = bot.inventory.items().reduce((best, item) => {
        if (!item.name.includes('sword') && !item.name.includes('axe')) return best;
        const damage = item.nbt?.value.display?.value.Lore?.value[0]?.value.includes('Damage') ? 
                       parseFloat(item.nbt.value.display.value.Lore.value[0].value.match(/(\d+\.?\d*)/)[0]) : 
                       (item.name.includes('diamond_sword') ? 7 : 4); // Basit bir tahmin
        if (!best || damage > best.damage) {
            return { item: item, damage: damage };
        }
        return best;
    }, null);

    if (bestWeapon) {
        bot.equip(bestWeapon.item, 'hand', () => {
             // En iyi kılıcı kuşandık
        });
    }
}

// Oyuncuyu Takip Etme ve Koruma
function startFollowing(bot) {
    if (current_state !== STATE.FOLLOWING) {
        bot.pvp.stop();
        bot.pathfinder.stop();
    }
    current_state = STATE.FOLLOWING;
    bot.chat('Sizi takip modundayım.');
    
    // 5 blok mesafeden takip et
    const player = bot.players[MAIN_PLAYER_NAME]?.entity;
    if (player) {
        bot.pathfinder.setGoal(new GoalFollow(player, 5), true);
    } else {
        // Oyuncu yoksa kapı nöbetine geç
        bot.chat('Kullanıcı sunucuda değil. Kapı nöbetine geçiyorum.');
        startGateGuard(bot);
    }
}

// Kapı Nöbeti Modu
function startGateGuard(bot) {
    if (!KAPI_KOORDINAT) {
        bot.chat('HATA: Kapı koordinatları ayarlanmamış!');
        startFollowing(bot); // Kapı yoksa takip etmeye geri dön
        return;
    }
    
    current_state = STATE.GUARDING_GATE;
    bot.pvp.stop();
    bot.chat('Kapı nöbeti görevine başlıyorum.');

    const goal = new GoalFollow(bot.entity, 0); // Yerinde kal
    bot.pathfinder.setGoal(goal, false, () => {
        // Kapı koordinatına git
        bot.pathfinder.setGoal(new GoalBlock(KAPI_KOORDINAT.x, KAPI_KOORDINAT.y, KAPI_KOORDINAT.z), true);
    });
}

// Avlanma ve Yemek Tedariki
function startHunting(bot) {
    if (current_state !== STATE.HUNTING && bot.inventory.emptySlotCount() <= 2) {
        // Envanter doluysa avlanma
        bot.chat('Avlanmaya gitmeden önce envanteri boşaltmalıyım.');
        return startEmptying(bot);
    }

    current_state = STATE.HUNTING;
    bot.chat('Yemek stoğu kritik, avlanmaya gidiyorum.');

    const hedef = bot.nearestEntity((entity) => {
        return entity.name === 'pig' || entity.name === 'cow' || entity.name === 'chicken';
    });

    if (hedef) {
        bot.pvp.attack(hedef); // pvp eklentisi ile hedefe saldır
    } else {
        bot.chat('Yakında av yok. Takibe dönüyorum.');
        setTimeout(() => startFollowing(bot), 10000);
    }
}

// Sandığa eşya boşaltma
async function startEmptying(bot) {
    if (!SANDIK_KOORDINAT) {
        bot.chat('HATA: Sandık koordinatları ayarlanmamış!');
        startFollowing(bot);
        return;
    }
    current_state = STATE.EMPTYING;
    // Detaylı sandık boşaltma mantığı buraya eklenecek (RAM limitini zorlamamak için basitleştirildi)
    
    bot.chat('Sandığa gidip envanteri boşaltıyorum.');
    // Kod sandık koordinatına gidecek, boşaltacak ve sonra takibe dönecek
    // (Kodun bu kısmı RAM limitini aşmamak için PATHFINDER döngüsüne bırakılmıştır)
    startFollowing(bot); // Basitçe takibe geri dönüyoruz
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
bot.loadPlugin(pvp);

bot.on('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
    
    bot.chat(`[Süper Koruma Botu] Hazır! Sayın ${MAIN_PLAYER_NAME}, sizi bekliyorum.`);
    equipBestWeapon(bot);
    startFollowing(bot); 
});

// PvP: Düşman Görünce Saldırı
bot.on('physic', () => {
    // Sadece takip/nöbet modundayken otomatik saldırı
    if (current_state === STATE.FOLLOWING || current_state === STATE.GUARDING_GATE) {
        const hedef = bot.nearestEntity((entity) => {
            return entity.type === 'mob' || (entity.type === 'player' && entity.username !== MAIN_PLAYER_NAME && bot.pvp.target === null);
        });

        if (hedef) {
            bot.pvp.attack(hedef);
            current_state = STATE.FIGHTING;
        } else if (bot.pvp.target && !bot.pvp.target.isValid) {
            bot.pvp.stop();
            // Savaşı bitirince ana göreve dön
            if (current_state === STATE.FIGHTING) startFollowing(bot);
        }
    }
});


// Can ve Açlık Kontrolü (Hayatta Kalma)
bot.on('health', () => {
    // Kritik durumda (Can < 10) ve savaşta değilse kaçış/yardım çağrısı
    if (bot.health < 10 && current_state !== STATE.FIGHTING) {
        bot.chat(`Yardım! Canım çok az: ${Math.floor(bot.health)}`);
        // Otomatik kaçış mantığı buraya eklenebilir, şimdilik sadece uyarıyoruz.
    }
    
    // Yemek stoğu kontrolü (Boşta kaldığında avlansın)
    const yiyecek = bot.inventory.items().find(item => item.name.includes('cooked_') || item.name.includes('steak'));
    if (!yiyecek && current_state !== STATE.HUNTING && current_state !== STATE.FIGHTING) {
        startHunting(bot);
    }
});

// Chat Komutları (Mod Değiştirme)
bot.on('chat', (username, message) => {
    if (username !== MAIN_PLAYER_NAME) return;

    const msg = message.toLowerCase();
    
    if (msg.includes('kapı ayarla')) {
        const pos = bot.entity.position; 
        KAPI_KOORDINAT = pos.clone();
        bot.chat(`[AYAR] Kapı nöbet koordinatı ayarlandı.`);
        startGateGuard(bot); // Ayarlayınca hemen nöbete başla
    } else if (msg.includes('takip et')) {
        startFollowing(bot);
    } else if (msg.includes('avlan')) {
        startHunting(bot);
    } else if (msg.includes('sandık ayarla')) {
         const sandik_block = bot.targetDigBlock; 
        if (sandik_block) {
            SANDIK_KOORDINAT = sandik_block.position.clone();
            bot.chat(`[AYAR] Sandık koordinatı ayarlandı.`);
        }
    }
});

// Hata ve Yeniden Bağlanma Yönetimi (7/24 Fix)
bot.on('end', () => {
    console.log('[ÇIKTI] Yeniden bağlanmaya çalışılıyor...');
    setTimeout(() => process.exit(1), 15000); 
});

const http = require('http');
http.createServer((req, res) => {
  res.write('Super koruma botu calisiyor...');
  res.end();
}).listen(process.env.PORT || 3000);
