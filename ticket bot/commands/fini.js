import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getActiveTickets, saveActiveTickets, getTicketByChannel, generateTranscript } from '../utils/ticketManager.js';
import config from '../config/config.js';

const ACCEPTE_CATEGORY = '1487854009502007317';

export default {
    data: new SlashCommandBuilder()
        .setName('fini')
        .setDescription('Clôturer un ticket après formation (staff uniquement)'),

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
        const activeTickets = getActiveTickets();

        await interaction.reply({
            content: '⏳ Clôture du ticket en cours...',
            ephemeral: true
        });

        try {
            // Générer le transcript avant de fermer
            const transcriptPath = await generateTranscript(channel);
            const transcriptChannel = guild.channels.cache.get(config.transcriptChannel);
            if (transcriptChannel && transcriptPath) {
                await transcriptChannel.send({
                    content: `📄 Transcript du ticket \`${channel.name}\` — formation terminée pour ${candidat ? `<@${candidatId}>` : 'candidat'} (clôturé par ${member})`,
                    files: [transcriptPath]
                });
            }

            // Retirer le candidat du ticket (supprimer de activeTickets)
            delete activeTickets[candidatId];
            saveActiveTickets(activeTickets);

            // Renommer le ticket + déplacer dans "candidatures acceptées"
            await channel.setName(`fini-${candidat ? candidat.user.username : 'candidat'}`);
            await channel.setParent(ACCEPTE_CATEGORY);

            // Retirer l'accès au candidat, garder que le staff
            await channel.permissionOverwrites.set([
                {
                    id: guild.roles.everyone.id,
                    deny: ['ViewChannel']
                },
                {
                    id: config.staffRole,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]);

            const embed = new EmbedBuilder()
                .setTitle('✅ Formation terminée')
                .setDescription(
                    `Le ticket de ${candidat ? `**${candidat.user.username}**` : 'ce candidat'} a été **clôturé** suite à la fin de sa formation.\n\n` +
                    `Le transcript a été sauvegardé et le salon a été archivé.`
                )
                .setColor(0xED4245)
                .setFooter({ text: `Clôturé par ${member.user.username} • Gang Squad` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

        } catch (err) {
            console.error('Erreur lors de la commande /fini :', err);
            return interaction.followUp({
                content: '❌ Une erreur est survenue lors de la clôture.',
                ephemeral: true
            });
        }
    }
};
