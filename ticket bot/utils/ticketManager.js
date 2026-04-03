import { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path'
import config from '../config/config.js';

const counterPath = './data/ticketCounter.json';
const activeTicketsPath = './data/activeTickets.json';

if (!fs.existsSync(counterPath)) fs.writeFileSync(counterPath, JSON.stringify({ count: 0 }));
if (!fs.existsSync(activeTicketsPath)) fs.writeFileSync(activeTicketsPath, JSON.stringify({}));

function getCounter() {
    try {
        const data = fs.readFileSync(counterPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return { count: 0 };
    }
}

function saveCounter(counter) {
    fs.writeFileSync(counterPath, JSON.stringify(counter, null, 2));
}

export function getActiveTickets() {
    try {
        const data = fs.readFileSync(activeTicketsPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export function saveActiveTickets(data) {
    fs.writeFileSync(activeTicketsPath, JSON.stringify(data, null, 2));
}

export function getTicketByChannel(channelId) {
    const activeTickets = getActiveTickets();
    for (const memberId in activeTickets) {
        if (activeTickets[memberId].channelId === channelId) {
            return { memberId, ticket: activeTickets[memberId] };
        }
    }
    return null;
}

export function getTicketByMember(memberId) {
    const activeTickets = getActiveTickets();
    if (activeTickets[memberId]) {
        return { memberId, ticket: activeTickets[memberId] };
    }
    return null;
}

export async function createTicket(interaction) {
    const guild = interaction.guild;
    const member = interaction.member;

    if (getTicketByMember(member.id)) return null;

    const counter = getCounter();
    counter.count += 1;
    saveCounter(counter);
    const ticketNumber = String(counter.count).padStart(3, '0');
    const ticketName = `${config.ticketName}-${ticketNumber}`;

    const channel = await guild.channels.create({
        name: ticketName,
        type: 0,
        parent: config.ticketCategory,
        permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: config.staffRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
    });

    const activeTickets = getActiveTickets();
    activeTickets[member.id] = { channelId: channel.id, transcriptDone: false };
    saveActiveTickets(activeTickets);

    await channel.send(`<@&${config.staffRole}> Un membre de l'équipe va s'occuper de ce ticket.`);

    const embed = new EmbedBuilder()
        .setTitle('Ticket en cours')
        .setDescription(`${member} a ouvert ce ticket.\n\nVeuillez poster votre candidature en prenant exemple sur <#1487854009078251631>.\nUn membre de l'équipe va te répondre bientôt.`)
        .setColor('Blue')
        .setTimestamp();

    const transcriptButton = new ButtonBuilder()
        .setCustomId('ticket_transcript')
        .setLabel('📄 Transcript')
        .setStyle(ButtonStyle.Primary);

    const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('❌ Fermer le ticket')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(transcriptButton, closeButton);

    await channel.send({ embeds: [embed], components: [row] });

    return channel;
}

export async function closeTicket(channel, userId) {
    const activeTickets = getActiveTickets();
    delete activeTickets[userId];
    saveActiveTickets(activeTickets);

    try {
        await channel.delete();
        console.log(`Ticket fermé: ${channel.name}`);
    } catch (err) {
        console.error('Impossible de supprimer le salon:', err);
    }
}

export async function generateTranscript(channel) {
    let allMessages = [];
    let lastId = null;

    try {
        while (true) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;

            const messages = await channel.messages.fetch(options);
            if (messages.size === 0) break;

            allMessages.push(...messages.values());
            lastId = messages.last().id;
        }
    } catch (err) {
        console.error("Erreur fetch messages:", err);
        return null;
    }

    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    function formatContent(text) {
        if (!text) return '';
        
        let html = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/```([\s\S]*?)```/g, '<div class="code-block"><pre>$1</pre></div>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            .replace(/__([^_]+)__/g, '<u>$1</u>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>')
            .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="link">$1</a>')
            .replace(/^&gt;\s(.*)$/gm, '<div class="quote">$1</div>')
            .replace(/\n/g, '<br>');

        html = html.replace(/(@everyone|@here)/g, '<span class="mention">$1</span>');
        html = html.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@Utilisateur</span>');
        html = html.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#channel</span>');
        html = html.replace(/&lt;@&(\d+)&gt;/g, '<span class="mention">@Role</span>');

        return html;
    }

    function renderAttachments(attachments) {
        if (!attachments || attachments.size === 0) return '';
        let html = '<div class="attachments">';
        attachments.forEach(att => {
            const isImage = /\.(png|jpe?g|gif|webp)$/i.test(att.name);
            if (isImage) {
                html += `<a href="${att.url}" target="_blank"><img src="${att.url}" class="attachment-img" alt="${att.name}"></a>`;
            } else {
                html += `
                <div class="attachment-file">
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                        <a href="${att.url}" target="_blank" class="file-name">${att.name}</a>
                        <span class="file-size">${(att.size / 1024).toFixed(2)} KB</span>
                    </div>
                </div>`;
            }
        });
        html += '</div>';
        return html;
    }

    function renderEmbeds(embeds) {
        if (!embeds || embeds.length === 0) return '';
        let html = '';
        embeds.forEach(embed => {

            const color = embed.hexColor || '#2f3136'; 
            
            html += `<div class="embed" style="border-left-color: ${color};">`;
            
            if (embed.author) html += `<div class="embed-author">${embed.author.name}</div>`;
            if (embed.title) html += `<div class="embed-title"><a href="${embed.url || '#'}" target="_blank">${embed.title}</a></div>`;
            if (embed.description) html += `<div class="embed-desc">${formatContent(embed.description)}</div>`;
            

            if (embed.fields && embed.fields.length > 0) {
                html += `<div class="embed-fields">`;
                embed.fields.forEach(field => {
                    html += `<div class="embed-field ${field.inline ? 'inline' : ''}">
                        <div class="field-name">${field.name}</div>
                        <div class="field-value">${formatContent(field.value)}</div>
                    </div>`;
                });
                html += `</div>`;
            }

            if (embed.image) html += `<img src="${embed.image.url}" class="embed-image">`;
            if (embed.footer) html += `<div class="embed-footer">${embed.footer.text || ''}</div>`;
            
            html += `</div>`;
        });
        return html;
    }

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        
        :root {
            --bg-primary: #36393f;
            --bg-secondary: #2f3136;
            --text-normal: #dcddde;
            --text-muted: #72767d;
            --link-color: #00b0f4;
            --mention-bg: rgba(88, 101, 242, 0.3);
            --mention-text: #dee0fc;
            --code-bg: #2f3136;
            --spoiler-bg: #202225;
        }

        body {
            background-color: var(--bg-primary);
            color: var(--text-normal);
            font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0; padding: 0;
            font-size: 16px;
            line-height: 1.375rem;
        }

        /* En-tête du canal */
        .channel-header {
            background-color: var(--bg-secondary);
            padding: 15px 20px;
            border-bottom: 1px solid #202225;
            display: flex; align-items: center;
            position: sticky; top: 0; z-index: 100;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .channel-hash { color: #8e9297; font-size: 24px; margin-right: 8px; }
        .channel-name { font-weight: 700; color: #fff; font-size: 16px; }
        .transcript-info { margin-left: auto; color: var(--text-muted); font-size: 12px; }

        /* Conteneur principal */
        .chat-container { padding: 20px 0; display: flex; flex-direction: column; }

        /* Message individuel */
        .message-group {
            display: flex;
            padding: 5px 16px;
            margin-top: 10px; /* Espace entre groupes */
        }
        .message-group:hover { background-color: rgba(4,4,5,0.07); }
        
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; margin-top: 2px; cursor: pointer; }
        .avatar:hover { opacity: 0.8; }
        
        .message-content-wrapper { flex: 1; min-width: 0; }
        
        .message-header { display: flex; align-items: center; margin-bottom: 2px; }
        .username { font-weight: 500; color: #fff; margin-right: 6px; cursor: pointer; }
        .username:hover { text-decoration: underline; }
        .bot-tag { background: #5865f2; color: #fff; font-size: 10px; padding: 2px 5px; border-radius: 3px; margin-right: 6px; font-weight: bold; }
        .timestamp { font-size: 12px; color: var(--text-muted); margin-left: 0px; }

        /* Texte du message */
        .message-body { color: var(--text-normal); white-space: pre-wrap; word-wrap: break-word; font-weight: 400; }
        
        /* Markdown Styles */
        .link { color: var(--link-color); text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .mention { background-color: var(--mention-bg); color: var(--mention-text); padding: 0 2px; border-radius: 3px; font-weight: 500; cursor: pointer; }
        .mention:hover { background-color: #5865f2; color: #fff; }
        .code-block { background: var(--code-bg); padding: 8px; border-radius: 4px; border: 1px solid #202225; margin: 6px 0; font-family: 'Consolas', monospace; font-size: 14px; overflow-x: auto; }
        .inline-code { background: var(--code-bg); padding: 2px 4px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 85%; }
        .quote { border-left: 4px solid #4f545c; padding-left: 10px; margin: 4px 0; color: var(--text-muted); }

        /* Pièces jointes */
        .attachments { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 10px; }
        .attachment-img { max-width: 400px; max-height: 300px; border-radius: 4px; cursor: pointer; }
        .attachment-file { display: flex; align-items: center; background: #2f3136; border: 1px solid #292b2f; padding: 10px; border-radius: 4px; width: fit-content; }
        .file-icon { font-size: 24px; margin-right: 10px; }
        .file-info { display: flex; flex-direction: column; }
        .file-name { color: var(--link-color); text-decoration: none; }
        .file-size { font-size: 12px; color: var(--text-muted); }

        /* Embeds */
        .embed {
            margin-top: 8px; display: flex; flex-direction: column; max-width: 520px;
            background-color: var(--bg-secondary); border-left: 4px solid #202225;
            padding: 10px; border-radius: 4px;
        }
        .embed-title { font-weight: 600; margin-bottom: 4px; }
        .embed-title a { color: #fff; text-decoration: none; }
        .embed-desc { font-size: 14px; color: var(--text-normal); margin-bottom: 8px; }
        .embed-image { max-width: 100%; border-radius: 4px; margin-top: 8px; }
        .embed-fields { display: flex; flex-wrap: wrap; margin-top: 5px; }
        .embed-field { margin-bottom: 10px; min-width: 100%; }
        .embed-field.inline { min-width: fit-content; margin-right: 15px; }
        .field-name { font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 2px; }
        .field-value { font-size: 13px; color: var(--text-normal); }
        .embed-footer { font-size: 11px; color: var(--text-muted); margin-top: 5px; }
        
        /* Réponse (Reply) */
        .reply-bar { display: flex; align-items: center; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; margin-left: 18px; }
        .reply-symbol { width: 30px; border-top: 2px solid #4f545c; border-left: 2px solid #4f545c; border-top-left-radius: 6px; height: 8px; margin-right: 5px; margin-bottom: -4px; opacity: 0.5; }
    `;

    let messagesHtml = '';

    for (const msg of allMessages) {
        const authorName = msg.member ? msg.member.displayName : msg.author.username;
        const avatarUrl = msg.author.displayAvatarURL({ format: 'png', size: 128 });
        const color = msg.member?.displayHexColor !== '#000000' ? msg.member.displayHexColor : '#ffffff';
        const isBot = msg.author.bot;

        const date = new Date(msg.createdTimestamp);
        const dateStr = date.toLocaleDateString('fr-FR');
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const contentHtml = formatContent(msg.content);
        const attachmentHtml = renderAttachments(msg.attachments);
        const embedHtml = renderEmbeds(msg.embeds);

        let replyHtml = '';
        if (msg.reference && msg.reference.messageId) {
            replyHtml = `
            <div class="reply-bar">
                <div class="reply-symbol"></div> 
                <span style="opacity: 0.7;">Réponse à un message</span>
            </div>`;
        }
        if (!contentHtml && !attachmentHtml && !embedHtml) continue;

        messagesHtml += `
        ${replyHtml}
        <div class="message-group">
            <img class="avatar" src="${avatarUrl}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <div class="message-content-wrapper">
                <div class="message-header">
                    <span class="username" style="color: ${color}">${authorName}</span>
                    ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
                    <span class="timestamp">${dateStr} à ${timeStr}</span>
                </div>
                <div class="message-body">
                    ${contentHtml}
                </div>
                ${attachmentHtml}
                ${embedHtml}
            </div>
        </div>
        `;
    }

    const finalHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Transcript - ${channel.name}</title>
    <style>${css}</style>
</head>
<body>
    <div class="channel-header">
        <span class="channel-hash">#</span>
        <span class="channel-name">${channel.name}</span>
        <div class="transcript-info">
            Exporté le ${new Date().toLocaleDateString('fr-FR')}
        </div>
    </div>
    
    <div class="chat-container">
        <div style="margin: 20px; padding-bottom: 20px; border-bottom: 1px solid #42454a;">
            <h1 style="color: white; margin-bottom: 5px;">Bienvenue dans #${channel.name} !</h1>
            <p style="color: #b9bbbe;">Ceci est le début de l'historique de ce canal.</p>
        </div>

        ${messagesHtml}
    </div>
</body>
</html>`;

    const transcriptsDir = path.resolve('./data/transcripts');
    if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

    const filePath = path.join(transcriptsDir, `${channel.name}-${Date.now()}.html`);
    fs.writeFileSync(filePath, finalHtml);

    return filePath;
}