const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const http = require('http');

// Render Uptime Web Sunucusu
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CraftRiva Bot Aktif!');
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
    ]
});

// Çekiliş Verilerini Tutma
const giveaways = new Map();

client.once('ready', () => {
    console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

// Komut Dinleyicisi
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- DESTEK PANELSİ KURULUMU ---
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
        await message.delete();
    }

    // --- ÇEKİLİŞ KOMUTLARI ---

    // !çekiliş-başlat <süre> <kazanan> <ödül>
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

        await message.delete();
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

        // Zamanlayıcı
        setTimeout(() => {
            endGiveaway(giveawayMsg.id);
        }, msTime);
    }

    // !çekiliş-bitir <mesajID>
    if (message.content.startsWith('!çekiliş-bitir')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const msgId = message.content.split(' ')[1];
        if (!msgId) return message.reply('Lütfen bitirmek istediğiniz çekilişin Mesaj ID\'sini yazın.');
        endGiveaway(msgId, message);
    }

    // !çekiliş-yeniden <mesajID>
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

    // --- ÇEKİLİŞ KATILMA BUTONU ---
    if (interaction.customId === 'giveaway_join') {
        const giveaway = giveaways.get(interaction.message.id);
        if (!giveaway || giveaway.ended) {
            return interaction.reply({ content: 'Bu çekiliş sona ermiş!', flags: MessageFlags.Ephemeral });
        }

        const userId = interaction.user.id;
        if (giveaway.participants.has(userId)) {
            giveaway.participants.delete(userId);
            await interaction.reply({ content: 'Çekilişten katılımınızı çektiniz.', flags: MessageFlags.Ephemeral });
        } else {
            giveaway.participants.add(userId);
            await interaction.reply({ content: 'Çekilişe başarıyla katıldınız! 🎉', flags: MessageFlags.Ephemeral });
        }

        // Buton sayısını güncelle
        const updatedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_join')
                .setLabel(`Katıl (${giveaway.participants.size})`)
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.message.edit({ components: [updatedRow] });
    }

    // --- DESTEK TİCKET ETKİLEŞİMLERİ ---
    if (interaction.customId.startsWith('ticket_') && interaction.customId !== 'ticket_kapat') {
        const secim = interaction.customId.replace('ticket_', '');
        const guild = interaction.guild;
        const channelName = `${secim}-${interaction.user.username}`;

        const existingChannel = guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
        if (existingChannel) {
            return interaction.reply({ content: `Zaten bu kategoride açık bir talebiniz bulunuyor: ${existingChannel}`, flags: MessageFlags.Ephemeral });
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

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_kapat').setLabel('Talebi Kapat').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
        await interaction.reply({ content: `Destek talebiniz oluşturuldu: ${ticketChannel}`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'ticket_kapat') {
        await interaction.reply('Bu destek talebi 5 saniye içinde kapatılıp silinecektir...');
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

// Çekiliş Bitirme Fonksiyonu
async function endGiveaway(messageId, commandMsg = null) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway || giveaway.ended) {
        if (commandMsg) commandMsg.reply('Çekiliş bulunamadı ya da zaten sonlandırılmış.');
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

            await giveawayMsg.edit({ embeds: [endEmbed], components: [disabledRow] });
            await channel.send(`Tebrikler ${winnerMentions}! **${giveaway.prize}** kazandınız! 🥳`);
        } else {
            endEmbed = new EmbedBuilder()
                .setTitle(`🎉 ÇEKİLİŞ İPTAL EDİLDİ: ${giveaway.prize}`)
                .setDescription('Yeterli katılım olmadığı için kazanan seçilemedi.')
                .setColor('#E74C3C')
                .setFooter({ text: 'CraftRiva Çekiliş Sistemi' });

            await giveawayMsg.edit({ embeds: [endEmbed], components: [disabledRow] });
        }
    } catch (e) {
        console.error('Çekiliş sonlandırma hatası:', e);
    }
}

// Yeniden Kazanan Seçme (Reroll) Fonksiyonu
async function rerollGiveaway(messageId, commandMsg) {
    const giveaway = giveaways.get(messageId);
    if (!giveaway) return commandMsg.reply('Çekiliş bulunamadı.');

    const participantArray = Array.from(giveaway.participants);
    if (participantArray.length === 0) return commandMsg.reply('Bu çekilişte hiç katılımcı yoktu!');

    const randomWinner = participantArray[Math.floor(Math.random() * participantArray.length)];
    commandMsg.channel.send(`🎲 **Yeni Kazanan (Yedek):** <@${randomWinner}>! Tebrikler! 🎉`);
}

client.login(process.env.DISCORD_TOKEN);
