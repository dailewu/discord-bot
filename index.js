const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

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

// !destek-kur komutu ile destek panelini kanala atıyoruz
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!destek-kur') {
        // Yetki kontrolü (Sadece yönetici kullanabilsin)
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Destek Sistemi')
            .setDescription('Bir sorun yaşıyorsanız veya yetkililerle görüşmek istiyorsanız aşağıdaki **"Destek Talebi Oluştur"** butonuna tıklayın.')
            .setColor('#5865F2');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_olustur')
                .setLabel('Destek Talebi Oluştur')
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete(); // Komut mesajını temizler
    }
});

// Butonlara tıklama olayı
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Destek Talebi Açma
    if (interaction.customId === 'ticket_olustur') {
        const guild = interaction.guild;
        const channelName = `destek-${interaction.user.username}`;

        // Zaten açık bir kanalı var mı kontrol edelim
        const existingChannel = guild.channels.cache.find(c => c.name === channelName.toLowerCase());
        if (existingChannel) {
            return interaction.reply({ content: `Zaten açık bir destek talebin var: ${existingChannel}`, ephemeral: true });
        }

        // Özel kanal oluşturma (Sadece kuran kişi ve yetkililer görür)
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone için kanalı gizle
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id, // Talebi açan kişi görebilir
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`Hoş geldin ${interaction.user.username}!`)
            .setDescription('Yetkililer en kısa sürede seninle ilgilenecektir. Talebi kapatmak için aşağıdaki butona tıklayabilirsin.')
            .setColor('#57F287');

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_kapat')
                .setLabel('Talebi Kapat')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
        await interaction.reply({ content: `Destek talebin oluşturuldu: ${ticketChannel}`, ephemeral: true });
    }

    // Destek Talebi Kapatma
    if (interaction.customId === 'ticket_kapat') {
        await interaction.reply('Destek talebi 5 saniye içinde kapatılıyor...');
        setTimeout(() => {
            interaction.channel.delete();
        }, 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
