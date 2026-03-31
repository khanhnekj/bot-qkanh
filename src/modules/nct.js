import { searchNCT } from "../utils/nhaccuatui.js";
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { log } from "../logger.js";
import { rentalManager } from "../utils/rentalManager.js";
import { drawZingSearch, drawZingPlayer } from "../utils/canvasHelper.js";
import { uploadAudioFile, createSpinningSticker } from "../utils/process-audio.js";

export const name = "nct";
export const description = "Tìm kiếm và nghe nhạc từ NhacCuaTui (NCT)";

export const pendingNct = new Map();

export const commands = {
    nct: async (ctx) => {
        const { api, threadId, threadType, senderId, args } = ctx;
        const query = args.join(" ");
        if (!query) return;

        try {
            const songs = await searchNCT(query);
            if (!songs || songs.length === 0) return;

            const results = songs.slice(0, 10);
            pendingNct.set(`${threadId}-${senderId}`, results);

            const mapped = results.map(s => ({
                title: s.name,
                artistsNames: s.artistName || "NCT Artist",
                thumbnail: s.image || s.bgImage || s.artistImage || "https://stc-nct.nct.vn/v10/images/nct-logo-600x600.png",
                duration: s.duration || 0
            }));

            const buffer = await drawZingSearch(mapped, query, "NHACCUATUI");
            const tempImg = path.join(process.cwd(), `src/modules/cache/nct_${Date.now()}.png`);
            fs.writeFileSync(tempImg, buffer);

            const infoMsg = `🎵 Kết quả tìm kiếm cho: "${query}"\n📌 Phản hồi STT (1-10) để tải nhạc.`;

            // Bọc text - Gửi kèm caption
            await api.sendMessage({
                msg: infoMsg,
                attachments: [tempImg]
            }, threadId, threadType);
            if (fs.existsSync(tempImg)) fs.unlinkSync(tempImg);

            setTimeout(() => pendingNct.delete(`${threadId}-${senderId}`), 120000);
        } catch (e) { log.error("NCT Error:", e.message); }
    }
};

export async function handle(ctx) {
    const { content, senderId, threadId, api, threadType, adminIds } = ctx;
    if (!adminIds.includes(String(senderId)) && !rentalManager.isRented(threadId)) return false;

    const choice = parseInt(content);
    if (isNaN(choice) || choice < 1 || choice > 10) return false;

    const key = `${threadId}-${senderId}`;
    const songs = pendingNct.get(key);
    if (!songs || !songs[choice - 1]) return false;

    const song = songs[choice - 1];
    pendingNct.delete(key);

    try {
        const streamObj = song.streamURL?.find(st => st.type === "320") || song.streamURL?.[0];
        const streamUrl = streamObj?.stream || streamObj?.download;
        if (!streamUrl) return true;

        const tempMp3 = path.join(process.cwd(), `nct_${Date.now()}.mp3`);
        const res = await axios({ method: 'get', url: streamUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(tempMp3);
        res.data.pipe(writer);
        await new Promise((r, j) => { writer.on('finish', r); writer.on('error', j); });

        const audioData = await uploadAudioFile(tempMp3, api, threadId, threadType);
        await api.sendVoiceNative({ voiceUrl: audioData.voiceUrl, duration: audioData.duration, fileSize: audioData.fileSize, threadId, threadType });

        const buf = await drawZingPlayer({
            title: song.name,
            artistsNames: song.artistName,
            thumbnail: song.image || song.bgImage || song.artistImage,
            duration: song.duration || 0,
            sourceName: "Nhaccuatui"
        });
        const pPath = path.join(process.cwd(), `src/modules/cache/nct_p_${Date.now()}.png`);
        fs.writeFileSync(pPath, buf);
        await api.sendMessage({ attachments: [pPath] }, threadId, threadType);

        const thumbUrl = song.image || song.bgImage || song.artistImage;
        if (thumbUrl) {
            const tSpin = path.join(process.cwd(), `src/modules/cache/spin_${Date.now()}.webp`);
            if (await createSpinningSticker(thumbUrl, tSpin)) {
                const up = await api.uploadAttachment(tSpin, threadId, threadType);
                const u = up[0]?.fileUrl || up[0]?.url;
                if (u) await api.sendCustomSticker({ staticImgUrl: u, animationImgUrl: u, threadId, threadType });
                if (fs.existsSync(tSpin)) fs.unlinkSync(tSpin);
            }
        }
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    } catch (e) { log.error("NCT Handle Error:", e.message); }
    return true;
}
