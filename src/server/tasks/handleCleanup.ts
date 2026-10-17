import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { Context } from "hono";
import { processCleanupJob } from "../core";

export type CleanupJobData = {
    fromCron: boolean;
    jobGuid?: string;
};

export const handleCleanupJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<CleanupJobData>>();

    await processCleanupJob(request);

    return c.json<TaskResponse>({ message: "Handled cleanup job." }, 200);
};
