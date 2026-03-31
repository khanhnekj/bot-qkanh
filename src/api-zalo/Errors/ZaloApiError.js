export class ZaloApiError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "ZlBotDQTApiError";
        this.code = code || null;
    }
}
