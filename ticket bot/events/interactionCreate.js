import { 
    createTicket, 
    closeTicket, 
    getActiveTickets
} from '../utils/ticketManager.js';

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
        const ticketEntry = Object.entries(activeTickets).find(([uid, data]) => data.channelId === interaction.channel.id);
        if (!ticketEntry) {
            return interaction.reply({ content: '⚠️ Ce salon n\'est pas reconnu comme un ticket actif.', ephemeral: true });
        }

        const [userId] = ticketEntry;

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'Fermeture du ticket dans 5 secondes...', ephemeral: true });
            setTimeout(() => closeTicket(interaction.channel, userId), 5000);
        }
    }
};
