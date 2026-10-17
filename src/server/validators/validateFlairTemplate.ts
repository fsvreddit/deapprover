import { SettingsValidationRequest, SettingsValidationResponse } from "@devvit/web/shared";
import type { Context } from "hono";

export const handleValidateFlairTemplateId = async (c: Context): Promise<Response> => {
    const validationRequest = await c.req.json<SettingsValidationRequest<string>>();

    const value = validationRequest.value;
    if (!value || value === "") {
        return c.json<SettingsValidationResponse>({
            success: true,
        });
    }

    const templateIdRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    if (!templateIdRegex.test(value)) {
        return c.json<SettingsValidationResponse>({
            success: false,
            error: "Flair Template ID is not valid",
        });
    }

    return c.json<SettingsValidationResponse>({ success: true }, 200);
};
