const cache = new Map();

/**
 * Cache tin nhắn để hỗ trợ Anti-Unsend
 */
export const messageCache = {
    set: (msgId, data) => {
        cache.set(String(msgId), {
            ...data,
            timestamp: Date.now()
        });

        // Gọn gàng hết mức: Giữ 300 tin để RAM luôn trống
        if (cache.size > 300) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
    },
    get: (msgId) => cache.get(String(msgId)),
    delete: (msgId) => cache.delete(String(msgId))
};

// Dọn dẹp siêu tốc mỗi 2 PHÚT
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of cache.entries()) {
        // Chỉ lưu 10 phút (Thời gian vàng của unsend)
        if (now - val.timestamp > 600000) cache.delete(key);
    }
}, 120000);
