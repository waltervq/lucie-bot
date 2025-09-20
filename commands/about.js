module.exports = {
    name: "about",
    run: async ({ sock, msg }) => {
        const from = msg.key.remoteJid;

        const text = `
🤖 *Lucie-Bot*
Version : 1.0.0
Auteur : VAINQ WALTER
Description : un Bot WhatsApp basé sur Baileys
inspiré du véritable nom de la mère du dévélloppeur : Lucie
👌 Fonctions : Audio, Sticker, Mini-jeux, Admin et plus

📱 Suivez l'auteur :
- GitHub : https://github.com/waltervq
        `;

        await sock.sendMessage(from, { text });
    }
};