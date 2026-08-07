const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function getSessionDir(num) {
    return path.join(os.tmpdir(), `session_${num}`);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Promise-based Vercel Pairing Route
app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = getSessionDir(num);

    try {
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            makeCacheableSignalKeyStore,
            fetchLatestBaileysVersion
        } = require('@whiskeysockets/baileys');

        if (fs.existsSync(sessionDir)) {
            fs.removeSync(sessionDir);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);

        // Promise Wrapper for Vercel Serverless Execution
        const getPairingCodePromise = () => new Promise((resolve, reject) => {
            let codeSent = false;

            sock.ev.on('connection.update', async (update) => {
                const { connection, qr } = update;

                if ((connection === 'connecting' || qr) && !sock.authState.creds.registered && !codeSent) {
                    codeSent = true;
                    try {
                        await delay(3000); // Wait 3s for serverless socket handshake
                        const code = await sock.requestPairingCode(num);
                        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                        resolve(formattedCode);
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            // Fallback timeout for Vercel (8 seconds)
            setTimeout(() => {
                if (!codeSent) reject(new Error("Connection Timeout"));
            }, 8000);
        });

        const code = await getPairingCodePromise();
        return res.status(200).json({ code });

    } catch (err) {
        console.error("Vercel Pairing Error:", err);
        return res.status(500).json({ error: "Failed to generate pairing code. Please try again." });
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`TechX-MD V4 running on http://localhost:${PORT}`);
    });
}

module.exports = app;
