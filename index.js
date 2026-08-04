const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const http = require('http');
const fs = require('fs');

// ==========================================
// --- RENDER 7/24 UPTIME SUNUCUSU ---
// ==========================================
http.createServer((req, res) => {
    res.write("CraftRiva Bot Aktif!");
    res.end();
}).listen(process.env.PORT || 3000);

// ==========================================
// --- AYARLAR ---
// ==========================================
const ANI_FOTOGRAFLAR_KANAL_ID = '1531645133177618641'; 
const INVITE_KANAL_ID = '1534343282996543639'; // Belirttiğin invite kanalı ID'si
const MAX_SAME_MESSAGES = 4;

// ==========================================
// --- VERİ DOSYASI YÖNETİMİ (KALIICI HAFIZA) ---
// ==========================================
const DATA_FILE = './invites.json';

// Davetleri dosyadan okuma
function loadInvites() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return new Map(JSON.parse(data));
        }
    } catch (err) {
        console.error('Davet verileri okunurken hata:', err);
    }
    return new Map();
}

// Davetleri dosyaya kaydetme
function saveInvites() {
    try {
        const data = JSON.stringify(Array.from(userInvites.entries()));
        fs.writeFileSync(DATA_FILE, data, 'utf8');
    } catch (err) {
        console.error('Davet verileri kaydedilirken hata:', err);
    }
}

// ==========================================
// --- İNTENT VE VERİ DEPOLAMA ---
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const userInvites = loadInvites(); // Kalıcı hafızadan yükle
const invitesCache = new Map();
const spamMap = new Map();
const giveaways = new Map();

// ==========================================
// --- BOT HAZIR OLDUĞUNDA ---
// ==========================================
client.on('ready', async () => {
    console.log(`🤖 ${client.user.tag} olarak giriş yapıldı ve aktif!`);
    
    client.guilds.cache.forEach(async (guild) => {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
        } catch (err) {
            console.log(`Davetler çekilemedi (${guild.name}):`, err.message);
        }
    });
});

