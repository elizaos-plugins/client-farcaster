import {
  toHex
} from "./chunk-7HJADXH2.js";
import "./chunk-PR4QN5HX.js";

// src/index.ts
import { elizaLogger as elizaLogger5 } from "@elizaos/core";

// src/client.ts
import { elizaLogger } from "@elizaos/core";
import { isApiErrorResponse } from "@neynar/nodejs-sdk";
var FarcasterClient = class {
  runtime;
  neynar;
  signerUuid;
  cache;
  lastInteractionTimestamp;
  constructor(opts) {
    this.cache = opts.cache;
    this.runtime = opts.runtime;
    this.neynar = opts.neynar;
    this.signerUuid = opts.signerUuid;
    this.lastInteractionTimestamp = /* @__PURE__ */ new Date();
  }
  async loadCastFromNeynarResponse(neynarResponse) {
    const profile = await this.getProfile(neynarResponse.author.fid);
    return {
      hash: neynarResponse.hash,
      authorFid: neynarResponse.author.fid,
      text: neynarResponse.text,
      profile,
      ...neynarResponse.parent_hash ? {
        inReplyTo: {
          hash: neynarResponse.parent_hash,
          fid: neynarResponse.parent_author.fid
        }
      } : {},
      timestamp: new Date(neynarResponse.timestamp)
    };
  }
  async publishCast(cast, parentCastId, retryTimes) {
    try {
      const result = await this.neynar.publishCast({
        signerUuid: this.signerUuid,
        text: cast,
        parent: parentCastId?.hash
      });
      if (result.success) {
        return {
          hash: result.cast.hash,
          authorFid: result.cast.author.fid,
          text: result.cast.text
        };
      }
    } catch (err) {
      if (isApiErrorResponse(err)) {
        elizaLogger.error("Neynar error: ", err.response.data);
        throw err.response.data;
      } else {
        elizaLogger.error("Error: ", err);
        throw err;
      }
    }
  }
  async getCast(castHash) {
    if (this.cache.has(`farcaster/cast/${castHash}`)) {
      return this.cache.get(`farcaster/cast/${castHash}`);
    }
    const response = await this.neynar.lookupCastByHashOrWarpcastUrl({
      identifier: castHash,
      type: "hash"
    });
    const cast = {
      hash: response.cast.hash,
      authorFid: response.cast.author.fid,
      text: response.cast.text,
      profile: {
        fid: response.cast.author.fid,
        name: response.cast.author.display_name || "anon",
        username: response.cast.author.username
      },
      ...response.cast.parent_hash ? {
        inReplyTo: {
          hash: response.cast.parent_hash,
          fid: response.cast.parent_author.fid
        }
      } : {},
      timestamp: new Date(response.cast.timestamp)
    };
    this.cache.set(`farcaster/cast/${castHash}`, cast);
    return cast;
  }
  async getCastsByFid(request) {
    const timeline = [];
    const response = await this.neynar.fetchCastsForUser({
      fid: request.fid,
      limit: request.pageSize
    });
    response.casts.map((cast) => {
      this.cache.set(`farcaster/cast/${cast.hash}`, cast);
      timeline.push({
        hash: cast.hash,
        authorFid: cast.author.fid,
        text: cast.text,
        profile: {
          fid: cast.author.fid,
          name: cast.author.display_name || "anon",
          username: cast.author.username
        },
        timestamp: new Date(cast.timestamp)
      });
    });
    return timeline;
  }
  async getMentions(request) {
    const neynarMentionsResponse = await this.neynar.fetchAllNotifications({
      fid: request.fid,
      type: ["mentions", "replies"]
    });
    const mentions = [];
    neynarMentionsResponse.notifications.map((notification) => {
      const cast = {
        hash: notification.cast.hash,
        authorFid: notification.cast.author.fid,
        text: notification.cast.text,
        profile: {
          fid: notification.cast.author.fid,
          name: notification.cast.author.display_name || "anon",
          username: notification.cast.author.username
        },
        ...notification.cast.parent_hash ? {
          inReplyTo: {
            hash: notification.cast.parent_hash,
            fid: notification.cast.parent_author.fid
          }
        } : {},
        timestamp: new Date(notification.cast.timestamp)
      };
      mentions.push(cast);
      this.cache.set(`farcaster/cast/${cast.hash}`, cast);
    });
    return mentions;
  }
  async getProfile(fid) {
    if (this.cache.has(`farcaster/profile/${fid}`)) {
      return this.cache.get(`farcaster/profile/${fid}`);
    }
    const result = await this.neynar.fetchBulkUsers({ fids: [fid] });
    if (!result.users || result.users.length < 1) {
      elizaLogger.error("Error fetching user by fid");
      throw "getProfile ERROR";
    }
    const neynarUserProfile = result.users[0];
    const profile = {
      fid,
      name: "",
      username: ""
    };
    const userDataBodyType = {
      1: "pfp",
      2: "name",
      3: "bio",
      5: "url",
      6: "username"
      // 7: "location",
      // 8: "twitter",
      // 9: "github",
    };
    profile.name = neynarUserProfile.display_name;
    profile.username = neynarUserProfile.username;
    profile.bio = neynarUserProfile.profile.bio.text;
    profile.pfp = neynarUserProfile.pfp_url;
    this.cache.set(`farcaster/profile/${fid}`, profile);
    return profile;
  }
  async getTimeline(request) {
    const timeline = [];
    const results = await this.getCastsByFid(request);
    for (const cast of results) {
      this.cache.set(`farcaster/cast/${cast.hash}`, cast);
      timeline.push(cast);
    }
    return {
      timeline
      //TODO implement paging
      //nextPageToken: results.nextPageToken,
    };
  }
};

