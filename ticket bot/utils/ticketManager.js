import { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const counterPath = path.join(__dirname, '../data/ticketCounter.json');
const activeTicketsPath = path.join(__dirname, '../data/activeTickets.json');

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

export async function getTicketByChannelOrRecover(channel, config) {
    const found = getTicketByChannel(channel.id);
    if (found) return found;

    const isInTicketCategory = channel.parentId === config.ticketCategory;
    const looksLikeTicket = /^(ticket|entretien|formation|fini|refus)-/.test(channel.name);
    if (!isInTicketCategory && !looksLikeTicket) return null;

    try {
        const messages = await channel.messages.fetch({ limit: 20 });
        for (const msg of [...messages.values()].reverse()) {
            if (!msg.author.bot) continue;
            if (msg.embeds.length === 0) continue;
            const desc = msg.embeds[0]?.description || '';
            const match = desc.match(/<@!?(\d+)>/);
            if (match) {
                const memberId = match[1];
                const activeTickets = getActiveTickets();
                activeTickets[memberId] = { channelId: channel.id, transcriptDone: false };
                saveActiveTickets(activeTickets);
                console.log(`🔄 Ticket auto-récupéré: #${channel.name} → userId:${memberId}`);
                return { memberId, ticket: activeTickets[memberId] };
            }
        }
    } catch (err) {
        console.error('Erreur récupération ticket depuis Discord:', err);
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
            { id: config.staffRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: config.viewerRole, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] }
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
            const color = embed.hexColor || '#5865f2';
            html += `<div class="embed" style="border-left-color:${color}">`;
            if (embed.author) html += `<div class="embed-author">${embed.author.name}</div>`;
            if (embed.title) html += `<div class="embed-title"><a href="${embed.url || '#'}" target="_blank">${embed.title}</a></div>`;
            if (embed.description) html += `<div class="embed-desc">${formatContent(embed.description)}</div>`;
            if (embed.fields?.length) {
                html += `<div class="embed-fields">`;
                embed.fields.forEach(f => {
                    html += `<div class="embed-field${f.inline ? ' inline' : ''}"><div class="field-name">${f.name}</div><div class="field-value">${formatContent(f.value)}</div></div>`;
                });
                html += `</div>`;
            }
            if (embed.image) html += `<img src="${embed.image.url}" class="embed-image">`;
            if (embed.footer) html += `<div class="embed-footer">${embed.footer.text || ''}</div>`;
            html += `</div>`;
        });
        return html;
    }

    const totalMessages = allMessages.filter(m => !m.author.bot).length;
    const participants = new Set(allMessages.map(m => m.author.id)).size;
    const firstMsg = allMessages[0];
    const lastMsg = allMessages[allMessages.length - 1];
    const duration = firstMsg && lastMsg
        ? Math.ceil((lastMsg.createdTimestamp - firstMsg.createdTimestamp) / (1000 * 60 * 60 * 24))
        : 0;

    let messagesHtml = '';
    let lastDateStr = '';

    for (const msg of allMessages) {
        const authorName = msg.member ? msg.member.displayName : msg.author.username;
        const avatarUrl = msg.author.displayAvatarURL({ format: 'png', size: 64 });
        const color = msg.member?.displayHexColor && msg.member.displayHexColor !== '#000000' ? msg.member.displayHexColor : '#ffffff';
        const isBot = msg.author.bot;

        const date = new Date(msg.createdTimestamp);
        const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const contentHtml = formatContent(msg.content);
        const attachmentHtml = renderAttachments(msg.attachments);
        const embedHtml = renderEmbeds(msg.embeds);

        if (!contentHtml && !attachmentHtml && !embedHtml) continue;

        if (dateStr !== lastDateStr) {
            messagesHtml += `<div class="date-sep"><span>${dateStr}</span></div>`;
            lastDateStr = dateStr;
        }

        let replyHtml = '';
        if (msg.reference?.messageId) {
            replyHtml = `<div class="reply-bar"><div class="reply-symbol"></div><span>Réponse à un message</span></div>`;
        }

        messagesHtml += `
        ${replyHtml}
        <div class="msg">
            <img class="avatar" src="${avatarUrl}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" loading="lazy">
            <div class="msg-body">
                <div class="msg-header">
                    <span class="uname" style="color:${color}">${authorName}</span>
                    ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
                    <span class="ts">${timeStr}</span>
                </div>
                <div class="msg-content">${contentHtml}</div>
                ${attachmentHtml}
                ${embedHtml}
            </div>
        </div>`;
    }

    const exportDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const finalHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript — ${channel.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=gg+sans:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
    --bg0: #1a1b1e;
    --bg1: #242529;
    --bg2: #2b2d31;
    --bg3: #313338;
    --bg-hover: rgba(255,255,255,0.03);
    --border: rgba(255,255,255,0.06);
    --brand: #5865f2;
    --brand-dim: rgba(88,101,242,0.15);
    --text: #dbdee1;
    --text-muted: #80848e;
    --text-faint: #4e5058;
    --link: #00a8fc;
    --mention-bg: rgba(88,101,242,0.25);
    --mention: #c9cdfb;
    --code-bg: #1e1f22;
    --green: #23a55a;
    --red: #f23f43;
    --yellow: #f0b132;
    --radius: 8px;
    --sidebar-w: 260px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
    background: var(--bg0);
    color: var(--text);
    font-family: 'Noto Sans', 'Helvetica Neue', sans-serif;
    font-size: 15px;
    line-height: 1.4;
    min-height: 100vh;
}

