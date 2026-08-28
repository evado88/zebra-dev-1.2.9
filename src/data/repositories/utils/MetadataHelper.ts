import { Id } from "../../../domain/entities/Ref";
import { D2Api, MetadataPick } from "../../../types/d2-api";
import { apiToFuture } from "../../api-futures";
import { Maybe } from "../../../utils/ts-utils";

/** A tracked entity attribute reduced to the id/value pair the app works with. */
export type TrackedEntityAttributeValue = { attribute: Id; value: string };

export function getProgramTEAsMetadata(api: D2Api, programId: Id) {
    return apiToFuture(
        api.models.programs.get({
            fields: {
                id: true,
                programTrackedEntityAttributes: {
                    trackedEntityAttribute: {
                        id: true,
                        valueType: true,
                        code: true,
                    },
                },
            },
            filter: {
                id: { eq: programId },
            },
        })
    );
}

export function getTEAttributeById(
    trackedEntity: { attributes?: Array<TrackedEntityAttributeValue> },
    attributeId: Id
): Maybe<TrackedEntityAttributeValue> {
    if (!trackedEntity.attributes) return undefined;

    return trackedEntity.attributes
        .map(attribute => ({ attribute: attribute.attribute, value: attribute.value }))
        .find(attribute => attribute.attribute === attributeId);
}

export function getProgramStage(api: D2Api, stageId: Id) {
    return apiToFuture(
        api.models.programStages.get({
            fields: {
                id: true,
                programStageDataElements: {
                    dataElement: {
                        id: true,
                        valueType: true,
                        code: true,
                    },
                },
            },
            filter: {
                id: { eq: stageId },
            },
        })
    );
}

export function getProgramDataElementsMetadata(api: D2Api, programId: Id) {
    return apiToFuture(
        api.models.programs.get({
            fields: programDataElementsFields,
            filter: {
                id: { eq: programId },
            },
        })
    );
}

const programDataElementsFields = {
    id: true,
    programStages: {
        id: true,
        name: true,
        programStageDataElements: {
            dataElement: {
                id: true,
                code: true,
                valueType: true,
                optionSetValue: true,
                optionSet: { options: { name: true, code: true } },
            },
        },
    },
} as const;

export type D2ProgramStageDataElement = MetadataPick<{
    programStageDataElements: {
        fields: typeof programDataElementsFields.programStages.programStageDataElements;
    };
}>["programStageDataElements"][number];
