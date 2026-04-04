import { 
    createTicket, 
    closeTicket, 
    getActiveTickets,
    saveActiveTickets
} from '../utils/ticketManager.js';
import config from '../config/config.js';

/**
 * Tente de retrouver le propriétaire du ticket depuis l'historique des messages du channel.
 * Cherche le premier utilisateur non-bot mentionné dans l'embed d'ouverture.
 */
async function recoverTicketOwner(channel) {
    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        for (const msg of messages.values()) {
            if (msg.author.bot && msg.embeds.length > 0) {
                const embed = msg.embeds[0];
                if (embed.description) {
                    // Cherche une mention utilisateur dans la description de l'embed
                    const match = embed.description.match(/<@!?(\d+)>/);
                    if (match) return match[1];
                }
            }
        }
    } catch (err) {
        console.error('Erreur récupération owner ticket:', err);
    }
    return null;
}

export default {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'create_ticket') {
            await interaction.reply({ content: 'Création du ticket...', ephemeral: true });
            const channel = await createTicket(interaction);
            if (!channel) {
                await interaction.editReply({ content: '⚠️ Tu as déjà un ticket ouvert !' });
                return;
            }
            await interaction.editReply({ content: `🎫 Ticket créé ! Accède à ton ticket ici : <#${channel.id}>` });
            return;
        }

        const activeTickets = getActiveTickets();
        let ticketEntry = Object.entries(activeTickets).find(([uid, data]) => data.channelId === interaction.channel.id);

        // 🔧 Auto-récupération : si le ticket n'est pas dans activeTickets (ex: après redémarrage),
        // on tente de retrouver le propriétaire depuis l'historique du channel.
        if (!ticketEntry) {
            const channel = interaction.channel;
            const isTicketChannel = channel.name.startsWith(config.ticketName + '-') &&
                channel.parentId === config.ticketCategory;

            if (isTicketChannel) {
                const recoveredUserId = await recoverTicketOwner(channel);
                if (recoveredUserId) {
                    // Réenregistre le ticket dans activeTickets
                    activeTickets[recoveredUserId] = { channelId: channel.id, transcriptDone: false };
                    saveActiveTickets(activeTickets);
                    ticketEntry = [recoveredUserId, activeTickets[recoveredUserId]];
                    console.log(`✅ Ticket auto-récupéré pour ${recoveredUserId} dans #${channel.name}`);
                }
            }

            if (!ticketEntry) {
                return interaction.reply({ content: '⚠️ Ce salon n\'est pas reconnu comme un ticket actif.', ephemeral: true });
            }
        }

        const [userId] = ticketEntry;

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'Fermeture du ticket dans 5 secondes...', ephemeral: true });
            setTimeout(() => closeTicket(interaction.channel, userId), 5000);
        }
    }
};
