import fs from "node:fs";
import axios from "axios";
import yts from "youtube-search-api";
import path from "node:path";
import { createCanvas, registerFont, loadImage } from "canvas";
import { uploadToTmpFiles } from "../utils/tmpFiles.js";
import { downloadYoutubeMp3 } from "../utils/ytdown.js";
import { downloadYoutube as getYoutubeDownload } from "../utils/youtube.js";
import { drawZingSearch, drawZingPlayer } from "../utils/canvasHelper.js";
import { createSpinningSticker } from "../utils/process-audio.js";
import { log } from "../logger.js";

export const name = "sing";
export const description = "Play YouTube với card âm nhạc";

const pendingSing = new Map();


// Aggressive cache cleanup
async function cleanCache() {
    const dir = path.join(process.cwd(), "src/modules/cache");
    if (!fs.existsSync(dir)) return;
    try {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
            if (file.startsWith("sing-") || file.startsWith("card-")) {
                try { await fs.promises.unlink(path.join(dir, file)); } catch (e) { }
            }
        }
    } catch (e) { }
}


const fontPath = path.join(process.cwd(), "src/modules/cache/BeVietnamPro-Bold.ttf");
try {
    registerFont(fontPath, { family: "BeVietnamProBold" });
} catch (e) { }

export const commands = {
    sing: async (ctx) => {
        await singHandler(ctx);
    },
    music: async (ctx) => {
        await singHandler(ctx);
    }
};

async function singHandler(ctx) {
    const { api, threadId, threadType, args, senderId } = ctx;
    if (!args[0]) return api.sendMessage({ msg: "❎ Nhập từ khoá hoặc link YouTube" }, threadId, threadType);

    await cleanCache();
    const q = args.join(" ").trim();
    const cacheDir = path.join(process.cwd(), "src/modules/cache");
    if (!fs.existsSync(cacheDir)) await fs.promises.mkdir(cacheDir, { recursive: true });

    // Handle Direct Link
    if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(q)) {
        try {
            await api.sendMessage({ msg: "⏳ Đang xử lý yêu cầu, vui lòng đợi..." }, threadId, threadType);
            const mp3Path = path.join(cacheDir, `sing-${senderId}-${Date.now()}.mp3`);
            const imgPath = path.join(cacheDir, `card-${senderId}-${Date.now()}.png`);

            const st = Date.now();
            const meta = await downloadYoutube(q, mp3Path);
            const processTime = Math.floor((Date.now() - st) / 1000);

            // Map meta to ZingPlayer format
            const songData = {
                title: meta.title,
                artistsNames: meta.author,
                thumbnail: meta.thumb,
                duration: meta.duration,
                views: meta.views,
                date: meta.date,
                processTime: processTime,
                sourceName: "YOUTUBE MUSIC"
            };

            const playerCardBuffer = await drawZingPlayer(songData);
            await fs.promises.writeFile(imgPath, playerCardBuffer);

            await sendMusicResult(api, threadId, threadType, imgPath, mp3Path, meta);
        } catch (e) {
            return api.sendMessage({ msg: "❎ Lỗi: " + e.message }, threadId, threadType);
        }
        return;
    }

    // Handle Search
    try {
        await api.sendMessage({ msg: `🔍 Đang tìm kiếm: ${q}...` }, threadId, threadType);
        const results = await yts.GetListByKeyword(q, false, 8);
        if (!results.items?.length) return api.sendMessage({ msg: "❎ Không tìm thấy kết quả nào." }, threadId, threadType);

        // Create songs list for Canvas
        const songs = results.items.map(v => ({
            id: v.id,
            title: v.title,
            artistsNames: v.channelTitle || "YouTube",
            thumbnail: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
            duration: v.length?.simpleText || "00:00",
            views: v.viewCount?.shortBylineText || v.viewCount?.simpleText || "0"
        }));

        const searchCardBuffer = await drawZingSearch(songs, q, "YOUTUBE MUSIC");
        const searchCardPath = path.join(cacheDir, `search-${senderId}-${Date.now()}.png`);
        await fs.promises.writeFile(searchCardPath, searchCardBuffer);

        const cardUrl = await uploadToTmpFiles(searchCardPath, api, threadId, threadType);

        let sentMsg;
        if (cardUrl && api.sendImageEnhanced) {
            sentMsg = await api.sendImageEnhanced({
                imageUrl: cardUrl,
                threadId, threadType,
                msg: `🎵 Kết quả tìm kiếm cho: "${q}"\n📌 Reply số thứ tự (1-${songs.length}) để tải nhạc.`
            });
        } else {
            sentMsg = await api.sendMessage({
                msg: `🎵 Kết quả tìm kiếm cho: "${q}"\n📌 Reply số thứ tự (1-${songs.length}) để tải nhạc.`,
                attachments: [searchCardPath]
            }, threadId, threadType);
        }

        // Cleanup search card after sending
        if (fs.existsSync(searchCardPath)) await fs.promises.unlink(searchCardPath).catch(() => { });

        pendingSing.set(senderId, {
            links: songs.map(s => s.id),
            threadId,
            messageID: sentMsg?.message || sentMsg?.messageID // Handle different API return formats
        });

    } catch (e) {
        return api.sendMessage({ msg: "❎ Lỗi tìm kiếm: " + e.message }, threadId, threadType);
    }
}

