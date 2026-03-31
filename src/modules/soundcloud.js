import { search, download } from "../utils/soundcloud.js";
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { log } from "../logger.js";
import { rentalManager } from "../utils/rentalManager.js";
import { drawZingSearch, drawZingPlayer } from "../utils/canvasHelper.js";
import { uploadAudioFile, createSpinningSticker } from "../utils/process-audio.js";

export const name = "soundcloud";
export const description = "Tìm kiếm và nghe nhạc từ SoundCloud";

export const pendingScl = new Map();

export const commands = {
    soundcloud: async (ctx) => await handleScl(ctx),
    sc: async (ctx) => await handleScl(ctx),
    scl: async (ctx) => await handleScl(ctx)
};

async function handleScl(ctx) {
    const { api, threadId, threadType, senderId, args } = ctx;
    const query = args.join(" ");
    if (!query) return;

    try {
        const results = await search(query);
        const tracks = results.filter(item => item.kind === 'track').slice(0, 10);
        if (tracks.length === 0) return;

        pendingScl.set(`${threadId}-${senderId}`, tracks);

        const mapped = tracks.map(t => ({
            title: t.title,
            artistsNames: t.user?.username || "SoundCloud Artist",
            thumbnail: (t.artwork_url || t.user?.avatar_url || "").replace("-large", "-t500x500"),
            duration: Math.floor(t.duration / 1000)
        }));

        const buffer = await drawZingSearch(mapped, query, "SOUNDCLOUD");
        const imagePath = path.join(process.cwd(), `src/modules/cache/scl_${Date.now()}.png`);
        fs.writeFileSync(imagePath, buffer);

        const infoMsg = `🎵 Kết quả tìm kiếm cho: "${query}"\n📌 Phản hồi STT (1-10) để tải nhạc.`;

        // Bọc text - Gửi ảnh kèm Caption bên dưới
        let sentMsg = await api.sendMessage({
            msg: infoMsg,
            attachments: [imagePath]
        }, threadId, threadType);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

        setTimeout(() => pendingScl.delete(`${threadId}-${senderId}`), 120000);
    } catch (e) { log.error("SCL Error:", e.message); }
}

export async function handle(ctx) {
    const { content, senderId, threadId, api, threadType, adminIds } = ctx;
    if (!adminIds.includes(String(senderId)) && !rentalManager.isRented(threadId)) return false;

    const choice = parseInt(content);
    if (isNaN(choice) || choice < 1 || choice > 10) return false;

    const key = `${threadId}-${senderId}`;
    const tracks = pendingScl.get(key);
    if (!tracks || !tracks[choice - 1]) return false;

    const track = tracks[choice - 1];
    pendingScl.delete(key);

    try {
        const { url } = await download(track.permalink_url);
        if (!url) return true;

        const tempMp3 = path.join(process.cwd(), `scl_${Date.now()}.mp3`);
        const res = await axios({ method: 'get', url, responseType: 'stream' });
        const writer = fs.createWriteStream(tempMp3);
        res.data.pipe(writer);
        await new Promise((r, j) => { writer.on('finish', r); writer.on('error', j); });

        const audioData = await uploadAudioFile(tempMp3, api, threadId, threadType);
        await api.sendVoiceNative({ voiceUrl: audioData.voiceUrl, duration: audioData.duration, fileSize: audioData.fileSize, threadId, threadType });

        const buf = await drawZingPlayer({
            title: track.title,
            artistsNames: track.user?.username,
            thumbnail: (track.artwork_url || "").replace("-large", "-t500x500"),
            duration: Math.floor(track.duration / 1000),
            sourceName: "SoundCloud"
        });
        const pPath = path.join(process.cwd(), `src/modules/cache/scl_p_${Date.now()}.png`);
        fs.writeFileSync(pPath, buf);
        await api.sendMessage({ attachments: [pPath] }, threadId, threadType);

        if (track.artwork_url) {
            const tSpin = path.join(process.cwd(), `src/modules/cache/spin_${Date.now()}.webp`);
            if (await createSpinningSticker(track.artwork_url.replace('-large', '-t500x500'), tSpin)) {
                const up = await api.uploadAttachment(tSpin, threadId, threadType);
                const u = up[0]?.fileUrl || up[0]?.url;
                if (u) await api.sendCustomSticker({ staticImgUrl: u, animationImgUrl: u, threadId, threadType });
                if (fs.existsSync(tSpin)) fs.unlinkSync(tSpin);
            }
        }
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    } catch (e) { log.error("Scl Handle Error:", e.message); }
    return true;
}
