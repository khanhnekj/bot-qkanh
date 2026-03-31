import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { uploadToTmpFiles } from '../utils/tmpFiles.js';

export const name = "ghepmat";
export const description = "Ghép mặt từ ảnh này sang ảnh khác";

export const pendingGhepMat = new Map();

/**
 * Hàm trợ giúp: Tự động phát hiện URL hay File để tạo Stream
 */
async function layDuLieuAnh(input) {
    if (input.startsWith('http://') || input.startsWith('https://')) {
        console.log(`>> Đang tải dữ liệu từ URL: ${input}...`);
        const response = await axios.get(input, { responseType: 'arraybuffer' });
        return {
            data: Buffer.from(response.data),
            options: {
                contentType: 'image/jpeg'
            }
        };
    } else {
        const data = await fs.promises.readFile(input);
        return {
            data: data,
            options: {
                filename: path.basename(input)
            }
        };
    }
}

async function ghepMat(sourceInput, targetInput) {
    try {
        const form = new FormData();
        const source = await layDuLieuAnh(sourceInput);
        const target = await layDuLieuAnh(targetInput);

        form.append('source', source.data, { ...source.options, filename: 'source.jpg' });
        form.append('target', target.data, { ...target.options, filename: 'target.jpg' });

        form.append('check-nsfw', 'true');
        form.append('enhancer', 'true');

        const headers = {
            ...form.getHeaders(),
            'content-length': form.getLengthSync().toString(),
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
            'cache-control': 'no-cache',
            'cookie': '_ga=GA1.1.1594344049.1748408562; cf_clearance=oH.Iw7sStm2T9VFlVHCNqDfwWFALfEJ8kBLCtu8GFsQ-1763737848-1.2.1.1-Cn.LFm6Wxq4YNXFNVnhBOeybPt_xQ2jewqNxj3A7_wLLSk2iHjY.HMSOtCmrKg1gfdfQve9BZ7QLoTcmfZOHyOhiIDOrw59uPjJy1x0kvrQSOT5ywpjKutRyozBuNi7c36liyhgqhpi55zk9wtMUNQaTWetm.4JOSiPVCLQTJpqZ4_Ux9UZ0RVYhFFuIBh0LRYKrBeB_UFB28vsxvelwDLHy_4JXvB3Myu6ZPx.ZclA; __gads=ID=eef09024a5cfd4ab:T=1748408570:RT=1772961016:S=ALNI_MZumfFIZXb09NGAFW5WMT8LulzMqQ; __eoi=ID=8a7345b40cf77301:T=1764037657:RT=1772961016:S=AA-AfjbmEVHBXmZmIVk0EATrZH3U; pvc_visits[0]=1772961213b7493; _ga_WBHK34L0J9=GS2.1.s1772960973$o37$g1$t1772961172$j52$l0$h0; FCCDCF=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B32%2C%22%5B%5C%2255d83103-a029-4fb0-807a-993e0255bd46%5C%22%2C%5B1763732933%2C995000000%5D%5D%22%5D%5D%5D; FCNEC=%5B%5B%22AKsRol-XylfY-_ELEo2JUhhAV2QifFiuCplreeMh2ZEl3KrOaT-rJvhbKq4IUQFMQaB0m2s-unCnaYEPVrWGBINUKgJIIMae3V2PJmte9txOppW-Jjbkoj1RwkFhWkBGMJmCXIF3dPphIGGNgE8PcdlThbjn-TXaLw%3D%3D%22%5D%5D',
            'origin': 'https://taoanhdep.com',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
            'Referer': 'https://taoanhdep.com/'
        };

        console.log('>> Đang gửi yêu cầu ghép...');
        const response = await axios.post('https://taoanhdep.com/public/doi-mat.php', form, { headers });

        let resData = response.data;
        if (typeof resData === 'string') {
            if (resData.trim().startsWith('<')) {
                throw new Error('API taoanhdep.com đang bảo trì hoặc chặn yêu cầu (Trả về HTML). Vui lòng thử lại sau.');
            }
            try { resData = JSON.parse(resData); } catch (e) { }
        }

        if (resData && resData.image) {
            return resData.image;
        } else if (resData && resData.error) {
            throw new Error(resData.error);
        } else {
            throw new Error(resData?.msg || 'API không trả về kết quả.');
        }
    } catch (error) {
        console.error('Lỗi ghép mặt:', error.message);
        throw error;
    }
}

