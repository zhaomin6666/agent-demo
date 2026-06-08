import {
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

export type MessageWindowOptions = {
  maxRecentMessages: number;
};

export function selectMessagesForModel(
  messages: BaseMessage[],
  options: MessageWindowOptions,
): BaseMessage[] {
  const systemMessage = messages.find(
    (message) => message instanceof SystemMessage,
  );

  const nonSystemMessages = messages.filter(
    (message) => !(message instanceof SystemMessage),
  );

  const recentMessages = nonSystemMessages.slice(-options.maxRecentMessages);

  if (!systemMessage) {
    return recentMessages;
  }

  return [systemMessage, ...recentMessages];
}