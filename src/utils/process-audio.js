import axios from "axios";
import path from "node:path";
import fs from "node:fs";
import { exec } from "node:child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { log } from "../logger.js";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set correct paths for bundled ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path || ffprobePath);

const tempDir = path.join(process.cwd(), "src", "modules", "cache");

// Ensure cache directory exists
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Chuyển đổi file audio sang AAC (chuẩn Zalo Voice)
 */
export async function convertToAAC(inputPath) {
    const outputPath = inputPath.replace(path.extname(inputPath), ".aac");
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .audioCodec('aac')
                .audioBitrate('128k')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });
        return outputPath;
    } catch (error) {
        log.error("Lỗi khi chuyển đổi sang AAC:", error.message);
        throw error;
    }
}

/**
 * Lấy kích thước file (bytes)
 */
export async function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (e) {
        return 0;
    }
}

/**
 * Upload file audio lên Zalo và trả về URL
 * Hỗ trợ tự động convert nếu file quá nặng hoặc sai định dạng
 */
export async function uploadAudioFile(filePath, api, threadId, threadType) {
    let aacPath = null;
    try {
        const fileSize = await getFileSize(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let finalPath = filePath;
        // Nếu file > 9MB hoặc không phải aac/m4a thì convert sang aac để tối ưu
        if (fileSize > 9 * 1024 * 1024 || (ext !== ".aac" && ext !== ".m4a")) {
            log.info(`◈ Tối ưu hóa file audio (${ext})...`);
            aacPath = await convertToAAC(filePath);
            finalPath = aacPath;
        }

        const results = await api.uploadAttachment(finalPath, threadId, threadType);
        if (!results || results.length === 0) throw new Error("Upload audio thất bại.");

        let voiceUrl = results[0].fileUrl || results[0].url;

        // Trick: Thêm timestamp .aac để Zalo nhận diện là Voice Message (hiện sóng nhạc)
        if (!voiceUrl.endsWith(".aac")) {
            voiceUrl = `${voiceUrl}/${Date.now()}.aac`;
        }

        // Lấy duration bằng ffprobe
        const metadata = await new Promise((resolve) => {
            ffmpeg.ffprobe(finalPath, (err, meta) => {
                if (err) resolve({ format: { duration: 0 } });
                else resolve(meta);
            });
        });
        const duration = Math.round((metadata.format?.duration || 0) * 1000);

        return {
            voiceUrl,
            fileSize: await getFileSize(finalPath),
            duration,
            filePath: finalPath
        };
    } catch (error) {
        log.error("Lỗi upload Audio:", error.message);
        throw error;
    } finally {
        if (aacPath && fs.existsSync(aacPath)) {
            try { fs.unlinkSync(aacPath); } catch (e) { }
        }
    }
}

/**
 * Tách âm thanh từ video
 */
export async function extractAudioFromVideo(input, api, threadId, threadType) {
    const tempVideoPath = path.join(tempDir, `temp_v_${Date.now()}.mp4`);
    const tempAudioPath = path.join(tempDir, `temp_a_${Date.now()}.aac`);

    try {
        if (typeof input === 'string' && input.startsWith('http')) {
            const response = await axios({ url: input, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(tempVideoPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } else if (Buffer.isBuffer(input)) {
            fs.writeFileSync(tempVideoPath, input);
        } else if (fs.existsSync(input)) {
            fs.copyFileSync(input, tempVideoPath);
        }

        // Trích xuất audio dùng ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .vn()
                .audioCodec('aac')
                .audioBitrate('128k')
                .on('end', resolve)
                .on('error', reject)
                .save(tempAudioPath);
        });

        const result = await uploadAudioFile(tempAudioPath, api, threadId, threadType);
        return result;

    } catch (error) {
        log.error("Lỗi trích xuất audio:", error.message);
        throw error;
    } finally {
        if (fs.existsSync(tempVideoPath)) try { fs.unlinkSync(tempVideoPath); } catch (e) { }
        if (fs.existsSync(tempAudioPath)) try { fs.unlinkSync(tempAudioPath); } catch (e) { }
    }
}

/**
 * Tạo Sticker xoay tròn 360 độ từ ảnh (Hiệu ứng đĩa quay)
 * Dùng FFmpeg trực tiếp với rotate filter — không cần Worker Thread
 */
export async function createSpinningSticker(imageUrl, outputPath) {
    const id = Date.now();
    const tempIn = path.join(tempDir, `spin_in_${id}.png`);

    try {
        // 1. Tải ảnh gốc về disk
        const resp = await axios({ url: imageUrl, method: "GET", responseType: "arraybuffer", timeout: 10000 });
        fs.writeFileSync(tempIn, Buffer.from(resp.data));

        // 2. Dùng FFmpeg tạo animated WebP xoay tròn 360°, cắt hình tròn
        await new Promise((resolve, reject) => {
            const cmd = `"${ffmpegPath}" -y -i "${tempIn}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,rotate=2*PI*t/2:c=none:ow='iw':oh='ih',format=rgba,geq=r='r(X,Y)':a='if(gt(hypot(X-256,Y-256),256),0,alpha(X,Y))'" -t 2 -loop 0 -vcodec libwebp -lossless 0 -q:v 70 "${outputPath}"`;
            exec(cmd, (err) => { if (err) reject(err); else resolve(); });
        });

        return true;
    } catch (error) {
        log.error("Lỗi tạo spinning sticker:", error.message);
        return false;
    } finally {
        if (fs.existsSync(tempIn)) try { fs.unlinkSync(tempIn); } catch (e) { }
    }
}

export default { convertToAAC, getFileSize, uploadAudioFile, extractAudioFromVideo, createSpinningSticker };
