import axios from 'axios';

const NCT_GRAPH_URL = 'https://graph.nhaccuatui.com/api/v3';

/**
 * NhacCuaTui Utility
 * Dùng để tìm kiếm và lấy link nhạc
 */

const HEADERS = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
    'authorization': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkdCI6IjE3NzE5Mjk5MjQwODUiLCJuYmYiOjE3NzE5Mjk5MjQsImxvZ2luTWV0aG9kIjoiNSIsImV4cGlyZWREYXRlIjoiMCIsImV4cCI6MTgwMzQ2NTkyNCwiZGV2aWNlaW5mbyI6IntcIkFkSURcIjpcIlwiLFwiQXBwTmFtZVwiOlwiV0VCXCIsXCJBcHBWZXJzaW9uXCI6XCIxXCIsXCJEZXZpY2VJRFwiOlwiZWEzZDQ4NGE2ODRkOTQ4OFwiLFwiRGV2aWNlTmFtZVwiOlwiXCIsXCJOZXR3b3JrXCI6XCJcIixcIk9zTmFtZVwiOlwiV0VCXCIsXCJPc1ZlcnNpb25cIjpcIldFQlwiLFwiUHJvdmlkZXJcIjpcIk5DVENvcnBcIixcIlVzZXJOYW1lXCI6XCJcIixcImlzVk5cIjpmYWxzZX0iLCJidmVkIjoiMCIsImRldmljZUlkIjoiZWEzZDQ4NGE2ODRkOTQ4OCIsImlhdCI6MTc3MTkyOTkyNCwidXQiOiIwIn0.667PW_WIX_hDh6qt-49KenVN-jfuMFTxI3qtdpaPkX8',
    'content-type': 'application/json',
    'origin': 'https://www.nhaccuatui.com',
    'referer': 'https://www.nhaccuatui.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'x-nct-appid': '6',
    'x-nct-deviceid': 'ea3d484a684d9488',
    'x-nct-language': 'en',
    'x-nct-os': 'web',
    'x-nct-time': '1771997600750',
    'x-nct-token': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkdCI6IjE3NzE5Mjk5MjQwODUiLCJuYmYiOjE3NzE5Mjk5MjQsImxvZ2luTWV0aG9kIjoiNSIsImV4cGlyZWREYXRlIjoiMCIsImV4cCI6MTgwMzQ2NTkyNCwiZGV2aWNlaW5mbyI6IntcIkFkSURcIjpcIlwiLFwiQXBwTmFtZVwiOlwiV0VCXCIsXCJBcHBWZXJzaW9uXCI6XCIxXCIsXCJEZXZpY2VJRFwiOlwiZWEzZDQ4NGE2ODRkOTQ4OFwiLFwiRGV2aWNlTmFtZVwiOlwiXCIsXCJOZXR3b3JrXCI6XCJcIixcIk9zTmFtZVwiOlwiV0VCXCIsXCJPc1ZlcnNpb25cIjpcIldFQlwiLFwiUHJvdmlkZXJcIjpcIk5DVENvcnBcIixcIlVzZXJOYW1lXCI6XCJcIixcImlzVk5cIjpmYWxzZX0iLCJidmVkIjoiMCIsImRldmljZUlkIjoiZWEzZDQ4NGE2ODRkOTQ4OCIsImlhdCI6MTc3MTkyOTkyNCwidXQiOiIwIn0.667PW_WIX_hDh6qt-49KenVN-jfuMFTxI3qtdpaPkX8',
    'x-nct-userid': '0',
    'x-nct-uuid': 'ea3d484a684d9488',
    'x-nct-version': '1',
    'x-sign': '0c1b209345155f5554822b01a6000f1488'
};

export async function searchNCT(query) {
    const timestamp = Date.now();
    try {
        // Axios tự động encode params trong URL và body JSON, 
        // việc encodeURIComponent thủ công có thể gây ra lỗi double-encode (VD: %20 -> %2520)
        const response = await axios.post(`${NCT_GRAPH_URL}/search/all`,
            {
                keyword: query, // Truyền trực tiếp query thô
                pageindex: 1,
                pagesize: 30,
                isShowLoading: true
            },
            {
                params: {
                    keyword: query,
                    correct: 'true',
                    timestamp: timestamp
                },
                headers: {
                    ...HEADERS,
                    'timestamp': timestamp,
                    'x-nct-time': timestamp,
                    // Sign này thường cố định cho các bản Web/Mobile Lite, nếu sai NCT sẽ trả kết quả rác
                    'x-sign': '0c1b209345155f5554822b01a6000f1488'
                }
            }
        );

        const songs = response.data?.data?.songs;
        if (songs && songs.length > 0) {
            // Lọc bỏ các kết quả không liên quan hoặc rác nếu cần
            return songs.filter(s => s.name && s.streamURL);
        } else {
            throw new Error(`Không tìm thấy kết quả cho từ khóa: "${query}".`);
        }
    } catch (e) {
        log.error("NCT Search API Fail:", e.message);
        throw new Error(`Lỗi NCT Search API: ${e.response?.data?.message || e.message}`);
    }
}

/**
 * Lấy thông tin bài hát qua API V1 (thường dùng để lấy link download dự phòng)
 */
export async function getSongInfoV1(songKey) {
    const timestamp = Date.now();
    try {
        const response = await axios.get(`https://graph.nhaccuatui.com/api/v1/songs/${songKey}`, {
            params: { timestamp },
            headers: {
                ...HEADERS,
                'x-sign': '785757628d9834307e56b058390f09de667' // Sign cho V1
            }
        });
        return response.data?.data;
    } catch (e) {
        return null;
    }
}

/**
 * Lấy các bài hát tương tự (như request bạn vừa gửi)
 */
export async function getSimilarSongs(songKey) {
    const timestamp = Date.now();
    try {
        const response = await axios.get(`https://graph.nhaccuatui.com/api/v1/song/similar/${songKey}`, {
            params: {
                key: songKey,
                rn: 20,
                timestamp: timestamp
            },
            headers: {
                ...HEADERS,
                'x-sign': '785757628d9834307e56b058390f09de667'
            }
        });
        return response.data?.data?.list || [];
    } catch (e) {
        return [];
    }
}

export default { searchNCT, getSongInfoV1, getSimilarSongs };
