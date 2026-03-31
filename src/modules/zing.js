import { searchZing, getStreamZing } from "../utils/zingmp3.js";
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { log } from "../logger.js";
import { rentalManager } from "../utils/rentalManager.js";
import { drawZingSearch, drawZingPlayer } from "../utils/canvasHelper.js";
import { uploadAudioFile, createSpinningSticker } from "../utils/process-audio.js";

export const name = "zing";
export const description = "Tìm kiếm và nghe nhạc từ ZingMP3";

export const pendingZing = new Map();

export const commands = {
    zing: async (ctx) => {
        const { api, threadId, threadType, senderId, args } = ctx;
        const query = args.join(" ");
        if (!query) return;

        try {
            const songs = await searchZing(query);
            if (!songs || songs.length === 0) return;

            const results = songs.slice(0, 10);
            pendingZing.set(`${threadId}-${senderId}`, results);

            const mapped = results.map(t => ({
                title: t.title,
                artistsNames: t.artistsNames,
                thumbnail: (t.thumbnail || t.thumb || "").replace("w94", "w500"),
                duration: t.duration
            }));

            const buffer = await drawZingSearch(mapped, query, "ZING MP3");
            const imagePath = path.join(process.cwd(), `src/modules/cache/z_${Date.now()}.png`);
            fs.writeFileSync(imagePath, buffer);

            const infoMsg = `🎵 Kết quả tìm kiếm cho: "${query}"\n📌 Phản hồi STT (1-10) để nghe nhạc.`;

            // Bọc text - Gửi ảnh kèm Caption bên dưới
            await api.sendMessage({
                msg: infoMsg,
                attachments: [imagePath]
            }, threadId, threadType);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            setTimeout(() => pendingZing.delete(`${threadId}-${senderId}`), 120000);
        } catch (e) { log.error("Zing Search Error:", e.message); }
    }
};

export async function handle(ctx) {
    const { content, senderId, threadId, api, threadType, adminIds } = ctx;
    if (!adminIds.includes(String(senderId)) && !rentalManager.isRented(threadId)) return false;

    const choice = parseInt(content);
    if (isNaN(choice) || choice < 1 || choice > 10) return false;

    const key = `${threadId}-${senderId}`;
    const songs = pendingZing.get(key);
    if (!songs || !songs[choice - 1]) return false;

    const song = songs[choice - 1];
    pendingZing.delete(key);

    try {
        const info = await getStreamZing(song.encodeId);
        const streamUrl = info?.["128"] || info?.["320"] || info?.default;
        if (!streamUrl || streamUrl === "VIP") {
            await api.sendMessage({ msg: "⚠️ Không tải được nhạc Zing (Bài hát VIP)." }, threadId, threadType);
            return true;
        }

        const tempMp3 = path.join(process.cwd(), `zing_${Date.now()}.mp3`);
        const res = await axios({ method: 'get', url: streamUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(tempMp3);
        res.data.pipe(writer);
        await new Promise((r, j) => { writer.on('finish', r); writer.on('error', j); });

        const audioData = await uploadAudioFile(tempMp3, api, threadId, threadType);
        await api.sendVoiceNative({ voiceUrl: audioData.voiceUrl, duration: audioData.duration, fileSize: audioData.fileSize, threadId, threadType });

        const buf = await drawZingPlayer({
            title: song.title,
            artistsNames: song.artistsNames,
            thumbnail: (song.thumbnail || "").replace("w94", "w500"),
            duration: song.duration,
            sourceName: "Zing MP3"
        });
        const pPath = path.join(process.cwd(), `src/modules/cache/z_p_${Date.now()}.png`);
        fs.writeFileSync(pPath, buf);
        await api.sendMessage({ attachments: [pPath] }, threadId, threadType);

        const thumbnail = (song.thumbnail || "").replace("w94", "w500");
        if (thumbnail) {
            const tSpin = path.join(process.cwd(), `src/modules/cache/spin_${Date.now()}.webp`);
            if (await createSpinningSticker(thumbnail, tSpin)) {
                const up = await api.uploadAttachment(tSpin, threadId, threadType);
                const u = up[0]?.fileUrl || up[0]?.url;
                if (u) await api.sendCustomSticker({ staticImgUrl: u, animationImgUrl: u, threadId, threadType });
                if (fs.existsSync(tSpin)) fs.unlinkSync(tSpin);
            }
        }
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    } catch (e) { log.error("Zing Handle Error:", e.message); }
    return true;
}
