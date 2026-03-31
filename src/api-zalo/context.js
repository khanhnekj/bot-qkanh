const _5_MINUTES = 5 * 60 * 1000;

class CallbacksMap extends Map {
    /**
     * @param ttl Time to live in milliseconds. Default is 5 minutes.
     */
    set(key, value, ttl = _5_MINUTES) {
        setTimeout(() => {
            this.delete(key);
        }, ttl);
        return super.set(key, value);
    }
}

export const appContext = {
    API_TYPE: 30,
    API_VERSION: 649,
    uploadCallbacks: new CallbacksMap(),
    options: {
        selfListen: false,
        checkUpdate: true,
        logging: true,
    },
    secretKey: null,
    imei: null,
    cookie: null,
    userAgent: null,
    language: "vi",
    timeMessage: 0,
    uid: null,
    uin: null,
    settings: null,
};

export function isContextSession(ctx) {
    return !!ctx.secretKey;
}

export const MAX_MESSAGES_PER_SEND = 50;
