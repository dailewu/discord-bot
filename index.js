const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const http = require('http');

// Render Uptime Web Sunucusu
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Uptime portu (${PORT}) hazır.`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ]
});

// Çekiliş Verilerini Tutma
const giveaways = new Map();

// Botun Çökmesini Engelleyen Hata Yakalayıcılar
process.on('unhandledRejection', error => {
    console.error('Yakalanamayan Hata (Unhandled Rejection):', error);
});

process.on('uncaughtException', error => {
    console.error('Yakalanamayan İstisna (Uncaught Exception):', error);
});

client.once('ready', () => {
    console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

// --- OTOMATİK ROL VERME SİSTEMİ ---
client.on('guildMemberAdd', async (member) => {
    try {
        const roleName = 'Üye'; 
        const role = member.guild.roles.cache.find(r => r.name === roleName);

        if (role) {
            await member.roles.add(role);
            console.log(`${member.user.tag} kullanıcısına ${roleName} rolü verildi.`);
        } else {
            console.log(`Hata: Sunucuda "${roleName}" adında bir rol bulunamadı!`);
        }
    } catch (error) {
        console.error('Otomatik rol verilirken hata oluştu:', error);
    }
});

// Komut Dinleyicisi
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

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
                .setEmoji('✖')
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
        else return message.reply('Geçersiz süre formatı! Dakika için `m`, saat için `h`, gün için `d` kullanın. (Örn: 30m, 2h, 1d)');

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

// Buton Etkileşimleri
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    try {
        if (interaction.customId === 'giveaway_join') {
            const giveaway = giveaways.get(interaction.message.id);
            if (!giveaway || giveaway.ended) {
                return interaction.reply({ content: 'Bu çekiliş sona ermiş!', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const userId = interaction.user.id;
            if (giveaway.participants.has(userId)) {
                giveaway.participants.delete(userId);
                await interaction.reply({ content: 'Çekilişten katılımınızı çektiniz.', flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                giveaway.participants.add(userId);
                await interaction.reply({ content: 'Çekilişe başarıyla katıldınız! 🎉', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_join')
                    .setLabel(`Katıl (${giveaway.participants.size})`)
                    .setEmoji('🎉')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.message.edit({ components: [updatedRow] }).catch(() => {});
        }

        // --- BİLET OLUŞTURMA İŞLEMİ ---
        if (interaction.customId.startsWith('ticket_') && !['ticket_confirm_close', 'ticket_cancel_close'].includes(interaction.customId)) {
            const secim = interaction.customId.replace('ticket_', '');
            const guild = interaction.guild;
            const channelName = `${secim}-${interaction.user.username}`;

            const existingChannel = guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
            if (existingChannel) {
                return interaction.reply({ content: `Zaten bu kategoride açık bir talebiniz bulunuyor: ${existingChannel}`, flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const kategoriIsimleri = {
                'ceza-itiraz': 'Ceza İtirazı ⚖️',
                'hile-bildirim': 'Hile Bildirimi ⚠️',
                'genel-destek': 'Genel Destek 📩',
                'odeme-sorunlari': 'Ödeme Sorunları 💳',
                'yetkili-sikayet': 'Yetkili Şikayeti 🚨',
                'bug-bildirimi': 'Hata-Bug Bildirimi 🛠️',
                'klan-destegi': 'Klan Desteği 📝'
            };

            const secilenIsim = kategoriIsimleri[secim] || 'Destek';

            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ],
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`${secilenIsim} Talebi`)
                .setDescription(`Merhaba <@${interaction.user.id}>, talebiniz **${secilenIsim}** kategorisinde oluşturuldu.\n\nLütfen konunuzla ilgili tüm detayları ve varsa kanıtlarınızı buraya yazın. Yetkili ekibimiz en kısa sürede ilgilenecektir.`)
                .setColor('#38B6FF');

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed] });
            await interaction.reply({ content: `Destek talebiniz oluşturuldu: ${ticketChannel}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        // --- KANALI KAPATMA ONAY BUTONLARI ---
        if (interaction.customId === 'ticket_confirm_close') {
            await interaction.reply('🔒 Destek talebi onaylandı, kanal 5 saniye içinde siliniyor...').catch(() => {});
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }

        if (interaction.customId === 'ticket_cancel_close') {
            await interaction.message.delete().catch(() => {});
            await interaction.reply({ content: 'Kapatma işlemi iptal edildi.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    } catch (err) {
        console.error('Etkileşim sırasında hata oluştu:', err);
    }
});

async function endGiveaway(messageId, commandMsg = null) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway || giveaway.ended) {
        if (commandMsg) commandMsg.reply('Çekiliş bulunamadı ya da zaten sonlandırılmış.').catch(() => {});
        return;
    }

    giveaway.ended = true;

    try {
        const channel = await client.channels.fetch(giveaway.channelId);
        const giveawayMsg = await channel.messages.fetch(giveaway.messageId);

        const winners = [];
        const participantArray = Array.from(giveaway.participants);

        if (participantArray.length > 0) {
            const tempParticipants = [...participantArray];
            for (let i = 0; i < Math.min(giveaway.winnerCount, participantArray.length); i++) {
                const randomIndex = Math.floor(Math.random() * tempParticipants.length);
                winners.push(tempParticipants.splice(randomIndex, 1)[0]);
            }
        }

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_ended')
                .setLabel(`Çekiliş Sona Erdi (${giveaway.participants.size})`)
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        let endEmbed;
        if (winners.length > 0) {
            const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
            endEmbed = new EmbedBuilder()
                .setTitle(`🎉 ÇEKİLİŞ SONUÇLANDI: ${giveaway.prize}`)
                .setDescription(`👑 **Kazananlar:** ${winnerMentions}\n👤 **Katılımcı Sayısı:** ${giveaway.participants.size}`)
                .setColor('#2ECC71')
                .setFooter({ text: 'CraftRiva Çekiliş Sistemi' });

            await giveawayMsg.edit({ embeds: [endEmbed], components: [disabledRow] }).catch(() => {});
            await channel.send(`Tebrikler ${winnerMentions}! **${giveaway.prize}** kazandınız! 🥳`).catch(() => {});
        } else {
            endEmbed = new EmbedBuilder()
                .setTitle(`🎉 ÇEKİLİŞ İPTAL EDİLDİ: ${giveaway.prize}`)
                .setDescription('Yeterli katılım olmadığı için kazanan seçilemedi.')
                .setColor('#E74C3C')
                .setFooter({ text: 'CraftRiva Çekiliş Sistemi' });

            await giveawayMsg.edit({ embeds: [endEmbed], components: [disabledRow] }).catch(() => {});
        }
    } catch (e) {
        console.error('Çekiliş sonlandırma hatası:', e);
    }
}

async function rerollGiveaway(messageId, commandMsg) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway) return commandMsg.reply('Çekiliş bulunamadı.').catch(() => {});

    const participantArray = Array.from(giveaway.participants);
    if (participantArray.length === 0) return commandMsg.reply('Bu çekilişte hiç katılımcı yoktu!').catch(() => {});

    const randomWinner = participantArray[Math.floor(Math.random() * participantArray.length)];
    commandMsg.channel.send(`🎲 **Yeni Kazanan (Yedek):** <@${randomWinner}>! Tebrikler! 🎉`).catch(() => {});
}

client.login(process.env.DISCORD_TOKEN);
