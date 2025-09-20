module.exports = {
    name: "kick",
    description: "Exclut un membre du groupe (utilisation : !kick <numéro>)",
    adminOnly: true, // Limite aux admins pour éviter les abus
    run: async ({ sock, msg, args }) => {
        const from = msg.key.remoteJid;

        // Vérifie que c’est un groupe
        if (!from.endsWith("@g.us")) {
            return sock.sendMessage(from, { text: "❌ Cette commande ne fonctionne que dans un groupe." });
        }

        // Vérifie qu’un numéro est fourni
        if (!args[0]) {
            return sock.sendMessage(from, { text: "❌ Merci de fournir le numéro à exclure." });
        }

        // Nettoyage du numéro et création du JID
        const user = args[0].replace(/\D/g, "") + "@s.whatsapp.net";

        try {
            // Exclusion du membre
            await sock.groupParticipantsUpdate(from, [user], "remove");

            // Confirmation
            await sock.sendMessage(from, { text: `✅ ${args[0]} a été exclu du groupe !` });

            console.log(`[KICK] ${args[0]} exclu du groupe ${from}`);
        } catch (err) {
            console.error("[KICK] Erreur :", err);
            await sock.sendMessage(from, { text: "❌ Impossible d’exclure cet utilisateur." });
        }
    }
};