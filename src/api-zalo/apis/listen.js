import EventEmitter from "events";
import WebSocket from "ws";
import { appContext } from "../context.js";
import { initializeGroupEvent } from "../models/GroupEvent.js";
import { GroupMessage, Message, Reaction, Undo } from "../models/index.js";
import { decodeEventData, getGroupEventType, logger } from "../utils.js";
import JSONBigInit from "json-bigint";
const JSONBig = JSONBigInit({ storeAsString: true });

export class Listener extends EventEmitter {
  constructor(url) {
    super();
    if (!appContext.cookie) throw new Error("Cookie is not available");
    if (!appContext.userAgent) throw new Error("User agent is not available");
    this.url = url;
    this.cookie = appContext.cookie;
    this.userAgent = appContext.userAgent;
    this.selfListen = appContext.options.selfListen;
    this.onConnectedCallback = () => { };
    this.onClosedCallback = () => { };
    this.onErrorCallback = () => { };
    this.onMessageCallback = () => { };
  }
  onConnected(cb) {
    this.onConnectedCallback = cb;
  }
  onClosed(cb) {
    this.onClosedCallback = cb;
  }
  onError(cb) {
    this.onErrorCallback = cb;
  }
  onMessage(cb) {
    this.onMessageCallback = cb;
  }
  start() {
    this.ws = new WebSocket(this.url, {
      headers: {
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        connection: "Upgrade",
        host: new URL(this.url).host,
        origin: "https://chat.zalo.me",
        prgama: "no-cache",
        "sec-websocket-extensions": "permessage-deflate; client_max_window_bits",
        "sec-websocket-version": "13",
        upgrade: "websocket",
        "user-agent": this.userAgent,
        cookie: this.cookie,
      },
    });
    this.ws.onopen = () => {
      this.onConnectedCallback();
      this.emit("connected");
    };
    this.ws.onclose = () => {
      this.onClosedCallback();
      this.emit("closed");
    };
    this.ws.onmessage = async (event) => {
      const { data } = event;
      if (!(data instanceof Buffer)) return;
      const encodedHeader = data.subarray(0, 4);
      const [version, cmd, subCmd] = getHeader(encodedHeader);
      try {
        const dataToDecode = data.subarray(4);
        const decodedData = new TextDecoder("utf-8").decode(dataToDecode);
        if (decodedData.length == 0) return;
        const parsed = JSONBig.parse(decodedData);
        if (version == 1) {
          // Key exchange (1,1)
          if (cmd == 1 && subCmd == 1 && parsed && (typeof parsed === 'object') && ("key" in parsed)) {
            this.handleKeyExchange(parsed);
          }
          // Personal messages (501,0)
          else if (cmd == 501 && subCmd == 0) {
            await this.handlePersonalMessages(parsed);
          }
          // Group messages (521,0)
          else if (cmd == 521 && subCmd == 0) {
            await this.handleGroupMessages(parsed);
          }
          // Controls/Events (601,0) 
          else if (cmd == 601 && subCmd == 0) {
            await this.handleControlEvents(parsed);
          }
          // Reactions (612, 0)
          else if (cmd == 612 && subCmd == 0) {
            await this.handleReactions(parsed);
          }
          // // Someone is typing a message in Private of Group (Not Community)
          // else if (cmd == 602 && subCmd == 0) {
          //   await this.handleTyping(parsed);
          // }
          // // Data My Clound Media
          // else if (cmd == 621 && subCmd == 0) {
          //   const parsedData = (await decodeEventData(parsed, this.cipherKey)).data;
          //   console.log(parsedData);
          // }
          // Connection closed (3000,0)
          else if (cmd == 3000 && subCmd == 0) {
            logger.error("Another connection is opened, closing this one");
            if (this.ws.readyState !== WebSocket.CLOSED) this.ws.close();
          }
          // Else Unknown Command
          else {
            // const noneCheck = ["602", "522", "2", "621"];
            // if (!noneCheck.includes(String(cmd))) {
            //   logger.info(`Unknown command: ${cmd}, ${subCmd}, 
            //     ${typeof parsed === 'object' ? JSON.stringify(parsed) : parsed}`);
            // }
          }
        }
      } catch (error) {
        this.onErrorCallback(error);
        this.emit("error", error);
      }
    };
  }

  handleKeyExchange(parsed) {
    this.cipherKey = parsed.key;
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.setupPingInterval();
  }

  setupPingInterval() {
    const ping = () => {
      const payload = {
        version: 1,
        cmd: 2,
        subCmd: 1,
        data: { eventId: Date.now() },
      };
      const encodedData = new TextEncoder().encode(JSON.stringify(payload.data));
      const dataLength = encodedData.length;
      const data = new DataView(Buffer.alloc(4 + dataLength).buffer);
      data.setUint8(0, payload.version);
      data.setInt32(1, payload.cmd, true);
      data.setInt8(3, payload.subCmd);
      encodedData.forEach((e, i) => {
        data.setUint8(4 + i, e);
      });
      this.ws.send(data);
    };
    this.pingInterval = setInterval(ping, 3 * 60 * 1000);
  }

