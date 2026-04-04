import { SlashCommandBuilder } from 'discord.js';
import { getTicketByChannel, getTicketByChannelOrRecover } from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Renommer un ticket (staff uniquement)')
        .addStringOption(option =>
            option.setName('nom').setDescription('Nouveau nom du ticket').setRequired(true)
        ),

    async execute(interaction) {
        const member = interaction.member;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
        }

        const ticketData = await getTicketByChannelOrRecover(interaction.channel, config);
        if (!ticketData) {
            return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
        }

        const newName = interaction.options.getString('nom');

        try {
            await interaction.channel.setName(newName);
            return interaction.reply({ content: `✅ Le ticket a été renommé en **${newName}**.`, ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Impossible de renommer le ticket.', ephemeral: true });
        }
    }
};
