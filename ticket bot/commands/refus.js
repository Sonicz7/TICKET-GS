import { SlashCommandBuilder } from 'discord.js';
import { getActiveTickets, saveActiveTickets } from '../utils/ticketManager.js';
import { getTicketByChannel } from '../utils/ticketManager.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('refus')
        .setDescription('Refuser un ticket (staff uniquement)'),

    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                ephemeral: true
            });
        }

        const activeTickets = getActiveTickets();

        console.log('Active tickets:', activeTickets);
        console.log('Salon actuel:', channel.id);

        const userId = Object.keys(activeTickets).find(id => activeTickets[id] === channel.id);

        const ticketData = getTicketByChannel(interaction.channel.id);
if (!ticketData) {
    return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
}

        try {
            await channel.setName('refus ❌');

            await channel.setParent(config.refusCategory);

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

            delete activeTickets[userId];
            saveActiveTickets(activeTickets);

            return interaction.reply({
                content: `✅ Le ticket a été refusé et déplacé dans la catégorie des refus.`,
                ephemeral: true
            });

        } catch (err) {
            console.error('Erreur lors du refus du ticket:', err);
            return interaction.reply({
                content: '❌ Impossible de refuser le ticket.',
                ephemeral: true
            });
        }
    }
};
