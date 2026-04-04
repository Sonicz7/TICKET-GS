import { SlashCommandBuilder } from 'discord.js';
import { getTicketByChannel } from '../utils/ticketManager.js';
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
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
        }

        const ticketData = getTicketByChannel(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
        }

        const userToAdd = interaction.options.getUser('membre');

        try {
            await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true
            });
            return interaction.reply({ content: `✅ ${userToAdd} a été ajouté au ticket.`, ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Impossible d\'ajouter ce membre.', ephemeral: true });
        }
    }
};
