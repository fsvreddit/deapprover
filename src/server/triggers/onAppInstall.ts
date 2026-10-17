import type { Context } from "hono";
import { scheduler } from "@devvit/web/server";
import { TriggerResponse } from "@devvit/web/shared";
import { addCronJobs, SchedulerJob } from "../core";
import { addSeconds } from "date-fns";
import { RecordInitialApprovedUsersJobData } from "../tasks";

export const onAppInstall = async (c: Context): Promise<Response> => {
    console.log("App Install: Triggered");

    await scheduler.runJob<RecordInitialApprovedUsersJobData>({
        name: SchedulerJob.RecordInitialApprovedUsers,
        runAt: addSeconds(new Date(), 10),
        data: { jobGuid: crypto.randomUUID() },
    });

    await addCronJobs();

    return c.json<TriggerResponse>({ message: "app installed" }, 200);
};
