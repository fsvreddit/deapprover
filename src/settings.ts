import { JobContext, SettingsFormField, TriggerContext } from "@devvit/public-api";

export enum AppSetting {
    DeapproveAfterMonths = "deapproveAfterMonths",

    FlairText = "flairText",
    FlairCSSClass = "flairCSSClass",
    FlairTemplateID = "flairTemplateID",

    ModmailSubject = "modmailSubject",
    ModmailText = "modmailText",
    ArchiveModmailAfterSend = "archiveModmailAfterSend",
};

export const appSettings: SettingsFormField[] = [
    {
        type: "number",
        name: AppSetting.DeapproveAfterMonths,
        label: "Deapprove posts after this many months",
        helpText: "Automatically deapprove users after they have been inactive for this many months. Set to zero to disable checks",
        defaultValue: 6,
    },
    {
        type: "group",
        label: "Flair Settings",
        helpText: "Set up flair to be applied to users who have been deapproved.",
        fields: [
            {
                type: "string",
                name: AppSetting.FlairText,
                label: "Flair Text",
                helpText: "Set this flair text on users who have been deapproved. Leave blank to skip.",
            },
            {
                type: "string",
                name: AppSetting.FlairCSSClass,
                label: "Flair CSS Class",
                helpText: "Set this flair CSS class on users who have been deapproved. Leave blank to skip.",
            },
            {
                type: "string",
                name: AppSetting.FlairTemplateID,
                label: "Flair Template ID",
                helpText: "Set this flair template ID on users who have been deapproved. Leave blank to skip.",
                onValidate: ({ value }) => {
                    if (!value || value === "") {
                        return;
                    }

                    const templateIdRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
                    if (!templateIdRegex.test(value)) {
                        return "Flair Template ID is not valid";
                    }
                },
            },
        ],
    },
    {
        type: "group",
        label: "Modmail Settings",
        helpText: "Send modmail to users who have been deapproved.",
        fields: [
            {
                type: "string",
                name: AppSetting.ModmailSubject,
                label: "Modmail Subject",
                helpText: "Subject of the modmail sent to users who have been deapproved. Leave blank for default subject. Supported placeholder: {{subreddit}}",
                defaultValue: "You have been removed as an approved user in r/{{subreddit}}",
            },
            {
                type: "paragraph",
                name: AppSetting.ModmailText,
                label: "Modmail to send to users who have been deapproved",
                helpText: "Leave blank to disable. Supported placeholders: {{username}}, {{subreddit}}, {{months}}",
                lineHeight: 10,
            },
            {
                type: "boolean",
                name: AppSetting.ArchiveModmailAfterSend,
                label: "Archive modmail after sending",
                helpText: "If enabled, modmail sent to users who have been deapproved will be automatically archived.",
                defaultValue: true,
            },
        ],
    },
];

export interface AppSettings {
    [AppSetting.DeapproveAfterMonths]?: number;

    [AppSetting.FlairText]?: string;
    [AppSetting.FlairCSSClass]?: string;
    [AppSetting.FlairTemplateID]?: string;

    [AppSetting.ModmailSubject]: string;
    [AppSetting.ModmailText]?: string;
    [AppSetting.ArchiveModmailAfterSend]: boolean;
}

export async function getAppSettings (context: TriggerContext | JobContext): Promise<AppSettings> {
    const settings = await context.settings.getAll();

    const returnValue: AppSettings = {
        [AppSetting.ModmailSubject]: settings[AppSetting.ModmailSubject] as string | undefined ?? "You have been removed as an approved user in r/{{subreddit}}",
        [AppSetting.ArchiveModmailAfterSend]: settings[AppSetting.ArchiveModmailAfterSend] as boolean | undefined ?? true,
    };

    const deapproveAfterMonths = settings[AppSetting.DeapproveAfterMonths] as number | undefined ?? 0;
    if (deapproveAfterMonths > 0) {
        returnValue[AppSetting.DeapproveAfterMonths] = deapproveAfterMonths;
    }

    const flairText = settings[AppSetting.FlairText] as string | undefined ?? "";
    if (flairText !== "") {
        returnValue[AppSetting.FlairText] = flairText;
    }

    const flairCSSClass = settings[AppSetting.FlairCSSClass] as string | undefined ?? "";
    if (flairCSSClass !== "") {
        returnValue[AppSetting.FlairCSSClass] = flairCSSClass;
    }

    const flairTemplateID = settings[AppSetting.FlairTemplateID] as string | undefined ?? "";
    if (flairTemplateID !== "") {
        returnValue[AppSetting.FlairTemplateID] = flairTemplateID;
    }

    const modmailText = settings[AppSetting.ModmailText] as string | undefined ?? "";
    if (modmailText !== "") {
        returnValue[AppSetting.ModmailText] = modmailText;
    }

    const modmailSubject = settings[AppSetting.ModmailSubject] as string | undefined ?? "";
    if (modmailSubject !== "") {
        returnValue[AppSetting.ModmailSubject] = modmailSubject;
    }

    return returnValue;
}
