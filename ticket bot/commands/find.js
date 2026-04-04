import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('find')
        .setDescription('Localiser un membre dans un salon vocal (Staff seulement)')
        .addUserOption(option =>
            option.setName('membre').setDescription('Le membre à localiser').setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de faire ça.', ephemeral: true });
        }

        const user = interaction.options.getUser('membre');
        const memberGuild = interaction.guild.members.cache.get(user.id);

        if (!memberGuild) {
            return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
        }
        if (!memberGuild.voice.channel) {
            return interaction.reply({ content: `❌ <@${user.id}> n'est pas dans un salon vocal.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('Localisation vocale')
            .setDescription(`<@${user.id}> se trouve actuellement dans le salon <#${memberGuild.voice.channel.id}>.`)
            .setColor(0x5865F2)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
