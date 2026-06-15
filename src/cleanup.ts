import { JobContext, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { addDays, addSeconds } from "date-fns";
import { removeRecordOfUserActivity } from "./deapprover.js";
import { CleanupJobData } from "./types.js";
import { SchedulerJob } from "./constants.js";
import { getUserActiveStatus, UserActiveStatus } from "./userStatus.js";

const CLEANUP_QUEUE = "cleanupQueue";
const CLEANUP_INTERVAL_DAYS = 7;

export async function setCleanupForUser (username: string, context: TriggerContext | JobContext) {
    await context.redis.zAdd(CLEANUP_QUEUE, { member: username, score: addDays(new Date(), CLEANUP_INTERVAL_DAYS).getTime() });
}

export async function bulkAddUsersToCleanup (usernames: string[], context: TriggerContext | JobContext) {
    if (usernames.length === 0) {
        return;
    }

    // Store users in Redis at a random time between now and the cleanup interval to stop users from bunching up.
    const recordsToStore = usernames.map(username => ({
        member: username,
        score: addSeconds(new Date(), Math.floor(Math.random() * CLEANUP_INTERVAL_DAYS * 24 * 60 * 60)).getTime(),
    }));

    await context.redis.zAdd(CLEANUP_QUEUE, ...recordsToStore);
    console.log(`Added ${usernames.length} users to cleanup queue for subreddit ${context.subredditName}`);
}

export async function removeUserFromCleanup (username: string, context: TriggerContext | JobContext) {
    await context.redis.zRem(CLEANUP_QUEUE, [username]);
    console.log(`Removed user ${username} from cleanup queue for subreddit ${context.subredditName}`);
}

export async function processCleanupJob (event: ScheduledJobEvent<CleanupJobData>, context: JobContext) {
    const runRecentlyKey = `cleanupJob:runRecently`;
    if (event.data.fromCron && await context.redis.exists(runRecentlyKey)) {
        console.log("Cleanup Job: Skipping cron instance due to recent ad-hoc run");
        return;
    }

    await context.redis.set(runRecentlyKey, Date.now().toString(), { expiration: addSeconds(new Date(), 30) });

    const runLimit = addSeconds(new Date(), 10).getTime();

    const usersToClean = await context.redis.zRange(CLEANUP_QUEUE, 0, Date.now(), { by: "score" });

    if (usersToClean.length === 0) {
        console.log("Cleanup Job: No users to clean");
        return;
    }

    while (usersToClean.length > 0 && Date.now() < runLimit) {
        const username = usersToClean.shift()?.member;
        if (!username) {
            break;
        }

        const userStatus = await getUserActiveStatus(username, context);
        if (userStatus === UserActiveStatus.Deleted) {
            await removeRecordOfUserActivity(username, context);
            console.log(`Cleanup Job: User ${username} does not exist, skipping cleanup actions`);
            await context.redis.zRem(CLEANUP_QUEUE, [username]);
        } else {
            await setCleanupForUser(username, context);
        }
    }

    if (usersToClean.length > 0) {
        console.log(`Cleanup Job: Still ${usersToClean.length} users to clean after processing, will continue in next run`);

        await context.scheduler.runJob({
            name: SchedulerJob.Cleanup,
            runAt: addSeconds(new Date(), 30),
            data: { fromCron: false } satisfies CleanupJobData,
        });
    }
}
