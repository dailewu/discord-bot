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

            // Zaman sınırı yok: Kullanıcı başka bir mesaj yazmadığı sürece aynı mesajları sayar
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

                    // Sayacı 4'te tutarak sonraki aynı mesajların da silinmesini sağla
                    spamMap.set(userId, {
                        lastMessage: rawContent,
                        count: newCount
                    });
                    
                    return; // Spam tespit edildiği için altındaki komutlar çalışmasın
                } else {
                    spamMap.set(userId, {
                        lastMessage: rawContent,
                        count: newCount
                    });
                }
            } else {
                // Mesaj içeriği değiştiyse sayacı sıfırla
                spamMap.set(userId, {
                    lastMessage: rawContent,
                    count: 1
                });
            }
        } else {
            // İlk mesaj
            spamMap.set(userId, {
                lastMessage: rawContent,
                count: 1
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
