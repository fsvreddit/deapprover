import type { Context } from "hono";
import { OnPostCreateRequest, TriggerResponse } from "@devvit/web/shared";
import { fixPostTriggerEvent } from "@fsvreddit/fsv-devvit-web-helpers";
import { recordUserActivity } from "../core";

export const onPostCreate = async (c: Context): Promise<Response> => {
    const request = await fixPostTriggerEvent(await c.req.json<OnPostCreateRequest>());

    if (request.author?.name) {
        await recordUserActivity(request.author.name);
    }

    return c.json<TriggerResponse>({ message: "post create handled" }, 200);
};
