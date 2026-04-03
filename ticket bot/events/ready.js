import config from '../config/config.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`ticket ${client.user.tag} est en ligne ✅`);

        const channel = await client.channels.fetch(config.ticketPanelChannel);
        const messages = await channel.messages.fetch({ limit: 100 });
        const panelExists = messages.some(msg => msg.author.id === client.user.id);

        if (panelExists) {
            console.log('Panel déjà présent ✅');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Support Tickets')
            .setDescription('Clique sur le bouton pour ouvrir un ticket.')
            .setColor('Blue');

        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Ouvrir un ticket')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await channel.send({ embeds: [embed], components: [row] });
        console.log('Panel de ticket envoyé ✅');
    }
};
