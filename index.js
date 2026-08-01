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

// Render 7/24 Uptime için basit web sunucusu
http.createServer((req, res) => {
    res.write("CraftRiva Bot Aktif!");
    res.end();
}).listen(process.env.PORT || 3000);

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

// Veri depolama (Hafıza)
const userInvites = new Map();
const invitesCache = new Map();
const spamMap = new Map();
const giveaways = new Map();

const MAX_SAME_MESSAGES = 4;

client.on('ready', async () => {
    console.log(`🤖 ${client.user.tag} olarak giriş yapıldı ve aktif!`);
    
    // Davetleri önbelleğe al
    client.guilds.cache.forEach(async (guild) => {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
        } catch (err) {
            console.log(`Davetler çekilemedi (${guild.name}):`, err.message);
        }
    });
});

// Yeni Üye Gelince (Otomatik Rol & Davet Takibi)
client.on('guildMemberAdd', async (member) => {
    try {
        const role = member.guild.roles.cache.find(r => r.name === 'Üye');
        if (role) await member.roles.add(role);
    } catch (err) {
        console.error('Otomatik rol verilemedi:', err.message);
    }

    try {
        const newInvites = await member.guild.invites.fetch();
        const oldInvites = invitesCache.get(member.guild.id);
        const invite = newInvites.find(i => oldInvites.has(i.code) && oldInvites.get(i.code) < i.uses);

        if (invite && invite.inviter) {
            const currentCount = userInvites.get(invite.inviter.id) || 0;
            userInvites.set(invite.inviter.id, currentCount + 1);
        }
        invitesCache.set(member.guild.id, new Map(newInvites.map((inv) => [inv.code, inv.uses])));
    } catch (err) {
        console.error('Davet güncellenirken hata oluştu:', err.message);
    }
});

