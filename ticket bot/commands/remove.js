import { SlashCommandBuilder } from 'discord.js';
import { getTicketByChannel } from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Retirer un membre d\'un ticket')
        .addUserOption(option =>
            option.setName('membre').setDescription('Utilisateur à retirer').setRequired(true)
        ),

    async execute(interaction) {
        const member = interaction.member;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
        }

        const ticketData = getTicketByChannel(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
        }

        const userToRemove = interaction.options.getUser('membre');

        try {
            await interaction.channel.permissionOverwrites.edit(userToRemove.id, {
                ViewChannel: false, SendMessages: false, ReadMessageHistory: false
            });
            return interaction.reply({ content: `✅ ${userToRemove} a été retiré du ticket.`, ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Impossible de retirer ce membre.', ephemeral: true });
        }
    }
};
