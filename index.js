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
                .setEmoji('✖') // Net görünen metin içi çarpı sembolü
                .setStyle(ButtonStyle.Danger)
        );

        return message.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
    }
