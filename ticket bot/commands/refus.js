import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getActiveTickets, saveActiveTickets, getTicketByChannelOrRecover } from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('refus')
        .setDescription('Refuser un ticket (staff uniquement)'),

    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketData = await getTicketByChannelOrRecover(channel, config);
        if (!ticketData) {
            return interaction.editReply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.' });
        }

        const activeTickets = getActiveTickets();
        const candidatId = ticketData.memberId;

        // ✅ Supprimer du registre et répondre AVANT les opérations lentes
        delete activeTickets[candidatId];
        saveActiveTickets(activeTickets);

        await interaction.editReply({ content: '✅ Le ticket a été refusé et sera déplacé sous peu.' });

        // Opérations lentes après la réponse
        (async () => {
            try {
                await channel.setName('refus-❌');
                await channel.setParent(config.refusCategory);
                await channel.permissionOverwrites.set([
                    { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
                    { id: config.staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                    { id: config.viewerRole, allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages'] }
                ]);
            } catch (err) {
                console.error('Erreur lors du déplacement du salon /refus :', err);
            }
        })();
    }
};
