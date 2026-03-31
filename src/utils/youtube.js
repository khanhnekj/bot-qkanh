import axios from "axios";

/**
 * Lấy link tải YouTube từ API vgasoft
 * @param {string} link - URL video YouTube
 * @returns {Promise<object>} - Dữ liệu video hoặc lỗi
 */
export async function downloadYoutube(link) {
    try {
        const url = `https://download.vgasoft.vn/web/c/youtube/getVideo?link=${encodeURIComponent(link)}`;

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; CPH2179) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'OS': 'webSite',
            'Origin': 'https://downloadvideo.vn',
            'PUBLIC_API_TOKEN': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJQVUJMSUNfQVBJX1RPS0VOIjoicGRtc1NEIzc4OUAxMyIsImlhdCI6MTc3MzY3MTY5NywiZXhwIjoxNzczNjcxNzg5fQ.h9vkDCIMzcvX37n_HpvCr8GwPX0yT9y07zT5SDBomuQ',
            'Referer': 'https://downloadvideo.vn/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'sec-ch-ua': '"Chromium";v="107", "Not=A?Brand";v="24"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"'
        };

        const res = await axios.get(url, { headers });
        return res.data;
    } catch (e) {
        return { error: true, message: e.message };
    }
}
