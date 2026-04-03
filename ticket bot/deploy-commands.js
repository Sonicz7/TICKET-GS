import 'dotenv/config';
import fs from 'fs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import path from 'path';

const commands = [];
const commandsPath = path.join('./commands');
fs.readdirSync(commandsPath).forEach(file => {
    if (!file.endsWith('.js')) return;
    import(`./commands/${file}`).then(cmd => {
        const command = cmd.default;
        commands.push(command.data.toJSON());
    });
});

setTimeout(async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Mise à jour des commandes slash...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log('✅ Commandes slash enregistrées !');
    } catch (err) {
        console.error(err);
    }
}, 1000);
