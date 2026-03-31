import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";
import { rentalManager } from "../utils/rentalManager.js";
import { downloadYoutube } from "../utils/youtube.js";
import { drawZingSearch, drawZingPlayer } from "../utils/canvasHelper.js";
import { uploadToTmpFiles } from "../utils/tmpFiles.js";
import { createSpinningSticker } from "../utils/process-audio.js";

export const name = "yt";
export const description = "Tìm kiếm và tải video YouTube";

const pendingDownloads = new Map();

async function reply(ctx, text) {
    await ctx.api.sendMessage(
        { msg: text, quote: ctx.message.data },
        ctx.threadId,
        ctx.threadType
    );
}

// Helper: download video file 
function downloadFile(url, filepath) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: 'GET',
                url,
                responseType: 'stream',
                timeout: 120000,
                maxRedirects: 10,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const file = fs.createWriteStream(filepath);
            response.data.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (err) => {
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                reject(err);
            });
        } catch (err) {
            if (fs.existsSync(filepath)) try { fs.unlinkSync(filepath); } catch (e) { }
            reject(err);
        }
    });
}

export const commands = {
    yt: async (ctx) => {
        const { api, args, threadId, threadType, prefix } = ctx;
        const query = args.join(" ").trim();
        if (!query) return reply(ctx, `[ 💡 HƯỚNG DẪN ]\n─────────────────\n‣ Dùng: ${prefix}yt [tên video]\n‣ Ví dụ: ${prefix}yt remix 2024`);

        try {
            const res = await axios.get(`https://aminul-youtube-api.vercel.app/search?query=${encodeURIComponent(query)}`);
            const data = res.data;

            if (!data || data.length === 0) {
                return reply(ctx, "⚠️ Rất tiếc, Bot không tìm thấy video nào phù hợp với từ khóa của bạn.");
            }

            const videos = data.slice(0, 10);
            pendingDownloads.set(`${threadId}-${ctx.senderId}`, videos);

            // Giao diện Canvas: Map full thông tin
            const mappedVideos = videos.map(v => ({
                title: v.title,
                artistsNames: v.author?.name || "YouTube Channel",
                thumbnail: v.thumbnail,
                duration: v.timestamp || v.duration || "0:00",
                views: v.views,
                uploaded: v.uploaded || v.ago
            }));

            // Vẽ Canvas Search chuyên nghiệp
            const buffer = await drawZingSearch(mappedVideos, query, "YOUTUBE");
            const tempImg = path.join(process.cwd(), `src/modules/cache/yt_s_${Date.now()}.png`);
            if (!fs.existsSync(path.dirname(tempImg))) fs.mkdirSync(path.dirname(tempImg), { recursive: true });
            fs.writeFileSync(tempImg, buffer);

            const remoteUrl = await uploadToTmpFiles(tempImg, api, threadId, threadType);
            const statusMsg = `[ 📺 YOUTUBE SEARCH ]\n─────────────────\n🔎 Tìm kiếm: "${query}"\n✨ Phản hồi số 𝟭-${videos.length} để tải video!\n🚀 Tốc độ tải cực nhanh (Full HD).`;

            if (remoteUrl) {
                await api.sendImageEnhanced({
                    imageUrl: remoteUrl,
                    threadId, threadType,
                    width: 1280, height: 720,
                    msg: statusMsg
                });
            } else {
                await api.sendMessage({ msg: statusMsg, attachments: [tempImg] }, threadId, threadType);
            }

            if (fs.existsSync(tempImg)) fs.unlinkSync(tempImg);

        } catch (err) {
            log.error("YT Search error:", err.message);
            reply(ctx, "⚠️ Hệ thống tìm kiếm YouTube đang bận. Vui lòng thử lại sau!");
        }
    },
    ytb: async (ctx) => commands.yt(ctx),
    youtube: async (ctx) => commands.yt(ctx)
};

