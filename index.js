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

// Vercel Pairing Endpoint ne Smart Socket Retry Loop
app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = getSessionDir(num);

    console.log(`\n[VERCEL PAIR] Starting pairing for: ${num}`);

    try {
        const importBaileys = new Function('return import("@whiskeysockets/baileys")');
        const baileys = await importBaileys();
        
        const makeWASocket = baileys.default?.default || baileys.default || baileys;
        const {
            useMultiFileAuthState,
            delay,
            makeCacheableSignalKeyStore,
            fetchLatestBaileysVersion,
            Browsers
        } = baileys;

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
            browser: Browsers.ubuntu("Chrome")
        });

        sock.ev.on('creds.update', saveCreds);

        // Smart Retry Loop to wait for WebSocket Connection on Vercel
        let code = null;
        let attempts = 0;

        while (!code && attempts < 10) {
            attempts++;
            await delay(1500);
            try {
                if (!sock.authState.creds.registered) {
                    const rawCode = await sock.requestPairingCode(num);
                    if (rawCode) {
                        code = rawCode.match(/.{1,4}/g)?.join("-") || rawCode;
                        console.log(`[VERCEL PAIR SUCCESS] Generated Code: ${code}`);
                    }
                }
            } catch (err) {
                console.log(`[VERCEL RETRY ${attempts}/10] Waiting for WhatsApp WebSocket connection...`);
            }
        }

        if (code && !res.headersSent) {
            return res.status(200).json({ code });
        } else if (!res.headersSent) {
            return res.status(500).json({ error: "Connection timeout. Please tap Generate Pairing Code again." });
        }

    } catch (err) {
        console.error("Vercel Server Error:", err);
        const errMsg = err?.message || err?.toString() || "Unknown Error";
        if (!res.headersSent) {
            return res.status(500).json({ error: `Pairing Error: ${errMsg}` });
        }
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`TechX-MD V4 running on http://localhost:${PORT}`);
    });
}

module.exports = app;
