import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getTicketByChannelOrRecover } from '../utils/ticketManager.js';
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
            return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketData = await getTicketByChannelOrRecover(interaction.channel, config);
        if (!ticketData) {
            return interaction.editReply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.' });
        }

        const newName = interaction.options.getString('nom');

        try {
            await interaction.channel.setName(newName);
            await interaction.editReply({ content: `✅ Le ticket a été renommé en **${newName}**.` });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: '❌ Impossible de renommer le ticket.' });
        }
    }
};
