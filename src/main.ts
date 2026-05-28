import { Devvit } from "@devvit/public-api";
import { appSettings } from "./settings.js";
import { deapproveInactiveUsers, handleModAction, recordContentCreation, recordInitialApprovedUsers } from "./deapprover.js";
import { handleAppInstall, handleAppUpgrade } from "./installTasks.js";
import { SchedulerJob } from "./constants.js";
import { processCleanupJob } from "./cleanup.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "AppInstall",
    onEvent: handleAppInstall,
});

Devvit.addTrigger({
    event: "AppUpgrade",
    onEvent: handleAppUpgrade,
});

Devvit.addTrigger({
    event: "PostSubmit",
    onEvent: recordContentCreation,
});

Devvit.addTrigger({
    event: "CommentSubmit",
    onEvent: recordContentCreation,
});

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.RecordInitialApprovedUsers,
    onRun: recordInitialApprovedUsers,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.DeapproveInactiveUsers,
    onRun: deapproveInactiveUsers,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.Cleanup,
    onRun: processCleanupJob,
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;
