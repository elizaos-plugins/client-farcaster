import { IAgentRuntime, Client } from '@elizaos/core';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';

type Profile = {
    fid: number;
    name: string;
    username: string;
    pfp?: string;
    bio?: string;
    url?: string;
};
type NeynarCastResponse = {
    hash: string;
    authorFid: number;
    text: string;
};
type Cast = {
    hash: string;
    authorFid: number;
    text: string;
    profile: Profile;
    inReplyTo?: {
        hash: string;
        fid: number;
    };
    timestamp: Date;
};
type CastId = {
    hash: string;
    fid: number;
};
type FidRequest = {
    fid: number;
    pageSize: number;
};

declare class FarcasterClient {
    runtime: IAgentRuntime;
    neynar: NeynarAPIClient;
    signerUuid: string;
    cache: Map<string, any>;
    lastInteractionTimestamp: Date;
    constructor(opts: {
        runtime: IAgentRuntime;
        url: string;
        ssl: boolean;
        neynar: NeynarAPIClient;
        signerUuid: string;
        cache: Map<string, any>;
    });
    loadCastFromNeynarResponse(neynarResponse: any): Promise<Cast>;
    publishCast(cast: string, parentCastId: CastId | undefined, retryTimes?: number): Promise<NeynarCastResponse | undefined>;
    getCast(castHash: string): Promise<Cast>;
    getCastsByFid(request: FidRequest): Promise<Cast[]>;
    getMentions(request: FidRequest): Promise<Cast[]>;
    getProfile(fid: number): Promise<Profile>;
    getTimeline(request: FidRequest): Promise<{
        timeline: Cast[];
        nextPageToken?: Uint8Array | undefined;
    }>;
}

declare class FarcasterPostManager {
    client: FarcasterClient;
    runtime: IAgentRuntime;
    private signerUuid;
    cache: Map<string, any>;
    private timeout;
    constructor(client: FarcasterClient, runtime: IAgentRuntime, signerUuid: string, cache: Map<string, any>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private generateNewCast;
}

declare class FarcasterInteractionManager {
    client: FarcasterClient;
    runtime: IAgentRuntime;
    private signerUuid;
    cache: Map<string, any>;
    private timeout;
    constructor(client: FarcasterClient, runtime: IAgentRuntime, signerUuid: string, cache: Map<string, any>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleInteractions;
    private handleCast;
}

declare class FarcasterAgentClient implements Client {
    runtime: IAgentRuntime;
    client: FarcasterClient;
    posts: FarcasterPostManager;
    interactions: FarcasterInteractionManager;
    private signerUuid;
    constructor(runtime: IAgentRuntime, client?: FarcasterClient);
    start(): Promise<void>;
    stop(): Promise<void>;
}

export { FarcasterAgentClient };
