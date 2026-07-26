import { JobContext, JSONObject, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { CommentSubmit, ModAction, PostSubmit } from "@devvit/protos";
import { getTrueUsername, hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-helpers";
import { DeapproveInactiveUsersJobData } from "./types.js";
import { AppSetting, AppSettings, getAppSettings } from "./settings.js";
import { addHours, addMinutes, addSeconds, subMonths } from "date-fns";
import { SchedulerJob } from "./constants.js";
import { getExtendedDevvit } from "devvit-helpers";
import { bulkAddUsersToCleanup, removeUserFromCleanup, setCleanupForUser } from "./cleanup.js";

const LAST_USER_ACTION_DATE = "lastUserActionDate";

function getApprovedUserCacheKey (username: string) {
    return `approvedUser:${username}`;
}

async function isUserApproved (username: string, context: TriggerContext | JobContext): Promise<boolean> {
    const approvedUserCacheKey = getApprovedUserCacheKey(username);
    const approvedUserCacheValue = await context.redis.get(approvedUserCacheKey);
    if (approvedUserCacheValue !== undefined) {
        return JSON.parse(approvedUserCacheValue) as boolean;
    }

    const isApprovedUser = await context.reddit.getApprovedUsers({
        subredditName: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
        username,
    }).all().then(users => users.length > 0);

    await context.redis.set(approvedUserCacheKey, JSON.stringify(isApprovedUser), { expiration: addHours(new Date(), 1) });
    return isApprovedUser;
}

async function recordUserActivity (username: string, context: TriggerContext | JobContext) {
    if (!await isUserApproved(username, context)) {
        return;
    }

    await context.redis.zAdd(LAST_USER_ACTION_DATE, { member: username, score: Date.now() });
    await setCleanupForUser(username, context);
    console.log(`Recorded activity for user ${username} in subreddit ${context.subredditName}`);
}

export async function removeRecordOfUserActivity (username: string, context: TriggerContext | JobContext) {
    await context.redis.zRem(LAST_USER_ACTION_DATE, [username]);
    console.log(`Removed record of activity for user ${username} in subreddit ${context.subredditName}`);
}

export async function recordContentCreation (event: PostSubmit | CommentSubmit, context: TriggerContext) {
    if (!event.author?.name) {
        throw new Error("Content creation event is missing author information");
    }

    let targetId: string | undefined;
    if ("comment" in event) {
        targetId = event.comment?.id;
    } else {
        targetId = event.post?.id;
    }

    if (!targetId) {
        throw new Error("Could not determine target ID for content creation event");
    }

    const username = await getTrueUsername(context.reddit, event.author.name, targetId);
    await recordUserActivity(username, context);
}

export async function recordInitialApprovedUsers (event: ScheduledJobEvent<JSONObject | undefined>, context: JobContext) {
    const jobGuid = event.data?.jobGuid as string | undefined;
    if (jobGuid && await hasTriggerBeenHandled(context.redis, `job:${jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Record Initial Approved Users Job: Skipping duplicate run for jobGuid ${jobGuid}`);
        return;
    }

    const approvedUsers = await context.reddit.getApprovedUsers({
        subredditName: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
        limit: 1000,
    }).all();

    await context.redis.zAdd(LAST_USER_ACTION_DATE, ...approvedUsers.map(user => ({ member: user.username, score: Date.now() })));
    await bulkAddUsersToCleanup(approvedUsers.map(user => user.username), context);

    console.log(`Recorded ${approvedUsers.length} initially approved users for subreddit ${context.subredditName}`);
}

export async function deapproveInactiveUsers (event: ScheduledJobEvent<DeapproveInactiveUsersJobData>, context: JobContext) {
    if (event.data.jobGuid && await hasTriggerBeenHandled(context.redis, `job:${event.data.jobGuid}`, { expiration: addMinutes(new Date(), 5) })) {
        console.warn(`Deapprove Job: Skipping duplicate run for jobGuid ${event.data.jobGuid}`);
        return;
    }

    const runRecentlyKey = `deapproveInactiveUsers:runRecently`;
    if (event.data.fromCron && await context.redis.exists(runRecentlyKey)) {
        console.log("Deapprove Job: Skipping cron instance due to recent ad-hoc run");
        return;
    }

    await context.redis.set(runRecentlyKey, Date.now().toString(), { expiration: addMinutes(new Date(), 1) });

    const appSettings = await getAppSettings(context);
    if (!appSettings[AppSetting.DeapproveAfterMonths]) {
        console.log("Deapprove Job: Skipping run since deapproval is disabled in settings");
        return;
    }

    const usersToDeapprove = await context.redis.zRange(LAST_USER_ACTION_DATE, 0, subMonths(Date.now(), appSettings[AppSetting.DeapproveAfterMonths]).getTime(), { by: "score" });

    const username = usersToDeapprove.shift()?.member;
    if (!username) {
        const trackedUserCount = await context.redis.zCard(LAST_USER_ACTION_DATE);
        console.log(`Deapprove Job: No users to deapprove. Total tracked users: ${trackedUserCount}`);
        return;
    }

    await deapproveUser(username, appSettings, context);

    if (usersToDeapprove.length > 0) {
        console.log(`Deapprove Job: Still ${usersToDeapprove.length} users to deapprove after processing ${username}, will continue in next run`);

        await context.scheduler.runJob({
            name: SchedulerJob.DeapproveInactiveUsers,
            runAt: addSeconds(new Date(), 30),
            data: { fromCron: false, jobGuid: crypto.randomUUID() } satisfies DeapproveInactiveUsersJobData,
        });
    }
}

async function deapproveUser (username: string, appSettings: AppSettings, context: JobContext) {
    const approvedUsers = await context.reddit.getApprovedUsers({
        subredditName: context.subredditName ?? await context.reddit.getCurrentSubredditName(),
        username,
    }).all();

    if (approvedUsers.length === 0) {
        console.log(`Deapprove Job: User ${username} is not currently approved, skipping deapproval`);
        await context.redis.zRem(LAST_USER_ACTION_DATE, [username]);
        return;
    }

    const subredditName = context.subredditName ?? await context.reddit.getCurrentSubredditName();

    await getExtendedDevvit().redditAPIPlugins.Users.Unfriend({
        type: "contributor",
        name: username,
        subreddit: subredditName,
    }, context.metadata);

    console.log(`Deapprove Job: Deapproved user ${username} in subreddit ${subredditName}`);

    if (appSettings[AppSetting.FlairText] || appSettings[AppSetting.FlairCSSClass] || appSettings[AppSetting.FlairTemplateID]) {
        await context.reddit.setUserFlair({
            subredditName,
            username,
            text: appSettings[AppSetting.FlairText],
            cssClass: appSettings[AppSetting.FlairCSSClass],
            flairTemplateId: appSettings[AppSetting.FlairTemplateID],
        });

        console.log(`Deapprove Job: Set flair for deapproved user ${username} in subreddit ${subredditName}`);
    }

    if (appSettings[AppSetting.ModmailText]) {
        const formattedModmailText = appSettings[AppSetting.ModmailText]
            .replaceAll("{{username}}", username)
            .replaceAll("{{subreddit}}", subredditName)
            .replaceAll("{{months}}", appSettings[AppSetting.DeapproveAfterMonths]?.toString() ?? "0");

        const newConversation = await context.reddit.modMail.createConversation({
            subredditName,
            to: username,
            subject: appSettings[AppSetting.ModmailSubject].replace("{{subreddit}}", subredditName),
            body: formattedModmailText,
            isAuthorHidden: true,
        });

        console.log(`Deapprove Job: Sent modmail to user ${username} regarding deapproval in subreddit ${subredditName}`);

        if (appSettings[AppSetting.ArchiveModmailAfterSend] && newConversation.conversation.id) {
            await context.reddit.modMail.archiveConversation(newConversation.conversation.id);
            console.log(`Deapprove Job: Archived modmail conversation with user ${username} regarding deapproval in subreddit ${subredditName}`);
        }
    }

    await context.redis.zRem(LAST_USER_ACTION_DATE, [username]);
}

export async function handleModAction (event: ModAction, context: TriggerContext) {
    if (!event.targetUser) {
        return;
    }

    if (event.action === "addcontributor") {
        await recordUserActivity(event.targetUser.name, context);
    }

    if (event.action === "removecontributor") {
        await context.redis.zRem(LAST_USER_ACTION_DATE, [event.targetUser.name]);
        await context.redis.del(getApprovedUserCacheKey(event.targetUser.name));
        await removeUserFromCleanup(event.targetUser.name, context);
        console.log(`Removed user ${event.targetUser.name} from activity tracking due to removal from approved users in subreddit ${context.subredditName}`);
    }
}
