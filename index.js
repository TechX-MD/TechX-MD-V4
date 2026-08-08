import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import pino from 'pino';
import axios from 'axios';
import yts from 'yt-search';
import { fileURLToPath } from 'url';
import * as baileys from '@whiskeysockets/baileys';

// Universal Safe Import Extractor
const b = baileys.default || baileys;

const makeWASocket = typeof b === 'function' ? b : (b.default || b.makeWASocket || baileys.makeWASocket);
const useMultiFileAuthState = b.useMultiFileAuthState || baileys.useMultiFileAuthState;
const delay = b.delay || baileys.delay;
const makeCacheableSignalKeyStore = b.makeCacheableSignalKeyStore || baileys.makeCacheableSignalKeyStore;
const fetchLatestBaileysVersion = b.fetchLatestBaileysVersion || baileys.fetchLatestBaileysVersion;
const Browsers = b.Browsers || baileys.Browsers;
const DisconnectReason = b.DisconnectReason || baileys.DisconnectReason;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function getSessionDir(num) {
    return path.join('./', `session_${num}`);
}

// Serve Cyber HTML Web Pair Control Panel
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TechX-MD V4 | Control Panel</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', Courier, monospace; }
            body { background: #030303; color: #f1f1f1; min-height: 100vh; padding: 15px; display: flex; flex-direction: column; align-items: center; position: relative; overflow-x: hidden; }
            #cyberCanvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; opacity: 0.15; }
            .wrapper { position: relative; z-index: 1; width: 100%; max-width: 500px; display: flex; flex-direction: column; align-items: center; }
            .header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(15, 3, 3, 0.9); border: 1px solid rgba(255, 0, 60, 0.4); border-radius: 10px; margin-bottom: 15px; box-shadow: 0 0 15px rgba(255, 0, 60, 0.15); }
            .brand { display: flex; align-items: center; gap: 10px; font-weight: bold; font-size: 17px; color: #ff003c; letter-spacing: 1px; }
            .brand-icon { width: 32px; height: 32px; background: #ff003c; border-radius: 6px; display: flex; justify-content: center; align-items: center; color: #000; font-size: 18px; box-shadow: 0 0 10px #ff003c; }
            .zim-clock-badge { background: rgba(0, 255, 102, 0.1); border: 1px solid #00ff66; color: #00ff66; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: monospace; display: flex; align-items: center; gap: 6px; }
            .live-dot { width: 7px; height: 7px; background: #00ff66; border-radius: 50%; box-shadow: 0 0 8px #00ff66; animation: blink 1s infinite alternate; }
            @keyframes blink { from { opacity: 0.3; } to { opacity: 1; } }
            .main-title { font-size: 26px; font-weight: 900; color: #ffffff; text-shadow: 0 0 10px #ff003c; margin-bottom: 18px; text-align: center; letter-spacing: 2px; }
            .main-title span { color: #ff003c; }
            .card { width: 100%; background: rgba(12, 2, 2, 0.9); border: 1px solid #ff003c; border-radius: 12px; padding: 22px; box-shadow: 0 0 25px rgba(255, 0, 60, 0.2); backdrop-filter: blur(5px); }
            .card-title { font-size: 17px; font-weight: bold; color: #ff003c; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .card-desc { font-size: 12px; color: #aaa; margin-bottom: 18px; }
            .input-group { margin-bottom: 15px; text-align: left; }
            label { display: block; font-size: 11px; color: #ff4d6d; margin-bottom: 6px; font-weight: bold; text-transform: uppercase; }
            select, input { width: 100%; padding: 12px; border-radius: 6px; border: 1px solid rgba(255, 0, 60, 0.4); background: #000; color: #00ff66; font-size: 14px; font-weight: bold; outline: none; transition: 0.3s; }
            select:focus, input:focus { border-color: #ff003c; box-shadow: 0 0 12px rgba(255, 0, 60, 0.6); }
            .btn-pair { width: 100%; padding: 14px; background: #ff003c; color: #000; border: none; border-radius: 6px; font-weight: 900; font-size: 15px; cursor: pointer; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 15px rgba(255, 0, 60, 0.5); }
            .btn-pair:hover { background: #e60036; color: #fff; box-shadow: 0 0 25px rgba(255, 0, 60, 0.8); }
            .code-container { margin-top: 20px; background: #000; border: 1px dashed #00ff66; border-radius: 8px; padding: 18px; display: none; text-align: center; box-shadow: 0 0 15px rgba(0, 255, 102, 0.2); }
            .code-label { font-size: 11px; font-weight: bold; color: #00ff66; letter-spacing: 1px; margin-bottom: 8px; text-transform: uppercase; }
            .code-display { display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 15px; }
            .code-val { font-size: 26px; font-weight: 900; color: #00ff66; letter-spacing: 4px; text-shadow: 0 0 10px #00ff66; }
            .copy-btn { background: rgba(0, 255, 102, 0.15); border: 1px solid #00ff66; color: #00ff66; width: 38px; height: 38px; border-radius: 6px; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 16px; }
            .steps { text-align: left; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; }
            .step-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; font-size: 11px; color: #ccc; }
            .step-num { width: 18px; height: 18px; background: #ff003c; color: #000; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 10px; flex-shrink: 0; }
            #loading { display: none; color: #ff003c; margin-top: 15px; font-size: 12px; font-weight: bold; text-align: center; text-transform: uppercase; }
            .bug-btn { position: fixed; bottom: 20px; right: 20px; background: #111; color: #ff003c; border: 1px solid #ff003c; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; text-decoration: none; box-shadow: 0 0 10px rgba(255, 0, 60, 0.3); z-index: 10; }
        </style>
    </head>
    <body>
        <canvas id="cyberCanvas"></canvas>
        <div class="wrapper">
            <div class="header">
                <div class="brand"><div class="brand-icon"><i class="fa-solid fa-terminal"></i></div> TECHX-MD V4</div>
                <div class="zim-clock-badge"><div class="live-dot"></div><span id="zimClock">--:--:-- CAT</span></div>
            </div>

            <div class="main-title">CYBER <span>WEB PAIR PANEL</span></div>

            <div class="card">
                <div class="card-title"><i class="fa-solid fa-key"></i> Link Phone Number</div>
                <div class="card-desc">Select country code, then enter your WhatsApp local number</div>

                <div class="input-group">
                    <label>Select Country (55+ Available)</label>
                    <select id="country">
                        <option value="263" selected>Zimbabwe (+263)</option>
                        <option value="27">South Africa (+27)</option>
                        <option value="234">Nigeria (+234)</option>
                        <option value="254">Kenya (+254)</option>
                        <option value="233">Ghana (+233)</option>
                        <option value="260">Zambia (+260)</option>
                        <option value="1">USA / Canada (+1)</option>
                        <option value="44">United Kingdom (+44)</option>
                        <option value="91">India (+91)</option>
                    </select>
                </div>

                <div class="input-group">
                    <label>WhatsApp Number (No leading 0)</label>
                    <input type="number" id="phone" placeholder="e.g. 771234567">
                </div>

                <button class="btn-pair" onclick="getCode()"><i class="fa-solid fa-code"></i> Generate Pairing Code</button>

                <div id="loading"><i class="fa-solid fa-spinner fa-spin"></i> Initializing Cyber Handshake... (~3s)...</div>

                <div id="codeBox" class="code-container">
                    <div class="code-label">YOUR PAIRING CODE (Valid 60s)</div>
                    <div class="code-display">
                        <div id="codeVal" class="code-val">----</div>
                        <button class="copy-btn" onclick="copyCode()"><i class="fa-regular fa-copy"></i></button>
                    </div>

                    <div class="steps">
                        <div class="step-item"><div class="step-num">1</div> Open WhatsApp on your phone</div>
                        <div class="step-item"><div class="step-num">2</div> Go to <b>Settings > Linked Devices > Link a Device</b></div>
                        <div class="step-item"><div class="step-num">3</div> Tap <b>"Link with phone number instead"</b> and enter code</div>
                    </div>
                </div>
            </div>
        </div>

        <a href="https://wa.me/263779411538" class="bug-btn"><i class="fa-solid fa-bug"></i> Report Bug</a>

        <script>
            function updateZimTime() {
                const options = { timeZone: 'Africa/Harare', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
                const zimTime = new Intl.DateTimeFormat('en-US', options).format(new Date());
                document.getElementById('zimClock').innerText = zimTime + ' CAT';
            }
            setInterval(updateZimTime, 1000);
            updateZimTime();

            const canvas = document.getElementById('cyberCanvas');
            const ctx = canvas.getContext('2d');
            function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
            window.addEventListener('resize', resize);
            resize();

            let angle = 0;
            function drawCyberGrid() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = 'rgba(0, 255, 102, 0.22)';
                ctx.lineWidth = 1;
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                angle += 0.003;

                for (let r = 60; r < Math.max(canvas.width, canvas.height); r += 70) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.stroke();
                }

                for (let i = 0; i < 8; i++) {
                    const a = angle + (i * Math.PI / 4);
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + Math.cos(a) * 1500, cy + Math.sin(a) * 1500);
                    ctx.stroke();
                }
                requestAnimationFrame(drawCyberGrid);
            }
            drawCyberGrid();

            async function getCode() {
                const country = document.getElementById('country').value;
                let phone = document.getElementById('phone').value.trim();
                
                if(!phone) return alert('Enter your WhatsApp local number!');

                if(phone.startsWith('0')) phone = phone.substring(1);
                const fullNumber = country + phone;

                document.getElementById('loading').style.display = 'block';
                document.getElementById('codeBox').style.display = 'none';

                try {
                    const res = await fetch('/pair?number=' + fullNumber);
                    const data = await res.json();
                    document.getElementById('loading').style.display = 'none';

                    if(data.code) {
                        document.getElementById('codeVal').innerText = data.code;
                        document.getElementById('codeBox').style.display = 'block';
                    } else {
                        alert(data.error || 'Failed to generate code.');
                    }
                } catch(e) {
                    document.getElementById('loading').style.display = 'none';
                    alert('Server error. Retry again.');
                }
            }

            function copyCode() {
                const code = document.getElementById('codeVal').innerText;
                navigator.clipboard.writeText(code);
                alert('Pairing Code copied: ' + code);
            }
        </script>
    </body>
    </html>
    `);
});

// Dynamic Web Pairing Session Engine
async function createPairingSocket(num, res) {
    const sessionDir = getSessionDir(num);

    if (res && fs.existsSync(sessionDir)) {
        try { fs.removeSync(sessionDir); } catch(e) {}
    }

    try {
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
            browser: Browsers.ubuntu("Chrome"),
            markOnlineOnConnect: true
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(`\n🎉 [SUCCESS] Web Pairing Successful for ${num}! TechX-MD V4 is ONLINE!\n`);
                
                try {
                    const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    await sock.sendMessage(myJid, {
                        text: `🎉 *TechX-MD V4 Connected Successfully!*\n\n🤖 *Bot Status:* Online & Active 24/7\n🎯 *Prefix:* [ . ]\n📢 *Official Channel:* https://whatsapp.com/channel/0029Vb8QAZyAe5VyFTerO82q\n\n_Type .menu to view all working plugins!_`
                    });

                    try {
                        const channelInfo = await sock.newsletterMetadata("invite", "0029Vb8QAZyAe5VyFTerO82q");
                        if (channelInfo && channelInfo.id) {
                            await sock.newsletterFollow(channelInfo.id);
                            console.log(`📢 [AUTO-JOIN] Joined Channel: ${channelInfo.id}`);
                        }
                    } catch (cErr) {}
                } catch (e) {}
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === 515) {
                    console.log(`[SESSION ${num}] Handshake complete (515) - Connecting bot engine...`);
                    await delay(2000);
                    createPairingSocket(num, null);
                } else if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log(`[LOGOUT] Number ${num} logged out. Cleaning session...`);
                    try { if (fs.existsSync(sessionDir)) fs.removeSync(sessionDir); } catch(e) {}
                }
            }
        });

        // 📩 INCOMING MESSAGES LISTENER (PLUGINS)
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message) return;

                const from = msg.key.remoteJid;
                let messageContent = msg.message;
                if (messageContent.ephemeralMessage) messageContent = messageContent.ephemeralMessage.message;
                if (messageContent.viewOnceMessage) messageContent = messageContent.viewOnceMessage.message;

                const type = Object.keys(messageContent)[0];
                let body = '';

                if (type === 'conversation') body = messageContent.conversation;
                else if (type === 'extendedTextMessage') body = messageContent.extendedTextMessage.text;

                if (!body || !body.startsWith('.')) return;

                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();

                console.log(`[COMMAND EXECUTED] .${command} in ${from}`);

                // ⚡ AUTO RANDOM EMOJI REACTION
                const randomEmojis = ['🤖', '⚡', '🔥', '🚀', '👑', '✨', '🎯', '💎', '🎉', '💥'];
                const selectedEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
                await sock.sendMessage(from, { react: { text: selectedEmoji, key: msg.key } });

                // PLUGIN 1: .ping
                if (command === 'ping') {
                    const start = Date.now();
                    await sock.sendMessage(from, { text: '🏓 *Pong! TechX-MD V4 Active!*' }, { quoted: msg });
                    const end = Date.now();
                    await sock.sendMessage(from, { text: `🚀 *Speed:* ${end - start}ms` }, { quoted: msg });
                }

                // PLUGIN 2: .song / .play / .music (DAVID CYRIL & GIFTED TECH API + YT-SEARCH)
                else if (command === 'song' || command === 'play' || command === 'music') {
                    const query = args.join(" ").trim();

                    if (!query) {
                        return await sock.sendMessage(from, {
                            text: `🎵 *TechX Song Downloader*\n\nUsage:\n.song <song name>\n.play <song name>\n.song <YouTube URL>`
                        }, { quoted: msg });
                    }

                    try {
                        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

                        let video = null;
                        let url = query;

                        if (!query.includes("youtube.com") && !query.includes("youtu.be")) {
                            const result = await yts(query);
                            if (!result.videos.length) {
                                return await sock.sendMessage(from, { text: "❌ No song found." }, { quoted: msg });
                            }
                            video = result.videos[0];
                            url = video.url;
                        }

                        if (video) {
                            await sock.sendMessage(from, {
                                image: { url: video.thumbnail },
                                caption: `🎵 *${video.title}*\n\n⏱ *Duration:* ${video.timestamp}\n\n📥 *Downloading MP3 Audio...*`
                            }, { quoted: msg });
                        }

                        const APIS = [
                            "https://apis.davidcyriltech.my.id/download/ytmp3?url=",
                            "https://api.giftedtech.web.id/api/download/ytmp3?url="
                        ];

                        let downloadUrl = null;
                        let title = video?.title || "song";

                        for (const api of APIS) {
                            try {
                                const res = await axios.get(api + encodeURIComponent(url), { timeout: 30000 });
                                const data = res.data;
                                downloadUrl = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url || data?.url || data?.link;
                                title = data?.result?.title || title;
                                if (downloadUrl) break;
                            } catch (e) {}
                        }

                        if (!downloadUrl) {
                            throw new Error("Download link not found.");
                        }

                        const audio = await axios.get(downloadUrl, {
                            responseType: "arraybuffer",
                            timeout: 120000,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity
                        });

                        const buffer = Buffer.from(audio.data);

                        await sock.sendMessage(from, {
                            audio: buffer,
                            mimetype: "audio/mpeg",
                            fileName: title + ".mp3",
                            ptt: false
                        }, { quoted: msg });

                        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

                    } catch (err) {
                        console.error("SONG ERROR:", err);
                        await sock.sendMessage(from, { text: "❌ Failed to download song. Please try again later." }, { quoted: msg });
                    }
                }

                // PLUGIN 3: .ai / .gpt (Working ChatGPT AI)
                else if (command === 'ai' || command === 'gpt') {
                    const query = args.join(" ");
                    if (!query) return await sock.sendMessage(from, { text: '❓ *Please ask a question!* Example: `.ai What is the capital of Zimbabwe?` ' }, { quoted: msg });
                    
                    try {
                        await sock.sendMessage(from, { text: '🧠 *TechX AI is thinking...*' }, { quoted: msg });
                        const res = await axios.get(`https://widipe.com/prompt/gpt?prompt=${encodeURIComponent(query)}`);
                        const reply = res.data?.result || res.data?.response || "I couldn't process that request right now.";
                        await sock.sendMessage(from, { text: `🤖 *TechX AI Response:*\n\n${reply}` }, { quoted: msg });
                    } catch(e) {
                        await sock.sendMessage(from, { text: '❌ *AI API Error. Please try again later.*' }, { quoted: msg });
                    }
                }

                // PLUGIN 4: .tiktok / .tt (Working TikTok Downloader)
                else if (command === 'tiktok' || command === 'tt') {
                    const url = args[0];
                    if (!url || !url.includes('tiktok.com')) return await sock.sendMessage(from, { text: '📹 *Please provide a valid TikTok link!* Example: `.tiktok https://vm.tiktok.com/...` ' }, { quoted: msg });

                    try {
                        await sock.sendMessage(from, { text: '📥 *Downloading TikTok video...*' }, { quoted: msg });
                        const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
                        const videoUrl = res.data?.video?.noWatermark || res.data?.video?.url;

                        if (videoUrl) {
                            await sock.sendMessage(from, {
                                video: { url: videoUrl },
                                caption: '✨ *Downloaded by TechX-MD V4*'
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { text: '❌ *Failed to fetch video.*' }, { quoted: msg });
                        }
                    } catch(e) {
                        await sock.sendMessage(from, { text: '❌ *Error processing TikTok link.*' }, { quoted: msg });
                    }
                }

                // PLUGIN 5: .qr (Working QR Code Generator)
                else if (command === 'qr') {
                    const text = args.join(" ");
                    if (!text) return await sock.sendMessage(from, { text: '📌 *Please provide text or link!* Example: `.qr https://google.com` ' }, { quoted: msg });
                    
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
                    await sock.sendMessage(from, {
                        image: { url: qrUrl },
                        caption: `📌 *QR Code generated for:* ${text}`
                    }, { quoted: msg });
                }

                // PLUGIN 6: .menu
                else if (command === 'menu' || command === 'help') {
                    const menuText = `
╭━━━〔 *TECHX-MD V4* 〕━━━
┃ 👑 *Owner:* +263779411538
┃ 🎯 *Prefix:* [ . ]
┃ ⚡ *Status:* Online & Active
┃ 📟 *Engine:* Baileys MD V4
╰━━━━━━━━━━━━━━━━━━

╭━━━〔 📥 *DOWNLOADERS* 〕━━━
├ .play <song name> - Download Song MP3
├ .song <title> - Download Song MP3
└ .tiktok <link> - Download TikTok Video

╭━━━〔 🤖 *AI & CHAT* 〕━━━
├ .ai <question> - Ask ChatGPT AI
└ .gpt <question> - Ask GPT AI

╭━━━〔 👥 *GROUP TOOLS* 〕━━━
├ .hidetag <text> - Tag all members
├ .tagall - Tag all group members
└ .link - Get Group Invite Link

╭━━━〔 🔍 *UTILS & TOOLS* 〕━━━
├ .qr <text/link> - Generate QR Code
├ .ping - Check response speed
├ .alive - Check bot status
└ .owner - Contact bot owner
╰━━━━━━━━━━━━━━━━━━

*Powered by TechX-MD V4 Engine*
                    `;

                    await sock.sendMessage(from, {
                        text: menuText.trim(),
                        contextInfo: {
                            externalAdReply: {
                                title: 'TECHX-MD V4 OFFICIAL CHANNEL',
                                body: 'Tap to Join & Get Bot Updates',
                                thumbnailUrl: 'https://files.catbox.moe/w8q394.jpg',
                                sourceUrl: 'https://whatsapp.com/channel/0029Vb8QAZyAe5VyFTerO82q',
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    }, { quoted: msg });
                }

                // PLUGIN 7: .alive
                else if (command === 'alive') {
                    await sock.sendMessage(from, { text: '✅ *TechX-MD V4 Server is Online!*' }, { quoted: msg });
                }

                // PLUGIN 8: .owner
                else if (command === 'owner') {
                    await sock.sendMessage(from, { text: '📲 *TechX-MD V4 Owner:* +263779411538' }, { quoted: msg });
                }

            } catch (err) {
                console.error("Msg Error:", err);
            }
        });

        // Request pairing code for web user
        if (res && !sock.authState.creds.registered) {
            await delay(3000);
            const code = await sock.requestPairingCode(num);
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`[WEB PAIR CODE GENERATED] ${formattedCode}`);
            if (!res.headersSent) {
                return res.json({ code: formattedCode });
            }
        }

    } catch (err) {
        console.error("Pairing Error:", err);
        if (res && !res.headersSent) {
            return res.status(500).json({ error: "Failed to generate pairing code." });
        }
    }
}

app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter a valid phone number." });

    num = num.replace(/[^0-9]/g, '');
    createPairingSocket(num, res);
});

// Auto-restart saved sessions
try {
    const existingSessions = fs.readdirSync('./').filter(f => f.startsWith('session_'));
    existingSessions.forEach(sDir => {
        const num = sDir.replace('session_', '');
        console.log(`[AUTO-RESTART] Restoring session for ${num}...`);
        createPairingSocket(num, null);
    });
} catch(e) {}

app.listen(PORT, () => {
    console.log(`\n🚀 TechX-MD V4 Web Pair Control Panel running on port ${PORT}\n`);
});
