import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const keysPath = path.join(process.cwd(), "src", "modules", "cache", "keys.json");

/**
 * Quản lý mã kích hoạt (Activation Key System)
 */
export const keyManager = {
    _data: {},

    load() {
        try {
            if (fs.existsSync(keysPath)) {
                this._data = JSON.parse(fs.readFileSync(keysPath, "utf-8"));
            } else {
                this._data = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load keys.json:", e.message);
            this._data = {};
        }
    },

    save() {
        try {
            fs.writeFileSync(keysPath, JSON.stringify(this._data, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save keys.json:", e.message);
        }
    },

    /**
     * Tạo mã kích hoạt mới
     * @param {number} days Số ngày thuê
     * @param {string} creator Thông tin người tạo
     * @returns {string} Mã key vừa tạo
     */
    generateKey(days, tier = "normal", creator = "Admin") {
        this.load();
        const key = "RENT-" + Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
        this._data[key] = {
            days,
            tier,
            creator,
            createdAt: Date.now()
        };
        this.save();
        return key;
    },

    /**
     * Sử dụng mã kích hoạt
     * @param {string} key Mã cần dùng
     * @param {string} threadId ID box sử dụng
     * @returns {object} { success, days, tier, msg }
     */
    useKey(key, threadId) {
        this.load();
        if (!this._data[key]) {
            return { success: false, msg: "Mã kích hoạt không tồn tại hoặc đã được sử dụng." };
        }

        const info = this._data[key];
        const days = info.days;
        const tier = info.tier || "normal";

        // Xóa key sau khi dùng
        delete this._data[key];
        this.save();

        log.info(`✦ Key [${key}] (${tier}) đã được dùng bởi ${threadId} cho ${days} ngày.`);
        return { success: true, days: days, tier: tier };
    },

    getAllKeys() {
        this.load();
        return this._data;
    }
};
