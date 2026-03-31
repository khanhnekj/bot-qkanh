import { appContext } from "../context.js";
export const MessageType = {
  DirectMessage: 0,
  GroupMessage: 1,
};
export class Message {
  constructor(data) {
    this.type = MessageType.DirectMessage;
    this.data = data;
    this.threadId = data.uidFrom === "0" ? data.idTo : data.uidFrom;
    this.isSelf = data.uidFrom === "0";
    if (data.idTo === "0") data.idTo = appContext.uid;
    if (data.uidFrom === "0") data.uidFrom = appContext.uid;
  }
}
export class GroupMessage {
  constructor(data) {
    this.type = MessageType.GroupMessage;
    this.data = data;
    this.threadId = data.idTo;
    this.isSelf = data.uidFrom === "0";
    if (data.uidFrom === "0") data.uidFrom = appContext.uid;
  }
}

export function MessageMention(uid, length = 1, offset = 0, autoFormat = false) {
  if (typeof offset !== "number" || typeof length !== "number") {
    throw new Error("Invalid Length, Offset! Length and Offset must be numbers");
  }

  const mention = {
    pos: offset,
    len: length,
    uid: uid,
    type: uid === "-1" ? 1 : 0,
  };

  if (autoFormat) {
    return JSON.stringify([mention]);
  } else {
    return mention;
  }
}

export function MessageStyle(offset = 0, length = 1, color = "ffffff", size = "18", bold = false, italic = false, underline = false, strike = false, autoFormat = true) {
  if (typeof offset !== "number" || typeof length !== "number") {
    throw new Error("Invalid Length, Offset! Length and Offset must be numbers");
  }

  let styleValue = [];

  if (bold) styleValue.push("b");
  if (italic) styleValue.push("i");
  if (underline) styleValue.push("u");
  if (strike) styleValue.push("s");
  styleValue.push("c_" + color.replace("#", ""));
  styleValue.push("f_" + size);

  const styleObject = {
    start: offset,
    len: length,
    st: styleValue.join(","),
  };

  if (autoFormat) {
    return JSON.stringify({
      styles: [styleObject],
      ver: 0,
    });
  } else {
    return styleObject;
  }
}

export function MultiMsgStyle(listStyle) {
  const styles = listStyle.map((style) => {
    if (typeof style === "string") {
      return JSON.parse(style).styles[0];
    }
    return style;
  });

  const styleFormat = JSON.stringify({
    styles: styles,
    ver: 0,
  });

  return styleFormat;
}
