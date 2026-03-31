import { appContext } from "../context.js";
export class Undo {
    constructor(data, isGroup) {
        this.data = data;
        this.threadId = data.uidFrom == "0" ? data.idTo : data.uidFrom;
        this.isSelf = data.uidFrom == "0";
        this.isGroup = isGroup;
        if (data.idTo == "0")
            data.idTo = appContext.uid;
        if (data.uidFrom == "0")
            data.uidFrom = appContext.uid;
    }
}
