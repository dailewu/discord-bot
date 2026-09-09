const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');

// --- 24/7 RENDER KEEP-ALIVE (EXPRESS) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('CraftRiva Bot 7/24 Aktiftir!');
});

app.listen(PORT, () => {
    console.log(`Express sunucusu ${PORT} portunda çalışıyor.`);
});

// --- CLIENT BAŞLATMA ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// --- VERİ TABANI / DOSYA KONTROLLERİ ---
const INVITE_FILE = './invites.json';
let invitesCache = new Map();

function loadInvites() {
    if (fs.existsSync(INVITE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(INVITE_FILE, 'utf8'));
            for (const [k, v] of Object.entries(data)) {
                invitesCache.set(k, v);
            }
        } catch (e) {
            console.log('Invite dosyası okunurken hata oluştu:', e);
        }
    }
}

function saveInvites() {
    const obj = Object.fromEntries(invitesCache);
    fs.writeFileSync(INVITE_FILE, JSON.stringify(obj, null, 2));
}

// --- BOT HAZIR OLDUĞUNDA ---
client.once('ready', async () => {
    console.log(`${client.user.tag} başarıyla giriş yaptı!`);
    loadInvites();

    for (const guild of client.guilds.cache.values()) {
        try {
            const firstInvites = await guild.invites.fetch();
            const inviteMap = new Map();
            firstInvites.forEach(inv => inviteMap.set(inv.code, inv.uses));
            invitesCache.set(guild.id, Object.fromEntries(inviteMap));
        } catch (err) {
            console.log(`${guild.name} sunucusunun davetleri çekilemedi.`);
        }
    }
    saveInvites();
});

// --- DAVET TAKİBİ (INVITE TRACKER) ---
client.on('guildMemberAdd', async member => {
    const guildInvites = await member.guild.invites.fetch().catch(() => null);
    if (!guildInvites) return;

    const cachedData = invitesCache.get(member.guild.id) || {};
    const inviteMap = new Map(Object.entries(cachedData));
    
    let usedInvite = null;
    for (const inv of guildInvites.values()) {
        const oldUses = inviteMap.get(inv.code) || 0;
        if (inv.uses > oldUses) {
            usedInvite = inv;
            break;
        }
    }

    const newInviteMap = new Map();
    guildInvites.forEach(inv => newInviteMap.set(inv.code, inv.uses));
    invitesCache.set(member.guild.id, Object.fromEntries(newInviteMap));
    saveInvites();

    const welcomeChannelId = 'KANAL_ID_BURAYA'; 
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (channel && usedInvite) {
        channel.send(`🎉 Sunucumuza hoş geldin **${member.user.tag}**! Davet eden: **${usedInvite.inviter ? usedInvite.inviter.tag : 'Bilinmiyor'}** (${usedInvite.uses} davet).`);
    }
});

// --- MESAFELİ KORUMA VE KOMUTLAR ---
const PREFIX = '!';
const BLACKLISTED_WORDS = ['küfür1', 'küfür2'];

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (BLACKLISTED_WORDS.some(word => message.content.toLowerCase().includes(word))) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            message.delete().catch(() => {});
            return message.channel.send(`${message.author}, bu sunucuda bu kelimeyi kullanamazsın!`).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 4000);
            });
        }
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'site') {
        return message.channel.send(`🌐 **CraftRiva Resmi Web Sitesi:** <https://craftriva.com>`);
    }

    if (command === 'map') {
        return message.channel.send(`🗺️ **CraftRiva Harita / Dynmap:** <https://map.craftriva.com>`);
    }

    if (command === 'ip' || command === 'sürüm') {
        return message.channel.send(`📌 **Sunucu IP:** play.craftriva.com\n📌 **Sürüm:** 1.16.5 - 1.20+`);
    }

    if (command === 'sil') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('Bu komutu kullanmak için Mesajları Yönet yetkin olmalı!');
        }
        const count = parseInt(args[0]);
        if (isNaN(count) || count <= 0 || count > 100) {
            return message.reply('Lütfen 1 ile 100 arasında geçerli bir sayı belirt!');
        }
        await message.channel.bulkDelete(count, true).catch(() => {});
        const m = await message.channel.send(`🧹 Başarıyla **${count}** mesaj silindi.`);
        setTimeout(() => m.delete().catch(() => {}), 3000);
    }

    if (command === 'ticketkur') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const embed = new EmbedBuilder()
            .setTitle('🎫 CraftRiva Destek & İletişim')
            .setDescription('Sunucumuzda destek almak, yetkili şikayetinde bulunmak veya hile bildirmek için aşağıdaki butonları kullanabilirsin.')
            .setColor('#3498db')
            .setFooter({ text: 'CraftRiva Destek Sistemi' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_destek').setLabel('Destek Talebi').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
            new ButtonBuilder().setCustomId('ticket_hile').setLabel('Hile / Bug Bildir').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId('ticket_sikayet').setLabel('Yetkili Şikayet').setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(() => {});
    }
});

