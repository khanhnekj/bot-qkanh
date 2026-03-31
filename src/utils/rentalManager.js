import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const rentalsPath = path.join(process.cwd(), "src", "modules", "cache", "rentals.json");

export const rentalManager = {
    _data: {},

    load() {
        if (Object.keys(this._data).length > 0) return this._data;
        try {
            if (fs.existsSync(rentalsPath)) {
                const raw = fs.readFileSync(rentalsPath, "utf-8");
                this._data = JSON.parse(raw);
            } else {
                this._data = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load rentals.json:", e.message);
            this._data = {};
        }
        return this._data;
    },

    save() {
        try {
            const dir = path.dirname(rentalsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(rentalsPath, JSON.stringify(this._data, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save rentals.json:", e.message);
        }
    },

    addRent(threadId, days, tier = "normal") {
        this.load();
        const now = Date.now();
        let currentExp = now;
        let currentTier = "normal";

        if (this._data[threadId]) {
            if (typeof this._data[threadId] === "object") {
                currentExp = Math.max(this._data[threadId].exp, now);
                currentTier = this._data[threadId].tier || "normal";
            } else {
                currentExp = Math.max(this._data[threadId], now);
            }
        }

        const msToAdd = days * 24 * 60 * 60 * 1000;
        const newExp = currentExp + msToAdd;

        this._data[threadId] = {
            exp: newExp,
            tier: tier
        };
        this.save();
        return newExp;
    },

    isRented(threadId) {
        this.load();
        const data = this._data[String(threadId)];
        if (!data) return false;
        const exp = typeof data === "object" ? data.exp : data;
        return exp > Date.now();
    },

    getTier(threadId) {
        this.load();
        const data = this._data[String(threadId)];
        if (!data) return "none";
        if (typeof data === "object") return data.tier || "normal";
        return "normal";
    },

    getExpiry(threadId) {
        this.load();
        const data = this._data[threadId];
        if (!data) return "Chưa thuê";
        const exp = typeof data === "object" ? data.exp : data;
        const tier = typeof data === "object" ? data.tier : "normal";
        if (exp <= Date.now()) return "Đã hết hạn";
        return `${new Date(exp).toLocaleString("vi-VN")} (${tier})`;
    },

    getAllRentals() {
        this.load();
        const now = Date.now();
        return Object.entries(this._data)
            .filter(([_, data]) => {
                const exp = typeof data === "object" ? data.exp : data;
                return exp > now;
            })
            .map(([id, data]) => ({
                id,
                exp: typeof data === "object" ? data.exp : data,
                tier: typeof data === "object" ? data.tier : "normal"
            }));
    },

    removeRent(threadId) {
        this.load();
        if (this._data[threadId]) {
            delete this._data[threadId];
            this.save();
            return true;
        }
        return false;
    }
};
