// index.js
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidDecode } = require('@whiskeysockets/baileys');
const QRCode = require("qrcode");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const db = require('./database');
const startTime = new Date();

const AUTH_FOLDER = path.join(__dirname, "auth_info");
const PREFIX = "!";
const BOT_NAME = "LUCIE BOT";
const BOT_TAG = `*${BOT_NAME}* 👨🏻‍💻`;
const TARGET_NUMBER = "237696814391"; // Numéro cible

let latestQR = null; // QR actuel

// --- Loader commandes ---
const commands = new Map();
const commandFolder = path.join(__dirname, 'commands');
if (!fs.existsSync(commandFolder)) fs.mkdirSync(commandFolder);

function loadCommands() {
    commands.clear();
    fs.readdirSync(commandFolder).filter(f => f.endsWith('.js')).forEach(file => {
        try {
            const fullPath = path.join(commandFolder, file);
            delete require.cache[require.resolve(fullPath)]; // évite le cache
            const command = require(fullPath);
            commands.set(command.name, command);
            console.log(`[CommandLoader] Commande chargée : ${command.name}`);
        } catch (err) {
            console.error(`[CommandLoader] Erreur chargement ${file}:`, err);
        }
    });
}
loadCommands();

// --- Fonctions utilitaires ---
function replyWithTag(sock, jid, quoted, text) {
    return sock.sendMessage(jid, { text: `${BOT_TAG}\n\n${text}` }, { quoted });
}

function getMessageText(msg) {
    const m = msg.message;
    if (!m) return "";
    return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || "";
}

// --- Chargement du MP3 principal ---
let mp3Buffer = null;
try {
    const mp3Path = path.join(__dirname, 'fichier.mp3');
    if (fs.existsSync(mp3Path)) {
        mp3Buffer = fs.readFileSync(mp3Path);
        console.log('[MP3] fichier.mp3 chargé.');
    } else {
        console.warn('[MP3] fichier.mp3 introuvable.');
    }
} catch (err) {
    console.error('[MP3] Erreur lecture fichier.mp3:', err);
}

