const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags, Collection } = require('discord.js');
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
        GatewayIntentBits.GuildInvites
    ]
});

// Davet Verilerini Önbellekte Tutma Maps
const invitesCache = new Collection(); 
const userInvites = new Map(); 
const memberInviter = new Map(); 

// Çekiliş Verilerini Tutma
const giveaways = new Map();

// --- SPAM KORUMASI VERİ YAPISI ---
const spamMap = new Map();
const MAX_SAME_MESSAGES = 4; // 4. ve üstü aynı mesaj silinecek
const SPAM_TIME_LIMIT = 5000; // 5 saniyelik zaman penceresi

// Botun Çökmesini Engelleyen Hata Yakalayıcılar
process.on('unhandledRejection', error => {
    console.error('Yakalanamayan Hata (Unhandled Rejection):', error);
});

process.on('uncaughtException', error => {
    console.error('Yakalanamayan İstisna (Uncaught Exception):', error);
});

// Bot Hazır Olduğunda Davetleri Önbelleğe Al
client.once('ready', async () => {
    console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);

    client.guilds.cache.forEach(async (guild) => {
        try {
            const firstInvites = await guild.invites.fetch();
            const codeUses = new Collection();
            firstInvites.forEach((inv) => codeUses.set(inv.code, inv.uses));
            invitesCache.set(guild.id, codeUses);
        } catch (err) {
            console.log(`Davetler çekilirken hata (${guild.name}):`, err.message);
        }
    });
});

// Yeni Davet Oluşturulduğunda Önbelleği Güncelle
client.on('inviteCreate', async (invite) => {
    const guildInvites = invitesCache.get(invite.guild.id) || new Collection();
    guildInvites.set(invite.code, invite.uses);
    invitesCache.set(invite.guild.id, guildInvites);
});

// Davet Silindiğinde Önbelleği Güncelle
client.on('inviteDelete', async (invite) => {
    const guildInvites = invitesCache.get(invite.guild.id);
    if (guildInvites) {
        guildInvites.delete(invite.code);
    }
});