const extractImageUrl = (attachStr) => {
    if (!attachStr) return null;
    try {
        let attachObj = typeof attachStr === "string" ? JSON.parse(attachStr) : attachStr;

        // Nếu Zalo trả về mảng ảnh
        if (Array.isArray(attachObj) && attachObj.length > 0) {
            attachObj = attachObj[0];
        }

        let url = null;
        if (attachObj.params) {
            let paramsObj = typeof attachObj.params === "string" ? JSON.parse(attachObj.params) : attachObj.params;
            if (paramsObj.hd) url = paramsObj.hd;
            else if (paramsObj.url) url = paramsObj.url;
        }

        if (!url && attachObj.href) {
            url = attachObj.href;
        }

        if (url && typeof url === 'string') {
            url = url.trim().replace(/^"|"$/g, '');
            if (url.startsWith("http")) return url;
        }
    } catch (e) {
        // Ignore parse errors
    }
    return null;
};

async function processGhepMat(ctx, sourceUrl, targetUrl, pendingNotiMsg = null) {
    const { api, threadId, threadType, log } = ctx;
    let waitRes = null;
    try {
        waitRes = await api.sendMessage({ msg: "⏳ Đang ghép mặt, vui lòng chờ trong giây lát..." }, threadId, threadType);

        log.info(`[GhepMat] Source: ${sourceUrl} | Target: ${targetUrl}`);
        const resultData = await ghepMat(sourceUrl, targetUrl);

        if (!resultData) {
            return api.sendMessage({ msg: "❌ Lỗi: Không nhận được ảnh từ API." }, threadId, threadType);
        }

        // `resultData` có thể bắt đầu bằng http, base64, hoặc là path tương đối của domain taoanhdep.com
        let finalUrl = resultData;
        const cacheDir = path.join(process.cwd(), 'src/modules/cache');
        if (!fs.existsSync(cacheDir)) {
            await fs.promises.mkdir(cacheDir, { recursive: true });
        }
        const tmpPath = path.join(cacheDir, `ghepmat_${Date.now()}.jpg`);

        if (finalUrl.startsWith('data:image')) {
            // Nếu là chuỗi base64
            const base64Data = finalUrl.replace(/^data:image\/\w+;base64,/, '');
            await fs.promises.writeFile(tmpPath, Buffer.from(base64Data, 'base64'));
        } else {
            // Nếu là URL
            if (!finalUrl.startsWith('http')) {
                finalUrl = finalUrl.startsWith('/') ? 'https://taoanhdep.com' + finalUrl : 'https://taoanhdep.com/' + finalUrl;
            }
            const resImg = await axios.get(finalUrl, { responseType: 'arraybuffer' });
            await fs.promises.writeFile(tmpPath, resImg.data);
        }

        const remoteUrl = await uploadToTmpFiles(tmpPath, api, threadId, threadType);
        if (remoteUrl && api.sendImageEnhanced) {
            await api.sendImageEnhanced({ imageUrl: remoteUrl, threadId, threadType, msg: "✨ Ảnh ghép của bạn đây!" });
        } else {
            await api.sendMessage({ msg: "✨ Ảnh ghép của bạn đây!", file: fs.createReadStream(tmpPath) }, threadId, threadType);
        }

        if (fs.existsSync(tmpPath)) await fs.promises.unlink(tmpPath);

        // Thu hồi các thông báo chờ nếu có
        try {
            if (waitRes && waitRes.message) api.undo(waitRes.message, threadId, threadType).catch(() => { });
            if (pendingNotiMsg) api.undo(pendingNotiMsg, threadId, threadType).catch(() => { });
        } catch (e) { }

    } catch (error) {
        log.error("GhepMat Error:", error.message);
        await api.sendMessage({ msg: `❌ Lỗi ghép mặt: ${error.message}` }, threadId, threadType);
    }
}