  async handlePersonalMessages(parsed) {
    const decoded = await decodeEventData(parsed, this.cipherKey);
    if (!decoded) return;
    const parsedData = decoded.data;
    const { msgs } = parsedData;
    for (const msg of msgs) {
      if (typeof msg.content == "object" && msg.content && ("deleteMsg" in msg.content)) {
        const undoObject = new Undo(msg, false);
        if (undoObject.isSelf && !this.selfListen) continue;
        this.emit("undo", undoObject);
      } else {
        const messageObject = new Message(msg);
        if (messageObject.isSelf && !this.selfListen) continue;
        this.onMessageCallback(messageObject);
        this.emit("message", messageObject);
      }
    }
  }

  async handleGroupMessages(parsed) {
    const decoded = await decodeEventData(parsed, this.cipherKey);
    if (!decoded) return;
    const parsedData = decoded.data;
    const { groupMsgs } = parsedData;
    for (const msg of groupMsgs) {
      if (typeof msg.content == "object" && msg.content && ("deleteMsg" in msg.content)) {
        const undoObject = new Undo(msg, true);
        if (undoObject.isSelf && !this.selfListen) continue;
        this.emit("undo", undoObject);
      } else {
        const messageObject = new GroupMessage(msg);
        if (messageObject.isSelf && !this.selfListen) continue;
        this.onMessageCallback(messageObject);
        this.emit("message", messageObject);
      }
    }
  }

  async handleControlEvents(parsed) {
    const decoded = await decodeEventData(parsed, this.cipherKey);
    if (!decoded) return;
    const parsedData = decoded.data;
    const { controls } = parsedData;
    for (const control of controls) {
      // DEBUG: Log all control events to identify join request event structure
      if (control.content.act_type === "group") {
        logger.info(`[DEBUG ctrl] act_type=${control.content.act_type} | act=${control.content.act} | data_preview=${JSON.stringify(control.content.data).substring(0, 150)}`);
      }
      if (control.content.act_type == "file_done") {
        const data = {
          fileUrl: control.content.data.url,
          fileId: control.content.fileId,
        };
        const uploadCallback = appContext.uploadCallbacks.get(String(control.content.fileId));
        if (uploadCallback) uploadCallback(data);
        appContext.uploadCallbacks.delete(String(control.content.fileId));
        this.emit("upload_attachment", data);
      } else if (control.content.act_type == "voice_aac_success") {
        const data = {
          fileUrl: control.content.data["5"] || control.content.data["6"],
          fileId: control.content.fileId,
        };
        const uploadCallback = appContext.uploadCallbacks.get(String(control.content.fileId));
        if (uploadCallback) uploadCallback(data);
        appContext.uploadCallbacks.delete(String(control.content.fileId));
        this.emit("upload_attachment", data);
      } else if (control.content.act_type == "group") {
        if (control.content.act == "join_reject") continue;
        const groupEventData = typeof control.content.data == "string" ? JSONBig.parse(control.content.data) : control.content.data;
        const groupEvent = initializeGroupEvent(groupEventData, getGroupEventType(control.content.act));
        if (groupEvent.isSelf && !this.selfListen) continue;
        this.emit("group_event", groupEvent);
      }
    }
  }

  async handleReactions(parsed) {
    const decoded = await decodeEventData(parsed, this.cipherKey);
    if (!decoded) return;
    const parsedData = decoded.data;
    const { reacts, reactGroups } = parsedData;
    for (const react of reacts) {
      react.content = JSONBig.parse(react.content);
      const reactionObject = new Reaction(react, false);
      if (reactionObject.isSelf && !this.selfListen) continue;
      this.emit("reaction", reactionObject);
    }
    for (const reactGroup of reactGroups) {
      reactGroup.content = JSONBig.parse(reactGroup.content);
      const reactionObject = new Reaction(reactGroup, true);
      if (reactionObject.isSelf && !this.selfListen) continue;
      this.emit("reaction", reactionObject);
    }
  }

  async handleTyping(parsed) {
    const data = JSONBig.parse(parsed.data);
    if (data.error_code !== 0) return;

    const actions = data.data.actions;
    for (const action of actions) {
      if (action.act_type === "typing") {
        // Parse dữ liệu typing theo cách thủ công
        const rawData = action.data.replace(/\\/g, '');
        const matches = {
          gid: rawData.match(/"gid":"(\d+)"/)?.[1],
          uid: rawData.match(/"uid":"(\d+)"/)?.[1],
          ts: rawData.match(/"ts":\s*"(\d+)"/)?.[1],
          isPC: rawData.match(/"isPC":(\d+)/)?.[1]
        };

        if (!matches.uid || !matches.ts) continue;

        const typingEvent = {
          userId: matches.uid,
          timestamp: Number(matches.ts),
          isPC: Boolean(Number(matches.isPC)),
          type: action.act // 'typing' cho tin nhắn cá nhân, 'gtyping' cho nhóm
        };

        // Thêm groupId nếu là typing trong nhóm và có gid
        if (action.act === "gtyping" && matches.gid) {
          typingEvent.groupId = matches.gid;
        }

        this.emit("typing", typingEvent);
      }
    }
  }

  stop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.onclose = () => { }; // Prevent recursive close event
      if (this.ws.readyState !== WebSocket.CLOSED) {
        this.ws.close();
      }
    }
    this.emit("closed");
  }
}
function getHeader(buffer) {
  if (buffer.byteLength < 4) {
    throw new Error("Invalid header");
  }
  return [buffer[0], buffer.readUInt16LE(1), buffer[3]];
}
