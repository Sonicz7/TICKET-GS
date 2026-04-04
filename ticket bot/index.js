import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits, Collection, Partials, MessageFlags } from 'discord.js';
import './keepalive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

client.events = new Collection();

const eventsPath = path.join(__dirname, 'events');
fs.readdirSync(eventsPath).forEach(file => {
    if (!file.endsWith('.js')) return;
    import(`./events/${file}`).then(eventFile => {
        const evt = eventFile.default;
        if (evt.once) client.once(evt.name, (...args) => evt.execute(client, ...args));
        else client.on(evt.name, (...args) => evt.execute(...args));
    });
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).forEach(file => {
    if (!file.endsWith('.js')) return;
    import(`./commands/${file}`).then(cmd => {
        const command = cmd.default;
        client.commands.set(command.data.name, command);
    });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        // Si l'interaction est déjà deferred ou replied, on utilise editReply
        // Sinon on essaie reply — mais on ne fait jamais les deux
        try {
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Une erreur est survenue.' });
            } else if (!interaction.replied) {
                await interaction.reply({ content: '❌ Une erreur est survenue.', flags: MessageFlags.Ephemeral });
            }
        } catch (e) {
            console.error('Impossible d\'envoyer le message d\'erreur:', e.message);
        }
    }
});

client.login(process.env.TOKEN);
