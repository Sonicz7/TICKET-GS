import { 
    createTicket, 
    closeTicket,
    getActiveTickets,
    getTicketByChannelOrRecover
} from '../utils/ticketManager.js';
import config from '../config/config.js';

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

        // Pour tous les autres boutons (close_ticket, etc.)
        const ticketEntry = await getTicketByChannelOrRecover(interaction.channel, config);
        if (!ticketEntry) {
            return interaction.reply({ content: '⚠️ Ce salon n\'est pas reconnu comme un ticket actif.', ephemeral: true });
        }

        const userId = ticketEntry.memberId;

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'Fermeture du ticket dans 5 secondes...', ephemeral: true });
            setTimeout(() => closeTicket(interaction.channel, userId), 5000);
        }
    }
};
