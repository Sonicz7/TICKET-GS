import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getActiveTickets, saveActiveTickets, getTicketByChannel } from '../utils/ticketManager.js';
import config from '../config/config.js';

// ID de la catégorie "Candidatures acceptées" et du rôle formateur
const ACCEPTE_CATEGORY = '1487854009502007317';
const FORMATEUR_ROLE = config.formateurRole; // à définir dans config.js

export default {
    data: new SlashCommandBuilder()
        .setName('formation')
        .setDescription('Accepter le candidat et lancer sa formation (staff uniquement)'),

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

        try {
            // Rename + déplacer le ticket
            await channel.setName(`formation-${candidat ? candidat.user.username : 'candidat'}`);
            await channel.setParent(ACCEPTE_CATEGORY);

            // Permissions : staff + candidat voient le salon
            const permissionOverwrites = [
                {
                    id: guild.roles.everyone.id,
                    deny: ['ViewChannel']
                },
                {
                    id: config.staffRole,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ];

            if (candidatId) {
                permissionOverwrites.push({
                    id: candidatId,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                });
            }

            await channel.permissionOverwrites.set(permissionOverwrites);

            const embed = new EmbedBuilder()
                .setTitle('🎉 Félicitations, tu es accepté(e) !')
                .setDescription(
                    `Bienvenue parmi nous ${candidat ? `<@${candidatId}>` : 'candidat'} ! 🥳\n\n` +
                    `Ta candidature a été **validée** par l'équipe et nous sommes vraiment contents de t'avoir avec nous.\n\n` +
                    `**📚 Voici la suite du processus :**\n` +
                    `> **1.** Un **formateur** va te contacter très prochainement pour organiser ta formation.\n` +
                    `> **2.** La formation te permettra de découvrir nos règles, nos méthodes et ton rôle au sein de l'équipe.\n` +
                    `> **3.** Une fois ta formation terminée, tu recevras ton rôle définitif et tu pourras commencer.\n\n` +
                    `💬 Reste disponible et attentif aux messages de ton formateur. Si tu as des questions, n'hésite pas à les poser ici !\n\n` +
                    `*À très vite et encore félicitations !* 🚀`
                )
                .setColor(0x57F287)
                .setFooter({ text: 'Gang Squad • Recrutement' })
                .setTimestamp();

            // Ping candidat + formateurs hors embed
            const pingContent = FORMATEUR_ROLE
                ? `<@${candidatId}> <@&${FORMATEUR_ROLE}>`
                : `<@${candidatId}>`;

            await interaction.reply({
                content: pingContent,
                embeds: [embed]
            });

        } catch (err) {
            console.error('Erreur lors de la commande /formation :', err);
            return interaction.reply({
                content: '❌ Une erreur est survenue.',
                ephemeral: true
            });
        }
    }
};