// src/post.ts
import {
  composeContext,
  generateText,
  ModelClass,
  stringToUuid as stringToUuid3,
  elizaLogger as elizaLogger3
} from "@elizaos/core";

// src/prompts.ts
import {
  messageCompletionFooter,
  shouldRespondFooter
} from "@elizaos/core";
var formatCast = (cast) => {
  return `ID: ${cast.hash}
    From: ${cast.profile.name} (@${cast.profile.username})${cast.profile.username})${cast.inReplyTo ? `
In reply to: ${cast.inReplyTo.fid}` : ""}
Text: ${cast.text}`;
};
var formatTimeline = (character, timeline) => `# ${character.name}'s Home Timeline
${timeline.map(formatCast).join("\n")}
`;
var headerTemplate = `
{{timeline}}

# Knowledge
{{knowledge}}

About {{agentName}} (@{{farcasterUsername}}):
{{bio}}
{{lore}}
{{postDirections}}

{{providers}}

{{recentPosts}}

{{characterPostExamples}}`;
var postTemplate = headerTemplate + `
# Task: Generate a post in the voice and style of {{agentName}}, aka @{{farcasterUsername}}
Write a single sentence post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}.
Try to write something totally different than previous posts. Do not add commentary or ackwowledge this request, just write the post.

Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.`;
var messageHandlerTemplate = headerTemplate + `
Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

Thread of casts You Are Replying To:
{{formattedConversation}}

# Task: Generate a post in the voice, style and perspective of {{agentName}} (@{{farcasterUsername}}):
{{currentPost}}` + messageCompletionFooter;
var shouldRespondTemplate = (
  //
  `# Task: Decide if {{agentName}} should respond.
    About {{agentName}}:
    {{bio}}

    # INSTRUCTIONS: Determine if {{agentName}} (@{{farcasterUsername}}) should respond to the message and participate in the conversation. Do not comment. Just respond with "RESPOND" or "IGNORE" or "STOP".

Response options are RESPOND, IGNORE and STOP.

{{agentName}} should respond to messages that are directed at them, or participate in conversations that are interesting or relevant to their background, IGNORE messages that are irrelevant to them, and should STOP if the conversation is concluded.

{{agentName}} is in a room with other users and wants to be conversational, but not annoying.
{{agentName}} should RESPOND to messages that are directed at them, or participate in conversations that are interesting or relevant to their background.
If a message is not interesting or relevant, {{agentName}} should IGNORE.
If a message thread has become repetitive, {{agentName}} should IGNORE.
Unless directly RESPONDing to a user, {{agentName}} should IGNORE messages that are very short or do not contain much information.
If a user asks {{agentName}} to stop talking, {{agentName}} should STOP.
If {{agentName}} concludes a conversation and isn't part of the conversation anymore, {{agentName}} should STOP.

IMPORTANT: {{agentName}} (aka @{{farcasterUsername}}) is particularly sensitive about being annoying, so if there is any doubt, it is better to IGNORE than to RESPOND.

Thread of messages You Are Replying To:
{{formattedConversation}}

Current message:
{{currentPost}}

` + shouldRespondFooter
);

