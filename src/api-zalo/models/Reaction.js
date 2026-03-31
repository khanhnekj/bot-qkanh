import { appContext } from "../context.js";

export const ReactionMap = {
  UNDO: { text: "", rType: -1 },
  HAHA: { text: ":>", rType: 0 },
  NGAI: { text: "--b", rType: 1 },
  KHOC: { text: ":-((", rType: 2 },
  LIKE: { text: "/-strong", rType: 3 },
  DISLIKE: { text: "/-weak", rType: 4 },
  HEART: { text: "/-heart", rType: 5 },
  SMILE: { text: ":d", rType: 6 },
  CUOIRANUOCMAT: { text: ":')", rType: 7 },
  MISS: { text: ":-*", rType: 8 },
  HANHPHUC: { text: ":3", rType: 9 },
  SEELOVE: { text: ":b", rType: 10 },
  THING: { text: ";d", rType: 11 },
  SO: { text: ":~", rType: 12 },
  CUOIBITMIENG: { text: ";p", rType: 13 },
  CHUMO: { text: ":*", rType: 14 },
  LOLANG: { text: ";o", rType: 15 },
  RUNGNUOCMAT: { text: ":((", rType: 16 },
  CUOINHE: { text: ":)", rType: 17 },
  LELUOI: { text: ":p", rType: 18 },
  NGAINGUNG: { text: ":$", rType: 19 },
  GIAN: { text: ":-h", rType: 20 },
  CUOIGIAN: { text: "x-)", rType: 21 },
  COOLNGAU: { text: "8-)", rType: 22 },
  SUNGSUONG: { text: ";-d", rType: 23 },
  DOI: { text: ":q", rType: 24 },
  BUON: { text: ":(", rType: 25 },
  CUOIHIEM: { text: "b-)", rType: 26 },
  THACMAC: { text: ";?", rType: 27 },
  NGAI: { text: ":|", rType: 28 },
  BUADAU: { text: ";xx", rType: 29 },
  BUONSAU: { text: ":--|", rType: 30 },
  THEM: { text: ";g", rType: 31 },
  WOW: { text: ":o", rType: 32 },
  NGU: { text: ":z", rType: 33 },
  CLOCK: { text: "🕑", rType: 55 },
  WAITING: { text: "⏳", rType: 55 },
  SANDGLASS: { text: "⌛", rType: 55 },
  ALARM: { text: "⏰", rType: 55 },
  OK: { text: "/-ok", rType: 68 },
  NONE: { text: "", rType: 75 },
  HOAHONG: { text: "/-rose", rType: 100 }
};

export const Reactions = Object.keys(ReactionMap).reduce((acc, key) => {
  acc[key] = ReactionMap[key].text;
  return acc;
}, {});

export class Reaction {
  constructor(data, isGroup) {
    this.data = data;
    const botUid = String(appContext.uid);

    if (isGroup) {
      this.threadId = data.idTo;
      this.threadType = 1; // Group
    } else {
      // Private chat: threadId is the OTHER person.
      // Nếu reaction từ 0 hoặc botUid gửi tới người khác -> threadId là idTo
      // Nếu người khác gửi tới 0 hoặc botUid -> threadId là uidFrom
      const from = String(data.uidFrom);
      this.threadId = (from === "0" || from === botUid) ? data.idTo : from;
      this.threadType = 0; // User
    }

    this.isSelf = data.uidFrom === "0" || String(data.uidFrom) === botUid;
    this.isGroup = isGroup;

    if (data.idTo === "0") data.idTo = appContext.uid;
    if (data.uidFrom === "0") data.uidFrom = appContext.uid;
  }
}