export const commands = {
    ghepmat: async (ctx) => {
        const { api, args, threadId, threadType, senderId, message } = ctx;

        let sourceUrl, targetUrl;

        const quoteImageUrl = extractImageUrl(message.data?.quote?.attach);
        const currentImageUrl = extractImageUrl(message.data?.attach);

        // Trường hợp 1: Nhận trực tiếp đủ 2 ảnh cùng lúc (qua link hoặc attach+reply)
        if (args.length >= 2 && args[0].startsWith("http") && args[1].startsWith("http")) {
            sourceUrl = args[0];
            targetUrl = args[1];
        } else if (currentImageUrl && quoteImageUrl) {
            sourceUrl = currentImageUrl;
            targetUrl = quoteImageUrl;
        } else if (args.length >= 1 && args[0].startsWith("http")) {
            if (quoteImageUrl) {
                sourceUrl = args[0];
                targetUrl = quoteImageUrl;
            } else if (currentImageUrl) {
                sourceUrl = currentImageUrl;
                targetUrl = args[0];
            }
        }

        // Nếu đã có đủ 2 ảnh, ghép luôn
        if (sourceUrl && targetUrl) {
            return processGhepMat(ctx, sourceUrl, targetUrl);
        }

        // Trường hợp 2: Thiếu 1 ảnh (chỉ cung cấp 1 ảnh làm thân/khung)
        let singleImage = currentImageUrl || quoteImageUrl || (args.length === 1 && args[0].startsWith("http") ? args[0] : null);

        if (singleImage) {
            // Xem có đang đợi ghép mặt từ người này không (nếu có thì ảnh này là ảnh mặt)
            if (pendingGhepMat.has(senderId)) {
                const pendingData = pendingGhepMat.get(senderId);
                if (pendingData.threadId === threadId) {
                    pendingGhepMat.delete(senderId);
                    // Ảnh 1 (đã lưu) làm targetUrl, Ảnh 2 (bây giờ) làm sourceUrl
                    return processGhepMat(ctx, singleImage, pendingData.targetUrl, pendingData.notiMsg);
                }
            }

            // Chưa có thì lấy làm ảnh 1 (targetUrl)
            const notiRes = await api.sendMessage({ msg: "✅ Đã nhận ảnh KHUNG (ảnh thân/poster).\n\n▶ Bây giờ bạn hãy TÌM MỘT BỨC ẢNH MẶT, sau đó REPLY LẠI BỨC ẢNH ĐÓ và gõ lệnh '!ghepmat' lần nữa để ghép nhé!" }, threadId, threadType);
            pendingGhepMat.set(senderId, { targetUrl: singleImage, threadId, notiMsg: notiRes?.message });
            return;
        } else {
            return api.sendMessage({ msg: "⚠️ Hướng dẫn !ghepmat:\n1. Reply 1 ảnh khung và gõ !ghepmat, sau đó reply tiếp 1 ảnh mặt và gõ !ghepmat lần 2.\n2. Reply 1 ảnh khung & đính kèm 1 ảnh mặt.\n3. Dùng 2 link: !ghepmat <link_mặt> <link_thân>" }, threadId, threadType);
        }
    }
};

export async function handle(ctx) {
    const { api, message, threadId, threadType, senderId, log } = ctx;

    // Xem có đang đợi ghép mặt từ người này không
    if (!pendingGhepMat.has(senderId)) return false;

    const pendingData = pendingGhepMat.get(senderId);

    // Đảm bảo là gửi ảnh ở cùng 1 nhóm
    if (pendingData.threadId !== threadId) return false;

    const imageUrl = extractImageUrl(message.data?.attach);
    if (!imageUrl) return false; // Chỉ lắng nghe nếu họ gửi ảnh

    // Xóa kho pending
    pendingGhepMat.delete(senderId);

    // Bọn mình đã nhận ảnh 1 làm "targetUrl", giờ ảnh 2 sẽ là "sourceUrl" (mặt)
    return processGhepMat(ctx, imageUrl, pendingData.targetUrl, pendingData.notiMsg);
}
