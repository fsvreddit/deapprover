import { Hono } from "hono";
import { createServer, getServerPort } from "@devvit/web/server";
import { getRequestListener } from "@hono/node-server";
import { handleValidateFlairTemplateId } from "./validators";
import { onAppInstall, onAppUpgrade, onCommentCreate, onPostCreate } from "./triggers";
import { handleCleanupJob, handleDeapproveInactiveUsersJob, handleRecordInitialApprovedUsersJob } from "./tasks";
import { onModAction } from "./triggers/onModAction";

const application = new Hono();

// Triggers
application.post("/internal/triggers/app-install", onAppInstall);
application.post("/internal/triggers/app-upgrade", onAppUpgrade);
application.post("/internal/triggers/comment-create", onCommentCreate);
application.post("/internal/triggers/mod-action", onModAction);
application.post("/internal/triggers/post-create", onPostCreate);

// Settings validators
application.post("/internal/validators/validate-flair-template-id", handleValidateFlairTemplateId);

// Scheduler jobs
application.post("/internal/scheduler/cleanup", handleCleanupJob);
application.post("/internal/scheduler/deapprove-inactive-users", handleDeapproveInactiveUsersJob);
application.post("/internal/scheduler/record-initial-approved-users", handleRecordInitialApprovedUsersJob);

const server = createServer(getRequestListener(application.fetch));
server.on("error", (err) => {
    console.error(`server error; ${err.stack}`);
});

const port = getServerPort();
server.listen(port);
