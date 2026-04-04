import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getTicketByChannel, getTicketByChannelOrRecover } from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('entretien')
        .setDescription('Proposer un entretien au candidat (staff uniquement)'),

    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
        }

        const ticketData = await getTicketByChannelOrRecover(channel, config);
        if (!ticketData) {
            return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
        }

        const candidatId = ticketData.memberId;
        const candidat = await guild.members.fetch(candidatId).catch(() => null);

        try {
            await channel.setName(`entretien-${candidat ? candidat.user.username : 'candidat'}`);

            const embed = new EmbedBuilder()
                .setTitle('Entretien')
                .setDescription(`${candidat ? `<@${candidatId}>` : 'Le candidat'} a été sélectionné(e) pour un entretien.\n\nMerci de nous indiquer tes disponibilités pour convenir d'un créneau ensemble.`)
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.reply({ content: `<@${candidatId}>`, embeds: [embed] });

        } catch (err) {
            console.error('Erreur lors de la commande /entretien :', err);
            return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }
};
