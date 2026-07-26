// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type DeapproveInactiveUsersJobData = {
    fromCron: boolean;
    jobGuid?: string;
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type CleanupJobData = {
    fromCron: boolean;
    jobGuid?: string;
};
