const guesses = new Map(); // pour stocker les parties en cours

module.exports = {
    name: "guess",
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        if (!from) return;

        // Génère le nombre aléatoire
        const random = Math.floor(Math.random() * 10) + 1;

        // Stocke la partie en cours
        guesses.set(from, random);

        await sock.sendMessage(from, { text: "🎲 Lucie Bot:\nDevine un nombre entre 1 et 10 ! écris ton chiffre." });

        // Attend 15 secondes pour la réponse
        setTimeout(async () => {
            if (guesses.has(from)) {
                await sock.sendMessage(from, { text: `⏰ Temps écoulé ! La réponse était : ${random}` });
                guesses.delete(from);
            }
        }, 15000);

        // Écoute les messages pour valider la réponse
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const m = messages[0];
            if (!m.message || m.key.remoteJid !== from) return;

            let body = "";
            if (m.message.conversation) body = m.message.conversation;
            else if (m.message.extendedTextMessage) body = m.message.extendedTextMessage.text;

            const answer = parseInt(body);
            if (!answer || !guesses.has(from)) return;

            if (answer === guesses.get(from)) {
                await sock.sendMessage(from, { text: "🎉 Bravo ! Tu as deviné ! : )" });
            } else {
                await sock.sendMessage(from, { text: `❌ Mauvais ! La réponse était ${guesses.get(from)} : (` });
            }

            guesses.delete(from);
        });
    }
};