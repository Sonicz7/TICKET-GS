import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import './keepalive.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel, Partials.Message]
});

client.events = new Collection();

const eventsPath = path.join('./events');
fs.readdirSync(eventsPath).forEach(file => {
    if (!file.endsWith('.js')) return;
    import(`./events/${file}`).then(eventFile => {
        const evt = eventFile.default;
        if (evt.once) client.once(evt.name, (...args) => evt.execute(client, ...args));
        else client.on(evt.name, (...args) => evt.execute(...args));
    });
});

client.commands = new Collection();

const commandsPath = path.join('./commands');
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
        await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
