import pino from 'pino';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import makeWASocket, {
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    Browsers
} from '@whiskeysockets/baileys';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = path.join(os.tmpdir(), `session_${num}`);

    try {
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
            const { connection, qr } = update;

            if ((connection === 'connecting' || qr) && !sock.authState.creds.registered && !codeSent) {
                codeSent = true;
                try {
                    await delay(2500);
                    const code = await sock.requestPairingCode(num);
                    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

                    if (!res.headersSent) {
                        return res.status(200).json({ code: formattedCode });
                    }
                } catch (err) {
                    console.error("Pairing Error:", err);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: "Failed to generate pairing code. Try again." });
                    }
                }
            }
        });

    } catch (err) {
        console.error("Handler Error:", err);
        if (!res.headersSent) {
            return res.status(500).json({ error: err?.message || "Serverless Function Error" });
        }
    }
}
