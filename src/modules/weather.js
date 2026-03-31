import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { drawWeatherCard } from "../utils/canvasHelper.js";

const TOMORROW_API_KEY = "mdTWQAInBIDB3mHiDtkwuTlwhVB50rqn";
const OPENWEATHER_API_KEY = "e707d13f116e5f7ac80bd21c37883e5e";
const WEATHERAPI_KEY = "fe221e3a25734f0297994922240611";

const AUTOSEND_FILE = path.join(process.cwd(), "src/modules/cache/weather_autosend.json");

const POPULAR_CITIES = [
    "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
    "Đà Lạt", "Nha Trang", "Huế", "Vũng Tàu", "Hạ Long",
    "Sapa", "Phan Thiết", "Quy Nhơn", "Buôn Ma Thuột", "Hà Giang"
];

export const name = "weather";
export const description = "Xem dự báo thời tiết chi tiết theo phong cách cao cấp";

function loadAutosend() {
    try {
        if (!fs.existsSync(AUTOSEND_FILE)) return { groups: {} };
        return JSON.parse(fs.readFileSync(AUTOSEND_FILE, "utf-8"));
    } catch (e) {
        return { groups: {} };
    }
}

function saveAutosend(data) {
    try {
        const dir = path.dirname(AUTOSEND_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(AUTOSEND_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) { }
}

export const commands = {
    weather: async (ctx) => {
        await weatherHandler(ctx);
    },
    thoitiet: async (ctx) => {
        await weatherHandler(ctx);
    }
};

async function weatherHandler(ctx) {
    const { api, threadId, threadType, args, adminIds, senderId } = ctx;
    const location = args.join(" ").trim();

    if (args[0] === "autosend") {
        if (!adminIds.includes(String(senderId))) {
            return api.sendMessage({ msg: "⚠️ Chỉ Admin mới có quyền cấu hình AutoSend!" }, threadId, threadType);
        }

        const action = args[1]?.toLowerCase();
        let configLoc = args.slice(2).join(" ").trim();
        if (!configLoc) configLoc = "random";
        const data = loadAutosend();

        if (action === "on") {
            data.groups[threadId] = { location: configLoc, threadType };
            saveAutosend(data);
            const locText = configLoc === "random" ? "Ngẫu nhiên các thành phố" : configLoc;
            await api.sendMessage({ msg: `✅ Đã bật Tự Động Thông Báo thời tiết cho nhóm này!\n📍 Địa điểm: ${locText}\n⏰ Tần suất: 30 phút/lần.\n🚀 Đang gửi bản tin đầu tiên...` }, threadId, threadType);

            try {
                const targetLoc = configLoc === "random" ? POPULAR_CITIES[Math.floor(Math.random() * POPULAR_CITIES.length)] : configLoc;
                const weatherData = await getFullWeatherData(targetLoc);
                if (weatherData) {
                    const buffer = await drawWeatherCard(weatherData);
                    const tmpFile = path.join(process.cwd(), `weather_${Date.now()}.png`);
                    fs.writeFileSync(tmpFile, buffer);
                    try {
                        await api.sendMessage({ msg: "", attachments: [tmpFile] }, threadId, threadType);
                    } finally {
                        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
                    }
                }
            } catch (e) { }
            return;
        } else if (action === "off") {
            delete data.groups[threadId];
            saveAutosend(data);
            return api.sendMessage({ msg: "🚨 Đã tắt Tự Động Thông Báo thời tiết cho nhóm này." }, threadId, threadType);
        } else if (action === "test") {
            await api.sendMessage({ msg: "⏳ Đang chạy thử nghiệm gửi Weather Auto..." }, threadId, threadType);
            return await autoSendWeather(api, { info: console.log, error: console.error }, threadId);
        } else {
            return api.sendMessage({ msg: "❓ Cách dùng: !weather autosend on/off [địa điểm]\n💡 Hoặc: !weather autosend test để thử ngay!" }, threadId, threadType);
        }
    }

    if (!location) {
        const randomCity = POPULAR_CITIES[Math.floor(Math.random() * POPULAR_CITIES.length)];
        await api.sendMessage({ msg: `⏳ Đang lấy thông tin thời tiết cho: ${randomCity}...` }, threadId, threadType);
        const weatherData = await getFullWeatherData(randomCity);
        if (weatherData) {
            const buffer = await drawWeatherCard(weatherData);
            const tmpFile = path.join(process.cwd(), `weather_${Date.now()}.png`);
            fs.writeFileSync(tmpFile, buffer);
            try {
                return await api.sendMessage({ msg: "", attachments: [tmpFile] }, threadId, threadType);
            } finally {
                if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
            }
        }
        return;
    }

    try {
        await api.sendMessage({ msg: `⏳ Đang lấy thông tin thời tiết cho: ${location}...` }, threadId, threadType);
        const weatherData = await getFullWeatherData(location);
        if (!weatherData) throw new Error("Không thể lấy thông tin thời tiết.");
        const buffer = await drawWeatherCard(weatherData);
        const tmpFile = path.join(process.cwd(), `weather_${Date.now()}.png`);
        fs.writeFileSync(tmpFile, buffer);
        try {
            await api.sendMessage({ msg: "", attachments: [tmpFile] }, threadId, threadType);
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    } catch (e) {
        await api.sendMessage({ msg: `❌ Lỗi: ${e.message}` }, threadId, threadType);
    }
}

async function getFullWeatherData(location) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=vi&format=json`;
        const geoRes = await axios.get(geoUrl);
        if (!geoRes.data.results || geoRes.data.results.length === 0) return null;

        const { latitude, longitude, name, admin1, country } = geoRes.data.results[0];

        const [weatherApiRes, tomorrowRes] = await Promise.all([
            axios.get(`http://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${latitude},${longitude}&days=7&aqi=yes&lang=vi`),
            axios.get(`https://api.tomorrow.io/v4/weather/forecast?location=${latitude},${longitude}&apikey=${TOMORROW_API_KEY}`)
        ]);

        const wa = weatherApiRes.data;
        const tm = tomorrowRes.data;

        // Current Info
        const result = {
            location: `${name}, ${admin1 || country}${country ? `, ${country}` : ""}`,
            time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }),
            current: {
                temp: wa.current.temp_c,
                feelsLike: wa.current.feelslike_c,
                condition: wa.current.condition.text,
                icon: "https:" + wa.current.condition.icon.replace("64x64", "128x128"),
                humidity: wa.current.humidity,
                wind: wa.current.wind_kph,
                windGust: wa.current.gust_kph,
                aqi: wa.current.air_quality["gb-defra-index"] || 1,
                aqiText: getAQIDesc(wa.current.air_quality["gb-defra-index"] || 1),
                aqiLevel: getAQILevel(wa.current.air_quality["gb-defra-index"] || 1)
            },
            astronomy: {
                sunrise: wa.forecast.forecastday[0].astro.sunrise,
                sunset: wa.forecast.forecastday[0].astro.sunset,
                moonrise: wa.forecast.forecastday[0].astro.moonrise,
                moonset: wa.forecast.forecastday[0].astro.moonset,
                sunDuration: "12 giờ 00 phút" // Fixed for now or calc later
            },
            hourly: [],
            daily: []
        };

        // Hourly (Next 7 hours)
        const currentHour = new Date().getHours();
        const fullHourly = wa.forecast.forecastday[0].hour.concat(wa.forecast.forecastday[1].hour);
        const next7Steps = fullHourly.filter(h => {
            const hDate = new Date(h.time_epoch * 1000);
            return hDate.getHours() > currentHour;
        }).slice(0, 7);

        result.hourly = next7Steps.map(h => ({
            time: new Date(h.time_epoch * 1000).getHours().toString().padStart(2, "0"),
            temp: h.temp_c,
            icon: "https:" + h.condition.icon,
            pop: h.chance_of_rain
        }));

        // Daily (Today + 2 days)
        result.daily = wa.forecast.forecastday.slice(0, 3).map((d, i) => ({
            date: i === 0 ? "H.nay" : new Date(d.date_epoch * 1000).toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" }),
            dayName: i === 0 ? "Th 3" : getDayName(new Date(d.date_epoch * 1000).getDay()),
            high: d.day.maxtemp_c,
            low: d.day.mintemp_c,
            icon: "https:" + d.day.condition.icon,
            condition: d.day.condition.text,
            pop: d.day.daily_chance_of_rain
        }));

        return result;

    } catch (e) {
        console.error("fetch weather info failed:", e.message);
        return null;
    }
}