export async function handle(ctx) {
    const { content, senderId, threadId, api, threadType, adminIds } = ctx;
    if (!adminIds.includes(String(senderId)) && !rentalManager.isRented(threadId)) return false;

    const choice = parseInt(content);
    if (isNaN(choice) || choice < 1 || choice > 10) return false;

    const key = `${threadId}-${senderId}`;
    const videos = pendingDownloads.get(key);
    if (!videos || !videos[choice - 1]) return false;

    const video = videos[choice - 1];
    pendingDownloads.delete(key);

    const loadingMsg = await api.sendMessage(`⏳ [ Đang xử lý ]\n─────────────────\n‣ Video: "${video.title}"\n‣ Vui lòng chờ trong giây lát...`, threadId, threadType);

    try {
        const downloadInfo = await downloadYoutube(video.url);

        if (!downloadInfo.success || !downloadInfo.result?.video) {
            throw new Error(downloadInfo.message || "API không trả về dữ liệu video.");
        }

        const videoData = downloadInfo.result.video;
        const videoList = videoData.videos || [];
        const withAudio = videoList.filter(v => v.hasAudio);
        const best = withAudio[withAudio.length - 1] || videoList[0];

        const videoUrl = best?.url;
        if (!videoUrl) throw new Error("Không lấy được link tải video.");

        const tempFile = path.join(process.cwd(), `yt_vid_${Date.now()}.mp4`);
        await downloadFile(videoUrl, tempFile);

        // 3. Gửi Player Card chuẩn Zing cho Video YouTube
        try {
            const mappedTrack = {
                title: video.title,
                artistsNames: video.author?.name || "YouTube",
                thumbnail: video.thumbnail,
                duration: video.timestamp || video.duration || "0:00",
                sourceName: "YouTube"
            };
            const cardBuffer = await drawZingPlayer(mappedTrack);
            const cardPath = path.join(process.cwd(), `src/modules/cache/yt_p_${Date.now()}.png`);
            fs.writeFileSync(cardPath, cardBuffer);

            const cardUrl = await uploadToTmpFiles(cardPath, api, threadId, threadType);
            if (cardUrl) {
                await api.sendImageEnhanced({
                    imageUrl: cardUrl,
                    threadId, threadType,
                    width: 1100, height: 500,
                    msg: `🎬 Đang chuẩn bị trình phát...\n🎵 Title: ${video.title}`
                });
            }
            if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);

            // 3.5. Hiệu ứng Sticker Đĩa quay
            if (video.thumbnail) {
                const spinPath = path.join(process.cwd(), `src/modules/cache/spin_yt_${Date.now()}.webp`);
                const spinOk = await createSpinningSticker(video.thumbnail, spinPath);
                if (spinOk) {
                    const spinUrl = await uploadToTmpFiles(spinPath, api, threadId, threadType);
                    if (spinUrl) {
                        await api.sendCustomSticker({
                            staticImgUrl: spinUrl, animationImgUrl: spinUrl,
                            threadId, threadType, width: 512, height: 512
                        });
                    }
                    if (fs.existsSync(spinPath)) fs.unlinkSync(spinPath);
                }
            }
        } catch (cardErr) {
            log.warn("Lỗi gửi YT Player Card:", cardErr.message);
        }

        // 4. Gửi Video (Tải nhanh - Zalo CDN)
        try {
            log.info(`◈ Đang upload video lên Zalo CDN...`);
            const uploads = await api.uploadAttachment(tempFile, threadId, threadType);
            if (!uploads || uploads.length === 0) throw new Error("Upload lên Zalo thất bại.");

            const zaloUrl = uploads[0].fileUrl || uploads[0].url || uploads[0].href;
            if (!zaloUrl) throw new Error("Không lấy được link nội bộ Zalo.");

            const stats = fs.statSync(tempFile);
            const statusMsg = `✅ [ TẢI THÀNH CÔNG ]\n─────────────────\n📽️ Video: ${video.title}\n👤 Kênh: ${video.author?.name}\n─────────────────\n✨ Chúc bạn xem video vui vẻ!`;

            await api.sendVideoEnhanced({
                videoUrl: zaloUrl,
                thumbnailUrl: video.thumbnail || "https://drive.google.com/uc?id=1pCQPRic8xPxbgUaPSIczb94S4RDdWDHK&export=download",
                duration: 10000, width: 720, height: 1280, fileSize: stats.size,
                msg: statusMsg,
                threadId, threadType
            });
            log.success(`✅ Đã gửi video YouTube thành công.`);
        } catch (e) {
            log.error(`⚠️ Lỗi gửi trình phát: ${e.message}`);
            await api.sendVideoUnified({
                videoPath: tempFile,
                thumbnailUrl: video.thumbnail,
                msg: `✅ [ TẢI THÀNH CÔNG ]\n📽️ Video: ${video.title}`,
                threadId, threadType
            });
        }

        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        try {
            await api.undo({ msgId: loadingMsg.data.msgId, cliMsgId: loadingMsg.data.cliMsgId }, threadId, threadType);
        } catch { }

    } catch (err) {
        log.error("YT Download error:", err.message);
        reply(ctx, `⚠️ Lỗi quá trình tải: ${err.message}`);
    }
    return true;
}
