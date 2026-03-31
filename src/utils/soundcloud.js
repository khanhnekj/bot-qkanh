import axios from 'axios';
import { URLSearchParams } from 'url';

const SOUNDCLOUD_API_URL = 'https://api-v2.soundcloud.com';
const SEARCH_ENDPOINT = '/search';
const USERS_ENDPOINT = '/users';
const FIXED_CLIENT_ID = '1IzwHiVxAHeYKAMqN0IIGD3ZARgJy2kl';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Origin': 'https://soundcloud.com',
    'Referer': 'https://soundcloud.com/'
};

const AUTH_INFO = {
    'AUTH_TOKEN': 'OAuth 2-317207-1307090055-cIofr6yolxNM3',
    'CLIENT_ID': '1IzwHiVxAHeYKAMqN0IIGD3ZARgJy2kl',
};

const COMMON_HEADERS = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Authorization': AUTH_INFO.AUTH_TOKEN,
    'Origin': 'https://soundcloud.com',
    'Referer': 'https://soundcloud.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Host': 'api-v2.soundcloud.com',
    'Connection': 'keep-alive',
};

function getBaseParams() {
    return {
        'client_id': AUTH_INFO.CLIENT_ID,
        'sc_a_id': '3c8801881e57e06df7d672272c5a04b9e0edec39',
        'facet': 'model',
        'user_id': '64639-829169-591460-315397',
        'limit': 10,
        'offset': 0,
        'linked_partitioning': 1,
        'app_version': 1763043258,
        'app_locale': 'en'
    };
}

export async function search(query) {
    const params = getBaseParams();
    params.q = query;
    const searchUrl = `${SOUNDCLOUD_API_URL}${SEARCH_ENDPOINT}?${new URLSearchParams(params).toString()}`;

    try {
        const response = await axios.get(searchUrl, { headers: COMMON_HEADERS });
        if (response.data?.collection?.length > 0) {
            return response.data.collection;
        } else {
            throw new Error(`Không tìm thấy kết quả cho từ khóa: "${query}".`);
        }
    } catch (e) {
        if (e.response && (e.response.status === 401 || e.response.status === 403)) {
            throw new Error("Lỗi Authorization: Token hoặc Client ID đã hết hạn.");
        }
        throw new Error(`Lỗi SoundCloud API: ${e.response?.status || e.message}`);
    }
}

async function getClientID() {
    try {
        const { data } = await axios.get('https://soundcloud.com/', { headers: HEADERS });
        const splitted = data.split('<script crossorigin src="');
        const urls = [];
        splitted.forEach((r) => {
            if (r.startsWith('https')) {
                urls.push(r.split('"')[0]);
            }
        });
        const data2 = await axios.get(urls[urls.length - 1]);
        return data2.data.split(',client_id:"')[1].split('"')[0];
    } catch (e) {
        return FIXED_CLIENT_ID;
    }
}

export async function download(link) {
    try {
        const formatNumber = (num) => num ? num.toLocaleString('de-DE') : 0;
        const conMs = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

        const clientId = await getClientID();
        let finalLink = link;

        if (link.includes('on.soundcloud.com')) {
            const redirectRes = await axios.get(link, { headers: HEADERS });
            finalLink = redirectRes.request.res.responseUrl;
        }

        const cleanUrl = finalLink.replace("m.soundcloud.com", "soundcloud.com").split('?')[0];
        const { data } = await axios.get(`${SOUNDCLOUD_API_URL}/resolve?url=${encodeURIComponent(cleanUrl)}&client_id=${clientId}`, { headers: HEADERS });

        const progressiveUrl = data?.media?.transcodings?.find(t => t.format.protocol === 'progressive')?.url;
        if (!progressiveUrl) throw new Error('Không tìm thấy link tải (progressive)');

        const streamData = (await axios.get(`${progressiveUrl}?client_id=${clientId}&track_authorization=${data.track_authorization}`)).data;

        return {
            id: data.id,
            title: data.title,
            author: data.user.full_name || data.user.username,
            playback: formatNumber(data.playback_count),
            likes: formatNumber(data.likes_count),
            duration: conMs(data.duration),
            url: streamData.url
        };
    } catch (error) {
        throw new Error(`Lỗi tải nhạc: ${error.message}`);
    }
}

export default { search, download };