/* ── LAYOUT ── */
.layout { display: flex; min-height: 100vh; }

/* ── SIDEBAR ── */
.sidebar {
    width: var(--sidebar-w);
    min-width: var(--sidebar-w);
    background: var(--bg2);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    flex-shrink: 0;
}
.sidebar-server {
    padding: 14px 16px;
    background: var(--bg1);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
}
.server-icon {
    width: 36px; height: 36px;
    background: var(--brand);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
}
.server-name { font-weight: 700; font-size: 14px; color: #fff; }
.sidebar-section { padding: 16px 8px 8px; }
.section-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0 8px;
    margin-bottom: 4px;
}
.channel-item {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
    background: var(--brand-dim);
    font-weight: 500;
}
.channel-hash { color: var(--text-muted); font-size: 18px; font-weight: 700; line-height: 1; }

.stats-grid { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.stat-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 13px;
}
.stat-row:hover { background: var(--bg-hover); }
.stat-label { color: var(--text-muted); }
.stat-val { color: var(--text); font-weight: 600; font-size: 13px; }

.badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.badge-archived { background: var(--brand); color: #fff; }
.badge-duration { background: rgba(35,165,90,0.2); color: var(--green); }

/* ── MAIN ── */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

/* ── TOPBAR ── */
.topbar {
    height: 48px;
    background: var(--bg3);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
    padding: 0 16px;
    position: sticky; top: 0; z-index: 10;
    box-shadow: 0 1px 0 rgba(0,0,0,0.3);
    flex-shrink: 0;
}
.topbar-hash { color: var(--text-muted); font-size: 22px; font-weight: 700; line-height: 1; }
.topbar-name { font-weight: 700; font-size: 15px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar-divider { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }
.topbar-sub { color: var(--text-muted); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.export-date { font-size: 11px; color: var(--text-faint); white-space: nowrap; }

/* ── CHAT ── */
.chat { flex: 1; padding-bottom: 40px; }

/* ── WELCOME ── */
.welcome {
    padding: 28px 20px 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
}
.welcome-icon {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--brand), #7c3aed);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
    margin-bottom: 14px;
    box-shadow: 0 4px 20px rgba(88,101,242,0.3);
}
.welcome-title { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px; }
.welcome-sub { color: var(--text-muted); font-size: 14px; line-height: 1.5; }
.welcome-sub strong { color: var(--text); }

/* ── DATE SEPARATOR ── */
.date-sep {
    display: flex; align-items: center;
    padding: 20px 16px 8px;
    gap: 12px;
}
.date-sep::before, .date-sep::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
}
.date-sep span {
    font-size: 11px; font-weight: 700;
    color: var(--text-muted);
    white-space: nowrap;
    text-transform: capitalize;
}

/* ── MESSAGES ── */
.msg {
    display: flex; align-items: flex-start;
    padding: 2px 16px 2px 72px;
    position: relative;
    margin-top: 14px;
    transition: background 0.1s;
}
.msg:hover { background: var(--bg-hover); }
.avatar {
    position: absolute; left: 16px; top: 2px;
    width: 40px; height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}
.msg-body { flex: 1; min-width: 0; }
.msg-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; flex-wrap: wrap; }
.uname { font-weight: 600; font-size: 15px; word-break: break-word; }
.bot-tag {
    background: var(--brand); color: #fff;
    font-size: 9px; font-weight: 700;
    padding: 1px 5px; border-radius: 3px;
    letter-spacing: 0.03em;
    flex-shrink: 0;
}
.ts { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }
.msg-content { color: var(--text); font-size: 15px; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere; }

