import { parentPort, workerData, isMainThread } from 'worker_threads';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Tắt cache Sharp để tiết kiệm RAM cho VPS của sếp DGK! 🧹✨
sharp.cache(false);

// 🛡️ Guard Clause: Chỉ chạy nếu là Worker, không chạy khi bót khởi động bình thường
if (!isMainThread && workerData) {
    processFrames().catch(err => {
        console.error('Worker Error:', err);
        process.exit(1);
    });
}

async function processFrames() {
    const { startFrame, endFrame, size, totalFrames, framesDir, imageBuffer, circleMask } = workerData;

    for (let i = startFrame; i < endFrame; i++) {
        const frameName = `frame_${String(i).padStart(3, '0')}.png`;
        const framePath = path.join(framesDir, frameName);

        // Bo tròn ảnh tĩnh bằng Sharp
        await sharp(imageBuffer)
            .resize(size, size)
            .composite([{
                input: circleMask,
                blend: 'dest-in'
            }])
            .png()
            .toFile(framePath);
    }

    parentPort.postMessage('done');
}
