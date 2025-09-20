module.exports = {
    name: "coinflip",
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;
        if (!from) return;

        // Message de suspense
        await sock.sendMessage(from, { text: "🪙 Lucie Bot Lance la pièce..." });

        // Pause 2 secondes pour plus de suspense
        setTimeout(async () => {
            const result = Math.random() > 0.5 ? "Pile 🪙" : "Face 🪙";
            await sock.sendMessage(from, { text: `🎉 Résultat : ${result}` });
        }, 2000);
    }
};