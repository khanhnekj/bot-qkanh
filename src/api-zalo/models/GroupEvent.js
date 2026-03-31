import { appContext } from "../context.js";
import { logMessageToFile } from "../../utils/io-json.js";

export const GroupEventType = {
  JOIN_REQUEST: "join_request",
  JOIN: "join",
  LEAVE: "leave",
  REMOVE_MEMBER: "remove_member",
  BLOCK_MEMBER: "block_member",
  UPDATE_SETTING: "update_setting",
  UPDATE: "update",
  NEW_LINK: "new_link",
  ADD_ADMIN: "add_admin",
  REMOVE_ADMIN: "remove_admin",
  NEW_PIN_TOPIC: "new_pin_topic",
  UPDATE_TOPIC: "update_topic",
  UPDATE_BOARD: "update_board",
  REORDER_PIN_TOPIC: "reorder_pin_topic",
  UNPIN_TOPIC: "unpin_topic",
  REMOVE_TOPIC: "remove_topic",
  UNKNOWN: "unknown",
};

export function initializeGroupEvent(data, type) {
  const threadId = data.groupId;
  if (type === GroupEventType.JOIN_REQUEST) {
    return { type, data: data, threadId, isSelf: false };
  } else if (
    type === GroupEventType.NEW_PIN_TOPIC ||
    type === GroupEventType.UNPIN_TOPIC ||
    type === GroupEventType.REORDER_PIN_TOPIC
  ) {
    return {
      type,
      data: data,
      threadId,
      isSelf: data.actorId === appContext.uid,
    };
  } else {
    const baseData = data;
    logMessageToFile(
      `${data.groupName}\nType Sự Kiện: ${typeToString(type)} - Số Lượng Member Trong Sự Kiện: ${baseData.updateMembers ? baseData.updateMembers.length : 0
      }\n`,
      "group"
    );
    if (baseData.updateMembers) {
      return {
        type,
        data: baseData,
        threadId,
        isSelf:
          baseData.updateMembers.some((member) => member.id === appContext.uid) || baseData.sourceId === appContext.uid,
      };
    } else {
      return {
        type,
        data: baseData,
        threadId,
        isSelf: false,
      };
    }
  }
}

function typeToString(type) {
  switch (type) {
    case GroupEventType.JOIN_REQUEST:
      return "JOIN_REQUEST";
    case GroupEventType.JOIN:
      return "JOIN";
    case GroupEventType.LEAVE:
      return "LEAVE";
    case GroupEventType.REMOVE_MEMBER:
      return "REMOVE_MEMBER";
    case GroupEventType.BLOCK_MEMBER:
      return "BLOCK_MEMBER";
    case GroupEventType.UPDATE_SETTING:
      return "UPDATE_SETTING";
    case GroupEventType.UPDATE:
      return "UPDATE";
    case GroupEventType.NEW_LINK:
      return "NEW_LINK";
    case GroupEventType.ADD_ADMIN:
      return "ADD_ADMIN";
    case GroupEventType.REMOVE_ADMIN:
      return "REMOVE_ADMIN";
    case GroupEventType.NEW_PIN_TOPIC:
      return "NEW_PIN_TOPIC";
    case GroupEventType.UPDATE_TOPIC:
      return "UPDATE_TOPIC";
    case GroupEventType.UPDATE_BOARD:
      return "UPDATE_BOARD";
    case GroupEventType.REORDER_PIN_TOPIC:
      return "REORDER_PIN_TOPIC";
    case GroupEventType.UNPIN_TOPIC:
      return "UNPIN_TOPIC";
    case GroupEventType.REMOVE_TOPIC:
      return "REMOVE_TOPIC";
    default:
      return String(type);
  }
}
