// commands/extract.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const log = require('../logger')(module);

function getQuotedOrMainMessage(msg) {
    return (
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        msg.message?.ephemeralMessage?.message ||
        msg.message?.viewOnceMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message?.viewOnceMessageV2Extension?.message ||
        msg.message
    );
}

module.exports = {
    name: 'extract',
    description: 'Extrait et sauvegarde un média (image, vidéo, audio, document), y compris view once.',
    adminOnly: false,
    run: async ({ sock, msg, replyWithTag }) => {
        let tempPath;
        try {
            // --- Crée dossier temporaire ---
            const tempDir = path.join(__dirname, "../temp");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const remoteJid = msg.key.remoteJid;
            const reactorJid = msg.key.participant || remoteJid;
            
            // --- Récupère le message pertinent ---
            const quoted = getQuotedOrMainMessage(msg);

            // --- Détecter type média ---
            const mediaMsg = quoted.imageMessage ? quoted :
                             quoted.videoMessage ? quoted :
                             quoted.audioMessage ? quoted :
                             quoted.documentMessage ? quoted :
                             quoted.viewOnceMessage?.message ||
                             quoted.viewOnceMessageV2?.message ||
                             quoted.viewOnceMessageV2Extension?.message ||
                             null;

            const mediaType = mediaMsg?.imageMessage ? 'image' :
                              mediaMsg?.videoMessage ? 'video' :
                              mediaMsg?.audioMessage ? 'audio' :
                              mediaMsg?.documentMessage ? 'document' : null;

            if (!mediaType) {
                return replyWithTag(sock, remoteJid, msg, "❌ Veuillez répondre à une image, vidéo, audio ou document (view once inclus).");
            }

            const mime = mediaMsg[`${mediaType}Message`]?.mimetype || '';
            const ext = mime.split('/')[1] || (
                mediaType === 'image' ? 'jpg' :
                mediaType === 'video' ? 'mp4' :
                mediaType === 'audio' ? 'ogg' : 'bin'
            );
            tempPath = path.join(tempDir, `media_${Date.now()}.${ext}`);

            // await replyWithTag(sock, remoteJid, msg, '⏳ Téléchargement en cours...');

            // --- Télécharger le média ---
            let buffer = Buffer.from([]);
            const stream = await downloadContentFromMessage(
                mediaMsg[`${mediaType}Message`],
                mediaType
            );
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            fs.writeFileSync(tempPath, buffer);
            log(`[EXTRACT] Média téléchargé: ${tempPath} (${buffer.length} bytes)`);

            // --- Préparer l'objet d'envoi ---
            let sendObj;
            if (mediaType === 'image') sendObj = { image: { url: tempPath }, caption: "📸 Média extrait avec Lucie Bot : )" };
            else if (mediaType === 'video') sendObj = { video: { url: tempPath }, caption: "🎬 Média extrait Lucie Bot : )" };
            else if (mediaType === 'audio') sendObj = { audio: { url: tempPath }, mimetype: mime || 'audio/ogg' };
            else sendObj = { document: { url: tempPath }, mimetype: mime, fileName: `document.${ext}` };

            // --- Envoi directement dans le chat privé du réacteur ---
            await sock.sendMessage(reactorJid, sendObj);
            log(`[EXTRACT] Média envoyé à ${reactorJid} ✅`);

        } catch (err) {
            console.error('[EXTRACT] Erreur:', err);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Impossible de récupérer le média.");
        } finally {
            // --- Nettoyage ---
            try {
                if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                log('[EXTRACT] Nettoyage terminé.');
            } catch {}
        }
    }
};