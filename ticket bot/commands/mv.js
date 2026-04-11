import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import config from '../config/config.js';

export default {
    data: new SlashCommandBuilder()
        .setName('mv')
        .setDescription('Déplacer un membre d\'une voix à une autre (Staff seulement)')
        .addUserOption(option =>
            option.setName('membre').setDescription('Le membre à déplacer').setRequired(true))
        .addChannelOption(option =>
            option.setName('destination').setDescription('Salon vocal de destination')
                .addChannelTypes(ChannelType.GuildVoice).setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.roles.cache.has(config.staffRole)) {
            return interaction.reply({ content: "❌ Vous n'avez pas la permission de faire ça.", ephemeral: true });
        }

        const user = interaction.options.getUser('membre');
        const destinationChannel = interaction.options.getChannel('destination');

        let memberGuild;
        try {
            memberGuild = await interaction.guild.members.fetch(user.id);
        } catch {
            return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
        }

        if (!memberGuild.voice?.channelId) {
            return interaction.reply({ content: `❌ ${user.username} n'est pas dans un salon vocal.`, ephemeral: true });
        }

        try {
            await memberGuild.voice.setChannel(destinationChannel);
            const embed = new EmbedBuilder()
                .setTitle('Déplacement vocal')
                .setDescription(`✅ **${user.username}** a été déplacé vers **${destinationChannel.name}**.`)
                .setColor(0x57F287)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Impossible de déplacer le membre.', ephemeral: true });
        }
    }
};
