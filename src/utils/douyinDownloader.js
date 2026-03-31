import axios from "axios";

/**
 * Download Douyin video/images via savetik.io
 */
export async function downloadDouyin(url) {
    try {
        const params = new URLSearchParams();
        params.append('q', url);
        params.append('cursor', '0');
        params.append('page', '0');
        params.append('lang', 'vi');

        const { data: resData } = await axios.post('https://savetik.io/api/ajaxSearch', params.toString(), {
            timeout: 15000,
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://savetik.io',
                'referer': 'https://savetik.io/vi/douyin-video-downloader',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
            }
        });

        if (!resData || resData.status !== "ok" || !resData.data) return null;

        const htmlData = resData.data;

        const result = {
            title: '',
            author: 'Douyin User',
            videoUrl: null,
            audioUrl: null,
            images: [],
            cover: null
        };

        const titleMatch = htmlData.match(/<h3>([\s\S]*?)<\/h3>/);
        if (titleMatch) {
            result.title = titleMatch[1].replace(/#\S+/g, '').replace(/<[^>]+>/g, '').trim();
        }

        const coverMatch = htmlData.match(/<div class="image-tik">[\s\S]*?<img src="([^"]+)"/);
        if (coverMatch) {
            result.cover = coverMatch[1].replace(/&amp;/g, '&');
        }

        // Extracts images if present in data-imageData attr
        const imageDataMatch = htmlData.match(/data-imageData="([^"]+)"/);
        if (imageDataMatch) {
            try {
                const b64Data = imageDataMatch[1];
                const decoded = Buffer.from(b64Data, 'base64').toString('utf-8');
                const urls = decoded.split(';');
                result.images = urls.filter(u => u.startsWith('http')).map(u => u.replace(/&amp;/g, '&'));
            } catch (e) {
                console.error("Lỗi parse ảnh Douyin:", e);
            }
        }

        // Find Video/Audio URLs
        const aTags = [...htmlData.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
        for (const match of aTags) {
            const href = match[1].replace(/&amp;/g, '&');
            const text = match[2].toLowerCase();

            if (text.includes("mp3") || text.includes("âm thanh")) {
                if (!result.audioUrl && href.startsWith("http")) result.audioUrl = href;
            } else if ((text.includes("video") || text.includes("mp4")) && !text.includes("render") && !text.includes("other") && !text.includes("khác")) {
                if (!result.videoUrl && href.startsWith("http") && !href.includes("#")) result.videoUrl = href;
                if ((text.includes("hd") || text.includes("không logo")) && href.startsWith("http") && !href.includes("#")) result.videoUrl = href;
            }
        }

        const audioUrlMatch = htmlData.match(/data-audioUrl="([^"]+)"/);
        if (audioUrlMatch) {
            let auUrl = audioUrlMatch[1].replace(/&amp;/g, '&');
            if (auUrl.startsWith('http')) result.audioUrl = auUrl;
        }

        return result;
    } catch (error) {
        console.error('Lỗi SaveTik (Douyin):', error.message);
        return null;
    }
}
