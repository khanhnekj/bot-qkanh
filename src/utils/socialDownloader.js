import axios from 'axios';

/**
 * downloadAll sử dụng API subhatde.id.vn
 * Hỗ trợ đa nền tảng: Facebook, YouTube, TikTok, Instagram...
 */
const API_URL = "https://api.subhatde.id.vn/api/downall";
const API_KEY = "682166a8f47ccd60713e668e50916d9c";

export async function downloadAll(link) {
    try {
        const { data: resObj } = await axios.get(API_URL, {
            params: {
                url: link,
                apikey: API_KEY
            },
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            }
        });

        const filteredMedias = resObj.medias.filter(m => {
            const q = (m.quality || "").toLowerCase();
            const u = (m.url || "").toLowerCase();
            const isThunzilla = q.includes("thunzilla") || q.includes("thunzila") || u.includes("thunzilla") || u.includes("thunzila");
            return !isThunzilla;
        });

        if (filteredMedias.length === 0) {
            return { error: true, message: "⚠️ Không tìm thấy media phù hợp (có thể đã bị lọc bỏ nội dung không mong muốn)." };
        }

        const medias = filteredMedias.map(m => {
            let url = m.url;
            let type = "video";
            const isImg = m.type.includes("image") || /\.(jpg|jpeg|png|webp|heic)(\?|$)/i.test(url);
            const isAudio = m.type.includes("audio") || /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url);

            if (isImg) type = "image";
            else if (isAudio) type = "audio";

            let extension = type === "video" ? "mp4" : (type === "audio" ? "mp3" : "jpg");
            if (m.type && m.type.includes('/')) {
                extension = m.type.split('/')[1];
            } else if (type === "image") {
                extension = "jpg";
            }

            return {
                url: m.url,
                quality: m.quality || "Default",
                extension: extension,
                type: type
            };
        });

        let authorName = "Người dùng Facebook";
        if (resObj.author) {
            if (typeof resObj.author === 'string') {
                authorName = resObj.author;
            } else if (typeof resObj.author === 'object') {
                authorName = resObj.author.name || resObj.author.nickname || resObj.author.username || resObj.author.display_name || "Người dùng Facebook";
            }
        }

        return {
            source: "subhatde-api",
            title: resObj.title || "Video Facebook",
            author: authorName,
            thumbnail: resObj.thumbnail || resObj.author?.image || resObj.author?.avatar || null,
            duration: 0,
            medias: medias
        };

    } catch (err) {
        console.error("Lỗi SubHatDe API:", err.message);
        return { error: true, message: `⚠️ Lỗi kết nối API SubHatDe: ${err.message}` };
    }
}