function getDayName(day) {
    const days = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
    return days[day];
}

function getAQILevel(aqi) {
    if (aqi <= 3) return "Tốt";
    if (aqi <= 6) return "Vừa phải";
    if (aqi <= 9) return "Kém";
    return "Rất kém";
}

function getAQIDesc(aqi) {
    if (aqi <= 3) return "Chất lượng không khí ở mức tốt, không gây ảnh hưởng đến sức khỏe.";
    if (aqi <= 6) return "Chất lượng không khí ở mức chấp nhận được đối với hầu hết đối tượng. Tuy nhiên có thể có tác động nhỏ.";
    return "Chất lượng không khí kém, có thể gây hại cho các nhóm đối tượng nhạy cảm.";
}

export async function autoSendWeather(api, log, onlyThreadId = null) {
    const data = loadAutosend();
    let groupIds = onlyThreadId ? [onlyThreadId] : Object.keys(data.groups);
    if (groupIds.length === 0) return;

    for (const tid of groupIds) {
        try {
            const config = data.groups[tid];
            if (!config) continue;
            let { location, threadType } = config;
            if (location === "random") location = POPULAR_CITIES[Math.floor(Math.random() * POPULAR_CITIES.length)];
            const weatherData = await getFullWeatherData(location);
            if (weatherData) {
                const buffer = await drawWeatherCard(weatherData);
                const tmpFile = path.join(process.cwd(), `weather_${Date.now()}.png`);
                fs.writeFileSync(tmpFile, buffer);
                try {
                    await api.sendMessage({ msg: "🕒 Thông báo thời tiết định kỳ (30p)", attachments: [tmpFile] }, tid, threadType);
                } finally {
                    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
                }
            }
        } catch (e) {
            log.error(`Lỗi gửi weather auto cho ${tid}: ${e.message}`);
        }
    }
}
