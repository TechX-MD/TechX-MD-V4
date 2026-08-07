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

// Full Debug Vercel Pairing Endpoint
app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = getSessionDir(num);

    console.log(`\n==================================================`);
    console.log(`[VERCEL DEBUG] Starting pairing for number: ${num}`);

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
            console.log(`[VERCEL DEBUG] Cleaning session folder: ${sessionDir}`);
            fs.removeSync(sessionDir);
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`[VERCEL DEBUG] Using WA Web Version: ${version.join('.')}`);

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

        sock.ev.on('creds.update', (creds) => {
            console.log(`[VERCEL CREDS] Credentials updated and saved!`);
            saveCreds(creds);
        });

        let codeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log(`[VERCEL CONN] State: ${connection}`);

            if (lastDisconnect) {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`[VERCEL ERROR] StatusCode: ${statusCode}`);
                console.log(`[VERCEL ERROR DETAILS]:`, JSON.stringify(lastDisconnect.error, null, 2));
            }

            if ((connection === 'connecting' || qr) && !sock.authState.creds.registered && !codeSent) {
                codeSent = true;
                try {
                    console.log(`[VERCEL DEBUG] Requesting Pairing Code from WhatsApp...`);
                    await delay(3000);
                    const code = await sock.requestPairingCode(num);
                    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                    
                    console.log(`[VERCEL CODE SUCCESS] Code: ${formattedCode}`);

                    if (!res.headersSent) {
                        return res.status(200).json({ code: formattedCode });
                    }
                } catch (err) {
                    console.error(`[VERCEL PAIR ERROR FATAL]:`, err);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: `Pairing Error: ${err.message}` });
                    }
                }
            }

            if (connection === 'open') {
                console.log(`\n🎉 [VERCEL SUCCESS] WhatsApp Device Linked Successfully for ${num}!\n`);
            }
        });

    } catch (err) {
        console.error(`[VERCEL SERVER FATAL ERROR]:`, err);
        if (!res.headersSent) {
            return res.status(500).json({ error: `Server Error: ${err.message}` });
        }
    }
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`TechX-MD V4 running on http://localhost:${PORT}`);
    });
}

module.exports = app;