// ==========================================
// --- YENİ ÜYE GİRİŞİ (OTO-ROL VE DAVET) ---
// ==========================================
client.on('guildMemberAdd', async (member) => {
    try {
        const role = member.guild.roles.cache.find(r => r.name === 'Üye');
        if (role) await member.roles.add(role);
    } catch (err) {
        console.error('Otomatik rol verilemedi:', err.message);
    }

    try {
        const oldInvites = invitesCache.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch();
        
        let invite = null;
        if (oldInvites) {
            // Kullanım sayısı artan daveti bul
            invite = newInvites.find(i => oldInvites.has(i.code) && oldInvites.get(i.code) < i.uses);
        }

        let inviterText = "Bilinmiyor";
        let inviteCount = 0;

        if (invite && invite.inviter) {
            inviterText = `<@${invite.inviter.id}>`;
            inviteCount = (userInvites.get(invite.inviter.id) || 0) + 1;
            userInvites.set(invite.inviter.id, inviteCount);
            saveInvites(); // Dosyaya anında kaydet
        }

        // Cache'i güncelle
        invitesCache.set(member.guild.id, new Map(newInvites.map((inv) => [inv.code, inv.uses])));

        // Belirtilen invite kanalına log atma
        const inviteChannel = member.guild.channels.cache.get(INVITE_KANAL_ID);
        if (inviteChannel) {
            const embed = new EmbedBuilder()
                .setTitle('📥 Yeni Üye Katıldı!')
                .setDescription(`Aramıza hoş geldin ${member}!\n\n📌 **Davet Eden:** ${inviterText}\n📊 **Toplam Davet Sayısı:** ${inviteCount}`)
                .setColor('#2ECC71')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await inviteChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Davet güncellenirken hata oluştu:', err.message);
    }
});

// ==========================================
// --- ÜYE AYRILDIĞINDA LOG ---
// ==========================================
client.on('guildMemberRemove', async (member) => {
    try {
        // Üye çıktığında güncel davetleri de cache'e tazeleyelim ki sayaçlar şaşmasın
        if (member.guild) {
            const newInvites = await member.guild.invites.fetch();
            invitesCache.set(member.guild.id, new Map(newInvites.map((inv) => [inv.code, inv.uses])));
        }

        const inviteChannel = member.guild.channels.cache.get(INVITE_KANAL_ID);
        if (!inviteChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('📤 Üye Ayrıldı')
            .setDescription(`**${member.user.tag}** sunucudan ayrıldı.`)
            .setColor('#E74C3C')
            .setTimestamp();

        await inviteChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Üye ayrılma logu gönderilemedi:', err.message);
    }
});

// ==========================================
// --- MESAJ DİNLEYİCİSİ (KOMUTLAR VE FİLTRELER) ---
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

    // --- ANI-FOTOĞRAFLAR KANAL SÜZGEÇ SİSTEMİ ---
    if (message.channel.id === ANI_FOTOGRAFLAR_KANAL_ID) {
        if (!isAdmin) {
            const hasAttachment = message.attachments.size > 0;
            const hasEmbed = message.embeds.length > 0;
            const hasMediaLink = /(https?:\/\/[^\s]+)/g.test(message.content);

            if (!hasAttachment && !hasEmbed && !hasMediaLink) {
                try {
                    await message.delete();
                    const warning = await message.channel.send(
                        `<@${message.author.id}>, bu kanala sadece **resim veya video** gönderebilirsin!`
                    );
                    setTimeout(() => warning.delete().catch(() => {}), 4000);
                } catch (err) {
                    console.error('[HATA] Mesaj silinemedi:', err.message);
                }
                return;
            }
        }
    }

    // --- SPAM KORUMASI ---
    const userId = message.author.id;
    const rawContent = message.content.trim().toLowerCase();

    if (rawContent && !isAdmin) {
        const userData = spamMap.get(userId);

        if (userData) {
            const { lastMessage, count } = userData;
            if (lastMessage === rawContent) {
                const newCount = count + 1;
                if (newCount >= MAX_SAME_MESSAGES) {
                    try {
                        await message.delete();
                        const warning = await message.channel.send(
                            `<@${userId}>, lütfen aynı mesajı üst üste tekrar gönderme!`
                        );
                        setTimeout(() => warning.delete().catch(() => {}), 4000);
                    } catch (err) {
                        console.error('Spam mesajı silinirken hata:', err.message);
                    }
                    spamMap.set(userId, { lastMessage: rawContent, count: newCount });
                    return; 
                } else {
                    spamMap.set(userId, { lastMessage: rawContent, count: newCount });
                }
            } else {
                spamMap.set(userId, { lastMessage: rawContent, count: 1 });
            }
        } else {
            spamMap.set(userId, { lastMessage: rawContent, count: 1 });
        }
    }

    // --- KOMUTLAR ---
    const content = message.content.toLowerCase();

    if (content === '!davetim' || content === '!invites' || content === '!davetlerim') {
        const targetUser = message.mentions.users.first() || message.author;
        const count = userInvites.get(targetUser.id) || 0;
        const embed = new EmbedBuilder()
            .setTitle('📊 Davet İstatistikleri')
            .setDescription(`<@${targetUser.id}> kullanıcısının şu anki aktif davet sayısı: **${count}**`)
            .setColor('#38B6FF');
        return message.reply({ embeds: [embed] });
    }

    if (content === '!ip') {
        return message.reply('🎮 **CraftRiva Sunucu IP Adresi:** `oyna.craftriva.com`');
    }
    if (content === '!map') {
        return message.reply('🗺️ **CraftRiva Harita Linki:** http://178.63.186.223:25685/#towny:2431:0:-909:3375:0:0:0:0:perspective');
    }
    if (content === '!site') {
        return message.reply('🌐 **CraftRiva Web Sitesi:** https://craftriva.com/');
    }

    if (content === '!kapat') {
        // baglanti-sorunlari- kategorisi buraya da eklendi
        const destekKategorileri = ['ceza-itiraz-', 'hile-bildirim-', 'genel-destek-', 'odeme-sorunlari-', 'yetkili-sikayet-', 'bug-bildirimi-', 'klan-destegi-', 'medya-', 'baglanti-sorunlari-'];
        const isTicketChannel = destekKategorileri.some(kategori => message.channel.name.startsWith(kategori));

        if (!isTicketChannel) return message.reply('⚠️ Bu komut sadece açık olan destek talebi kanallarında kullanılabilir!').catch(() => {});

        const confirmEmbed = new EmbedBuilder()
            .setTitle('🔒 Destek Talebi Kapatma Onayı')
            .setDescription('Bu destek talebini kapatmak istediğinizden emin misiniz?\n\n*Onaylarsanız kanal 5 saniye içerisinde kalıcı olarak silinecektir.*')
            .setColor('#B22222');

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_confirm_close').setLabel('Evet, Talebi Kapat').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_cancel_close').setLabel('İptal').setEmoji('❌').setStyle(ButtonStyle.Danger)
        );

        return message.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    if (message.content === '!destek-kur') {
        if (!isAdmin) return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın!');

        const embed = new EmbedBuilder()
            .setTitle('🛡️ CraftRiva Destek & İletişim Merkezi')
            .setDescription('Sunucumuzda yaşadığınız sorunlar veya talepleriniz için aşağıdaki butonlara tıklayarak **Destek Talebi** oluşturabilirsiniz.\n\n📌 **Kurallar & Bilgilendirme:**\n• Gereksiz veya troll amaçlı talep açmak yasaktır.\n• Lütfen talebinizi oluşturduktan sonra sorununuzu detaylıca yazıp yetkililerin dönüş bekleyin.\n\n**Yardım almak istediğiniz kategoriye aşağıdaki butonlardan tıklayın:**')
            .setColor('#38B6FF')
            .setFooter({ text: 'CraftRiva Destek Sistemi', iconURL: message.guild.iconURL() });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_ceza-itiraz').setLabel('Ceza İtirazı').setEmoji('⚖️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_hile-bildirim').setLabel('Hile Bildirimi').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_genel-destek').setLabel('Genel Destek').setEmoji('📩').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_odeme-sorunlari').setLabel('Ödeme Sorunları').setEmoji('💳').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_yetkili-sikayet').setLabel('Yetkili Şikayeti').setEmoji('🚨').setStyle(ButtonStyle.Secondary)
        );

        // Bağlantı Sorunları butonu 2. satıra (row2) eklendi
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_bug-bildirimi').setLabel('Hata-Bug Bildirimi').setEmoji('🛠️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_klan-destegi').setLabel('Klan Desteği').setEmoji('📝').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_medya').setLabel('Medya').setEmoji('🎥').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_baglanti-sorunlari').setLabel('Bağlantı Sorunları').setEmoji('🔌').setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [embed], components: [row1, row2] });
        await message.delete().catch(() => {});
    }

    if (message.content.startsWith('!çekiliş-başlat')) {
        if (!isAdmin) return message.reply('Çekiliş başlatmak için **Yönetici** yetkisine sahip olmalısın!');

        const args = message.content.split(' ').slice(1);
        if (args.length < 3) return message.reply('Kullanım: `!çekiliş-başlat <süre(1m/1h/1d)> <kazanan_sayısı> <ödül>`');

        const timeInput = args[0];
        const winnerCount = parseInt(args[1]);
        const prize = args.slice(2).join(' ');

        if (isNaN(winnerCount) || winnerCount < 1) return message.reply('Geçerli bir kazanan sayısı girin!');

        let msTime = 0;
        if (timeInput.endsWith('m')) msTime = parseInt(timeInput) * 60 * 1000;
        else if (timeInput.endsWith('h')) msTime = parseInt(timeInput) * 60 * 60 * 1000;
        else if (timeInput.endsWith('d')) msTime = parseInt(timeInput) * 24 * 60 * 60 * 1000;
        else return message.reply('Geçersiz süre formatı! Dakika için `m`, saat için `h`, gün için `d` kullanın.');

        const endTime = Date.now() + msTime;

        const embed = new EmbedBuilder()
            .setTitle(`🎉 ÇEKİLİŞ: ${prize}`)
            .setDescription(`Katılmak için aşağıdaki **Katıl** butonuna tıklayın!\n\n⌛ **Bitiş:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:f>)\n👑 **Kazanan Sayısı:** ${winnerCount}\n👤 **Düzenleyen:** ${message.author}`)
            .setColor('#38B6FF')
            .setFooter({ text: 'CraftRiva Çekiliş Sistemi' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('giveaway_join').setLabel('Katıl (0)').setEmoji('🎉').setStyle(ButtonStyle.Primary)
        );

        await message.delete().catch(() => {});
        const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });

        giveaways.set(giveawayMsg.id, {
            messageId: giveawayMsg.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            prize: prize,
            winnerCount: winnerCount,
            endTime: endTime,
            participants: new Set(),
            ended: false
        });

        setTimeout(() => endGiveaway(giveawayMsg.id), msTime);
    }

    if (message.content.startsWith('!çekiliş-bitir')) {
        if (!isAdmin) return;
        const msgId = message.content.split(' ')[1];
        if (!msgId) return message.reply('Lütfen bitirmek istediğiniz çekilişin Mesaj ID\'sini yazın.');
        endGiveaway(msgId, message);
    }

    if (message.content.startsWith('!çekiliş-yeniden')) {
        if (!isAdmin) return;
        const msgId = message.content.split(' ')[1];
        if (!msgId) return message.reply('Lütfen yeniden seçmek istediğiniz çekilişin Mesaj ID\'sini yazın.');
        rerollGiveaway(msgId, message);
    }
});