// --- BUTON VE MODAL ETKİLEŞİMLERİ ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('ticket_')) {
            const type = interaction.customId.split('_')[1];

            if (type === 'hile') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_hile')
                    .setTitle('Hile / Bug Bildirim Formu');

                const oyuncuInput = new TextInputBuilder()
                    .setCustomId('input_oyuncu')
                    .setLabel('Hile Kullananın Oyuncu Adı')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örn: Steve123')
                    .setRequired(true);

                const aciklamaInput = new TextInputBuilder()
                    .setCustomId('input_aciklama')
                    .setLabel('Olayın Detayı / Kanıt Linki')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Varsa video/fotoğraf linkini ekleyin.')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(oyuncuInput), new ActionRowBuilder().addComponents(aciklamaInput));
                return await interaction.showModal(modal);
            }

            if (type === 'sikayet') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_sikayet')
                    .setTitle('Yetkili Şikayet Formu');

                const yetkiliInput = new TextInputBuilder()
                    .setCustomId('input_yetkili')
                    .setLabel('Şikayet Edilen Yetkili')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Yetkilinin adı veya Etiketi')
                    .setRequired(true);

                const aciklamaInput = new TextInputBuilder()
                    .setCustomId('input_sikayet_aciklama')
                    .setLabel('Şikayet Sebebi / Detayı')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Yaşadığınız durumu ve kanıtları belirtin.')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(yetkiliInput), new ActionRowBuilder().addComponents(aciklamaInput));
                return await interaction.showModal(modal);
            }

            const guild = interaction.guild;
            // Eğer kategori ID kullanacaksan tırnak içine yaz, kullanmayacaksan null yap
            const categoryId = null; 

            const channel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    }
                ],
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`Destek Talebi: ${type.toUpperCase()}`)
                .setDescription(`Merhaba ${interaction.user}, yetkililer seninle kısa süre içinde ilgilenecektir.\nTalebi kapatmak için aşağıdaki butonu kullanabilirsin.`)
                .setColor('#3498db');

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close').setLabel('Talebi Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ content: `${interaction.user}`, embeds: [ticketEmbed], components: [closeRow] });
            await interaction.reply({ content: `✅ Bilet kanalın başarıyla oluşturuldu: ${channel}`, ephemeral: true });
        }

        else if (interaction.customId === 'ticket_close') {
            const channel = interaction.channel;
            await interaction.reply({ content: '🔒 Bilet kapatılıyor, HTML transcript hazırlanıyor...' });

            try {
                const attachment = await discordTranscripts.createTranscript(channel, {
                    limit: -1,
                    returnType: 'attachment',
                    fileName: `transcript-${channel.name}.html`,
                    saveImages: true,
                    poweredBy: false
                });

                const logChannelId = 'LOG_KANAL_ID_BURAYA';
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                
                if (logChannel) {
                    await logChannel.send({
                        content: `📁 **${channel.name}** adlı bilet kapatıldı. Kapatan yetkili/kullanıcı: ${interaction.user.tag}`,
                        files: [attachment]
                    });
                }
            } catch (err) {
                console.log('Transcript oluşturulurken hata:', err);
            }

            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 5000);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_hile') {
            const oyuncu = interaction.fields.getTextInputValue('input_oyuncu');
            const aciklama = interaction.fields.getTextInputValue('input_aciklama');

            const logChannelId = 'HİLE_LOG_KANAL_ID_BURAYA';
            const logChannel = interaction.guild.channels.cache.get(logChannelId);

            const reportEmbed = new EmbedBuilder()
                .setTitle('🚨 Yeni Hile / Bug Bildirimi')
                .addFields(
                    { name: 'Bildiren:', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                    { name: 'Bildirilen Oyuncu:', value: oyuncu, inline: true },
                    { name: 'Açıklama / Kanıt:', value: aciklama }
                )
                .setColor('#3498db')
                .setTimestamp();

            if (logChannel) {
                await logChannel.send({ embeds: [reportEmbed] });
            }

            await interaction.reply({ content: '✅ Hile bildirimin başarıyla yetkililere iletildi. Teşekkürler!', ephemeral: true });
        }

        else if (interaction.customId === 'modal_sikayet') {
            const yetkili = interaction.fields.getTextInputValue('input_yetkili');
            const aciklama = interaction.fields.getTextInputValue('input_sikayet_aciklama');

            const logChannelId = 'ŞİKAYET_LOG_KANAL_ID_BURAYA';
            const logChannel = interaction.guild.channels.cache.get(logChannelId);

            const sikayetEmbed = new EmbedBuilder()
                .setTitle('🛡️ Yeni Yetkili Şikayeti')
                .addFields(
                    { name: 'Şikayet Eden:', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                    { name: 'Şikayet Edilen Yetkili:', value: yetkili, inline: true },
                    { name: 'Şikayet Sebebi / Detay:', value: aciklama }
                )
                .setColor('#3498db')
                .setTimestamp();

            if (logChannel) {
                await logChannel.send({ embeds: [sikayetEmbed] });
            }

            await interaction.reply({ content: '✅ Yetkili şikayetiniz üst yönetime başarıyla iletildi. Teşekkürler!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN || 'SENIN_BOT_TOKENIN');