// Interactive handler (for replies)
export async function handle(ctx) {
    const { api, message, threadId, threadType, senderId, content } = ctx;
    if (!pendingSing.has(senderId)) return false;

    const session = pendingSing.get(senderId);
    if (session.threadId !== threadId) return false;

    const choice = parseInt(content.trim());
    if (isNaN(choice) || choice < 1 || choice > session.links.length) return false; // Not a valid choice for this module

    const videoId = session.links[choice - 1];
    pendingSing.delete(senderId);

    await cleanCache();
    const cacheDir = path.join(process.cwd(), "src/modules/cache");
    const mp3Path = path.join(cacheDir, `sing-${senderId}-${Date.now()}.mp3`);
    const imgPath = path.join(cacheDir, `card-${senderId}-${Date.now()}.png`);

    try {
        await api.sendMessage({ msg: "⏳ Đang tải bản nhạc bạn chọn..." }, threadId, threadType);
        const st = Date.now();
        const meta = await downloadYoutube(`https://www.youtube.com/watch?v=${videoId}`, mp3Path);
        const processTime = Math.floor((Date.now() - st) / 1000);

        // Map meta to ZingPlayer format
        const songData = {
            title: meta.title,
            artistsNames: meta.author,
            thumbnail: meta.thumb,
            duration: meta.duration,
            views: meta.views,
            date: meta.date,
            processTime: processTime,
            sourceName: "YOUTUBE MUSIC"
        };

        const playerCardBuffer = await drawZingPlayer(songData);
        await fs.promises.writeFile(imgPath, playerCardBuffer);

        // Try to undo the search list message
        if (session.messageID) {
            api.undo(session.messageID, threadId, threadType).catch(() => { });
        }

        await sendMusicResult(api, threadId, threadType, imgPath, mp3Path, meta);
    } catch (e) {
        api.sendMessage({ msg: "❎ Lỗi: " + e.message }, threadId, threadType);
    }

    return true; // Mark as handled
}

