import { SlashCommandBuilder } from 'discord.js';
import { getActiveTickets, saveActiveTickets } from '../utils/ticketManager.js';
import { getTicketByChannel } from '../utils/ticketManager.js';
import config from '../config/config.js';

const ACCEPTE_CATEGORY = '1487854009502007317';

export default {
    data: new SlashCommandBuilder()
        .setName('accepter')
        .setDescription('Accepter un ticket (staff uniquement)'),

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

        const ticketData = getTicketByChannel(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
        }

        const activeTickets = getActiveTickets();

        const userId = Object.keys(activeTickets).find(id => activeTickets[id] === channel.id);

        try {
            await channel.setName('accepté ✅');

            await channel.setParent(ACCEPTE_CATEGORY);

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

            if (userId) {
                permissionOverwrites.push({
                    id: userId,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                });
            }

            await channel.permissionOverwrites.set(permissionOverwrites);

            return interaction.reply({
                content: `✅ Le ticket a été accepté et déplacé dans la catégorie des acceptés.`,
                ephemeral: true
            });

        } catch (err) {
            console.error('Erreur lors de l\'acceptation du ticket:', err);
            return interaction.reply({
                content: '❌ Impossible d\'accepter le ticket.',
                ephemeral: true
            });
        }
    }
};
