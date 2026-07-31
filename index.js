const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const http = require('http');

// Render Uptime Web Sunucusu (Port 3000)
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
                'Sunucumuzda yaşadığınız sorunlar veya talepleriniz için aşağıdaki butonlara tıklayarak **Destek Talebi** oluşturabilirsiniz.\n\n' +
                '📌 **Kurallar & Bilgilendirme:**\n' +
                '• Gereksiz veya troll amaçlı talep açmak yasaktır.\n' +
                '• Lütfen talebinizi oluşturduktan sonra sorununuzu detaylıca yazıp yetkililerin dönüş yapmasını bekleyin.\n\n' +
                '**Yardım almak istediğiniz kategoriye aşağıdaki butonlardan tıklayın:**'
            )
            .setColor('#38B6FF')
            .setFooter({ text: 'CraftRiva Destek Sistemi', iconURL: message.guild.iconURL() });

        // İlk Sıra Butonlar (Gri Stil)
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_ceza-itiraz')
                .setLabel('Ceza İtirazı')
                .setEmoji('⚖️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_hile-bildirim')
                .setLabel('Hile Bildirimi')
                .setEmoji('⚠️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_genel-destek')
                .setLabel('Genel Destek')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_odeme-sorunlari')
                .setLabel('Ödeme Sorunları')
                .setEmoji('💳')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_yetkili-sikayet')
                .setLabel('Yetkili Şikayeti')
                .setEmoji('🚨')
                .setStyle(ButtonStyle.Secondary)
        );

        // İkinci Sıra Butonlar (Gri Stil)
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_bug-bildirimi')
                .setLabel('Hata-Bug Bildirimi')
                .setEmoji('🛠️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_klan-destegi')
                .setLabel('Klan Desteği')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ embeds: [embed], components: [row1, row2] });
        await message.delete();
    }
});

// Buton Etkileşimleri
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Destek Talebi Açma
    if (interaction.customId.startsWith('ticket_') && interaction.customId !== 'ticket_kapat') {
        const secim = interaction.customId.replace('ticket_', '');
        const guild = interaction.guild;
        const channelName = `${secim}-${interaction.user.username}`;

        // Zaten açık talebi var mı kontrol et
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
            .setColor('#38B6FF');

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_kapat')
                .setLabel('Talebi Kapat')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
        await interaction.reply({ content: `Destek talebiniz oluşturuldu: ${ticketChannel}`, flags: MessageFlags.Ephemeral });
    }

    // Kanal Kapatma Butonu
    if (interaction.customId === 'ticket_kapat') {
        await interaction.reply('Bu destek talebi 5 saniye içinde kapatılıp silinecektir...');
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
