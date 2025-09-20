module.exports = {
    name: "demote",
    description: "Démote un admin en membre",
    run: async ({ sock, msg, args }) => {
        if (!msg.key.remoteJid.endsWith("@g.us")) return;
        const sender = msg.key.participant;
        const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
        const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;

        if (!isAdmin) {
            await sock.sendMessage(msg.key.remoteJid, { text: "❌ Vous devez être admin pour utiliser cette commande." });
            return;
        }

        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, { text: "❌ Veuillez mentionner un admin à rétrograder." });
            return;
        }

        try {
            await sock.groupParticipantsUpdate(msg.key.remoteJid, mentioned, "demote");
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Admin rétrogradé en membre !` });
        } catch (err) {
            console.error(err);
            await sock.sendMessage(msg.key.remoteJid, { text: "❌ Impossible de rétrograder cet admin." });
        }
    }
};