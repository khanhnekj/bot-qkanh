import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const statsPath = path.join(process.cwd(), "src", "modules", "cache", "stats.json");

export const statsManager = {
    _data: {},

    load() {
        if (Object.keys(this._data).length > 0) return this._data;
        try {
            if (fs.existsSync(statsPath)) {
                const content = fs.readFileSync(statsPath, "utf-8");
                this._data = JSON.parse(content);
            } else {
                this._data = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load stats.json:", e.message);
            this._data = {};
        }
        return this._data;
    },

    save() {
        try {
            const dir = path.dirname(statsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(statsPath, JSON.stringify(this._data, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save stats.json:", e.message);
        }
    },

    saveDebounced() {
        if (this._saveTimeout) clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => {
            this.save();
        }, 5000);
    },

    setRole(threadId, uid, role) {
        this.load();
        if (!this._data[threadId]) {
            this._data[threadId] = { members: {}, lastResetDay: new Date().getDate(), lastResetWeek: this._getWeekNumber(new Date()) };
        }
        if (!this._data[threadId].members[uid]) {
            this._data[threadId].members[uid] = {
                name: "Người dùng",
                total: 0,
                day: 0,
                week: 0,
                joinDate: Date.now(),
                role: role
            };
        } else {
            this._data[threadId].members[uid].role = role;
        }
        this.save();
    },

    addMessage(threadId, senderId, senderName, role = null) {
        this.load();

        if (!this._data[threadId]) this._data[threadId] = { members: {}, lastResetDay: new Date().getDate(), lastResetWeek: this._getWeekNumber(new Date()) };

        const thread = this._data[threadId];
        const now = new Date();
        const today = now.getDate();
        const currentWeek = this._getWeekNumber(now);

        if (thread.lastResetDay !== today) {
            Object.values(thread.members).forEach(m => m.day = 0);
            thread.lastResetDay = today;
        }

        if (thread.lastResetWeek !== currentWeek) {
            Object.values(thread.members).forEach(m => m.week = 0);
            thread.lastResetWeek = currentWeek;
        }

        if (!thread.members[senderId]) {
            thread.members[senderId] = {
                name: senderName,
                total: 0,
                day: 0,
                week: 0,
                joinDate: Date.now(),
                role: "Thành viên"
            };
        }

        const member = thread.members[senderId];
        member.name = senderName;
        // Chỉ cập nhật role nếu: role mới được truyền vào VÀ (nó là Admin HOẶC hiện tại đang là Thành viên)
        if (role) {
            if (role === "Admin" || member.role === "Thành viên") {
                member.role = role;
            }
        }
        member.total++;
        member.day++;
        member.week++;

        this.saveDebounced();
    },

    getStats(threadId, senderId) {
        this.load();
        const thread = this._data[threadId];
        if (!thread || !thread.members[senderId]) return null;
        return thread.members[senderId];
    },

    getTop(threadId, type = "total", limit = 10) {
        this.load();
        const thread = this._data[threadId];
        if (!thread) return [];

        return Object.entries(thread.members)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b[type] - a[type])
            .slice(0, limit);
    },

    getAllThreads() {
        this.load();
        return Object.keys(this._data);
    },

    resetDayAll() {
        this.load();
        Object.values(this._data).forEach(thread => {
            if (thread.members) {
                Object.values(thread.members).forEach(m => m.day = 0);
            }
            thread.lastResetDay = new Date().getDate();
        });
        this.save();
    },

    resetWeekAll() {
        this.load();
        const currentWeek = this._getWeekNumber(new Date());
        Object.values(this._data).forEach(thread => {
            if (thread.members) {
                Object.values(thread.members).forEach(m => m.week = 0);
            }
            thread.lastResetWeek = currentWeek;
        });
        this.save();
    },

    _getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    }
};
