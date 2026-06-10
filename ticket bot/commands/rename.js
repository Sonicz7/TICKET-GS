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

        // ✅ Répondre AVANT setName (opération lente)
        await interaction.editReply({ content: `✅ Le ticket sera renommé en **${newName}**.` });

        interaction.channel.setName(newName)
            .catch(err => console.error('Erreur lors du renommage /rename :', err));
    }
};