// Komut ve Spam Dinleyicisi
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // ==========================================
    // --- SADECE YÖNETİCİ MUAFİYETLİ SPAM KORUMASI ---
    // ==========================================
    const userId = message.author.id;
    const rawContent = message.content.trim().toLowerCase();

    // Sadece Yönetici yetkisine sahip kullanıcıları muaf tut
    const isExempt = message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (rawContent && !isExempt) {
        const userData = spamMap.get(userId);

        if (userData) {
            const { lastMessage, count } = userData;

            if (lastMessage === rawContent) {
                const newCount = count + 1;

                if (newCount >= MAX_SAME_MESSAGES) { // 4 ve üzeri aynı mesaj
                    try {
                        await message.delete();
                        
                        const warning = await message.channel.send(
                            `<@${userId}>, lütfen aynı mesajı üst üste tekrar gönderme!`
                        );
                        
                        setTimeout(() => warning.delete().catch(() => {}), 4000);
                    } catch (err) {
                        console.error('Spam mesajı silinirken hata oluştu:', err.message);
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
    // ==========================================

    const content = message.content.toLowerCase();

    // --- DAVET SORGULAMA KOMUTU (!davetim / !invites) ---
    if (content === '!davetim' || content === '!invites') {
        const targetUser = message.mentions.users.first() || message.author;
        const count = userInvites.get(targetUser.id) || 0;

        const embed = new EmbedBuilder()
            .setTitle('📊 Davet İstatistikleri')
            .setDescription(`<@${targetUser.id}> kullanıcısının şu anki aktif davet sayısı: **${count}**`)
            .setColor('#38B6FF');

        return message.reply({ embeds: [embed] });
    }

    // --- SUNUCU BİLGİ KOMUTLARI (!ip, !map, !site) ---
    if (content === '!ip') {
        return message.reply('🎮 **CraftRiva Sunucu IP Adresi:** `oyna.craftriva.com`');
    }

    if (content === '!map') {
        return message.reply('🗺️ **CraftRiva Harita Linki:** http://178.63.186.223:25685/#towny:2431:0:-909:3375:0:0:0:0:perspective');
    }

    if (content === '!site') {
        return message.reply('🌐 **CraftRiva Web Sitesi:** https://craftriva.com/');
    }

    // --- DESTEK KAPATMA KOMUTU (!kapat) ---
    if (content === '!kapat') {
        const destekKategorileri = ['ceza-itiraz-', 'hile-bildirim-', 'genel-destek-', 'odeme-sorunlari-', 'yetkili-sikayet-', 'bug-bildirimi-', 'klan-destegi-'];
        const isTicketChannel = destekKategorileri.some(kategori => message.channel.name.startsWith(kategori));

        if (!isTicketChannel) {
            return message.reply('⚠️ Bu komut sadece açık olan destek talebi kanallarında kullanılabilir!').catch(() => {});
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle('🔒 Destek Talebi Kapatma Onayı')
            .setDescription('Bu destek talebini kapatmak istediğinizden emin misiniz?\n\n*Onaylarsanız kanal 5 saniye içerisinde kalıcı olarak silinecektir.*')
            .setColor('#B22222');

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_confirm_close')
                .setLabel('Evet, Talebi Kapat')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_cancel_close')
                .setLabel('İptal')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

        return message.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    // --- DESTEK PANELİ KURULUMU ---
    if (message.content === '!destek-kur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🛡️ CraftRiva Destek & İletişim Merkezi')
            .setDescription(
                'Sunucumuzda yaşadığınız sorunlar veya talepleriniz için aşağıdaki butonlara tıklayarak **Destek Talebi** oluşturabilirsiniz.\n\n' +
                '📌 **Kurallar & Bilgilendirme:**\n' +
                '• Gereksiz veya troll amaçlı talep açmak yasaktır.\n' +
                '• Lütfen talebinizi oluşturduktan sonra sorununuzu detaylıca yazıp yetkililerin dönüş yapmasını bekleyin.\n\n' +
                '**Yardım almak istediğiniz kategoriye aşağıdaki butonlardan tıklayın:**'
            )
            .setColor('#38B6FF')
            .setFooter({ text: 'CraftRiva Destek Sistemi', iconURL: message.guild.iconURL() });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_ceza-itiraz').setLabel('Ceza İtirazı').setEmoji('⚖️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_hile-bildirim').setLabel('Hile Bildirimi').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_genel-destek').setLabel('Genel Destek').setEmoji('📩').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_odeme-sorunlari').setLabel('Ödeme Sorunları').setEmoji('💳').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_yetkili-sikayet').setLabel('Yetkili Şikayeti').setEmoji('🚨').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_bug-bildirimi').setLabel('Hata-Bug Bildirimi').setEmoji('🛠️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_klan-destegi').setLabel('Klan Desteği').setEmoji('📝').setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [embed], components: [row1, row2] });
        await message.delete().catch(() => {});
    }

    // --- ÇEKİLİŞ KOMUTLARI ---
    if (message.content.startsWith('!çekiliş-başlat')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Çekiliş başlatmak için **Yönetici** yetkisine sahip olmalısın!');
        }

        const args = message.content.split(' ').slice(1);
        if (args.length < 3) {
            return message.reply('Kullanım: `!çekiliş-başlat <süre(1m/1h/1d)> <kazanan_sayısı> <ödül>`\nÖrnek: `!çekiliş-başlat 10m 1 VIP Üyelik`');
        }

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
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel('Katıl (0)')
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary)
        );

        await message.delete().catch(() => {});
        const giveawayMsg = await message.channel.send({ embeds: [embed], components: [row] });

        const giveawayData = {
            messageId: giveawayMsg.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            prize: prize,
            winnerCount: winnerCount,
            endTime: endTime,
            participants: new Set(),
            ended: false
        };

        giveaways.set(giveawayMsg.id, giveawayData);

        setTimeout(() => {
            endGiveaway(giveawayMsg.id);
        }, msTime);
    }

    if (message.content.startsWith('!çekiliş-bitir')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const msgId = message.content.split(' ')[1];
        if (!msgId) return message.reply('Lütfen bitirmek istediğiniz çekilişin Mesaj ID\'sini yazın.');
        endGiveaway(msgId, message);
    }

    if (message.content.startsWith('!çekiliş-yeniden')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const msgId = message.content.split(' ')[1];
        if (!msgId) return message.reply('Lütfen yeniden seçmek istediğiniz çekilişin Mesaj ID\'sini yazın.');
        rerollGiveaway(msgId, message);
    }
});

