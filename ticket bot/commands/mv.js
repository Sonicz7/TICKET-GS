import { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } from 'discord.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('mv')
        .setDescription('Déplacer un membre d’une voix à une autre (Staff seulement)')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à déplacer')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('destination')
                .setDescription('Salon vocal de destination')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de faire ça.', ephemeral: true });
        }

        const member = interaction.options.getUser('membre');
        const memberGuild = interaction.guild.members.cache.get(member.id);
        const destinationChannel = interaction.options.getChannel('destination');

        if (!memberGuild) {
            return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
        }

        if (!memberGuild.voice.channel) {
            return interaction.reply({ content: `❌ ${member.username} n’est pas dans un salon vocal.`, ephemeral: true });
        }

        try {
            await memberGuild.voice.setChannel(destinationChannel);

            const embed = new EmbedBuilder()
                .setTitle('🔊 Déplacement vocal')
                .setDescription(`✅ **${member.username}** a été déplacé vers **${destinationChannel.name}**.`)
                .setColor('Green')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Impossible de déplacer le membre.', ephemeral: true });
        }
    }
};
