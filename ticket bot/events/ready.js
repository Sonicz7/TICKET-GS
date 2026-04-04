import config from '../config/config.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getActiveTickets, saveActiveTickets } from '../utils/ticketManager.js';

/**
 * Synchronise les tickets actifs au démarrage du bot.
 * Parcourt tous les channels de la catégorie ticket et les réenregistre dans activeTickets.json
 * si ils n'y sont pas déjà, en retrouvant l'owner depuis l'historique des messages.
 */
async function syncActiveTickets(client) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const activeTickets = getActiveTickets();
        const knownChannelIds = new Set(Object.values(activeTickets).map(t => t.channelId));

        let synced = 0;
        for (const [, channel] of guild.channels.cache) {
            if (channel.parentId !== config.ticketCategory) continue;
            if (knownChannelIds.has(channel.id)) continue;

            // Tente de retrouver l'owner depuis l'embed d'ouverture
            try {
                const messages = await channel.messages.fetch({ limit: 15 });
                for (const msg of messages.values()) {
                    if (msg.author.bot && msg.embeds.length > 0) {
                        const match = msg.embeds[0]?.description?.match(/<@!?(\d+)>/);
                        if (match) {
                            const userId = match[1];
                            if (!activeTickets[userId]) {
                                activeTickets[userId] = { channelId: channel.id, transcriptDone: false };
                                synced++;
                                console.log(`🔄 Ticket synchronisé: #${channel.name} → userId:${userId}`);
                            }
                            break;
                        }
                    }
                }
            } catch { /* channel inaccessible, on passe */ }
        }

        if (synced > 0) {
            saveActiveTickets(activeTickets);
            console.log(`✅ ${synced} ticket(s) resynchronisé(s) au démarrage.`);
        } else {
            console.log('✅ activeTickets.json déjà à jour.');
        }
    } catch (err) {
        console.error('Erreur sync tickets au démarrage:', err);
    }
}

export default {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`ticket ${client.user.tag} est en ligne ✅`);

        // 🔧 Resynchronise les tickets actifs après un redémarrage
        await syncActiveTickets(client);

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
