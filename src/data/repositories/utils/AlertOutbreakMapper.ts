import { alertOutbreakCodes } from "../consts/AlertConstants";
import { NotificationOptions } from "../../../domain/repositories/NotificationRepository";
import { AlertVerificationStatus } from "../../../domain/entities/alert/Alert";

/**
 * The part of a tracked entity these helpers read. Tracker queries return only the fields
 * they select, and alert tracked entities are read with several different field sets, so
 * this describes what is needed rather than a full `D2TrackerTrackedEntity`.
 */
export type AlertTrackedEntityAttributes = {
    attributes?: Array<{ code?: string; value: string }>;
};

export function mapTrackedEntityAttributesToNotificationOptions(
    trackedEntity: AlertTrackedEntityAttributes
): NotificationOptions {
    const verificationStatus = getAlertValueFromMap(
        "verificationStatus",
        trackedEntity
    ) as AlertVerificationStatus;
    const incidentManager = getAlertValueFromMap("incidentManager", trackedEntity);
    const emergenceDate = getAlertValueFromMap("emergedDate", trackedEntity);
    const detectionDate = getAlertValueFromMap("detectedDate", trackedEntity);
    const notificationDate = getAlertValueFromMap("notifiedDate", trackedEntity);
    const emsId = getAlertValueFromMap("emsId", trackedEntity);
    const outbreakId = getAlertValueFromMap("outbreakId", trackedEntity);

    return {
        detectionDate: detectionDate,
        emergenceDate: emergenceDate,
        incidentManager: incidentManager,
        notificationDate: notificationDate,
        verificationStatus: verificationStatus,
        emsId: emsId,
        outbreakId: outbreakId,
    };
}

export function getAlertValueFromMap(
    key: keyof typeof alertOutbreakCodes,
    trackedEntity: AlertTrackedEntityAttributes
): string {
    return (
        trackedEntity.attributes?.find(attribute => attribute.code === alertOutbreakCodes[key])
            ?.value ?? ""
    );
}
