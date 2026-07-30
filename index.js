require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.get('/', (req, res) => {
    res.send('Bot 7/24 aktif çalışıyor!');
});
app.listen(3000, () => {
    console.log('Uptime portu (3000) hazır.');
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    console.log(`🚀 Bot başarıyla giriş yaptı: ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    const icerik = message.content.toLowerCase();

    if (icerik === '!sa') {
        message.reply('Aleykümselam, hoş geldin!');
    }

    if (icerik === '!ping') {
        message.reply('Pong! 🏓');
    }
});

client.login(process.env.DISCORD_TOKEN);