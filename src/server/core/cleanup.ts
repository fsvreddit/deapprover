import { context, redis, scheduler, TaskRequest } from "@devvit/web/server";
import { addDays, addMinutes, addSeconds } from "date-fns";
import { getUserActiveStatus, removeRecordOfUserActivity, SchedulerJob, UserActiveStatus } from ".";
import { hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { CleanupJobData } from "../tasks";

const CLEANUP_QUEUE = "cleanupQueue";
const CLEANUP_INTERVAL_DAYS = 7;

export async function setCleanupForUser (username: string) {
    await redis.zAdd(CLEANUP_QUEUE, { member: username, score: addDays(new Date(), CLEANUP_INTERVAL_DAYS).getTime() });
}

export async function bulkAddUsersToCleanup (usernames: string[]) {
    if (usernames.length === 0) {
        return;
    }

    // Store users in Redis at a random time between now and the cleanup interval to stop users from bunching up.
    const recordsToStore = usernames.map(username => ({
        member: username,
        score: addSeconds(new Date(), Math.floor(Math.random() * CLEANUP_INTERVAL_DAYS * 24 * 60 * 60)).getTime(),
    }));

    await redis.zAdd(CLEANUP_QUEUE, ...recordsToStore);
    console.log(`Added ${usernames.length} users to cleanup queue for subreddit ${context.subredditName}`);
}

export async function removeUserFromCleanup (username: string) {
    await redis.zRem(CLEANUP_QUEUE, [username]);
    console.log(`Removed user ${username} from cleanup queue for subreddit ${context.subredditName}`);
}

export async function processCleanupJob (event: TaskRequest<CleanupJobData>) {
    if (event.data.jobGuid && await hasEventBeenHandled(`job:${event.data.jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Cleanup Job: Skipping duplicate run for jobGuid ${event.data.jobGuid}`);
        return;
    }

    const runRecentlyKey = `cleanupJob:runRecently`;
    if (event.data.fromCron && await redis.exists(runRecentlyKey)) {
        console.log("Cleanup Job: Skipping cron instance due to recent ad-hoc run");
        return;
    }

    await redis.set(runRecentlyKey, Date.now().toString(), { expiration: addSeconds(new Date(), 30) });

    const runLimit = addSeconds(new Date(), 10).getTime();

    const usersToClean = await redis.zRange(CLEANUP_QUEUE, 0, Date.now(), { by: "score" });

    if (usersToClean.length === 0) {
        console.log("Cleanup Job: No users to clean");
        return;
    }

    while (usersToClean.length > 0 && Date.now() < runLimit) {
        const username = usersToClean.shift()?.member;
        if (!username) {
            break;
        }

        const userStatus = await getUserActiveStatus(username);
        if (userStatus === UserActiveStatus.Deleted) {
            await removeRecordOfUserActivity(username);
            console.log(`Cleanup Job: User ${username} does not exist, skipping cleanup actions`);
            await redis.zRem(CLEANUP_QUEUE, [username]);
        } else {
            await setCleanupForUser(username);
        }
    }

    if (usersToClean.length > 0) {
        console.log(`Cleanup Job: Still ${usersToClean.length} users to clean after processing, will continue in next run`);

        await scheduler.runJob<CleanupJobData>({
            name: SchedulerJob.Cleanup,
            runAt: addSeconds(new Date(), 30),
            data: { fromCron: false, jobGuid: crypto.randomUUID() },
        });
    }
}
