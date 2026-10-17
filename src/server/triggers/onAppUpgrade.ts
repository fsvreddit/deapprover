import type { Context } from "hono";
import { context } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { addCronJobs } from "../core";

export const onAppUpgrade = async (c: Context): Promise<Response> => {
    console.log("App Upgrade: Triggered");

    await addCronJobs();

    console.log(`App Upgrade: Upgraded ${context.appSlug} to version ${context.appVersion} in subreddit ${context.subredditName}`);

    return c.json<TriggerResponse>({ message: "app upgraded" }, 200);
};