/* ── MARKDOWN ── */
.link { color: var(--link); text-decoration: none; }
.link:hover { text-decoration: underline; }
.mention { background: var(--mention-bg); color: var(--mention); padding: 0 3px; border-radius: 3px; font-weight: 500; }
.code-block {
    background: var(--code-bg); padding: 10px 14px;
    border-radius: 4px; border: 1px solid var(--border);
    margin: 6px 0; font-family: 'Consolas', 'Courier New', monospace;
    font-size: 13px; overflow-x: auto; max-width: 100%;
}
.code-block pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
.inline-code {
    background: var(--code-bg); padding: 1px 5px; border-radius: 3px;
    font-family: 'Consolas', monospace; font-size: 87%;
    border: 1px solid var(--border);
}
.quote { border-left: 3px solid var(--text-faint); padding-left: 12px; margin: 4px 0; color: var(--text-muted); }

/* ── ATTACHMENTS ── */
.attachments { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
.attachment-img { max-width: min(400px, 100%); max-height: 300px; border-radius: 4px; border: 1px solid var(--border); display: block; }
.attachment-file {
    display: flex; align-items: center; gap: 10px;
    background: var(--bg2); border: 1px solid var(--border);
    padding: 10px 14px; border-radius: 8px;
    max-width: 100%;
}
.file-icon { font-size: 22px; flex-shrink: 0; }
.file-name { color: var(--link); text-decoration: none; font-size: 14px; font-weight: 500; word-break: break-all; }
.file-name:hover { text-decoration: underline; }
.file-size { font-size: 12px; color: var(--text-muted); }

/* ── EMBEDS ── */
.embed {
    margin-top: 8px; max-width: min(520px, 100%);
    background: var(--bg2); border-left: 4px solid var(--border);
    border-radius: 0 var(--radius) var(--radius) 0;
    padding: 12px 16px; display: flex; flex-direction: column; gap: 5px;
    overflow: hidden;
}
.embed-author { font-size: 13px; font-weight: 600; color: var(--text); }
.embed-title { font-weight: 700; font-size: 15px; }
.embed-title a { color: var(--link); text-decoration: none; }
.embed-title a:hover { text-decoration: underline; }
.embed-desc { font-size: 14px; line-height: 1.45; color: var(--text); }
.embed-image { max-width: 100%; border-radius: 4px; margin-top: 4px; }
.embed-fields { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.embed-field { min-width: 100%; }
.embed-field.inline { min-width: fit-content; }
.field-name { font-weight: 600; font-size: 13px; color: #fff; margin-bottom: 2px; }
.field-value { font-size: 13px; color: var(--text); }
.embed-footer { font-size: 12px; color: var(--text-muted); margin-top: 4px; border-top: 1px solid var(--border); padding-top: 6px; }

/* ── REPLY ── */
.reply-bar {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--text-muted);
    margin-bottom: 2px; padding-left: 72px;
}
.reply-symbol {
    width: 24px; height: 9px;
    border-top: 2px solid var(--text-faint);
    border-left: 2px solid var(--text-faint);
    border-top-left-radius: 5px;
    flex-shrink: 0;
}

/* ── MOBILE HEADER (hidden on desktop) ── */
.mobile-header { display: none; }

/* ── RESPONSIVE ── */
@media (max-width: 700px) {
    :root { --sidebar-w: 0px; }

    .sidebar { display: none; }

    .mobile-header {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px;
        background: var(--bg1);
        border-bottom: 1px solid var(--border);
        position: sticky; top: 0; z-index: 20;
        flex-shrink: 0;
    }
    .mobile-server-icon {
        width: 30px; height: 30px;
        background: var(--brand); border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; flex-shrink: 0;
    }
    .mobile-info { flex: 1; min-width: 0; }
    .mobile-channel { font-weight: 700; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mobile-server { font-size: 11px; color: var(--text-muted); }
    .mobile-badge { background: var(--brand); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px; flex-shrink: 0; }

    .topbar { display: none; }

    /* Stats bar under mobile header */
    .mobile-stats {
        display: flex; gap: 0;
        background: var(--bg2);
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
        flex-shrink: 0;
    }
    .mobile-stat {
        display: flex; flex-direction: column; align-items: center;
        padding: 8px 16px;
        border-right: 1px solid var(--border);
        white-space: nowrap;
        flex-shrink: 0;
    }
    .mobile-stat:last-child { border-right: none; }
    .mobile-stat-val { font-size: 15px; font-weight: 700; color: #fff; }
    .mobile-stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }

    .welcome { padding: 20px 14px 18px; }
    .welcome-icon { width: 52px; height: 52px; font-size: 22px; }
    .welcome-title { font-size: 20px; }

    .msg { padding: 2px 12px 2px 58px; margin-top: 12px; }
    .avatar { left: 12px; width: 34px; height: 34px; }
    .uname { font-size: 14px; }
    .msg-content { font-size: 14px; }

    .embed { max-width: 100%; }
    .attachment-img { max-width: 100%; }

    .reply-bar { padding-left: 58px; }

    .date-sep { padding: 14px 12px 6px; }

    .code-block { font-size: 12px; }
}

@media (max-width: 400px) {
    .msg { padding-left: 50px; }
    .avatar { width: 30px; height: 30px; }
    .reply-bar { padding-left: 50px; }
    .ts { display: none; }
}
</style>
</head>
<body>
<div class="layout">

    <!-- SIDEBAR (desktop) -->
    <div class="sidebar">
        <div class="sidebar-server">
            <div class="server-icon">🎫</div>
            <div class="server-name">GS STAFF</div>
        </div>
        <div class="sidebar-section">
            <div class="section-label">Recrutement</div>
            <div class="channel-item">
                <span class="channel-hash">#</span>
                <span>${channel.name}</span>
            </div>
        </div>
        <div class="sidebar-section">
            <div class="section-label">Statistiques</div>
            <div class="stats-grid">
                <div class="stat-row">
                    <span class="stat-label">Messages</span>
                    <span class="stat-val">${totalMessages}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Participants</span>
                    <span class="stat-val">${participants}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Durée</span>
                    <span class="stat-val">${duration > 0 ? duration + ' jour' + (duration > 1 ? 's' : '') : 'Même jour'}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Exporté</span>
                    <span class="stat-val" style="font-size:11px;color:var(--text-muted)">${exportDate}</span>
                </div>
            </div>
        </div>
        <div class="sidebar-section" style="margin-top:auto;padding-top:8px;">
            <div class="stats-grid">
                <div class="stat-row">
                    <span class="badge badge-archived">Archivé</span>
                </div>
            </div>
        </div>
    </div>

    <!-- MAIN -->
    <div class="main">

        <!-- MOBILE HEADER -->
        <div class="mobile-header">
            <div class="mobile-server-icon">🎫</div>
            <div class="mobile-info">
                <div class="mobile-channel">#${channel.name}</div>
                <div class="mobile-server">GS STAFF · Transcript</div>
            </div>
            <span class="mobile-badge">Archivé</span>
        </div>

        <!-- MOBILE STATS BAR -->
        <div class="mobile-stats">
            <div class="mobile-stat">
                <div class="mobile-stat-val">${totalMessages}</div>
                <div class="mobile-stat-label">Messages</div>
            </div>
            <div class="mobile-stat">
                <div class="mobile-stat-val">${participants}</div>
                <div class="mobile-stat-label">Participants</div>
            </div>
            <div class="mobile-stat">
                <div class="mobile-stat-val">${duration > 0 ? duration + 'j' : '—'}</div>
                <div class="mobile-stat-label">Durée</div>
            </div>
            <div class="mobile-stat">
                <div class="mobile-stat-val" style="font-size:12px">${exportDate}</div>
                <div class="mobile-stat-label">Export</div>
            </div>
        </div>

        <!-- TOPBAR (desktop) -->
        <div class="topbar">
            <span class="topbar-hash">#</span>
            <span class="topbar-name">${channel.name}</span>
            <div class="topbar-divider"></div>
            <span class="topbar-sub">Transcript du ticket · ${totalMessages} messages</span>
            <div class="topbar-right">
                <span class="badge badge-archived">Archivé</span>
                <span class="export-date">${exportDate}</span>
            </div>
        </div>

        <!-- CHAT -->
        <div class="chat">
            <div class="welcome">
                <div class="welcome-icon">📋</div>
                <div class="welcome-title">#${channel.name}</div>
                <div class="welcome-sub">
                    Début de l'historique de ce ticket ·
                    <strong>${totalMessages} message${totalMessages > 1 ? 's' : ''}</strong> ·
                    <strong>${participants} participant${participants > 1 ? 's' : ''}</strong>
                </div>
            </div>
            ${messagesHtml}
        </div>

    </div>
</div>
</body>
</html>`;

    const transcriptsDir = path.join(__dirname, '../data/transcripts');
    if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

    const filePath = path.join(transcriptsDir, `${channel.name}-${Date.now()}.html`);
    fs.writeFileSync(filePath, finalHtml);

    return filePath;
}
