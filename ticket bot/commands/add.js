import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getTicketByChannelOrRecover } from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Ajouter un membre à un ticket')
        .addUserOption(option =>
            option.setName('membre').setDescription('Utilisateur à ajouter').setRequired(true)
        ),

    async execute(interaction) {
        const member = interaction.member;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketData = await getTicketByChannelOrRecover(interaction.channel, config);
        if (!ticketData) {
            return interaction.editReply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.' });
        }

        const userToAdd = interaction.options.getUser('membre');

        try {
            await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true
            });
            await interaction.editReply({ content: `✅ ${userToAdd} a été ajouté au ticket.` });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ Impossible d\'ajouter ce membre.' });
        }
    }
};
