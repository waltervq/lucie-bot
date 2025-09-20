const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "statusall",
    description: "Récupère et renvoie les statuts récents",
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        try {
            // Récupère les statuts via le JID spécial
            const statusJid = "status@broadcast";
            const statusMessages = await sock.fetchStatusUpdates(statusJid);

            if (!statusMessages || statusMessages.length === 0) {
                return sock.sendMessage(from, { text: "❌ Lucie Bot, ne trouve Aucun statut." });
            }

            for (let st of statusMessages) {
                const jid = st.key?.participant || st.key?.remoteJid || "inconnu";

                // Vérifie si c’est une image, vidéo ou texte
                const mediaMsg = st.message?.imageMessage || st.message?.videoMessage;
                const textMsg = st.message?.extendedTextMessage?.text || st.message?.conversation;

                if (mediaMsg) {
                    // Téléchargement du média
                    let buffer = Buffer.from([]);
                    const stream = await downloadContentFromMessage(mediaMsg, mediaMsg.mimetype.startsWith("image") ? "image" : "video");
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    // Envoi du média au chat
                    await sock.sendMessage(from, {
                        [mediaMsg.mimetype.startsWith("image") ? "image" : "video"]: buffer,
                        caption: `📌 Statut de ${jid}`,
                    });
                } else if (textMsg) {
                    await sock.sendMessage(from, { text: `📝 Statut de ${jid}:\n\n${textMsg}` });
                }
            }

            await sock.sendMessage(from, { text: "✅ Tous les statuts ont été consultés." });

        } catch (err) {
            console.error("Erreur statusall:", err);
            await sock.sendMessage(from, { text: "❌ Impossible de récupérer les statuts." });
        }
    }
};