import { context, reddit, redis, scheduler, TaskRequest } from "@devvit/web/server";
import { OnModActionRequest } from "@devvit/web/shared";
import { getExtendedDevvit, hasEventBeenHandled } from "@fsvreddit/fsv-devvit-web-helpers";
import { AppSetting, AppSettings, bulkAddUsersToCleanup, getAppSettings, removeUserFromCleanup, SchedulerJob, setCleanupForUser } from ".";
import { addHours, addMinutes, addSeconds, subMonths } from "date-fns";
import { DeapproveInactiveUsersJobData, RecordInitialApprovedUsersJobData } from "../tasks";

const LAST_USER_ACTION_DATE = "lastUserActionDate";

function getApprovedUserCacheKey (username: string) {
    return `approvedUser:${username}`;
}

async function isUserApproved (username: string): Promise<boolean> {
    const approvedUserCacheKey = getApprovedUserCacheKey(username);
    const approvedUserCacheValue = await redis.get(approvedUserCacheKey);
    if (approvedUserCacheValue !== undefined) {
        return JSON.parse(approvedUserCacheValue) as boolean;
    }

    const isApprovedUser = await reddit.getApprovedUsers({
        subredditName: context.subredditName,
        username,
    }).all().then(users => users.length > 0);

    await redis.set(approvedUserCacheKey, JSON.stringify(isApprovedUser), { expiration: addHours(new Date(), 1) });
    return isApprovedUser;
}

export async function recordUserActivity (username: string) {
    if (!await isUserApproved(username)) {
        return;
    }

    await redis.zAdd(LAST_USER_ACTION_DATE, { member: username, score: Date.now() });
    await setCleanupForUser(username);
    console.log(`Recorded activity for user ${username} in subreddit ${context.subredditName}`);
}

export async function removeRecordOfUserActivity (username: string) {
    await redis.zRem(LAST_USER_ACTION_DATE, [username]);
    console.log(`Removed record of activity for user ${username} in subreddit ${context.subredditName}`);
}

export async function recordInitialApprovedUsers (event: TaskRequest<RecordInitialApprovedUsersJobData>) {
    const jobGuid = event.data.jobGuid;
    if (jobGuid && await hasEventBeenHandled(`job:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Record Initial Approved Users Job: Skipping duplicate run for jobGuid ${jobGuid}`);
        return;
    }

    const approvedUsers = await reddit.getApprovedUsers({
        subredditName: context.subredditName,
        limit: 1000,
    }).all();

    await redis.zAdd(LAST_USER_ACTION_DATE, ...approvedUsers.map(user => ({ member: user.username, score: Date.now() })));
    await bulkAddUsersToCleanup(approvedUsers.map(user => user.username));

    console.log(`Recorded ${approvedUsers.length} initially approved users for subreddit ${context.subredditName}`);
}

export async function deapproveInactiveUsers (event: TaskRequest<DeapproveInactiveUsersJobData>) {
    if (event.data.jobGuid && await hasEventBeenHandled(`job:${event.data.jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Deapprove Job: Skipping duplicate run for jobGuid ${event.data.jobGuid}`);
        return;
    }

    const runRecentlyKey = `deapproveInactiveUsers:runRecently`;
    if (event.data.fromCron && await redis.exists(runRecentlyKey)) {
        console.log("Deapprove Job: Skipping cron instance due to recent ad-hoc run");
        return;
    }

    await redis.set(runRecentlyKey, Date.now().toString(), { expiration: addMinutes(new Date(), 1) });

    const appSettings = await getAppSettings();
    if (!appSettings[AppSetting.DeapproveAfterMonths]) {
        console.log("Deapprove Job: Skipping run since deapproval is disabled in settings");
        return;
    }

    const usersToDeapprove = await redis.zRange(LAST_USER_ACTION_DATE, 0, subMonths(Date.now(), appSettings[AppSetting.DeapproveAfterMonths]).getTime(), { by: "score" });

    const username = usersToDeapprove.shift()?.member;
    if (!username) {
        const trackedUserCount = await redis.zCard(LAST_USER_ACTION_DATE);
        console.log(`Deapprove Job: No users to deapprove. Total tracked users: ${trackedUserCount}`);
        return;
    }

    await deapproveUser(username, appSettings);

    if (usersToDeapprove.length > 0) {
        console.log(`Deapprove Job: Still ${usersToDeapprove.length} users to deapprove after processing ${username}, will continue in next run`);

        await scheduler.runJob<DeapproveInactiveUsersJobData>({
            name: SchedulerJob.DeapproveInactiveUsers,
            runAt: addSeconds(new Date(), 30),
            data: { fromCron: false, jobGuid: crypto.randomUUID() },
        });
    }
}

