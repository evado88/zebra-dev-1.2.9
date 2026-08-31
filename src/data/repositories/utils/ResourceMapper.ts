import { D2TrackerEventSchema, D2TrackerEventToPost } from "@eyeseetea/d2-api/api/trackerEvents";
import { Id } from "../../../domain/entities/Ref";
import { Maybe } from "../../../utils/ts-utils";
import { Resource } from "../../../domain/entities/resources/Resource";
import { SelectedPick } from "@eyeseetea/d2-api/api";
import { D2DataElementSchema } from "@eyeseetea/d2-api/2.36";
import {
    dhis2ResourceTypeToResourceType,
    eventFields,
    isDHIS2ResourceType,
    isStringInResourcesCodes,
    ResourcesCodes,
    resourcesIds,
    ResourcesKeyCode,
    resourceTypeToDHIS2ResourceType,
    RTSL_ZEBRA_RESOURCES_EVENT_PROGRAM_ID,
    RTSL_ZEBRA_RESOURCES_EVENT_PROGRAM_STAGE_ID,
    RTSL_ZEBRA_RESOURCES_ORG_UNIT_ID,
} from "../consts/ResourceConstants";
import { ResourceType } from "../../../domain/entities/resources/ResourceTypeNamed";

/** Resource event as returned by the tracker API: only {@link eventFields} are present. */
export type D2ResourceEvent = SelectedPick<D2TrackerEventSchema, typeof eventFields>;

type DataValueToPost = { dataElement: Id; value: string };

export function mapD2TrackerEventToResource(d2TrackerEvent: D2ResourceEvent): Resource {
    const { event, dataValues } = d2TrackerEvent;

    const dhis2ResourceType = getValueById(dataValues, resourcesIds.type);
    const resourceType =
        dhis2ResourceType && isDHIS2ResourceType(dhis2ResourceType)
            ? dhis2ResourceTypeToResourceType(dhis2ResourceType)
            : undefined;

    const resourceLabel = getValueById(dataValues, resourcesIds.name) || "";
    const resourceFileId = getValueById(dataValues, resourcesIds.fileId);
    const resourceFolder = getValueById(dataValues, resourcesIds.folder);
    const diseaseOutbreakEventId = getValueById(dataValues, resourcesIds.diseaseOutbreakId);

    if (!resourceType || !resourceLabel || !resourceFileId) {
        throw new Error(
            `Missing required fields:
            resourceType: ${resourceType}, resourceLabel: ${resourceLabel}, resourceFileId: ${resourceFileId}`
        );
    }

    switch (resourceType) {
        case ResourceType.RESPONSE_DOCUMENT:
            if (!resourceFolder) throw new Error("Missing resource folder for Response Document");
            return {
                id: event,
                type: resourceType,
                name: resourceLabel,
                fileId: resourceFileId,
                folder: resourceFolder,
            };

        case ResourceType.TEMPLATE:
            return {
                id: event,
                type: resourceType,
                name: resourceLabel,
                fileId: resourceFileId,
            };

        case ResourceType.DISEASE_OUTBREAK_EVENT_DOCUMENT:
            if (!diseaseOutbreakEventId || !resourceFolder)
                throw new Error(
                    "Missing Disease Outbreak Event Id or Resource Folder for Event Document"
                );
            return {
                id: event,
                type: resourceType,
                name: resourceLabel,
                fileId: resourceFileId,
                folder: resourceFolder,
                diseaseOutbreakEventId: diseaseOutbreakEventId,
            };
    }
}

export function mapResourceToD2TrackerEvent(
    resource: Resource,
    programStageDataElementsMetadata: D2ProgramStageDataElementsMetadata[]
): D2TrackerEventToPost {
    const dataElementValues: Record<ResourcesCodes, string> = getDataValuesFromResource(resource);

    const dataValues: DataValueToPost[] = programStageDataElementsMetadata.map(programStage => {
        if (!isStringInResourcesCodes(programStage.dataElement.code)) {
            throw new Error(
                `DataElement code ${programStage.dataElement.code} not found in Resources Codes`
            );
        }
        const typedCode: ResourcesKeyCode = programStage.dataElement.code;
        return getPopulatedDataValue(programStage.dataElement.id, dataElementValues[typedCode]);
    });

    return {
        event: resource.id,
        program: RTSL_ZEBRA_RESOURCES_EVENT_PROGRAM_ID,
        programStage: RTSL_ZEBRA_RESOURCES_EVENT_PROGRAM_STAGE_ID,
        orgUnit: RTSL_ZEBRA_RESOURCES_ORG_UNIT_ID,
        dataValues: dataValues,
        occurredAt: new Date().toISOString(),
        status: "ACTIVE",
    };
}

function getDataValuesFromResource(resource: Resource): Record<ResourcesCodes, string> {
    switch (resource.type) {
        case ResourceType.RESPONSE_DOCUMENT:
            if (!resource.folder) throw new Error("Missing resource folder for Response Document");
            return {
                RTSL_ZEB_DET_RESOURCES_RESOURCE_TYPE: resourceTypeToDHIS2ResourceType(
                    resource.type
                ),
                RTSL_ZEB_DET_RESOURCES_FILE_NAME: resource.name,
                RTSL_ZEB_DET_RESOURCES_FILE_FOLDER: resource.folder,
                RTSL_ZEB_DET_RESOURCES_FILE_ID: resource.fileId || "",
                RTSL_ZEB_DET_RESOURCES_DISEASE_OUTBREAK_EVENT_ID: "",
            };

        case ResourceType.TEMPLATE:
            return {
                RTSL_ZEB_DET_RESOURCES_RESOURCE_TYPE: resourceTypeToDHIS2ResourceType(
                    resource.type
                ),
                RTSL_ZEB_DET_RESOURCES_FILE_NAME: resource.name,
                RTSL_ZEB_DET_RESOURCES_FILE_ID: resource.fileId || "",
                RTSL_ZEB_DET_RESOURCES_FILE_FOLDER: "",
                RTSL_ZEB_DET_RESOURCES_DISEASE_OUTBREAK_EVENT_ID: "",
            };

        case ResourceType.DISEASE_OUTBREAK_EVENT_DOCUMENT:
            if (!resource.diseaseOutbreakEventId || !resource.folder)
                throw new Error(
                    "Missing Disease Outbreak Event Id or Resource Folder for Event Document"
                );
            return {
                RTSL_ZEB_DET_RESOURCES_RESOURCE_TYPE: resourceTypeToDHIS2ResourceType(
                    resource.type
                ),
                RTSL_ZEB_DET_RESOURCES_FILE_NAME: resource.name,
                RTSL_ZEB_DET_RESOURCES_FILE_FOLDER: resource.folder,
                RTSL_ZEB_DET_RESOURCES_FILE_ID: resource.fileId || "",
                RTSL_ZEB_DET_RESOURCES_DISEASE_OUTBREAK_EVENT_ID: resource.diseaseOutbreakEventId,
            };
    }
}

function getPopulatedDataValue(dataElement: Id, value: Maybe<string>): DataValueToPost {
    const populatedDataValue: DataValueToPost = {
        dataElement: dataElement,
        value: value ?? "",
    };

    return populatedDataValue;
}

function getValueById(dataValues: DataValueToPost[], dataElement: string): Maybe<string> {
    return dataValues.find(dataValue => dataValue.dataElement === dataElement)?.value;
}

type D2ProgramStageDataElementsMetadata = {
    dataElement: SelectedPick<
        D2DataElementSchema,
        {
            id: true;
            valueType: true;
            code: true;
        }
    >;
};