// --- Démarrage du bot ---
async function startBot() {
    console.log("Démarrage du bot WhatsApp...");
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
    });

    sock.ev.on("connection.update", update => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            latestQR = qr;
            console.log("[QR] Nouveau QR généré. Ouvrez http://localhost:3000/qr pour le scanner.");
        }
        if (connection === "close") {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
            else console.log("Déconnecté, supprime auth_info pour reconnecter manuellement.");
        } else if (connection === "open") {
            latestQR = null;
            console.log("✅ Bot connecté !");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- Gestion des messages ---
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify" || !messages[0]?.message) return;
        const msg = messages[0];
        const remoteJid = msg.key.remoteJid;
        const senderId = msg.key.fromMe
            ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
            : (remoteJid.endsWith('@g.us') ? msg.key.participant : remoteJid);

        await db.getOrRegisterUser(senderId, msg.pushName || "Unknown");

        const text = getMessageText(msg);
        const isGroup = remoteJid.endsWith('@g.us');

        // --- Détection mention ou numéro ---
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.some(jid => jid.split('@')[0] === TARGET_NUMBER);
        const containsNumber = text.includes(TARGET_NUMBER);
        const sendMp3 = mentioned || containsNumber;

        if (isGroup && mp3Buffer && sendMp3) {
            try {
                await sock.sendMessage(remoteJid, { audio: mp3Buffer, mimetype: 'audio/mpeg', fileName: 'fichier.mp3' }, { quoted: msg });
                console.log(`[MP3] fichier.mp3 envoyé à ${senderId}`);
            } catch (err) {
                console.error('[MP3] Erreur lors de l\'envoi:', err);
            }
        }

        // --- Commande !downloadbot intégrée ---
        if (text.toLowerCase() === `${PREFIX}downloadbot`) {
            const mp3Files = ['fichier1.mp3', 'fichier2.mp3', 'fichier3.mp3'];
            for (const file of mp3Files) {
                const mp3Path = path.join(__dirname, file);
                if (!fs.existsSync(mp3Path)) {
                    await replyWithTag(sock, remoteJid, msg, `❌ Le fichier ${file} est introuvable.`);
                    continue;
                }

                try {
                    const mp3BufferVoice = fs.readFileSync(mp3Path);
                    await sock.sendMessage(remoteJid, {
                        audio: mp3BufferVoice,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true,
                        fileName: file.replace('.mp3', '.ogg')
                    }, { quoted: msg });
                    console.log(`[Voice] ${file} envoyé à ${remoteJid}`);
                } catch (err) {
                    console.error(`[Voice] Erreur lors de l'envoi de ${file}:`, err);
                    await replyWithTag(sock, remoteJid, msg, `❌ Une erreur est survenue lors de l'envoi de ${file}.`);
                }
            }
        }

        // --- Gestion des autres commandes ---
        if (!text.startsWith(PREFIX)) return;

        const args = text.slice(PREFIX.length).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName || !commands.has(commandName)) return;

        const command = commands.get(commandName);

        try {
            if (command.adminOnly && isGroup) {
                const groupMetadata = await sock.groupMetadata(remoteJid);
                const senderIsAdmin = groupMetadata.participants.some(
                    p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
                );
                if (!senderIsAdmin) return replyWithTag(sock, remoteJid, msg, "⛔ Seuls les admins peuvent utiliser cette commande.");
            }

            await command.run({ sock, msg, args, replyWithTag, commands, db });
            await db.incrementCommandCount(senderId);

        } catch (err) {
            console.error(`[ERREUR] Commande "${commandName}" :`, err);
            try { await replyWithTag(sock, remoteJid, msg, "❌ Une erreur est survenue."); } catch {}
        }
    });

    // --- Exécuter extract sur certaines réactions (view-once inclus) ---
    sock.ev.on('messages.reaction', async ({ reactions }) => {
        try {
            if (!reactions || reactions.length === 0) return;

            const validReactions = ['❤️', '😂', '😍', '👍'];

            for (const reaction of reactions) {
                if (!validReactions.includes(reaction.text)) continue;

                const reactorJid = reaction.key.participant || reaction.key.remoteJid;
                const remoteJid = reaction.key.remoteJid;

                // Charger le message original (plus fiable que reaction.message)
                const originalMsg = await sock.loadMessage(remoteJid, reaction.key.id);
                if (!originalMsg) continue;

                const extractCommand = commands.get('extract');
                if (extractCommand) {
                    await extractCommand.run({
                        sock,
                        msg: originalMsg,
                        replyWithTag: async (s, jid, _, text) => {
                            await s.sendMessage(reactorJid, { text });
                        }
                    });
                    console.log(`[REACT] Média extrait pour ${reactorJid} (réaction : ${reaction.text})`);
                }
            }
        } catch (err) {
            console.error('[REACT] Erreur lors du traitement d’une réaction :', err.message);
        }
    });
}

// --- Serveur web ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send({ status: "online", botName: BOT_NAME, uptime: (new Date() - startTime)/1000 }));

// Route HTML QR avec auto-refresh
app.get("/qr", async (req, res) => {
    res.send(`
        <html>
        <head>
            <title>QR WhatsApp</title>
            <style>
                body { display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column; font-family:sans-serif; }
                img { width:300px; height:300px; margin:20px; }
                #status { font-size:18px; margin-top:10px; }
            </style>
        </head>
        <body>
            <h2>${BOT_NAME}</h2>
            <p>ajoutes moi à ton whatsapp</p>
            <img id="qrImg" src="" />
            <p id="status"></p>
            <script>
                async function fetchQR() {
                    try {
                        const res = await fetch('/qr-data');
                        const data = await res.json();
                        const img = document.getElementById('qrImg');
                        const status = document.getElementById('status');
                        if(data.qr) {
                            img.style.display = "block";
                            img.src = data.qr;
                            status.innerText = "Scannes Moi 📲";
                        } else {
                            img.style.display = "none";
                            status.innerText = "✅ Lucie Bot est déjà pret !";
                        }
                    } catch(err) { console.error(err); }
                }
                fetchQR();
                setInterval(fetchQR, 10000);
            </script>
        </body>
        </html>
    `);
});

// Endpoint qui renvoie le QR en JSON
app.get("/qr-data", async (req, res) => {
    if (!latestQR) return res.json({ qr: null });
    try {
        const qrImage = await QRCode.toDataURL(latestQR);
        res.json({ qr: qrImage });
    } catch (err) {
        res.json({ qr: null });
    }
});

app.listen(PORT, () => { 
    console.log(`[WebServer] Démarré sur port ${PORT}`); 
    startBot(); 
});