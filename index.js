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

// Vercel Keep-Alive Pairing Engine
app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = getSessionDir(num);

    try {
        const baileys = await import('@whiskeysockets/baileys');
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

        let codeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if ((connection === 'connecting' || qr) && !sock.authState.creds.registered && !codeSent) {
                codeSent = true;
                try {
                    await delay(3000);
                    const code = await sock.requestPairingCode(num);
                    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                    
                    if (!res.headersSent) {
                        res.status(200).json({ code: formattedCode });
                    }
                } catch (err) {
                    console.error("Pair Request Error:", err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: "Failed to request code. Try again." });
                    }
                }
            }

            if (connection === 'open') {
                console.log(`\n🎉 [SUCCESS] Device Linked Successfully on Vercel for ${num}!\n`);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === 515) {
                    console.log(`[VERCEL HANDSHAKE] Status 515 - Completing login sequence...`);
                }
            }
        });

    } catch (err) {
        console.error("Vercel Server Error:", err);
        if (!res.headersSent) {
            return res.status(500).json({ error: "Vercel Server Error occurred." });
        }
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`TechX-MD V4 running on http://localhost:${PORT}`);
    });
}

module.exports = app;
