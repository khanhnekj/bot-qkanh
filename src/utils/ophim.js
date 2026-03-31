import axios from "axios";

const OPHIM = "https://ophim1.com";
const PHIMAPI = "https://phimapi.com";

/**
 * Lấy danh sách phim mới nhất
 * @param {number} page 
 * @returns {Promise<any>}
 */
export async function getLatest(page = 1) {
  try {
    const res = await axios.get(`${OPHIM}/danh-sach/phim-moi-cap-nhat?page=${page}`);
    return res.data;
  } catch (e) {
    // fallback
    const res = await axios.get(`${PHIMAPI}/danh-sach/phim-moi-cap-nhat?page=${page}`);
    return res.data;
  }
}

/**
 * Lấy chi tiết phim theo slug
 * @param {string} slug 
 * @returns {Promise<any>}
 */
export async function getDetail(slug) {
  try {
    const res = await axios.get(`${OPHIM}/phim/${slug}`);
    return res.data;
  } catch (e) {
    const res = await axios.get(`${PHIMAPI}/phim/${slug}`);
    return res.data;
  }
}

/**
 * Tìm kiếm phim theo từ khóa
 * @param {string} keyword 
 * @returns {Promise<any>}
 */
export async function search(keyword) {
  try {
    const res = await axios.get(`${OPHIM}/v1/api/tim-kiem?keyword=${keyword}`);
    return res.data;
  } catch (e) {
    try {
        const res = await axios.get(`${PHIMAPI}/v1/api/tim-kiem?keyword=${keyword}`);
        return res.data;
    } catch (e2) {
        // Fallback to the user's original URL just in case
        const res = await axios.get(`${OPHIM}/tim-kiem?keyword=${keyword}`);
        return res.data;
    }
  }
}

export default {
  getLatest,
  getDetail,
  search,
};
