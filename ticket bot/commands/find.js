import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('find')
        .setDescription('Localiser un membre dans un salon vocal (Staff seulement)')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à localiser')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de faire ça.', ephemeral: true });
        }

        const member = interaction.options.getUser('membre');
        const memberGuild = interaction.guild.members.cache.get(member.id);

        if (!memberGuild) {
            return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
        }

        if (!memberGuild.voice.channel) {
            return interaction.reply({ content: `❌ <@${member.id}> n’est pas dans un salon vocal.`, ephemeral: true });
        }

        const voiceChannel = memberGuild.voice.channel;

        const embed = new EmbedBuilder()
            .setTitle('🔎 Localisation vocale')
            .setColor('Blue')
            .setDescription(`<@${member.id}> se trouve actuellement dans le salon <#${voiceChannel.id}>.`)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
