import { 
    createTicket, 
    closeTicket, 
    getActiveTickets, 
    saveActiveTickets, 
    generateTranscript 
} from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const member = interaction.member;

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
            return interaction.reply({ content: '⚠️ Ce salon n’est pas reconnu comme un ticket actif.', ephemeral: true });
        }

        const [userId, ticketData] = ticketEntry;

        if (interaction.customId === 'ticket_transcript') {
    if (!member.roles.cache.has(config.staffRole)) {
        return interaction.reply({ content: '❌ Seuls les staff peuvent générer le transcript.', ephemeral: true });
    }

    const transcriptPath = await generateTranscript(interaction.channel);
    ticketData.transcriptDone = true;
    saveActiveTickets(activeTickets);

    const transcriptChannel = interaction.guild.channels.cache.get(config.transcriptChannel);
    if (transcriptChannel) {
        await transcriptChannel.send({
            content: `📄 Transcript du ticket ${interaction.channel.name} généré par ${member}`,
            files: [transcriptPath]
        });
    }

    return interaction.reply({ content: '📄 Transcript généré et envoyé dans le salon staff !', ephemeral: true });
}

        if (interaction.customId === 'close_ticket') {
            if (!ticketData.transcriptDone && !member.roles.cache.has(config.staffRole)) {
                return interaction.reply({
                    content: '⚠️ Veuillez attendre qu’un membre du staff génère le transcript avant de fermer le ticket.',
                    ephemeral: true
                });
            }

            await interaction.reply({ content: 'Fermeture du ticket dans 5 secondes...', ephemeral: true });
            setTimeout(() => closeTicket(interaction.channel, userId), 5000);
        }
    }
};
