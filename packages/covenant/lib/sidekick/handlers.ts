import type { PublishFunction, SidekickClient, SidekickState } from ".";
import type { Logger } from "../logger";
import type { ListenMessage, SendMessage, SubscribeMessage, UnlistenMessage, UnsubscribeMessage } from "./protocol";
import { getChannelTopicName, getMapId, getResourceTopicName } from "./protocol";


export interface SidekickHandlerContext {
  state: SidekickState;
  client: SidekickClient;
  publish: PublishFunction;
  logger: Logger;
}

export async function handleListenMessage(message: ListenMessage, { client, logger }: SidekickHandlerContext) {
  for (const resource of message.resources) {
    client.subscribe(getResourceTopicName(resource));
  }

  logger.info(`Listened to ${message.resources.toString()}`);

  client.directMessage({
    type: "listening",
    resources: message.resources,
  });
}

export async function handleUnlistenMessage(message: UnlistenMessage, { client, logger }: SidekickHandlerContext) {
  for (const resource of message.resources) {
    client.unsubscribe(getResourceTopicName(resource));
  }
  logger.info(`Unlistened to ${message.resources.toString()}`);

  client.directMessage({
    type: "unlistening",
    resources: message.resources,
  });
}

export async function handleSendMessage(message: SendMessage, { client, logger, state }: SidekickHandlerContext) {
  const topic = getChannelTopicName(message.channel, message.params);
  const mapId = getMapId(client.getId(), topic);
  const context = state.contextMap.get(mapId);

  if (!context) {
    logger.error(`Tried to send data on ${topic} but was not subscribed`);
    client.directMessage({
      type: "error",
      error: {
        channel: message.channel,
        params: message.params,
        fault: "client",
        message: "Not connected to channel",
      }
    });
    return;
  }

  const result = await state.serverConnection.sendMessage({
    params: message.params,
    channel: message.channel,
    data: message.data,
    context,
  });

  if (result !== null) {
    logger.error(`Got bad response sending message in ${topic}: ${result.fault} - ${result.message}`);
    client.directMessage({
      type: "error",
      error: result,
    });
    return;
  }

  logger.info(`Processed message on ${topic} successfully`);
}

export async function handleSubscribeMessage(message: SubscribeMessage, { client, logger, state }: SidekickHandlerContext) {
  const payload = state.tokenMap.get(message.token);
  if (!payload) {
    logger.error("Failed to subscribe: bad input token");
    // TODO - add a time delay here to avoid brute forcing input tokens? 
    // probably not. This level of abstraction doesn't feel right for that
    client.directMessage({
      type: "error",
      error: {
        fault: "client",
        message: "Inputted invalid token for subscription",
        channel: "???unknown",
        params: {},
      }
    });
    return;
  }

  const topic = getChannelTopicName(payload.channel, payload.params);
  const mapId = getMapId(client.getId(), topic);

  state.tokenMap.delete(message.token);
  state.contextMap.set(mapId, payload.context);
  client.subscribe(topic);
  state.usedTokenMap.set(message.token, {
    id: client.getId(),
    channel: payload.channel,
    params: payload.params,
  })


  logger.info(`Subscribed to ${topic}`);
  client.directMessage({
    type: "subscribed",
    channel: payload.channel,
    params: payload.params,
  });
}

export async function handleUnsubscribeMessage(message: UnsubscribeMessage, { client, logger, state }: SidekickHandlerContext) {
  const data = state.usedTokenMap.get(message.token);
  const id = client.getId();
  if (!data || data.id !== id) {
    logger.error("Failed to unsubscribe: bad input token");
    client.directMessage({
      type: "error",
      error: {
        fault: "client",
        message: "Inputted invalid token for unsubscription",
        channel: "???unknown",
        params: {},
      }
    })
    return;
  }
  const topic = getChannelTopicName(data.channel, data.params);
  const mapId = getMapId(id, topic);

  state.usedTokenMap.delete(message.token);
  state.contextMap.delete(mapId);
  client.unsubscribe(topic);

  logger.info(`Unsubscribed from ${topic}`);
  client.directMessage({
    type: "unsubscribed",
    channel: data.channel,
    params: data.params,
  });

}
