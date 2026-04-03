import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import config from '../config/config.js';
import { getTicketByChannel } from '../utils/ticketManager.js';

const activeTicketsPath = './data/activeTickets.json';

export function getActiveTickets() {
    try {
        const data = fs.readFileSync(activeTicketsPath, 'utf8');
        if (!data) return {};
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Renommer un ticket (staff uniquement)')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nouveau nom du ticket')
                .setRequired(true)
        ),

    async execute(interaction) {
        const member = interaction.member;

        if (!member.roles.cache.has(config.staffRole)) {
            return interaction.reply({
                content: '❌ Tu n’as pas la permission d’utiliser cette commande.',
                ephemeral: true
            });
        }

        const activeTickets = getActiveTickets();

        const ticketData = getTicketByChannel(interaction.channel.id);
if (!ticketData) {
    return interaction.reply({ content: '⚠️ Cette commande ne peut être utilisée que dans un ticket.', ephemeral: true });
}

        const newName = interaction.options.getString('nom');

        await interaction.channel.setName(newName).catch(err => {
            console.error(err);
            return interaction.reply({
                content: '❌ Impossible de renommer le ticket.',
                ephemeral: true
            });
        });

        return interaction.reply({
            content: `✅ Le ticket a été renommé en **${newName}**.`,
            ephemeral: true
        });
    }
};
