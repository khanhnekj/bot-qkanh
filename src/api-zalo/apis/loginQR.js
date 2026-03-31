import { appContext } from "../context.js";
import { logger, generateZaloUUID } from "../utils.js";
import { writeFile } from "node:fs/promises";
import toughCookie from "tough-cookie";

const { CookieJar, Cookie } = toughCookie;

export var LoginQRCallbackEventType;
(function (LoginQRCallbackEventType) {
    LoginQRCallbackEventType[LoginQRCallbackEventType["QRCodeGenerated"] = 0] = "QRCodeGenerated";
    LoginQRCallbackEventType[LoginQRCallbackEventType["QRCodeExpired"] = 1] = "QRCodeExpired";
    LoginQRCallbackEventType[LoginQRCallbackEventType["QRCodeScanned"] = 2] = "QRCodeScanned";
    LoginQRCallbackEventType[LoginQRCallbackEventType["QRCodeDeclined"] = 3] = "QRCodeDeclined";
    LoginQRCallbackEventType[LoginQRCallbackEventType["GotLoginInfo"] = 4] = "GotLoginInfo";
})(LoginQRCallbackEventType || (LoginQRCallbackEventType = {}));

// Request riêng cho flow QR login, dùng CookieJar để quản lý cookies theo domain
async function qrRequest(cookieJar, url, options = {}) {
    const origin = new URL(url).origin;
    const cookieString = await cookieJar.getCookieString(origin);

    const headers = Object.assign({
        "User-Agent": appContext.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    }, options.headers || {});

    if (cookieString) {
        headers.Cookie = cookieString;
    }

    options.headers = headers;

    const response = await fetch(url, options);

    // Lưu cookies từ response vào CookieJar
    const setCookieRaw = response.headers.get("set-cookie");
    if (setCookieRaw) {
        const splitCookies = setCookieRaw.split(", ");
        for (const cookie of splitCookies) {
            const parsed = Cookie.parse(cookie);
            try {
                if (parsed) {
                    await cookieJar.setCookie(parsed, parsed.domain != "zalo.me" ? `https://${parsed.domain}` : origin);
                }
            } catch (error) {
                // Bỏ qua lỗi parse cookie
            }
        }
    }

    // Xử lý redirect
    const redirectURL = response.headers.get("location");
    if (redirectURL) {
        const redirectOptions = Object.assign({}, options);
        redirectOptions.method = "GET";
        redirectOptions.headers = Object.assign({}, redirectOptions.headers, {
            Referer: "https://id.zalo.me/",
        });
        return await qrRequest(cookieJar, redirectURL, redirectOptions);
    }

    return response;
}

async function loadLoginPage(cookieJar) {
    const response = await qrRequest(cookieJar, "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F", {
        headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "cache-control": "max-age=0",
            priority: "u=0, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-site",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            Referer: "https://chat.zalo.me/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        method: "GET",
    });
    const html = await response.text();
    const regex = /https:\/\/stc-zlogin\.zdn\.vn\/main-([\d.]+)\.js/;
    const match = html.match(regex);
    return match === null || match === void 0 ? void 0 : match[1];
}

