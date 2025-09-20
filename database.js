// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const log = require('./logger')(module); // Assure-toi d’avoir un logger similaire

// --- CHEMIN VERS LA NOUVELLE BASE ---
const dbPath = path.join(__dirname, 'mybot.db'); // <-- nouvelle BD
const db = new sqlite3.Database(dbPath);

// --- INITIALISATION DE LA BASE ---
db.serialize(() => {
    log(`[DATABASE] Connexion à SQLite réussie : ${dbPath}`);
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            firstSeen TEXT,
            commandCount INTEGER DEFAULT 0
        )
    `);
});

// --- FONCTIONS UTILISATEUR ---

/**
 * Récupère un utilisateur existant ou l'enregistre si nouveau.
 */
function getOrRegisterUser(userId, name) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
            if (err) return reject(err);
            if (row) {
                resolve(row);
            } else {
                const firstSeen = new Date().toISOString();
                db.run("INSERT INTO users (id, name, firstSeen) VALUES (?, ?, ?)",
                    [userId, name, firstSeen],
                    function(err) {
                        if (err) return reject(err);
                        log(`[DATABASE] Nouvel utilisateur enregistré : ${name} (${userId})`);
                        resolve({ id: userId, name, firstSeen, commandCount: 0 });
                    }
                );
            }
        });
    });
}

/**
 * Incrémente le compteur de commandes d'un utilisateur
 */
function incrementCommandCount(userId) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET commandCount = commandCount + 1 WHERE id = ?", [userId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Retourne le nombre total d'utilisateurs
 */
function getTotalUsers() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (err) return reject(err);
            resolve(row.count || 0);
        });
    });
}

/**
 * Retourne le nombre total de commandes utilisées par tous les utilisateurs
 */
function getTotalCommands() {
    return new Promise((resolve, reject) => {
        db.get("SELECT COALESCE(SUM(commandCount), 0) as total FROM users", (err, row) => {
            if (err) return reject(err);
            resolve(row.total || 0);
        });
    });
}

// --- EXPORT ---
module.exports = {
    getOrRegisterUser,
    incrementCommandCount,
    getTotalUsers,
    getTotalCommands
};