// --- OTOMATİK ROL VE DAVET TAKİBİ (GİRİŞ) ---
client.on('guildMemberAdd', async (member) => {
    try {
        // 1. Otomatik Rol Verme
        const roleName = 'Üye'; 
        const role = member.guild.roles.cache.find(r => r.name === roleName);
        if (role) await member.roles.add(role).catch(() => {});

        // 2. Davet Takibi
        const newInvites = await member.guild.invites.fetch();
        const oldInvites = invitesCache.get(member.guild.id) || new Collection();
        
        const invite = newInvites.find((i) => i.uses > (oldInvites.get(i.code) || 0));
        
        const codeUses = new Collection();
        newInvites.forEach((inv) => codeUses.set(inv.code, inv.uses));
        invitesCache.set(member.guild.id, codeUses);

        // Belirtilen Davet Kanalı
        const inviteChannel = member.guild.channels.cache.find(c => c.name === '✉️┃invite-kanalı' || c.name === 'invite-kanalı');

        if (invite) {
            const inviter = invite.inviter;
            if (inviter) {
                const currentCount = userInvites.get(inviter.id) || 0;
                const newCount = currentCount + 1;
                userInvites.set(inviter.id, newCount);

                memberInviter.set(member.id, inviter.id);

                if (inviteChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('📥 Yeni Üye Katıldı!')
                        .setDescription(`Aramıza hoş geldin <@${member.id}>!\n\n👤 **Davet Eden:** <@${inviter.id}>\n📊 **Toplam Davet Sayısı:** \`${newCount}\``)
                        .setColor('#2ECC71')
                        .setThumbnail(member.user.displayAvatarURL())
                        .setTimestamp();

                    inviteChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        } else {
            if (inviteChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('📥 Yeni Üye Katıldı!')
                    .setDescription(`Aramıza hoş geldin <@${member.id}>!\n\n❓ **Davet Eden:** Bulunamadı (Özel URL veya Bot)`)
                    .setColor('#3498DB')
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp();

                inviteChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    } catch (error) {
        console.error('Giriş takibinde hata oluştu:', error);
    }
});

// --- DAVET DÜŞÜRME TAKİBİ (ÇIKIŞ) ---
client.on('guildMemberRemove', async (member) => {
    try {
        const inviterId = memberInviter.get(member.id);
        const inviteChannel = member.guild.channels.cache.find(c => c.name === '✉️┃invite-kanalı' || c.name === 'invite-kanalı');

        if (inviterId) {
            const currentCount = userInvites.get(inviterId) || 0;
            const newCount = Math.max(0, currentCount - 1);
            userInvites.set(inviterId, newCount);

            memberInviter.delete(member.id);

            if (inviteChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('📤 Üye Ayrıldı')
                    .setDescription(`**${member.user.tag}** sunucudan ayrıldı.\n\n👤 **Davet Eden:** <@${inviterId}>\n📉 **Güncel Davet Sayısı:** \`${newCount}\``)
                    .setColor('#E74C3C')
                    .setTimestamp();

                inviteChannel.send({ embeds: [embed] }).catch(() => {});
            }
        } else {
            if (inviteChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('📤 Üye Ayrıldı')
                    .setDescription(`**${member.user.tag}** sunucudan ayrıldı.`)
                    .setColor('#95A5A6')
                    .setTimestamp();

                inviteChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    } catch (error) {
        console.error('Çıkış takibinde hata oluştu:', error);
    }
});

// Komut Dinleyicisi
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // ==========================================
    // --- SPAM KORUMASI SİSTEMİ ---
    // ==========================================
    const userId = message.author.id;
    const rawContent = message.content.trim();

    if (rawContent) {
        const now = Date.now();
        const userData = spamMap.get(userId);

        if (userData) {
            const { lastMessage, count, lastTimestamp } = userData;

            if (lastMessage === rawContent && (now - lastTimestamp) < SPAM_TIME_LIMIT) {
                const newCount = count + 1;

                if (newCount >= MAX_SAME_MESSAGES) {
                    try {
                        await message.delete();
                        
                        const warning = await message.channel.send(
                            `<@${userId}>, lütfen aynı mesajı üst üste tekrar gönderme!`
                        );
                        
                        setTimeout(() => warning.delete().catch(() => {}), 4000);
                    } catch (err) {
                        console.error('Spam mesajı silinirken hata oluştu:', err.message);
                    }

                    spamMap.set(userId, {
                        lastMessage: rawContent,
                        count: newCount,
                        lastTimestamp: now
                    });
                    
                    // Spam tespit edildiği için komut işlemlerine geçilmesin
                    return;
                } else {
                    spamMap.set(userId, {
                        lastMessage: rawContent,
                        count: newCount,
                        lastTimestamp: now
                    });
                }
            } else {
                spamMap.set(userId, {
                    lastMessage: rawContent,
                    count: 1,
                    lastTimestamp: now
                });
            }
        } else {
            spamMap.set(userId, {
                lastMessage: rawContent,
                count: 1,
                lastTimestamp: now
            });
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

            const supportRole = guild.roles.cache.find(r => r.name === 'Destek Yetkilisi');

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            ];

            if (supportRole) {
                permissionOverwrites.push({
                    id: supportRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                });
            }

            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: permissionOverwrites,
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`${secilenIsim} Talebi`)
                .setDescription(`Merhaba <@${interaction.user.id}>, talebiniz **${secilenIsim}** kategorisinde oluşturuldu.\n\nLütfen konunuzla ilgili tüm detayları ve varsa kanıtlarınızı buraya yazın. Yetkili ekibimiz en kısa sürede ilgilenecektir.`)
                .setColor('#38B6FF');

            const mentionText = supportRole ? `<@${interaction.user.id}> | <@&${supportRole.id}>` : `<@${interaction.user.id}>`;

            await ticketChannel.send({ content: mentionText, embeds: [ticketEmbed] });
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
