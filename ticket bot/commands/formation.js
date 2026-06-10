import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getActiveTickets, saveActiveTickets, getTicketByChannelOrRecover } from '../utils/ticketManager.js';
import config from '../config/config.js';

const ACCEPTE_CATEGORY = '1487854009502007317';
const FORMATEUR_ROLE = config.formateurRole;

export default {
    data: new SlashCommandBuilder()
        .setName('formation')
        .setDescription('Accepter le candidat et lancer sa formation (staff uniquement)'),

    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission d\'utiliser cette commande.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        const ticketData = await getTicketByChannelOrRecover(channel, config);
        if (!ticketData) {
            return interaction.editReply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.' });
        }

        const candidatId = ticketData.memberId;
        const candidat = await guild.members.fetch(candidatId).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle('Formation en cours')
            .setDescription(`${candidat ? `<@${candidatId}>` : 'Le candidat'} a été accepté(e) dans l'équipe.\n\nUn formateur va te contacter prochainement pour organiser ta formation.\nReste disponible et n'hésite pas à poser tes questions ici.`)
            .setColor(0x57F287)
            .setTimestamp();

        const pingContent = FORMATEUR_ROLE ? `<@${candidatId}> <@&${FORMATEUR_ROLE}>` : `<@${candidatId}>`;

        // ✅ Répondre AVANT les opérations lentes (setName, setParent, permissions)
        await interaction.editReply({ content: pingContent, embeds: [embed] });

        // Opérations lentes après la réponse, en non-bloquant
        (async () => {
            try {
                await channel.setName(`formation-${candidat ? candidat.user.username : 'candidat'}`);
                await channel.setParent(ACCEPTE_CATEGORY);

                const permissionOverwrites = [
                    { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
                    { id: config.staffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                    { id: config.viewerRole, allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages'] }
                ];
                if (candidatId) {
                    permissionOverwrites.push({ id: candidatId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
                }
                await channel.permissionOverwrites.set(permissionOverwrites);
            } catch (err) {
                console.error('Erreur lors de la mise à jour du salon /formation :', err);
            }
        })();
    }
};