// src/utils.ts
import { stringToUuid } from "@elizaos/core";
var MAX_CAST_LENGTH = 1024;
function castId({ hash, agentId }) {
  return `${hash}-${agentId}`;
}
function castUuid(props) {
  return stringToUuid(castId(props));
}
function splitPostContent(content, maxLength = MAX_CAST_LENGTH) {
  const paragraphs = content.split("\n\n").map((p) => p.trim());
  const posts = [];
  let currentTweet = "";
  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    if ((currentTweet + "\n\n" + paragraph).trim().length <= maxLength) {
      if (currentTweet) {
        currentTweet += "\n\n" + paragraph;
      } else {
        currentTweet = paragraph;
      }
    } else {
      if (currentTweet) {
        posts.push(currentTweet.trim());
      }
      if (paragraph.length <= maxLength) {
        currentTweet = paragraph;
      } else {
        const chunks = splitParagraph(paragraph, maxLength);
        posts.push(...chunks.slice(0, -1));
        currentTweet = chunks[chunks.length - 1];
      }
    }
  }
  if (currentTweet) {
    posts.push(currentTweet.trim());
  }
  return posts;
}
function splitParagraph(paragraph, maxLength) {
  const sentences = paragraph.match(/[^\.!\?]+[\.!\?]+|[^\.!\?]+$/g) || [
    paragraph
  ];
  const chunks = [];
  let currentChunk = "";
  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).trim().length <= maxLength) {
      if (currentChunk) {
        currentChunk += " " + sentence;
      } else {
        currentChunk = sentence;
      }
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length <= maxLength) {
        currentChunk = sentence;
      } else {
        const words = sentence.split(" ");
        currentChunk = "";
        for (const word of words) {
          if ((currentChunk + " " + word).trim().length <= maxLength) {
            if (currentChunk) {
              currentChunk += " " + word;
            } else {
              currentChunk = word;
            }
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = word;
          }
        }
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// src/memory.ts
import {
  elizaLogger as elizaLogger2,
  getEmbeddingZeroVector,
  stringToUuid as stringToUuid2
} from "@elizaos/core";
function createCastMemory({
  roomId,
  runtime,
  cast
}) {
  const inReplyTo = cast.inReplyTo ? castUuid({
    hash: toHex(cast.inReplyTo.hash),
    agentId: runtime.agentId
  }) : void 0;
  return {
    id: castUuid({
      hash: cast.hash,
      agentId: runtime.agentId
    }),
    agentId: runtime.agentId,
    userId: runtime.agentId,
    content: {
      text: cast.text,
      source: "farcaster",
      url: "",
      inReplyTo,
      hash: cast.hash
    },
    roomId,
    embedding: getEmbeddingZeroVector()
  };
}
async function buildConversationThread({
  cast,
  runtime,
  client
}) {
  const thread = [];
  const visited = /* @__PURE__ */ new Set();
  async function processThread(currentCast) {
    if (visited.has(currentCast.hash)) {
      return;
    }
    visited.add(currentCast.hash);
    const roomId = castUuid({
      hash: currentCast.hash,
      agentId: runtime.agentId
    });
    const memory = await runtime.messageManager.getMemoryById(roomId);
    if (!memory) {
      elizaLogger2.log("Creating memory for cast", currentCast.hash);
      const userId = stringToUuid2(currentCast.profile.username);
      await runtime.ensureConnection(
        userId,
        roomId,
        currentCast.profile.username,
        currentCast.profile.name,
        "farcaster"
      );
      await runtime.messageManager.createMemory(
        createCastMemory({
          roomId,
          runtime,
          cast: currentCast
        })
      );
    }
    thread.unshift(currentCast);
    if (currentCast.inReplyTo) {
      const parentCast = await client.getCast(currentCast.inReplyTo.hash);
      await processThread(parentCast);
    }
  }
  await processThread(cast);
  return thread;
}

// src/actions.ts
async function sendCast({
  client,
  runtime,
  content,
  roomId,
  inReplyTo,
  profile
}) {
  const chunks = splitPostContent(content.text);
  const sent = [];
  let parentCastId = inReplyTo;
  for (const chunk of chunks) {
    const neynarCast = await client.publishCast(chunk, parentCastId);
    if (neynarCast) {
      const cast = {
        hash: neynarCast.hash,
        authorFid: neynarCast.authorFid,
        text: neynarCast.text,
        profile,
        inReplyTo: parentCastId,
        timestamp: /* @__PURE__ */ new Date()
      };
      sent.push(cast);
      parentCastId = {
        fid: neynarCast?.authorFid,
        hash: neynarCast?.hash
      };
    }
  }
  return sent.map((cast) => ({
    cast,
    memory: createCastMemory({
      roomId,
      runtime,
      cast
    })
  }));
}

// src/post.ts
var FarcasterPostManager = class {
  constructor(client, runtime, signerUuid, cache) {
    this.client = client;
    this.runtime = runtime;
    this.signerUuid = signerUuid;
    this.cache = cache;
  }
  timeout;
  async start() {
    const generateNewCastLoop = async () => {
      try {
        await this.generateNewCast();
      } catch (error) {
        elizaLogger3.error(error);
        return;
      }
      this.timeout = setTimeout(
        generateNewCastLoop,
        (Math.floor(Math.random() * (4 - 1 + 1)) + 1) * 60 * 60 * 1e3
      );
    };
    generateNewCastLoop();
  }
  async stop() {
    if (this.timeout) clearTimeout(this.timeout);
  }
  async generateNewCast() {
    elizaLogger3.info("Generating new cast");
    try {
      const fid = Number(this.runtime.getSetting("FARCASTER_FID"));
      const profile = await this.client.getProfile(fid);
      await this.runtime.ensureUserExists(
        this.runtime.agentId,
        profile.username,
        this.runtime.character.name,
        "farcaster"
      );
      const { timeline } = await this.client.getTimeline({
        fid,
        pageSize: 10
      });
      this.cache.set("farcaster/timeline", timeline);
      const formattedHomeTimeline = formatTimeline(
        this.runtime.character,
        timeline
      );
      const generateRoomId = stringToUuid3("farcaster_generate_room");
      const state = await this.runtime.composeState(
        {
          roomId: generateRoomId,
          userId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          content: { text: "", action: "" }
        },
        {
          farcasterUserName: profile.username,
          timeline: formattedHomeTimeline
        }
      );
      const context = composeContext({
        state,
        template: this.runtime.character.templates?.farcasterPostTemplate || postTemplate
      });
      const newContent = await generateText({
        runtime: this.runtime,
        context,
        modelClass: ModelClass.SMALL
      });
      const slice = newContent.replaceAll(/\\n/g, "\n").trim();
      let content = slice.slice(0, MAX_CAST_LENGTH);
      if (content.length > MAX_CAST_LENGTH) {
        content = content.slice(0, content.lastIndexOf("\n"));
      }
      if (content.length > MAX_CAST_LENGTH) {
        content = content.slice(0, content.lastIndexOf("."));
      }
      if (content.length > MAX_CAST_LENGTH) {
        content = content.slice(0, content.lastIndexOf("."));
      }
      if (this.runtime.getSetting("FARCASTER_DRY_RUN") === "true") {
        elizaLogger3.info(`Dry run: would have cast: ${content}`);
        return;
      }
      try {
        const [{ cast }] = await sendCast({
          client: this.client,
          runtime: this.runtime,
          signerUuid: this.signerUuid,
          roomId: generateRoomId,
          content: { text: content },
          profile
        });
        const roomId = castUuid({
          agentId: this.runtime.agentId,
          hash: cast.hash
        });
        await this.runtime.ensureRoomExists(roomId);
        await this.runtime.ensureParticipantInRoom(
          this.runtime.agentId,
          roomId
        );
        elizaLogger3.info(
          `[Farcaster Neynar Client] Published cast ${cast.hash}`
        );
        await this.runtime.messageManager.createMemory(
          createCastMemory({
            roomId,
            runtime: this.runtime,
            cast
          })
        );
      } catch (error) {
        elizaLogger3.error("Error sending cast:", error);
      }
    } catch (error) {
      elizaLogger3.error("Error generating new cast:", error);
    }
  }
};

// src/interactions.ts
import {
  composeContext as composeContext2,
  generateMessageResponse,
  generateShouldRespond,
  ModelClass as ModelClass2,
  stringToUuid as stringToUuid4,
  elizaLogger as elizaLogger4
} from "@elizaos/core";
var FarcasterInteractionManager = class {
  constructor(client, runtime, signerUuid, cache) {
    this.client = client;
    this.runtime = runtime;
    this.signerUuid = signerUuid;
    this.cache = cache;
  }
  timeout;
  async start() {
    const handleInteractionsLoop = async () => {
      try {
        await this.handleInteractions();
      } catch (error) {
        elizaLogger4.error(error);
        return;
      }
      this.timeout = setTimeout(
        handleInteractionsLoop,
        Number(
          this.runtime.getSetting("FARCASTER_POLL_INTERVAL") || 120
        ) * 1e3
        // Default to 2 minutes
      );
    };
    handleInteractionsLoop();
  }
  async stop() {
    if (this.timeout) clearTimeout(this.timeout);
  }
  async handleInteractions() {
    const agentFid = Number(this.runtime.getSetting("FARCASTER_FID"));
    const mentions = await this.client.getMentions({
      fid: agentFid,
      pageSize: 10
    });
    const agent = await this.client.getProfile(agentFid);
    for (const mention of mentions) {
      const messageHash = toHex(mention.hash);
      const conversationId = `${messageHash}-${this.runtime.agentId}`;
      const roomId = stringToUuid4(conversationId);
      const userId = stringToUuid4(mention.authorFid.toString());
      const pastMemoryId = castUuid({
        agentId: this.runtime.agentId,
        hash: mention.hash
      });
      const pastMemory = await this.runtime.messageManager.getMemoryById(pastMemoryId);
      if (pastMemory) {
        continue;
      }
      await this.runtime.ensureConnection(
        userId,
        roomId,
        mention.profile.username,
        mention.profile.name,
        "farcaster"
      );
      const thread = await buildConversationThread({
        client: this.client,
        runtime: this.runtime,
        cast: mention
      });
      const memory = {
        content: { text: mention.text, hash: mention.hash },
        agentId: this.runtime.agentId,
        userId,
        roomId
      };
      await this.handleCast({
        agent,
        cast: mention,
        memory,
        thread
      });
    }
    this.client.lastInteractionTimestamp = /* @__PURE__ */ new Date();
  }
  async handleCast({
    agent,
    cast,
    memory,
    thread
  }) {
    if (cast.profile.fid === agent.fid) {
      elizaLogger4.info("skipping cast from bot itself", cast.hash);
      return;
    }
    if (!memory.content.text) {
      elizaLogger4.info("skipping cast with no text", cast.hash);
      return { text: "", action: "IGNORE" };
    }
    const currentPost = formatCast(cast);
    const { timeline } = await this.client.getTimeline({
      fid: agent.fid,
      pageSize: 10
    });
    const formattedTimeline = formatTimeline(
      this.runtime.character,
      timeline
    );
    const formattedConversation = thread.map(
      (cast2) => `@${cast2.profile.username} (${new Date(
        cast2.timestamp
      ).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric"
      })}):
                ${cast2.text}`
    ).join("\n\n");
    const state = await this.runtime.composeState(memory, {
      farcasterUsername: agent.username,
      timeline: formattedTimeline,
      currentPost,
      formattedConversation
    });
    const shouldRespondContext = composeContext2({
      state,
      template: this.runtime.character.templates?.farcasterShouldRespondTemplate || this.runtime.character?.templates?.shouldRespondTemplate || shouldRespondTemplate
    });
    const memoryId = castUuid({
      agentId: this.runtime.agentId,
      hash: cast.hash
    });
    const castMemory = await this.runtime.messageManager.getMemoryById(memoryId);
    if (!castMemory) {
      await this.runtime.messageManager.createMemory(
        createCastMemory({
          roomId: memory.roomId,
          runtime: this.runtime,
          cast
        })
      );
    }
    const shouldRespondResponse = await generateShouldRespond({
      runtime: this.runtime,
      context: shouldRespondContext,
      modelClass: ModelClass2.SMALL
    });
    if (shouldRespondResponse === "IGNORE" || shouldRespondResponse === "STOP") {
      elizaLogger4.info(
        `Not responding to cast because generated ShouldRespond was ${shouldRespondResponse}`
      );
      return;
    }
    const context = composeContext2({
      state,
      template: this.runtime.character.templates?.farcasterMessageHandlerTemplate ?? this.runtime.character?.templates?.messageHandlerTemplate ?? messageHandlerTemplate
    });
    const responseContent = await generateMessageResponse({
      runtime: this.runtime,
      context,
      modelClass: ModelClass2.LARGE
    });
    responseContent.inReplyTo = memoryId;
    if (!responseContent.text) return;
    if (this.runtime.getSetting("FARCASTER_DRY_RUN") === "true") {
      elizaLogger4.info(
        `Dry run: would have responded to cast ${cast.hash} with ${responseContent.text}`
      );
      return;
    }
    const callback = async (content, files) => {
      try {
        if (memoryId && !content.inReplyTo) {
          content.inReplyTo = memoryId;
        }
        const results = await sendCast({
          runtime: this.runtime,
          client: this.client,
          signerUuid: this.signerUuid,
          profile: cast.profile,
          content,
          roomId: memory.roomId,
          inReplyTo: {
            fid: cast.authorFid,
            hash: cast.hash
          }
        });
        results[0].memory.content.action = content.action;
        for (const { memory: memory2 } of results) {
          await this.runtime.messageManager.createMemory(memory2);
        }
        return results.map((result) => result.memory);
      } catch (error) {
        console.error("Error sending response cast:", error);
        return [];
      }
    };
    const responseMessages = await callback(responseContent);
    const newState = await this.runtime.updateRecentMessageState(state);
    await this.runtime.processActions(
      memory,
      responseMessages,
      newState,
      callback
    );
  }
};

// src/index.ts
import { Configuration, NeynarAPIClient as NeynarAPIClient2 } from "@neynar/nodejs-sdk";
var FarcasterAgentClient = class {
  constructor(runtime, client) {
    this.runtime = runtime;
    const cache = /* @__PURE__ */ new Map();
    this.signerUuid = runtime.getSetting("FARCASTER_NEYNAR_SIGNER_UUID");
    const neynarConfig = new Configuration({
      apiKey: runtime.getSetting("FARCASTER_NEYNAR_API_KEY")
    });
    const neynarClient = new NeynarAPIClient2(neynarConfig);
    this.client = client ?? new FarcasterClient({
      runtime,
      ssl: true,
      url: runtime.getSetting("FARCASTER_HUB_URL") ?? "hub.pinata.cloud",
      neynar: neynarClient,
      signerUuid: this.signerUuid,
      cache
    });
    elizaLogger5.info("Farcaster Neynar client initialized.");
    this.posts = new FarcasterPostManager(
      this.client,
      this.runtime,
      this.signerUuid,
      cache
    );
    this.interactions = new FarcasterInteractionManager(
      this.client,
      this.runtime,
      this.signerUuid,
      cache
    );
  }
  client;
  posts;
  interactions;
  signerUuid;
  async start() {
    await Promise.all([this.posts.start(), this.interactions.start()]);
  }
  async stop() {
    await Promise.all([this.posts.stop(), this.interactions.stop()]);
  }
};
export {
  FarcasterAgentClient
};
//# sourceMappingURL=index.js.map