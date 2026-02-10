const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function startServer() {
    // Deschidem baza de date SQLite
    const db = await open({
        filename: join(__dirname, 'chat.db'),
        driver: sqlite3.Database
    });

    // Cream tabelul daca nu exista
    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            content TEXT
        );
    `);

    const app = express();
    const server = createServer(app);
    const io = new Server(server);

    // Servim fisierul HTML
    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    io.on('connection', async (socket) => {
        console.log('Un utilizator s-a conectat');

        // Trimitem istoricul mesajelor la conectare
        try {
            const messages = await db.all('SELECT username, content FROM messages ORDER BY id ASC');
            messages.forEach(row => {
                socket.emit('chat message', row.content, row.username);
            });
        } catch (e) {
            console.error('Eroare la incarcarea istoricului:', e);
        }

        // Ascultam pentru mesaje noi
        socket.on('chat message', async (msg, username) => {
            const user = username || 'Anonim';
            try {
                // Salvam in baza de date
                await db.run('INSERT INTO messages (username, content) VALUES (?, ?)', [user, msg]);
                // Emitem catre toata lumea
                io.emit('chat message', msg, user);
            } catch (e) {
                console.error('Eroare la salvarea mesajului:', e);
            }
        });

        socket.on('disconnect', () => {
            console.log('Utilizator deconectat');
        });
    });

    // cPanel aloca portul automat prin variabila de mediu PORT
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Serverul ruleaza pe portul ${port}`);
    });
}

// Pornim aplicatia
startServer().catch(err => {
    console.error('Eroare la pornirea serverului:', err);
});
