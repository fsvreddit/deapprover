import { Context } from "hono";
import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { recordInitialApprovedUsers } from "../core";

export type RecordInitialApprovedUsersJobData = {
    jobGuid?: string;
};

export const handleRecordInitialApprovedUsersJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<RecordInitialApprovedUsersJobData>>();

    await recordInitialApprovedUsers(request);

    return c.json<TaskResponse>({ message: "Handled record initial approved users job." }, 200);
};
