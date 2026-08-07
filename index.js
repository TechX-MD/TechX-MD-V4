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

// Fast Crash-Proof Vercel Pairing Endpoint
app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = getSessionDir(num);

    try {
        // Native Dynamic Import for Baileys on Vercel
        const baileys = await import('@whiskeysockets/baileys');
        const makeWASocket = baileys.default?.default || baileys.default || baileys;
        const {
            useMultiFileAuthState,
            delay,
            makeCacheableSignalKeyStore
        } = baileys;

        if (fs.existsSync(sessionDir)) {
            fs.removeSync(sessionDir);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);

        let codeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;

            if ((connection === 'connecting' || qr) && !sock.authState.creds.registered && !codeSent) {
                codeSent = true;
                try {
                    await delay(2000); // Fast 2s buffer to fit Vercel 10s timeout
                    const code = await sock.requestPairingCode(num);
                    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

                    if (!res.headersSent) {
                        return res.status(200).json({ code: formattedCode });
                    }
                } catch (err) {
                    console.error("Pairing Request Error:", err);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: "Failed to generate pairing code. Please try again." });
                    }
                }
            }
        });

    } catch (err) {
        console.error("Vercel Function Error:", err);
        if (!res.headersSent) {
            return res.status(500).json({ error: err?.message || "Server Error occurred." });
        }
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`TechX-MD V4 running on http://localhost:${PORT}`);
    });
}

module.exports = app;