async function deapproveUser (username: string, appSettings: AppSettings) {
    const approvedUsers = await reddit.getApprovedUsers({
        subredditName: context.subredditName,
        username,
    }).all();

    if (approvedUsers.length === 0) {
        console.log(`Deapprove Job: User ${username} is not currently approved, skipping deapproval`);
        await redis.zRem(LAST_USER_ACTION_DATE, [username]);
        return;
    }

    await getExtendedDevvit().redditAPIPlugins.Users.Unfriend({
        type: "contributor",
        name: username,
        subreddit: context.subredditName,
    }, context.metadata);

    console.log(`Deapprove Job: Deapproved user ${username} in subreddit ${context.subredditName}`);

    if (appSettings[AppSetting.FlairText] || appSettings[AppSetting.FlairCSSClass] || appSettings[AppSetting.FlairTemplateID]) {
        await reddit.setUserFlair({
            subredditName: context.subredditName,
            username,
            text: appSettings[AppSetting.FlairText],
            cssClass: appSettings[AppSetting.FlairCSSClass],
            flairTemplateId: appSettings[AppSetting.FlairTemplateID],
        });

        console.log(`Deapprove Job: Set flair for deapproved user ${username} in subreddit ${context.subredditName}`);
    }

    if (appSettings[AppSetting.ModmailText]) {
        const formattedModmailText = appSettings[AppSetting.ModmailText]
            .replaceAll("{{username}}", username)
            .replaceAll("{{subreddit}}", context.subredditName)
            .replaceAll("{{months}}", appSettings[AppSetting.DeapproveAfterMonths]?.toString() ?? "0");

        const newConversation = await reddit.modMail.createConversation({
            subredditName: context.subredditName,
            to: username,
            subject: appSettings[AppSetting.ModmailSubject].replace("{{subreddit}}", context.subredditName),
            body: formattedModmailText,
            isAuthorHidden: true,
        });

        console.log(`Deapprove Job: Sent modmail to user ${username} regarding deapproval in subreddit ${context.subredditName}`);

        if (appSettings[AppSetting.ArchiveModmailAfterSend] && newConversation.conversation.id) {
            await reddit.modMail.archiveConversation(newConversation.conversation.id);
            console.log(`Deapprove Job: Archived modmail conversation with user ${username} regarding deapproval in subreddit ${context.subredditName}`);
        }
    }

    await redis.zRem(LAST_USER_ACTION_DATE, [username]);
}

export async function handleModAction (event: OnModActionRequest) {
    if (!event.targetUser) {
        return;
    }

    if (event.action === "addcontributor") {
        await recordUserActivity(event.targetUser.name);
    }

    if (event.action === "removecontributor") {
        await redis.zRem(LAST_USER_ACTION_DATE, [event.targetUser.name]);
        await redis.del(getApprovedUserCacheKey(event.targetUser.name));
        await removeUserFromCleanup(event.targetUser.name);
        console.log(`Removed user ${event.targetUser.name} from activity tracking due to removal from approved users in subreddit ${context.subredditName}`);
    }
}
