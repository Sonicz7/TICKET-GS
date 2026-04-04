import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getTicketByChannel } from '../utils/ticketManager.js';
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
            return interaction.reply({
                content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.',
                ephemeral: true
            });
        }

        const ticketData = getTicketByChannel(channel.id);
        if (!ticketData) {
            return interaction.reply({
                content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.',
                ephemeral: true
            });
        }

        const candidatId = ticketData.memberId;
        const candidat = await guild.members.fetch(candidatId).catch(() => null);

        try {
            // Rename le ticket
            await channel.setName(`entretien-${candidat ? candidat.user.username : 'candidat'}`);

            const embed = new EmbedBuilder()
                .setTitle('📋 Convocation à un entretien')
                .setDescription(
                    `Salut ${candidat ? `<@${candidatId}>` : 'candidat'} ! 👋\n\n` +
                    `Après avoir examiné ta candidature avec attention, nous sommes ravis de t'informer que **nous souhaiterions te rencontrer en entretien** afin d'en apprendre davantage sur toi.\n\n` +
                    `Pourrais-tu nous indiquer **tes disponibilités** pour qu'on puisse convenir d'un créneau ensemble ?\n\n` +
                    `> Merci de préciser les **jours et horaires** qui te conviennent le mieux.\n` +
                    `On reste disponibles si tu as la moindre question. À très vite !`
                )
                .setColor(0x5865F2)
                .setFooter({ text: 'GS • Recrutement' })
                .setTimestamp();

            // Ping hors embed
            await interaction.reply({
                content: `<@${candidatId}>`,
                embeds: [embed]
            });

        } catch (err) {
            console.error('Erreur lors de la commande /entretien :', err);
            return interaction.reply({
                content: '❌ Une erreur est survenue.',
                ephemeral: true
            });
        }
    }
};
