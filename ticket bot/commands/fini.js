import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getActiveTickets, saveActiveTickets, getTicketByChannelOrRecover, generateTranscript } from '../utils/ticketManager.js';
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
            return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const ticketData = await getTicketByChannelOrRecover(channel, config);
        if (!ticketData) {
            return interaction.editReply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.' });
        }

        const candidatId = ticketData.memberId;
        const candidat = await guild.members.fetch(candidatId).catch(() => null);
        const activeTickets = getActiveTickets();

        try {
            // Transcript (opération async mais relativement rapide)
            const transcriptPath = await generateTranscript(channel);
            const transcriptChannel = guild.channels.cache.get(config.transcriptChannel);
            if (transcriptChannel && transcriptPath) {
                await transcriptChannel.send({
                    content: `📄 Transcript du ticket \`${channel.name}\` — formation terminée pour ${candidat ? `<@${candidatId}>` : 'candidat'} (clôturé par ${member})`,
                    files: [transcriptPath]
                });
            }

            delete activeTickets[candidatId];
            saveActiveTickets(activeTickets);

            // Embed dans le salon du ticket
            const embed = new EmbedBuilder()
                .setTitle('Formation terminée')
                .setDescription(`Le ticket de ${candidat ? `<@${candidatId}>` : 'ce candidat'} a été clôturé.\n\nLe transcript a été sauvegardé et le salon a été archivé.`)
                .setColor(0xED4245)
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            // ✅ Répondre à l'interaction AVANT setName/setParent/permissions (opérations lentes)
            await interaction.editReply({ content: '✅ Ticket clôturé avec succès.' });

            // Opérations lentes après la réponse
            (async () => {
                try {
                    await channel.setName(`fini-${candidat ? candidat.user.username : 'candidat'}`);
                    await channel.setParent(ACCEPTE_CATEGORY);
                    await channel.permissionOverwrites.set([
                        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
                        { id: config.staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        { id: config.viewerRole, allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages'] }
                    ]);
                } catch (err) {
                    console.error('Erreur lors de l\'archivage du salon /fini :', err);
                }
            })();

        } catch (err) {
            console.error('Erreur lors de la commande /fini :', err);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la clôture.' });
        }
    }
};
