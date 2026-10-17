import { Context } from "hono";
import { TaskRequest, TaskResponse } from "@devvit/web/server";
import { deapproveInactiveUsers } from "../core";

export type DeapproveInactiveUsersJobData = {
    fromCron: boolean;
    jobGuid?: string;
};

export const handleDeapproveInactiveUsersJob = async (c: Context): Promise<Response> => {
    const request = await c.req.json<TaskRequest<DeapproveInactiveUsersJobData>>();

    await deapproveInactiveUsers(request);

    return c.json<TaskResponse>({ message: "Handled deapprove inactive users job." }, 200);
};
