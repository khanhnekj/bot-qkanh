import axios from "axios";

/**
 * Download TikTok video via SnapTik API
 * Trả về thông tin đầy đủ: author, title, videoUrl, audioUrl, cover, stats
 */
export async function downloadTikTok(url) {
    try {
        const { data } = await axios.post('https://snaptik.fit/api/tiktok', { url }, {
            timeout: 15000,
            headers: {
                'Host': 'snaptik.fit',
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'origin': 'https://snaptik.fit',
                'referer': 'https://snaptik.fit/vi',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                'cookie': 'SITE_TOTAL_ID=82518739e5f14cd013b0abe183e3f275; _ga=GA1.1.2048407429.1763542949; fpestid=rY26MjD2DA7X3ummEeNuZ6rSnTfLSVml8x5BtYCq63UOjv3lDRvrIM0_n5i_dYULXur3Bg; _ga_9F02TFM0WY=GS2.1.s1763542949$o1$g0$t1763542953$j56$l0$h0'
            }
        });

        if (!data || !data.download_link) return null;

        const links = data.download_link;
        const stats = data.statistics || {};
        const author = data.author || {};

        // Xác định loại nội dung: slideshow hay video
        let images = data.images || [];
        let videoUrl = links.no_watermark_hd || links.no_watermark || null;

        // Xử lý nếu videoUrl là mảng (Array) hoặc chuỗi gộp (String with commas)
        if (Array.isArray(videoUrl)) {
            if (videoUrl.length > 1) {
                images = images.concat(videoUrl);
                videoUrl = null;
            } else {
                videoUrl = videoUrl[0] || null;
            }
        } else if (typeof videoUrl === 'string' && videoUrl.includes(',')) {
            const splitted = videoUrl.split(',').filter(u => u.trim());
            if (splitted.length > 1) {
                images = images.concat(splitted);
                videoUrl = null;
            }
        }


        if (videoUrl && typeof videoUrl === 'string') {
            const isImageUrl = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(videoUrl)
                || /tiktokcdn\.com\/(?!.*\.mp4)/.test(videoUrl) && !/\bvideo\b/.test(videoUrl)
                || /\/photo\//i.test(videoUrl);

            if (isImageUrl) {
                images = [videoUrl, ...images];
                videoUrl = null;
            }
        }

        return {
            title: data.description || `Video TikTok`,
            author: author.nickname || null,
            avatar: author.avatar || null,
            videoUrl: videoUrl,
            audioUrl: links.mp3 || null,
            cover: data.cover || null,
            images: images,
            stats: {
                views: stats.play_count || 0,
                likes: stats.digg_count || 0,
                comments: stats.comment_count || 0,
                shares: stats.repost_count || 0
            }
        };
    } catch (error) {
        console.error('Lỗi SnapTik:', error.message);
        return null;
    }
}
