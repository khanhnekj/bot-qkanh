import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const settingsPath = path.join(process.cwd(), "src", "modules", "cache", "thread_settings.json");

export const threadSettingsManager = {
    _data: null,

    load() {
        if (this._data !== null) return this._data;
        try {
            if (fs.existsSync(settingsPath)) {
                this._data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
            } else {
                this._data = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load thread_settings.json:", e.message);
            this._data = {};
        }
        return this._data;
    },

    save() {
        try {
            const dir = path.dirname(settingsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(settingsPath, JSON.stringify(this._data, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save thread_settings.json:", e.message);
        }
    },

    get(threadId, key, defaultValue = false) {
        this.load();
        return this._data[String(threadId)]?.[key] ?? defaultValue;
    },

    set(threadId, key, value) {
        this.load();
        const tid = String(threadId);
        if (!this._data[tid]) this._data[tid] = {};
        this._data[tid][key] = value;
        this.save();
    },

    toggle(threadId, key) {
        const current = this.get(threadId, key, false);
        this.set(threadId, key, !current);
        return !current;
    },

    isAdminOnly(threadId) {
        return this.get(threadId, "adminOnly", false);
    }
};
