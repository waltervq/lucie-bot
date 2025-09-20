module.exports = {
    name: "delete",
    description: "Supprime n’importe quel message dans le groupe (le bot doit être admin).",
    adminOnly: false,
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        // Vérifie si c'est une réponse à un message
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!quoted || !stanzaId) {
            return sock.sendMessage(from, { text: "❌ Réponds à un message pour le supprimer." });
        }

        try {
            // Envoie la requête de suppression
            await sock.sendMessage(from, {
                delete: {
                    remoteJid: from,
                    fromMe: false,
                    id: stanzaId,
                    participant: participant
                }
            });
            console.log(`[DELETE] Message supprimé par le bot dans ${from}`);
        } catch (err) {
            console.error("[DELETE] Impossible de supprimer le message :", err);
            await sock.sendMessage(from, { text: "❌ Impossible de supprimer ce message. Assure-toi que le bot est admin." });
        }
    }
};