// ==========================================
// --- ETKİLEŞİMLER (BUTON TIKLAMALARI) ---
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith('ticket_')) {
        const action = interaction.customId.replace('ticket_', '');

        if (action === 'confirm_close') {
            await interaction.reply({ content: '🔒 Destek talebi onaylandı. Kanal 5 saniye içinde siliniyor...', ephemeral: true });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            return;
        }

        if (action === 'cancel_close') {
            await interaction.message.delete().catch(() => {});
            return interaction.reply({ content: '❌ Kapatma işlemi iptal edildi.', ephemeral: true });
        }

        // Bağlantı Sorunları kategorisi eklendi
        const categoryMap = {
            'ceza-itiraz': 'Ceza İtirazı',
            'hile-bildirim': 'Hile Bildirimi',
            'genel-destek': 'Genel Destek',
            'odeme-sorunlari': 'Ödeme Sorunları',
            'yetkili-sikayet': 'Yetkili Şikayeti',
            'bug-bildirimi': 'Hata-Bug Bildirimi',
            'klan-destegi': 'Klan Desteği',
            'medya': 'Medya',
            'baglanti-sorunlari': 'Bağlantı Sorunları'
        };

        const categoryName = categoryMap[action] || 'Destek';
        const channelName = `${action}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) return interaction.reply({ content: `⚠️ Zaten açık bir destek talebiniz bulunuyor: ${existingChannel}`, ephemeral: true });

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: 0,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] }
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 ${categoryName} Talebi`)
                .setDescription(`Merhaba ${interaction.user}, destek talebiniz başarıyla oluşturuldu!\n\n📌 **Kategori:** ${categoryName}\n\nLütfen sorununuzu detaylı şekilde açıklayınız.\n\nYetkililerimiz en kısa sürede ilgilenecektir.`)
                .setColor('#38B6FF')
                .setFooter({ text: 'CraftRiva Destek Sistemi' });

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed] });
            await interaction.reply({ content: `✅ Destek talebiniz oluşturuldu: ${ticketChannel}`, ephemeral: true });
        } catch (error) {
            console.error('Kanal oluşturma hatası:', error);
            await interaction.reply({ content: '❌ Destek kanalı oluşturulurken hata oluştu! Bot yetkilerini kontrol edin.', ephemeral: true });
        }
    }

    if (interaction.customId === 'giveaway_join') {
        const giveawayData = giveaways.get(interaction.message.id);
        if (!giveawayData || giveawayData.ended) return interaction.reply({ content: '❌ Bu çekiliş sona ermiş!', ephemeral: true });

        if (giveawayData.participants.has(interaction.user.id)) {
            giveawayData.participants.delete(interaction.user.id);
            await interaction.reply({ content: '❌ Çekilişten katılımınızı geri çektiniz.', ephemeral: true });
        } else {
            giveawayData.participants.add(interaction.user.id);
            await interaction.reply({ content: '🎉 Çekilişe başarıyla katıldınız! Bol şans.', ephemeral: true });
        }

        const count = giveawayData.participants.size;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('giveaway_join').setLabel(`Katıl (${count})`).setEmoji('🎉').setStyle(ButtonStyle.Primary)
        );

        await interaction.message.edit({ components: [row] }).catch(() => {});
    }
});

