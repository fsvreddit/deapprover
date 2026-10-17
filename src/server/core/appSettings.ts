import { settings } from "@devvit/web/server";

export enum AppSetting {
    DeapproveAfterMonths = "deapproveAfterMonths",

    FlairText = "flairText",
    FlairCSSClass = "flairCSSClass",
    FlairTemplateID = "flairTemplateID",

    ModmailSubject = "modmailSubject",
    ModmailText = "modmailText",
    ArchiveModmailAfterSend = "archiveModmailAfterSend",
};

export interface AppSettings {
    [AppSetting.DeapproveAfterMonths]?: number;

    [AppSetting.FlairText]?: string;
    [AppSetting.FlairCSSClass]?: string;
    [AppSetting.FlairTemplateID]?: string;

    [AppSetting.ModmailSubject]: string;
    [AppSetting.ModmailText]?: string;
    [AppSetting.ArchiveModmailAfterSend]: boolean;
}

export async function getAppSettings (): Promise<AppSettings> {
    const appSettings = await settings.getAll();

    const returnValue: AppSettings = {
        [AppSetting.ModmailSubject]: appSettings[AppSetting.ModmailSubject] as string | undefined ?? "You have been removed as an approved user in r/{{subreddit}}",
        [AppSetting.ArchiveModmailAfterSend]: appSettings[AppSetting.ArchiveModmailAfterSend] as boolean | undefined ?? true,
    };

    const deapproveAfterMonths = appSettings[AppSetting.DeapproveAfterMonths] as number | undefined ?? 0;
    if (deapproveAfterMonths > 0) {
        returnValue[AppSetting.DeapproveAfterMonths] = deapproveAfterMonths;
    }

    const flairText = appSettings[AppSetting.FlairText] as string | undefined ?? "";
    if (flairText !== "") {
        returnValue[AppSetting.FlairText] = flairText;
    }

    const flairCSSClass = appSettings[AppSetting.FlairCSSClass] as string | undefined ?? "";
    if (flairCSSClass !== "") {
        returnValue[AppSetting.FlairCSSClass] = flairCSSClass;
    }

    const flairTemplateID = appSettings[AppSetting.FlairTemplateID] as string | undefined ?? "";
    if (flairTemplateID !== "") {
        returnValue[AppSetting.FlairTemplateID] = flairTemplateID;
    }

    const modmailText = appSettings[AppSetting.ModmailText] as string | undefined ?? "";
    if (modmailText !== "") {
        returnValue[AppSetting.ModmailText] = modmailText;
    }

    const modmailSubject = appSettings[AppSetting.ModmailSubject] as string | undefined ?? "";
    if (modmailSubject !== "") {
        returnValue[AppSetting.ModmailSubject] = modmailSubject;
    }

    return returnValue;
}
