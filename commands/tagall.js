module.exports = {
    name: "tagall",
    description: "Mentionne tous les membres du groupe",
    adminOnly: true, // Limite aux admins pour éviter les abus
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        // Vérifie que c’est bien un groupe
        if (!from.endsWith("@g.us")) {
            return sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." });
        }

        try {
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants.map(p => p.id);

            if (participants.length === 0) {
                return sock.sendMessage(from, { text: "❌ Aucun membre trouvé à mentionner." });
            }

            await sock.sendMessage(from, {
                text: "📢 Mention spéciale à tous !",
                mentions: participants
            });

            console.log(`[TAGALL] Tous les membres ont été mentionnés dans le groupe ${from}`);
        } catch (err) {
            console.error("[TAGALL] Erreur :", err);
            await sock.sendMessage(from, { text: "❌ Impossible de mentionner tous les membres." });
        }
    }
};