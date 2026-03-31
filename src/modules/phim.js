import { getLatest, getDetail, search } from "../utils/ophim.js";
import { log } from "../logger.js";
import { downloadFile, deleteFile } from "../utils/util.js";
import path from "node:path";
import fs from "node:fs";
import ffmpeg from "fluent-ffmpeg";

export const name = "phim";
export const description = "Tìm kiếm và lấy link xem phim từ Ophim";

const movieSessions = new Map();

/**
 * Download HLS (m3u8) to MP4
 */
async function downloadHls(url, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(url)
            .outputOptions("-c copy")
            .outputOptions("-bsf:a aac_adtstoasc")
            .on("end", resolve)
            .on("error", (err) => {
                console.error("FFmpeg Error:", err);
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * Compress video to under 100MB
 */
async function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // First get duration using ffprobe
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err);
            const duration = metadata.format.duration;
            if (!duration) return reject(new Error("Không thể lấy thời lượng video."));

            // Calculate target bitrate (targeting ~90MB for safety)
            const targetSizeBits = 90 * 1024 * 1024 * 8;
            const targetBitrate = Math.floor(targetSizeBits / duration);
            
            // Limit minimum quality so it's not totally unwatchable
            const videoBitrate = Math.max(targetBitrate - 64000, 100000); // 100kbps min video

            ffmpeg(inputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .audioBitrate('64k')
                .videoBitrate(`${videoBitrate / 1000}k`)
                .size('640x?') // Scale to preserve aspect ratio
                .outputOptions([
                    "-preset veryfast",
                    "-crf 28", // Balance speed/quality
                    "-maxrate 1M",
                    "-bufsize 2M"
                ])
                .on("end", resolve)
                .on("error", (err) => {
                    console.error("Compression Error:", err);
                    reject(err);
                })
                .save(outputPath);
        });
    });
}

/**
 * Split video into parts under 100MB
 */
async function splitVideo(inputPath, outputPattern) {
    return new Promise((resolve, reject) => {
        // -segment_time is tricky because it depends on bitrate.
        // Better: calculate parts and split accurately using seek/duration,
        // or just use segment for ease (though size might vary).
        // Let's use segment with a safe duration (e.g. 10 mins parts)
        ffmpeg(inputPath)
            .outputOptions([
                "-c copy",
                "-map 0",
                "-segment_time 00:05:00", // 5 minute parts to be VERY safe with Zalo's 100MB
                "-f segment",
                "-reset_timestamps 1"
            ])
            .on("end", resolve)
            .on("error", reject)
            .save(outputPattern);
    });
}

export const commands = {
    phim: async (ctx) => {
        const { api, threadId, threadType, args, senderId } = ctx;
        const subCmd = args[0]?.toLowerCase();

        if (subCmd === "search" || (!subCmd && args.length > 0)) {
            const query = (subCmd === "search" ? args.slice(1).join(" ") : args.join(" ")).trim();
            if (!query) return api.sendMessage({ msg: "🔍 Nhập tên phim cần tìm (VD: -phim naruto)" }, threadId, threadType);

            try {
                const res = await search(query);
                const items = res.items || res.data?.items;
                if (!items?.length) return api.sendMessage({ msg: "❎ Không tìm thấy phim này." }, threadId, threadType);

                let reply = `🎬 Kết quả tìm kiếm cho: "${query}"\n─────────────────\n`;
                items.slice(0, 10).forEach((item, index) => {
                    reply += `${index + 1}. ${item.name} (${item.year})\n`;
                });
                reply += `─────────────────\n📌 Phản hồi STT để xem chi tiết.`;

                const sent = await api.sendMessage({ msg: reply }, threadId, threadType);
                movieSessions.set(senderId, {
                    type: "list",
                    items: items.slice(0, 10).map(i => i.slug),
                    threadId
                });
            } catch (err) {
                api.sendMessage({ msg: "❌ Lỗi: " + err.message }, threadId, threadType);
            }
        } 
        else if (subCmd === "latest" || subCmd === "hot" || !subCmd) {
            try {
                const res = await getLatest(1);
                const items = res.items || res.data?.items;
                if (!items?.length) return api.sendMessage({ msg: "❎ Không có phim mới." }, threadId, threadType);

                let reply = `🔥 Phim mới nhất\n─────────────────\n`;
                items.slice(0, 15).forEach((item, index) => {
                    reply += `${index + 1}. ${item.name} (${item.year})\n`;
                });
                reply += `─────────────────\n📌 Phản hồi STT để xem chi tiết.`;

                await api.sendMessage({ msg: reply }, threadId, threadType);
                movieSessions.set(senderId, {
                    type: "list",
                    items: items.slice(0, 15).map(i => i.slug),
                    threadId
                });
            } catch (err) {
                api.sendMessage({ msg: "❌ Lỗi: " + err.message }, threadId, threadType);
            }
        }
    }
};

