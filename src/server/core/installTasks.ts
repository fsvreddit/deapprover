import { scheduler } from "@devvit/web/server";
import { SchedulerJob } from ".";
import { CleanupJobData, DeapproveInactiveUsersJobData } from "../tasks";

export async function addCronJobs () {
    const currentJobs = await scheduler.listJobs().then(jobs => jobs.filter(job => "cron" in job).map(job => job.id));

    await Promise.all(currentJobs.map(async jobId => scheduler.cancelJob(jobId)));

    await scheduler.runJob<DeapproveInactiveUsersJobData>({
        name: SchedulerJob.DeapproveInactiveUsers,
        cron: "5 * * * *", // every hour
        data: { fromCron: true },
    });

    await scheduler.runJob<CleanupJobData>({
        name: SchedulerJob.Cleanup,
        cron: "10/30 * * * *", // every 30 minutes
        data: { fromCron: true },
    });
}