async function getLoginInfo(cookieJar, version) {
    const form = new URLSearchParams();
    form.append("continue", "https://zalo.me/pc");
    form.append("v", version);
    return await qrRequest(cookieJar, "https://id.zalo.me/account/logininfo", {
        headers: {
            accept: "*/*",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/x-www-form-urlencoded",
            priority: "u=1, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            Referer: "https://id.zalo.me/account?continue=https%3A%2F%2Fzalo.me%2Fpc",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: form,
        method: "POST",
    })
        .then((res) => res.json())
        .catch(logger.error);
}

async function verifyClient(cookieJar, version) {
    const form = new URLSearchParams();
    form.append("type", "device");
    form.append("continue", "https://zalo.me/pc");
    form.append("v", version);
    return await qrRequest(cookieJar, "https://id.zalo.me/account/verify-client", {
        headers: {
            accept: "*/*",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/x-www-form-urlencoded",
            priority: "u=1, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            Referer: "https://id.zalo.me/account?continue=https%3A%2F%2Fzalo.me%2Fpc",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: form,
        method: "POST",
    })
        .then((res) => res.json())
        .catch(logger.error);
}

async function generate(cookieJar, version) {
    const form = new URLSearchParams();
    form.append("continue", "https://zalo.me/pc");
    form.append("v", version);
    return await qrRequest(cookieJar, "https://id.zalo.me/account/authen/qr/generate", {
        headers: {
            accept: "*/*",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/x-www-form-urlencoded",
            priority: "u=1, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            Referer: "https://id.zalo.me/account?continue=https%3A%2F%2Fzalo.me%2Fpc",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: form,
        method: "POST",
    })
        .then((res) => res.json())
        .catch(logger.error);
}

async function saveQRCodeToFile(filepath, imageData) {
    await writeFile(filepath, imageData, "base64");
}

async function waitingScan(cookieJar, version, code, signal) {
    const form = new URLSearchParams();
    form.append("code", code);
    form.append("continue", "https://chat.zalo.me/");
    form.append("v", version);
    return await qrRequest(cookieJar, "https://id.zalo.me/account/authen/qr/waiting-scan", {
        headers: {
            accept: "*/*",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/x-www-form-urlencoded",
            priority: "u=1, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            Referer: "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: form,
        method: "POST",
        signal,
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.error_code == 8) {
                return waitingScan(cookieJar, version, code, signal);
            }
            return data;
        })
        .catch((e) => {
            if (!signal.aborted)
                logger.error(e);
        });
}

async function waitingConfirm(cookieJar, version, code, signal) {
    const form = new URLSearchParams();
    form.append("code", code);
    form.append("gToken", "");
    form.append("gAction", "CONFIRM_QR");
    form.append("continue", "https://chat.zalo.me/");
    form.append("v", version);
    logger.info("Please confirm on your phone");
    return await qrRequest(cookieJar, "https://id.zalo.me/account/authen/qr/waiting-confirm", {
        headers: {
            accept: "*/*",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "content-type": "application/x-www-form-urlencoded",
            priority: "u=1, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            Referer: "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        body: form,
        method: "POST",
        signal,
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.error_code == 8) {
                return waitingConfirm(cookieJar, version, code, signal);
            }
            return data;
        })
        .catch((e) => {
            if (!signal.aborted)
                logger.error(e);
        });
}

async function checkSession(cookieJar) {
    return await qrRequest(cookieJar, "https://id.zalo.me/account/checksession?continue=https%3A%2F%2Fchat.zalo.me%2Findex.html", {
        headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            priority: "u=0, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "upgrade-insecure-requests": "1",
            Referer: "https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        redirect: "manual",
        method: "GET",
    }).catch(logger.error);
}

async function getUserInfo(cookieJar) {
    return await qrRequest(cookieJar, "https://jr.chat.zalo.me/jr/userinfo", {
        headers: {
            accept: "*/*",
            "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            priority: "u=1, i",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            Referer: "https://chat.zalo.me/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        method: "GET",
    })
        .then((res) => res.json())
        .catch(logger.error);
}

export async function loginQR(options, callback) {
    if (!options) options = {};
    if (!options.userAgent) options.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

    // Dùng CookieJar để quản lý cookies theo domain (giống zca-js mới)
    const cookieJar = new CookieJar();

    appContext.cookie = "";
    appContext.secretKey = null;
    appContext.userAgent = options.userAgent;
    appContext.language = options.language || "vi";

    return new Promise(async (resolve, reject) => {
        const controller = new AbortController();
        let qrTimeout = null;
        function cleanUp() {
            controller.abort();
            if (qrTimeout) {
                clearTimeout(qrTimeout);
                qrTimeout = null;
            }
        }
        try {
            function retry() {
                cleanUp();
                return resolve(loginQR(options, callback));
            }
            function abort() {
                cleanUp();
                return reject(new Error("Login QR Aborted"));
            }

            console.log();
            const loginVersion = await loadLoginPage(cookieJar);
            if (!loginVersion) throw new Error("Cannot get API login version");
            logger.info("Got login version:", loginVersion);

            await getLoginInfo(cookieJar, loginVersion);
            await verifyClient(cookieJar, loginVersion);
            const qrGenResult = await generate(cookieJar, loginVersion);
            if (!qrGenResult || !qrGenResult.data)
                throw new Error(`Unable to generate QRCode\nResponse: ${JSON.stringify(qrGenResult, null, 2)}`);

            const qrData = qrGenResult.data;

            if (callback) {
                callback({
                    type: LoginQRCallbackEventType.QRCodeGenerated,
                    data: { ...qrData, image: qrData.image.replace(/^data:image\/png;base64,/, "") },
                    actions: {
                        async saveToFile(qrPath) {
                            if (qrPath === void 0) qrPath = options.qrPath || "qr.png";
                            await saveQRCodeToFile(qrPath, qrData.image.replace(/^data:image\/png;base64,/, ""));
                            logger.info("Scan the QR code at", `'${qrPath}'`, "to proceed with login");
                        },
                        retry,
                        abort,
                    },
                });
            } else {
                const qrPath = options.qrPath || "qr.png";
                await saveQRCodeToFile(qrPath, qrData.image.replace(/^data:image\/png;base64,/, ""));
                logger.info("Scan the QR code at", `'${qrPath}'`, "to proceed with login");
            }

            qrTimeout = setTimeout(() => {
                cleanUp();
                logger.info("QR expired!");
                if (callback) {
                    callback({ type: LoginQRCallbackEventType.QRCodeExpired, data: null, actions: { retry, abort } });
                } else {
                    retry();
                }
            }, 100000);

            const scanResult = await waitingScan(cookieJar, loginVersion, qrData.code, controller.signal);
            if (!scanResult || !scanResult.data) throw new Error("Cannot get scan result");

            if (callback) {
                callback({ type: LoginQRCallbackEventType.QRCodeScanned, data: scanResult.data, actions: { retry, abort } });
            }

            const confirmResult = await waitingConfirm(cookieJar, loginVersion, qrData.code, controller.signal);
            if (!confirmResult) throw new Error("Cannot get confirm result");

            clearTimeout(qrTimeout);

            if (confirmResult.error_code == -13) {
                if (callback) {
                    callback({
                        type: LoginQRCallbackEventType.QRCodeDeclined,
                        data: { code: qrData.code },
                        actions: { retry, abort },
                    });
                } else {
                    logger.error("QRCode login declined");
                    throw new Error("QRCode login declined");
                }
                return;
            } else if (confirmResult.error_code != 0) {
                throw new Error(`An error has occurred.\nResponse: ${JSON.stringify(confirmResult, null, 2)}`);
            }

            // checkSession + getUserInfo (giống zca-js mới)
            const checkSessionResult = await checkSession(cookieJar);
            if (!checkSessionResult) throw new Error("Cannot get session, login failed");

            logger.info("Successfully logged into the account", scanResult.data.display_name);

            const userInfo = await getUserInfo(cookieJar);
            if (!userInfo || !userInfo.data) throw new Error("Can't get account info");
            if (!userInfo.data.logged) throw new Error("Can't login");

            // Chuyển CookieJar thành cookies array/object cho appContext
            const cookiesData = cookieJar.toJSON().cookies;

            // Lấy tất cả cookies từ CookieJar thay vì chỉ chat.zalo.me
            const allDomains = ["zalo.me", "id.zalo.me", "chat.zalo.me", "jr.chat.zalo.me", "file.zalo.me"];
            let mergedCookies = "";
            for (const domain of allDomains) {
                const domCookie = await cookieJar.getCookieString("https://" + domain);
                if (domCookie) {
                    if (mergedCookies && !mergedCookies.endsWith("; ")) mergedCookies += "; ";
                    mergedCookies += domCookie;
                }
            }
            appContext.cookie = mergedCookies;

            const imei = generateZaloUUID(options.userAgent);
            resolve({
                cookie: cookiesData,
                imei: imei,
                userAgent: options.userAgent
            });
        }
        catch (error) {
            cleanUp();
            reject(error);
        }
    });
}
