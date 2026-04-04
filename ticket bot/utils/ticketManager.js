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

    const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('❌ Fermer le ticket')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

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
                html += `<div class="attachment-file"><div class="file-icon">📄</div><div class="file-info"><a href="${att.url}" target="_blank" class="file-name">${att.name}</a><span class="file-size">${(att.size / 1024).toFixed(2)} KB</span></div></div>`;
            }
        });
        html += '</div>';
        return html;
    }

    function renderEmbeds(embeds) {
        if (!embeds || embeds.length === 0) return '';
        let html = '';
        embeds.forEach(embed => {
            const color = embed.hexColor || '#2b2d31';
            html += `<div class="embed" style="border-left-color: ${color};">`;
            if (embed.author) html += `<div class="embed-author">${embed.author.name}</div>`;
            if (embed.title) html += `<div class="embed-title"><a href="${embed.url || '#'}" target="_blank">${embed.title}</a></div>`;
            if (embed.description) html += `<div class="embed-desc">${formatContent(embed.description)}</div>`;
            if (embed.fields && embed.fields.length > 0) {
                html += `<div class="embed-fields">`;
                embed.fields.forEach(field => {
                    html += `<div class="embed-field ${field.inline ? 'inline' : ''}"><div class="field-name">${field.name}</div><div class="field-value">${formatContent(field.value)}</div></div>`;
                });
                html += `</div>`;
            }
            if (embed.image) html += `<img src="${embed.image.url}" class="embed-image">`;
            if (embed.footer) html += `<div class="embed-footer">${embed.footer.text || ''}</div>`;
            html += `</div>`;
        });
        return html;
    }

    // ── Stats ──
    const totalMessages = allMessages.filter(m => !m.author.bot).length;
    const participants = new Set(allMessages.map(m => m.author.id)).size;
    const firstMsg = allMessages[0];
    const lastMsg = allMessages[allMessages.length - 1];
    const duration = firstMsg && lastMsg
        ? Math.ceil((lastMsg.createdTimestamp - firstMsg.createdTimestamp) / (1000 * 60 * 60 * 24))
        : 0;

    // ── Build messages HTML with date separators ──
    let messagesHtml = '';
    let lastDateStr = '';

    for (const msg of allMessages) {
        const authorName = msg.member ? msg.member.displayName : msg.author.username;
        const avatarUrl = msg.author.displayAvatarURL({ format: 'png', size: 128 });
        const color = msg.member?.displayHexColor && msg.member.displayHexColor !== '#000000' ? msg.member.displayHexColor : '#ffffff';
        const isBot = msg.author.bot;

        const date = new Date(msg.createdTimestamp);
        const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const contentHtml = formatContent(msg.content);
        const attachmentHtml = renderAttachments(msg.attachments);
        const embedHtml = renderEmbeds(msg.embeds);

        if (!contentHtml && !attachmentHtml && !embedHtml) continue;

        // Date separator
        if (dateStr !== lastDateStr) {
            messagesHtml += `<div class="date-separator"><span>${dateStr}</span></div>`;
            lastDateStr = dateStr;
        }

        let replyHtml = '';
        if (msg.reference && msg.reference.messageId) {
            replyHtml = `<div class="reply-bar"><div class="reply-symbol"></div><span>Réponse à un message</span></div>`;
        }

        messagesHtml += `
        ${replyHtml}
        <div class="message-group has-top-margin">
            <img class="avatar" src="${avatarUrl}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            <div class="message-content-wrapper">
                <div class="message-header">
                    <span class="username" style="color: ${color}">${authorName}</span>
                    ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
                    <span class="timestamp">Aujourd'hui à ${timeStr}</span>
                </div>
                <div class="message-body">${contentHtml}</div>
                ${attachmentHtml}
                ${embedHtml}
            </div>
        </div>`;
    }

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');
        :root {
            --bg-primary: #313338; --bg-secondary: #2b2d31; --bg-tertiary: #1e1f22;
            --bg-hover: rgba(4,4,5,0.07); --text-normal: #dbdee1; --text-muted: #80848e;
            --text-faint: #4e5058; --brand: #5865f2; --brand-glow: rgba(88,101,242,0.15);
            --link-color: #00a8fc; --mention-bg: rgba(88,101,242,0.3); --mention-text: #c9cdfb;
            --code-bg: #1e1f22; --border: #3f4147;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg-primary); color: var(--text-normal); font-family: 'Noto Sans', 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.375; }
        .layout { display: flex; min-height: 100vh; }

        /* Sidebar */
        .sidebar { width: 240px; min-width: 240px; background: var(--bg-secondary); display: flex; flex-direction: column; border-right: 1px solid var(--bg-tertiary); }
        .sidebar-header { padding: 16px; background: var(--bg-tertiary); border-bottom: 1px solid var(--border); }
        .server-name { font-weight: 700; font-size: 15px; color: #fff; }
        .sidebar-section { padding: 16px 8px 8px; }
        .sidebar-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; padding: 0 8px; margin-bottom: 6px; display: block; }
        .sidebar-channel { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; color: #fff; font-size: 14px; background: var(--brand-glow); }
        .sidebar-channel .hash { color: var(--text-muted); font-size: 18px; font-weight: 700; }
        .sidebar-stat { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 13px; color: var(--text-muted); }
        .sidebar-stat span:last-child { color: var(--text-normal); font-weight: 600; }

        /* Main */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 100vh; }
        .topbar { height: 48px; background: var(--bg-primary); border-bottom: 1px solid var(--bg-tertiary); display: flex; align-items: center; gap: 8px; padding: 0 16px; position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 0 rgba(0,0,0,0.2); }
        .topbar-hash { color: var(--text-muted); font-size: 20px; font-weight: 700; }
        .topbar-name { font-weight: 700; font-size: 16px; color: #fff; }
        .topbar-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
        .topbar-desc { color: var(--text-muted); font-size: 13px; }
        .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .topbar-badge { background: var(--brand); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .export-date { font-size: 12px; color: var(--text-muted); }

        /* Chat */
        .chat { flex: 1; padding: 16px 0 40px; }
        .channel-welcome { padding: 24px 16px 20px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
        .welcome-icon { width: 68px; height: 68px; border-radius: 50%; background: var(--brand); display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
        .welcome-title { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .welcome-sub { color: var(--text-muted); font-size: 14px; line-height: 1.5; }

        /* Date separator */
        .date-separator { display: flex; align-items: center; padding: 16px 16px 8px; }
        .date-separator::before, .date-separator::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .date-separator span { font-size: 12px; font-weight: 600; color: var(--text-muted); padding: 0 12px; white-space: nowrap; }

        /* Messages */
        .message-group { display: flex; align-items: flex-start; padding: 2px 16px; }
        .message-group:hover { background: var(--bg-hover); }
        .message-group.has-top-margin { margin-top: 14px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; margin-top: 2px; flex-shrink: 0; }
        .message-content-wrapper { flex: 1; min-width: 0; }
        .message-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
        .username { font-weight: 500; font-size: 15px; color: #fff; }
        .bot-tag { background: var(--brand); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 4px; border-radius: 3px; }
        .timestamp { font-size: 11px; color: var(--text-muted); }
        .message-body { color: var(--text-normal); font-size: 15px; line-height: 1.375; word-break: break-word; }

        /* Markdown */
        .link { color: var(--link-color); text-decoration: none; } .link:hover { text-decoration: underline; }
        .mention { background: var(--mention-bg); color: var(--mention-text); padding: 0 2px; border-radius: 3px; font-weight: 500; }
        .code-block { background: var(--code-bg); padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border); margin: 6px 0; font-family: 'Consolas', monospace; font-size: 13px; overflow-x: auto; max-width: 90%; }
        .code-block pre { margin: 0; white-space: pre-wrap; }
        .inline-code { background: var(--code-bg); padding: 1px 5px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 87%; border: 1px solid var(--border); }
        .quote { border-left: 4px solid #4e5058; padding-left: 12px; margin: 4px 0; }

        /* Attachments */
        .attachments { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
        .attachment-img { max-width: 400px; max-height: 300px; border-radius: 4px; border: 1px solid var(--border); }
        .attachment-file { display: flex; align-items: center; gap: 10px; background: var(--bg-secondary); border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; }
        .file-icon { font-size: 22px; }
        .file-name { color: var(--link-color); text-decoration: none; font-size: 14px; font-weight: 500; }
        .file-size { font-size: 12px; color: var(--text-muted); }

        /* Embeds */
        .embed { margin-top: 8px; max-width: 520px; background: var(--bg-secondary); border-left: 4px solid var(--border); border-radius: 0 4px 4px 0; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
        .embed-author { font-size: 13px; font-weight: 600; }
        .embed-title { font-weight: 700; font-size: 15px; }
        .embed-title a { color: var(--link-color); text-decoration: none; }
        .embed-desc { font-size: 14px; line-height: 1.4; }
        .embed-image { max-width: 100%; border-radius: 4px; margin-top: 4px; }
        .embed-fields { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .embed-field { min-width: 100%; } .embed-field.inline { min-width: fit-content; }
        .field-name { font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 2px; }
        .field-value { font-size: 13px; }
        .embed-footer { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

        /* Reply */
        .reply-bar { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); margin-bottom: 2px; padding-left: 56px; }
        .reply-symbol { width: 28px; height: 10px; border-top: 2px solid var(--text-faint); border-left: 2px solid var(--text-faint); border-top-left-radius: 6px; flex-shrink: 0; }
    `;

    const finalHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript — ${channel.name}</title>
    <style>${css}</style>
</head>
<body>
<div class="layout">
    <div class="sidebar">
        <div class="sidebar-header">
            <div class="server-name">Gang Squad</div>
        </div>
        <div class="sidebar-section">
            <span class="sidebar-label">Recrutement</span>
            <div class="sidebar-channel">
                <span class="hash">#</span>
                <span>${channel.name}</span>
            </div>
        </div>
        <div class="sidebar-section">
            <span class="sidebar-label">Statistiques</span>
            <div class="sidebar-stat"><span>Messages</span><span>${totalMessages}</span></div>
            <div class="sidebar-stat"><span>Participants</span><span>${participants}</span></div>
            <div class="sidebar-stat"><span>Durée</span><span>${duration > 0 ? duration + 'j' : 'Même jour'}</span></div>
        </div>
    </div>
    <div class="main">
        <div class="topbar">
            <span class="topbar-hash">#</span>
            <span class="topbar-name">${channel.name}</span>
            <div class="topbar-divider"></div>
            <span class="topbar-desc">Transcript du ticket</span>
            <div class="topbar-right">
                <span class="topbar-badge">Archivé</span>
                <span class="export-date">Exporté le ${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
        </div>
        <div class="chat">
            <div class="channel-welcome">
                <div class="welcome-icon">📋</div>
                <div class="welcome-title">#${channel.name}</div>
                <div class="welcome-sub">Début de l'historique de ce ticket · ${totalMessages} messages · ${participants} participant${participants > 1 ? 's' : ''}</div>
            </div>
            ${messagesHtml}
        </div>
    </div>
</div>
</body>
</html>`;

    const transcriptsDir = path.resolve('./data/transcripts');
    if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

    const filePath = path.join(transcriptsDir, `${channel.name}-${Date.now()}.html`);
    fs.writeFileSync(filePath, finalHtml);

    return filePath;
}
