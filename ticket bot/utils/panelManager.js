import fs from 'fs';
import path from 'path';
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import config from '../config/config.js';

const dataPath = path.join('./data/ticketPanel.json');

function getData() {
    return JSON.parse(fs.readFileSync(dataPath));
}

function saveData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export async function sendTicketPanel(client) {
    const channel = await client.channels.fetch(config.ticketPanelChannel);
    if (!channel) return console.log('Salon panel introuvable');

    const data = getData();

    if (data.messageId) {
        try {
            await channel.messages.fetch(data.messageId);
            console.log('Panel déjà présent ✅');
            return;
        } catch {
            console.log('Ancien panel supprimé, recréation...');
        }
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 Support')
        .setDescription('Clique sur le bouton ci-dessous pour créer un ticket.')
        .setColor('Blue');

    const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Créer un ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫');

    const row = new ActionRowBuilder().addComponents(button);

    const msg = await channel.send({
        embeds: [embed],
        components: [row]
    });

    data.messageId = msg.id;
    saveData(data);

    console.log('Panel ticket envoyé ✅');
}
