import { TriggerContext } from "@devvit/public-api";
import { AppInstall, AppUpgrade } from "@devvit/protos";
import { SchedulerJob } from "./constants.js";
import { addSeconds } from "date-fns";
import { CleanupJobData, DeapproveInactiveUsersJobData } from "./types.js";

async function addCronJobs (context: TriggerContext) {
    const currentJobs = await context.scheduler.listJobs().then(jobs => jobs.filter(job => "cron" in job).map(job => job.id));

    await Promise.all(currentJobs.map(async jobId => context.scheduler.cancelJob(jobId)));

    await context.scheduler.runJob({
        name: SchedulerJob.DeapproveInactiveUsers,
        cron: "5 * * * *", // every hour
        data: { fromCron: true } satisfies DeapproveInactiveUsersJobData,
    });

    await context.scheduler.runJob({
        name: SchedulerJob.Cleanup,
        cron: "10/30 * * * *", // every 30 minutes
        data: { fromCron: true } satisfies CleanupJobData,
    });
}

export async function handleAppInstall (_: AppInstall, context: TriggerContext) {
    await context.scheduler.runJob({
        name: SchedulerJob.RecordInitialApprovedUsers,
        runAt: addSeconds(new Date(), 10),
        data: { jobGuid: crypto.randomUUID() },
    });

    await addCronJobs(context);

    console.log(`App Install: Installed ${context.appSlug} at version ${context.appVersion} in subreddit ${context.subredditName}`);
}

export async function handleAppUpgrade (_: AppUpgrade, context: TriggerContext) {
    await addCronJobs(context);

    console.log(`App Upgrade: Upgraded ${context.appSlug} to version ${context.appVersion} in subreddit ${context.subredditName}`);
}
