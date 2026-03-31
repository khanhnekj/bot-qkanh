import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const bankPath = path.join(process.cwd(), "src", "modules", "cache", "bank.json");

/**
 * Quản lý hệ thống ngân hàng (Xu) cho các trò chơi
 */
export const bankManager = {
    _data: {},

    load() {
        try {
            if (fs.existsSync(bankPath)) {
                this._data = JSON.parse(fs.readFileSync(bankPath, "utf-8"));
            } else {
                this._data = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load bank.json:", e.message);
            this._data = {};
        }
    },

    save() {
        try {
            const dir = path.dirname(bankPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(bankPath, JSON.stringify(this._data, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save bank.json:", e.message);
        }
    },

    /**
     * Lấy số dư của một người dùng
     */
    getBalance(senderId) {
        this.load();
        const id = String(senderId);
        if (!this._data[id]) {
            this._data[id] = 10000; // Tặng 10k xu cho người mới
            this.save();
        }
        return this._data[id];
    },

    /**
     * Cộng thêm xu
     */
    add(senderId, amount) {
        this.load();
        const id = String(senderId);
        const current = this.getBalance(id);
        this._data[id] = current + amount;
        this.save();
        return this._data[id];
    },

    /**
     * Trừ bớt xu
     */
    subtract(senderId, amount) {
        this.load();
        const id = String(senderId);
        const current = this.getBalance(id);
        const next = Math.max(0, current - amount);
        this._data[id] = next;
        this.save();
        return this._data[id];
    }
};

bankManager.load();
