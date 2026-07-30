const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    console.log(`Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

// !destek-kur komutu
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!destek-kur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🛡️ CraftRiva Destek & İletişim Merkezi')
            .setDescription(
                'Sunucumuzda yaşadığınız sorunlar veya talepleriniz için aşağıdaki menüden ilgili konuyu seçerek **Destek Talebi** oluşturabilirsiniz.\n\n' +
                '📌 **Kurallar & Bilgilendirme:**\n' +
                '• Gereksiz veya troll amaçlı talep açmak yasaktır.\n' +
                '• Lütfen talebinizi oluşturduktan sonra sorununuzu detaylıca yazıp yetkililerin dönüş yapmasını bekleyin.\n' +
                '• İşleminiz bittiğinde **"Talebi Kapat"** butonuna basarak kanalı kapatabilirsiniz.\n\n' +
                '👇 **Yardım almak istediğiniz konuyu aşağıdan seçin:**'
            )
            .setColor('#2F3136')
            .setFooter({ text: 'CraftRiva Destek Sistemi', iconURL: message.guild.iconURL() });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_kategori_sec')
            .setPlaceholder('Lütfen bir destek kategorisi seçin...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ceza İtirazı')
                    .setDescription('Aldığınız cezalara (Mute/Ban) itiraz etmek için.')
                    .setValue('ceza-itiraz')
                    .setEmoji('⚖️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Hile Bildirimi')
                    .setDescription('Hile kullanan oyuncuları bildirmek için.')
                    .setValue('hile-bildirim')
                    .setEmoji('⚠️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Genel Destek')
                    .setDescription('Sunucu içi genel soru ve yardım talepleriniz.')
                    .setValue('genel-destek')
                    .setEmoji('📩'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ödeme Sorunları')
                    .setDescription('VIP, kredi ve mağaza alım sorunları.')
                    .setValue('odeme-sorunlari')
                    .setEmoji('💳'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Yetkili Şikayeti')
                    .setDescription('Kural ihlali yaptığını düşündüğünüz yetkilileri bildirin.')
                    .setValue('yetkili-sikayet')
                    .setEmoji('🚨'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Hata-Bug Bildirimi')
                    .setDescription('Oyun içi veya sunucu hatalarını bildirmek için.')
                    .setValue('bug-bildirimi')
                    .setEmoji('🛠️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Klan Desteği')
                    .setDescription('Klanınız ile ilgili talepler ve yardımlar.')
                    .setValue('klan-destegi')
                    .setEmoji('📝')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

// Menü ve Buton Etkileşimleri
client.on('interactionCreate', async (interaction) => {
    // Kategori Menüsü Seçildiğinde
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_kategori_sec') {
        const secim = interaction.values[0];
        const guild = interaction.guild;
        const channelName = `${secim}-${interaction.user.username}`;

        // Zaten açık talebi var mı kontrol et
        const existingChannel = guild.channels.cache.find(c => c.name.toLowerCase() === channelName.toLowerCase());
        if (existingChannel) {
            return interaction.reply({ content: `Zaten bu kategoride açık bir talebiniz bulunuyor: ${existingChannel}`, ephemeral: true });
        }

        // Kategori isimlerini düzeltme
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

        // Özel Kanal Oluşturma
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${secilenIsim} Talebi`)
            .setDescription(`Merhaba <@${interaction.user.id}>, talebiniz **${secilenIsim}** kategorisinde oluşturuldu.\n\nLütfen konunuzla ilgili tüm detayları ve varsa kanıtlarınızı (ekran görüntüsü/video) buraya yazın. Yetkili ekibimiz en kısa sürede ilgilenecektir.`)
            .setColor('#57F287');

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_kapat')
                .setLabel('Talebi Kapat')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
        await interaction.reply({ content: `Destek talebiniz oluşturuldu: ${ticketChannel}`, ephemeral: true });
    }

    // Kanal Kapatma Butonu
    if (interaction.isButton() && interaction.customId === 'ticket_kapat') {
        await interaction.reply('Bu destek talebi 5 saniye içinde kapatılıp silinecektir...');
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
