import axios from 'axios';

/**
 * Download YouTube audio using ytdown.to API
 * @param {string} videoUrl - The YouTube video URL
 * @returns {Promise<string>} - Direct download link to the audio file
 */
export async function downloadYoutubeMp3(videoUrl) {
    const proxyUrl = 'https://app.ytdown.to/proxy.php';
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://app.ytdown.to',
        'Referer': 'https://app.ytdown.to/en12/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
    };

    try {
        // Step 1: Search for video and get media list
        const searchPayload = `url=${encodeURIComponent(videoUrl)}`;
        const searchRes = await axios.post(proxyUrl, searchPayload, { headers });

        let data = searchRes.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) {
                console.error('ytdown.to Search Response Error (HTML?):', data.substring(0, 500));
                throw new Error('Trang web tải nhạc (ytdown) đang chặn yêu cầu hoặc yêu cầu CAPTCHA.');
            }
        }

        // Kiểm tra status ở cả root và trong object api
        const status = data.status || data.api?.status;
        if (!data || status !== 'ok') {
            console.error('ytdown.to Search Fail:', JSON.stringify(data));
            throw new Error(data?.message || data.api?.message || 'Không thể tìm thấy thông tin tải về cho video này.');
        }

        // Lấy danh sách mediaItems (có thể nằm ở root, trong result.video hoặc trong api)
        const mediaItems = data.result?.video?.mediaItems || data.api?.mediaItems || data.mediaItems || [];

        // Tìm định dạng âm thanh (ưu tiên 128k hoặc cao nhất có thể)
        const audioItems = mediaItems.filter(item => item.type === 'Audio');
        if (audioItems.length === 0) {
            throw new Error('Video này không hỗ trợ tải âm thanh.');
        }

        // Ưu tiên 128k, sau đó mới đến các chất lượng khác
        const audioItem = audioItems.find(item => item.mediaQuality === '128K' || item.name?.includes('128'))
            || audioItems[audioItems.length - 1];

        if (!audioItem || !audioItem.mediaUrl) {
            throw new Error('Không tìm thấy link âm thanh phù hợp.');
        }

        // Step 2: Get final download link (Sử dụng cùng proxy)
        const downloadPayload = `url=${encodeURIComponent(audioItem.mediaUrl)}`;
        const downloadRes = await axios.post(proxyUrl, downloadPayload, { headers });

        let dlData = downloadRes.data;
        if (typeof dlData === 'string') {
            try { dlData = JSON.parse(dlData); } catch (e) { }
        }

        // Link tải có thể nằm ở nhiều vị trí tùy phiên bản API (root, api, hoặc result)
        const finalUrl = dlData.fileUrl || dlData.api?.fileUrl || dlData.result?.video?.fileUrl || dlData.url;

        if (!finalUrl) {
            console.error('ytdown.to Download Link Fail:', JSON.stringify(dlData));
            throw new Error(dlData?.message || 'Không thể lấy link tải nhạc cuối cùng.');
        }

        return finalUrl;
    } catch (error) {
        console.error('ytdown.to API Error:', error.message);
        throw error;
    }
}

/**
 * Download YouTube video using ytdown.to API
 * @param {string} videoUrl - The YouTube video URL
 * @returns {Promise<object>} - Object containing fileUrl and title
 */
export async function downloadYoutubeVideo(videoUrl) {
    const proxyUrl = 'https://app.ytdown.to/proxy.php';
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://app.ytdown.to',
        'Referer': 'https://app.ytdown.to/en12/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
    };

    try {
        const searchPayload = `url=${encodeURIComponent(videoUrl)}`;
        const searchRes = await axios.post(proxyUrl, searchPayload, { headers });

        let data = searchRes.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { throw new Error('Trang web tải video đang chặn yêu cầu.'); }
        }

        const status = data.status || data.api?.status;
        if (!data || status !== 'ok') {
            throw new Error(data?.message || data.api?.message || 'Không thể tìm thấy thông tin tải về.');
        }

        const meta = data.api || data.result?.video || {};
        const mediaItems = data.result?.video?.mediaItems || data.api?.mediaItems || data.mediaItems || [];

        // Tìm định dạng video (ưu tiên MP4, có âm thanh)
        const videoItems = mediaItems.filter(item => item.type === 'Video');
        if (videoItems.length === 0) {
            throw new Error('Link này không hỗ trợ tải video.');
        }

        // Ưu tiên HD, sau đó là SD, lọc bỏ những cái không có âm thanh nếu có flag 'merge' hoặc 'download'
        // Thường Video trong ytdown.to mà task là 'merge' thì có cả audio+video
        const bestVideo = videoItems.find(v => v.mediaQuality === 'HD') || videoItems[0];

        if (!bestVideo || !bestVideo.mediaUrl) {
            throw new Error('Không tìm thấy link video phù hợp.');
        }

        const downloadPayload = `url=${encodeURIComponent(bestVideo.mediaUrl)}`;
        const downloadRes = await axios.post(proxyUrl, downloadPayload, { headers });

        let dlData = downloadRes.data;
        if (typeof dlData === 'string') {
            try { dlData = JSON.parse(dlData); } catch (e) { }
        }

        const finalUrl = dlData.fileUrl || dlData.api?.fileUrl || dlData.result?.video?.fileUrl || dlData.url;

        if (!finalUrl) {
            throw new Error(dlData?.message || 'Không thể lấy link tải video cuối cùng.');
        }

        return {
            fileUrl: finalUrl,
            title: meta.title || 'YouTube Video',
            thumbnail: meta.imagePreviewUrl || meta.thumb || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`,
            id: meta.id
        };
    } catch (error) {
        console.error('ytdown.to Video API Error:', error.message);
        throw error;
    }
}