async function getVideoDetails(id) {
    try {
        const r = await axios.post(
            "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2i5kNbQO2FhW6V0aG2s7YdmH8W1w",
            { videoId: id, context: { client: { clientName: "WEB", clientVersion: "2.20240801.01.00" } } },
            { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" } }
        );
        const d = r.data.videoDetails;
        let date = "?";
        try {
            const iso = r.data.microformat.playerMicroformatRenderer.publishDate;
            const dt = new Date(iso);
            date = `${("0" + dt.getDate()).slice(-2)}/${("0" + (dt.getMonth() + 1)).slice(-2)}/${dt.getFullYear()}`;
        } catch { }
        return {
            title: d.title,
            author: d.author,
            duration: Number(d.lengthSeconds),
            views: Number(d.viewCount),
            date
        };
    } catch {
        return { title: "?", author: "?", duration: 0, views: 0, date: "?" };
    }
}

async function downloadYoutube(url, outputPath) {
    try {
        const downloadUrl = await downloadYoutubeMp3(url);

        const id = url.includes("v=") ? url.split("v=")[1].split("&")[0] : url.split("/").pop().split("?")[0];
        const meta = await getVideoDetails(id);

        const b = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 120000
        });

        await fs.promises.writeFile(outputPath, Buffer.from(b.data));

        return {
            ...meta,
            thumb: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
        };
    } catch (e) {
        throw new Error(e.message || "Không thể tải nhạc từ YouTube.");
    }
}

const formatDuration = t => `${Math.floor(t / 60)}:${("0" + (t % 60)).slice(-2)}`;

function fitText(ctx, text, maxW, startFS, minFS) {
    let fs = startFS;
    while (fs >= minFS) {
        ctx.font = `bold ${fs}px BeVietnamProBold, sans-serif`;
        if (ctx.measureText(text).width <= maxW) return { text, fs };
        fs--;
    }
    let t = text;
    while (ctx.measureText(t + "...").width > maxW && t.length > 5) t = t.slice(0, -1);
    return { text: t + "...", fs: minFS };
}

async function sendMusicResult(api, threadId, threadType, imgPath, mp3Path, meta) {
    try {
        const remoteImgUrl = await uploadToTmpFiles(imgPath, api, threadId, threadType);
        const statusMsg = `[ � YOUTUBE PLAYER ]\n─────────────────\n✨ Đang phát nhạc cho bạn:\n🎵 Title: ${meta.title}\n👤 Artist: ${meta.author}\n─────────────────`;

        if (remoteImgUrl && api.sendImageEnhanced) {
            await api.sendImageEnhanced({
                imageUrl: remoteImgUrl,
                threadId, threadType,
                msg: statusMsg,
                width: 1100,
                height: 500
            });
        } else {
            await api.sendMessage({ msg: statusMsg, attachments: [imgPath] }, threadId, threadType);
        }

        // Send audio
        if (api.sendVoiceUnified) {
            await api.sendVoiceUnified({ filePath: mp3Path, threadId, threadType });
        } else {
            await api.sendMessage({ msg: "🎧 Bản nhạc của bạn", attachments: [mp3Path] }, threadId, threadType);
        }

        // ─── TÍNH NĂNG ĐĨA QUAY (SPINNING DISC) ───
        if (meta.thumb) {
            const tempSpinOut = path.join(process.cwd(), `src/modules/cache/spin_${Date.now()}.webp`);
            try {
                const spinOk = await createSpinningSticker(meta.thumb, tempSpinOut);
                if (spinOk) {
                    const uploadSpin = await api.uploadAttachment(tempSpinOut, threadId, threadType);
                    const spinUrl = uploadSpin[0]?.fileUrl || uploadSpin[0]?.url || (typeof uploadSpin[0] === 'string' ? uploadSpin[0] : null);
                    if (spinUrl) {
                        await api.sendCustomSticker({
                            staticImgUrl: spinUrl,
                            animationImgUrl: spinUrl,
                            threadId, threadType,
                            width: 512, height: 512
                        });
                    }
                }
            } catch (spinErr) {
                console.error("Lỗi gửi Spin Sticker:", spinErr.message);
            } finally {
                if (fs.existsSync(tempSpinOut)) await fs.promises.unlink(tempSpinOut).catch(() => { });
            }
        }

        // Cleanup
        try { if (fs.existsSync(imgPath)) await fs.promises.unlink(imgPath); } catch (e) { }
        try { if (fs.existsSync(mp3Path)) await fs.promises.unlink(mp3Path); } catch (e) { }

    } catch (e) {
        console.error("Lỗi khi gửi kết quả nhạc:", e.message);
    }
}