export async function handle(ctx) {
    const { api, threadId, threadType, senderId, content } = ctx;
    if (!movieSessions.has(senderId)) return false;

    const session = movieSessions.get(senderId);
    if (session.threadId !== threadId) return false;

    const input = content.trim().toLowerCase();
    
    // Handle download request: "tải [số]" or just "[số]"
    const isDownload = input.startsWith("tải") || input.startsWith("dl");
    const cleanInput = isDownload ? input.replace(/^(tải|dl)\s*/, "").trim() : input;
    const idx = parseInt(cleanInput) - 1;

    if (isNaN(idx) || idx < 0 || idx >= session.items.length) return false;

    // IF in Download mode (after details)
    if (session.type === "detail") {
        if (!isDownload) return false; // Must explicitly say "tải" if already in detail view
        
        const ep = session.items[idx];
        if (!ep.link_m3u8) return api.sendMessage({ msg: "❎ Link này không hỗ trợ tải." }, threadId, threadType);

        try {
            await api.sendMessage({ msg: `⏳ Đang tiến hành tải video: "${ep.name}"...\n⚠️ Quá trình này có thể mất vài phút tùy độ dài phim.` }, threadId, threadType);
            
            const cacheDir = path.join(process.cwd(), "src/modules/cache");
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
            const videoPath = path.join(cacheDir, `movie_${Date.now()}.mp4`);
            
            await downloadHls(ep.link_m3u8, videoPath);
            
            const stats = fs.statSync(videoPath);
            if (stats.size > 100 * 1024 * 1024) {
                // Default: Try to compress if requested "nén" or just as improvement
                await api.sendMessage({ msg: `⚠️ Tệp quá lớn (${(stats.size/1024/1024).toFixed(2)}MB). Bot đang tiến hành NÉN phim để gửi cho bạn "Một cục" duy nhất dưới 100MB...` }, threadId, threadType);
                
                const compressedPath = path.join(cacheDir, `movie_compressed_${Date.now()}.mp4`);
                try {
                    await compressVideo(videoPath, compressedPath);
                    if (api.sendVideoUnified) {
                        await api.sendVideoUnified({ videoPath: compressedPath, threadId, threadType, msg: `🎬 Phim của bạn (Đã nén): ${ep.name}` });
                    } else {
                        await api.sendMessage({ msg: `🎬 Video (Đã nén): ${ep.name}`, attachments: [compressedPath] }, threadId, threadType);
                    }
                } catch (e) {
                    await api.sendMessage({ msg: "❌ Nén thất bại, Bot sẽ chia nhỏ tệp để gửi thay thế..." }, threadId, threadType);
                    // Split fallback
                    const splitPattern = path.join(cacheDir, `movie_part_%03d.mp4`);
                    await splitVideo(videoPath, splitPattern);
                    const files = fs.readdirSync(cacheDir).filter(f => f.startsWith("movie_part_") && f.endsWith(".mp4")).sort();
                    for (let i = 0; i < files.length; i++) {
                        const partPath = path.join(cacheDir, files[i]);
                        await api.sendMessage({ msg: `🎬 Phần ${i + 1}/${files.length} của phim: ${ep.name}` }, threadId, threadType);
                        if (api.sendVideoUnified) await api.sendVideoUnified({ videoPath: partPath, threadId, threadType });
                        else await api.sendMessage({ attachments: [partPath] }, threadId, threadType);
                        deleteFile(partPath);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } finally {
                    deleteFile(compressedPath);
                }
                
                deleteFile(videoPath);
                return;
            }

            if (api.sendVideoUnified) {
                await api.sendVideoUnified({ videoPath, threadId, threadType, msg: `🎬 Phim của bạn: ${ep.name}` });
            } else {
                await api.sendMessage({ msg: `🎬 Video: ${ep.name}`, attachments: [videoPath] }, threadId, threadType);
            }
            
            deleteFile(videoPath);
        } catch (err) {
            api.sendMessage({ msg: "❌ Lỗi khi tải phim: " + err.message }, threadId, threadType);
        }
        return true;
    }

    // Default: Show Details
    const slug = session.items[idx];
    movieSessions.delete(senderId);

    try {
        await api.sendMessage({ msg: "⏳ Đang lấy thông tin chi tiết..." }, threadId, threadType);
        const data = await getDetail(slug);
        const movie = data.movie || data.data?.item;
        const episodes = data.episodes || data.data?.item?.episodes;
        
        if (movie) {
            const m = movie;
            let info = `🎬 [ ${m.name.toUpperCase()} ]\n`;
            if (m.origin_name) info += `📽️ Tên gốc: ${m.origin_name}\n`;
            info += `📅 Năm: ${m.year}\n`;
            info += `⏱️ Thời lượng: ${m.time}\n`;
            info += `🏷️ Thể loại: ${m.category?.map(c => c.name).join(", ")}\n`;
            info += `🌍 Quốc gia: ${m.country?.map(c => c.name).join(", ")}\n`;
            info += `🌟 Trạng thái: ${m.status}\n`;
            info += `─────────────────\n`;
            
            const serverData = episodes?.[0]?.server_data || m.episodes?.[0]?.server_data;
            if (serverData && serverData.length > 0) {
                info += `📺 Danh sách tập:\n`;
                serverData.slice(-10).forEach((e, i) => {
                    info += `${i + 1}. ${e.name}\n`;
                });
                info += `─────────────────\n💡 Reply STT để xem link m3u8.\n💡 Reply "tải [số]" để Bot tải video gửi cho bạn.`;

                // Update session to allow choosing episode for download
                movieSessions.set(senderId, {
                    type: "detail",
                    items: serverData.slice(-10),
                    threadId
                });
            }

            if (m.thumb_url) {
                const cacheDir = path.join(process.cwd(), "src/modules/cache");
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                const thumbPath = path.join(cacheDir, `ophim_${Date.now()}.jpg`);
                try {
                    await downloadFile(m.thumb_url, thumbPath);
                    await api.sendMessage({ msg: info, attachments: [thumbPath] }, threadId, threadType);
                } catch (e) {
                    await api.sendMessage({ msg: info }, threadId, threadType);
                } finally {
                    deleteFile(thumbPath);
                }
            } else {
                await api.sendMessage({ msg: info }, threadId, threadType);
            }
        }
    } catch (err) {
        api.sendMessage({ msg: "❌ Lỗi detail: " + err.message }, threadId, threadType);
    }

    return true;
}