// Buttolar ve Etkileşimler (Ticket & Çekiliş)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // --- DESTEK TALEBİ BUTONLARI ---
    if (interaction.customId.startsWith('ticket_')) {
        const action = interaction.customId.replace('ticket_', '');

        if (action === 'confirm_close') {
            await interaction.reply({ content: '🔒 Destek talebi onaylandı. Kanal 5 saniye içinde siliniyor...', ephemeral: true });
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
            return;
        }

        if (action === 'cancel_close') {
            await interaction.message.delete().catch(() => {});
            return interaction.reply({ content: '❌ Kapatma işlemi iptal edildi.', ephemeral: true });
        }

        // Kategori isimleri
        const categoryMap = {
            'ceza-itiraz': 'Ceza İtirazı',
            'hile-bildirim': 'Hile Bildirimi',
            'genel-destek': 'Genel Destek',
            'odeme-sorunlari': 'Ödeme Sorunları',
            'yetkili-sikayet': 'Yetkili Şikayeti',
            'bug-bildirimi': 'Hata-Bug Bildirimi',
            'klan-destegi': 'Klan Desteği'
        };

        const categoryName = categoryMap[action] || 'Destek';
        const channelName = `${action}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.reply({ content: `⚠️ Zaten açık bir destek talebiniz bulunuyor: ${existingChannel}`, ephemeral: true });
        }

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: 0, // GUILD_TEXT
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 ${categoryName} Talebi`)
                .setDescription(
                    `Merhaba ${interaction.user}, destek talebiniz başarıyla oluşturuldu!\n\n` +
                    `📌 **Kategori:** ${categoryName}\n` +
                    `Lütfen sorununuzu, kullanıcı adınızı ve varsa ekran görüntülerinizi buraya yazın. Yetkililerimiz en kısa sürede ilgilenecektir.\n\n` +
                    `*Talebi kapatmak için ` + '`!kapat`' + ` yazabilirsiniz.*`
                )
                .setColor('#38B6FF')
                .setFooter({ text: 'CraftRiva Destek Sistemi' });

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed] });
            await interaction.reply({ content: `✅ Destek talebiniz oluşturuldu: ${ticketChannel}`, ephemeral: true });
        } catch (error) {
            console.error('Kanal oluşturma hatası:', error);
            await interaction.reply({ content: '❌ Destek kanalı oluşturulurken bir hata oluştu! Lütfen bot yetkilerini kontrol edin.', ephemeral: true });
        }
    }

    // --- ÇEKİLİŞ BUTONU ---
    if (interaction.customId === 'giveaway_join') {
        const giveawayData = giveaways.get(interaction.message.id);
        if (!giveawayData || giveawayData.ended) {
            return interaction.reply({ content: '❌ Bu çekiliş sona ermiş!', ephemeral: true });
        }

        if (giveawayData.participants.has(interaction.user.id)) {
            giveawayData.participants.delete(interaction.user.id);
            await interaction.reply({ content: '❌ Çekilişten katılımınızı geri çektiniz.', ephemeral: true });
        } else {
            giveawayData.participants.add(interaction.user.id);
            await interaction.reply({ content: '🎉 Çekilişe başarıyla katıldınız! Bol şans.', ephemeral: true });
        }

        const count = giveawayData.participants.size;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel(`Katıl (${count})`)
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.message.edit({ components: [row] }).catch(() => {});
    }
});

// Çekiliş Bitirme Fonksiyonu
async function endGiveaway(messageId, commandMsg = null) {
    const data = giveaways.get(messageId);
    if (!data || data.ended) return;

    data.ended = true;

    try {
        const channel = await client.channels.fetch(data.channelId);
        const giveawayMsg = await channel.messages.fetch(data.messageId);

        const participantsArray = Array.from(data.participants);

        if (participantsArray.length === 0) {
            const endedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0])
                .setDescription(`⌛ **Bitiş:** Sona Erdi!\n👑 **Kazanan:** Yeterli katılım olmadı.\n👤 **Düzenleyen:** <@${data.guildId}>`)
                .setColor('#FF0000');

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

        const endedEmbed = EmbedBuilder.from(giveawayMsg.embeds[0])
            .setDescription(`⌛ **Bitiş:** Sona Erdi!\n👑 **Kazanan(lar):** ${winnerMentions}`)
            .setColor('#2ECC71');

        await giveawayMsg.edit({ embeds: [endedEmbed], components: [] });
        await channel.send(`🎉 Tebrikler ${winnerMentions}! **${data.prize}** çekilişini kazandınız!`);
    } catch (err) {
        console.error('Çekiliş bitirilirken hata:', err.message);
        if (commandMsg) commandMsg.reply('Çekiliş bitirilirken bir hata oluştu. Mesaj ID\'sini kontrol edin.');
    }
}

// Çekiliş Yeniden Seçme Fonksiyonu
async function rerollGiveaway(messageId, commandMsg) {
    const data = giveaways.get(messageId);
    if (!data) return commandMsg.reply('Bu ID ile kayıtlı bir çekiliş bulunamadı.');

    const participantsArray = Array.from(data.participants);
    if (participantsArray.length === 0) return commandMsg.reply('Katılımcı bulunmadığı için yeni kazanan seçilemiyor.');

    const newWinner = participantsArray[Math.floor(Math.random() * participantsArray.length)];
    commandMsg.channel.send(`🎉 Yeni kazanan seçildi! Tebrikler <@${newWinner}>, **${data.prize}** çekilişini kazandın!`);
}

// Bot Girişi
client.login(process.env.TOKEN);