// ==========================================
// --- ÇEKİLİŞ FONKSİYONLARI ---
// ==========================================
async function endGiveaway(messageId, commandMsg = null) {
    const data = giveaways.get(messageId);
    if (!data || data.ended) return;
    data.ended = true;

    try {
        const channel = await client.channels.fetch(data.channelId);
        const giveawayMsg = await channel.messages.fetch(data.messageId);
        const participantsArray = Array.from(data.participants);

        if (participantsArray.length === 0) {
            const endedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0]).setDescription(`⌛ **Bitiş:** Sona Erdi!\n👑 **Kazanan:** Yeterli katılım olmadı.\n👤 **Düzenleyen:** <@${data.guildId}>`).setColor('#FF0000');
            await giveawayMsg.edit({ embeds: [endedEmbed], components: [] });
            return channel.send(`🎉 **${data.prize}** çekilişi sona erdi ancak yeterli katılım olmadı.`);
        }

        const winners = [];
        const winnerCount = Math.min(data.winnerCount, participantsArray.length);
        for (let i = 0; i < winnerCount; i++) {
            const randomIndex = Math.floor(Math.random() * participantsArray.length);
            winners.push(participantsArray.splice(randomIndex, 1)[0]);
        }

        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        const endedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0]).setDescription(`⌛ **Bitiş:** Sona Erdi!\n👑 **Kazanan(lar):** ${winnerMentions}`).setColor('#2ECC71');
        
        await giveawayMsg.edit({ embeds: [endedEmbed], components: [] });
        await channel.send(`🎉 Tebrikler ${winnerMentions}! **${data.prize}** çekilişini kazandınız!`);
    } catch (err) {
        console.error('Çekiliş bitirilirken hata:', err.message);
        if (commandMsg) commandMsg.reply('Çekiliş bitirilirken bir hata oluştu.');
    }
}

async function rerollGiveaway(messageId, commandMsg) {
    const data = giveaways.get(messageId);
    if (!data) return commandMsg.reply('Bu ID ile kayıtlı bir çekiliş bulunamadı.');
    
    const participantsArray = Array.from(data.participants);
    if (participantsArray.length === 0) return commandMsg.reply('Katılımcı bulunmadığı için yeni kazanan seçilemiyor.');

    const newWinner = participantsArray[Math.floor(Math.random() * participantsArray.length)];
    commandMsg.channel.send(`🎉 Yeni kazanan seçildi! Tebrikler <@${newWinner}>, **${data.prize}** çekilişini kazandın!`);
}

// ==========================================
// --- BOTU BAŞLATMA ---
// ==========================================
client.login(process.env.TOKEN);
