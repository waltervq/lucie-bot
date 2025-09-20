// commands/pp.js
const log = require('../logger')(module);

module.exports = {
    name: "pp",
    description: "Télécharge la photo de profil d'une personne en pleine résolution",
    adminOnly: false,
    run: async ({ sock, msg, args, replyWithTag }) => {
        try {
            const remoteJid = msg.key.remoteJid;
            const isGroup = remoteJid.endsWith("@g.us");

            let targetJid;

            if (isGroup && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                // Dans un groupe, récupérer le JID de la personne à qui on répond
                targetJid = msg.message.extendedTextMessage.contextInfo.participant;
            } else {
                // Chat privé ou groupe sans réponse : prendre le sender
                targetJid = isGroup ? msg.key.participant : remoteJid;
            }

            if (!targetJid) {
                return replyWithTag(sock, remoteJid, msg, "⚠️ Lucie Bot:\nImpossible de déterminer la personne dont récupérer la photo.");
            }

            // Récupérer la photo de profil en pleine résolution
            const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);

            if (!ppUrl) {
                return replyWithTag(sock, remoteJid, msg, "⚠️ Lucie Bot:\nCette personne n'a pas de photo de profil.");
            }

            await sock.sendMessage(remoteJid, { image: { url: ppUrl }, caption: "📸 Lucie Bot:\nVoila la Photo de profil : )" }, { quoted: msg });
            log(`[PP] Photo de profil envoyée pour ${targetJid}`);

        } catch (err) {
            console.error("[PP] Erreur :", err);
            await replyWithTag(sock, msg.key.remoteJid, msg, "❌ Une erreur est survenue lors de la récupération de la photo de profil : (.");
        }
    },
};