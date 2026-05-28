import * as protos from "@devvit/protos";
import { Devvit } from "@devvit/public-api";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type RedditAPIPlugins = {
    NewModmail: protos.NewModmail;
    Widgets: protos.Widgets;
    ModNote: protos.ModNote;
    LinksAndComments: protos.LinksAndComments;
    Moderation: protos.Moderation;
    GraphQL: protos.GraphQL;
    Listings: protos.Listings;
    Flair: protos.Flair;
    Wiki: protos.Wiki;
    Users: protos.Users;
    PrivateMessages: protos.PrivateMessages;
    Subreddits: protos.Subreddits;
};

/**
 * This is an extended version of the Devvit type that includes some of the members that are not exposed by default.
 */
export type ExtendedDevvit = typeof Devvit & {
    redditAPIPlugins: RedditAPIPlugins;
    schedulerPlugin: protos.Scheduler;
    kvStorePlugin: protos.KVStore;
    redisPlugin: protos.RedisAPI;
    mediaPlugin: protos.MediaService;
    settingsPlugin: protos.Settings;
    realtimePlugin: protos.Realtime;
};

export function getExtendedDevvit (): ExtendedDevvit {
    return Devvit as ExtendedDevvit;
}
