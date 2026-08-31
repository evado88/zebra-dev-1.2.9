import {
    CasesDataSource,
    DataSource,
    DiseaseOutbreakEventBaseAttrs,
} from "../../../domain/entities/disease-outbreak-event/DiseaseOutbreakEvent";
import {
    AttributeToPost,
    D2TrackedEntityInstanceToPost,
} from "@eyeseetea/d2-api/api/trackerTrackedEntities";
import {
    DiseaseOutbreakCode,
    diseaseOutbreakCodes,
    getValueFromDiseaseOutbreak,
    isStringInDiseaseOutbreakCodes,
    DiseaseOutbreakKeyCode,
    RTSL_ZEBRA_ORG_UNIT_ID,
    RTSL_ZEBRA_PROGRAM_ID,
    RTSL_ZEBRA_TRACKED_ENTITY_TYPE_ID,
    casesDataSourceMap,
    dataSourceMap,
} from "../consts/DiseaseOutbreakConstants";
import { SelectedPick } from "@eyeseetea/d2-api/api";
import { D2TrackedEntityAttributeSchema } from "../../../types/d2-api";
import { D2TrackerEnrollmentToPost } from "@eyeseetea/d2-api/api/trackerEnrollments";
import { getCurrentTimeString, getISODateAsLocaleDateString } from "./DateTimeHelper";
import { Id } from "../../../domain/entities/Ref";
import { Maybe } from "../../../utils/ts-utils";

/**
 * The subset of a tracked entity this mapper reads. Tracker queries return only the fields
 * they select, and the disease outbreak queries do not all select the same ones, so this
 * describes what the mapper needs rather than a full `D2TrackerTrackedEntity`.
 */
export type DiseaseOutbreakTrackedEntity = {
    trackedEntity?: Id;
    createdAt?: string;
    updatedAt?: string;
    attributes?: Array<{ code?: string; value: string }>;
    enrollments?: Array<{ status?: Maybe<"ACTIVE" | "COMPLETED" | "CANCELLED"> }>;
};

type D2TrackedEntityAttribute = {
    trackedEntityAttribute: SelectedPick<
        D2TrackedEntityAttributeSchema,
        {
            id: true;
            valueType: true;
            code: true;
        }
    >;
};

export function mapTrackedEntityAttributesToDiseaseOutbreak(
    trackedEntity: DiseaseOutbreakTrackedEntity
): DiseaseOutbreakEventBaseAttrs | undefined {
    if (!trackedEntity.trackedEntity) throw new Error("Tracked entity not found");

    const fromMap = (key: keyof typeof diseaseOutbreakCodes) => getValueFromMap(key, trackedEntity);

    const casesDataSource =
        casesDataSourceMap[fromMap("casesDataSource")] ??
        CasesDataSource.RTSL_ZEB_OS_CASE_DATA_SOURCE_eIDSR;

    const dataSource =
        casesDataSource === CasesDataSource.RTSL_ZEB_OS_CASE_DATA_SOURCE_eIDSR
            ? dataSourceMap[fromMap("dataSource")] || DataSource.ND1
            : undefined;

    const diseaseOutbreak: DiseaseOutbreakEventBaseAttrs = {
        id: trackedEntity.trackedEntity,
        status: trackedEntity.enrollments?.[0]?.status ?? "ACTIVE", //Zebra Outbreak has only one enrollment
        name: fromMap("name"),
        created: trackedEntity.createdAt
            ? getISODateAsLocaleDateString(trackedEntity.createdAt)
            : undefined,
        lastUpdated: trackedEntity.updatedAt
            ? getISODateAsLocaleDateString(trackedEntity.updatedAt)
            : undefined,
        createdByName: undefined,
        mainSyndromeCode: fromMap("mainSyndrome"),
        suspectedDiseaseCode: fromMap("suspectedDisease"),
        notificationSourceCode: fromMap("notificationSource"),
        emerged: {
            date: new Date(fromMap("emergedDate")),
            narrative: fromMap("emergedNarrative"),
        },
        detected: {
            date: new Date(fromMap("detectedDate")),
            narrative: fromMap("detectedNarrative"),
        },
        notified: {
            date: new Date(fromMap("notifiedDate")),
            narrative: fromMap("notifiedNarrative"),
        },
        incidentManagerName: fromMap("incidentManager"),
        earlyResponseActions: {
            initiateInvestigation: new Date(fromMap("initiateInvestigation")),
            conductEpidemiologicalAnalysis: new Date(fromMap("conductEpidemiologicalAnalysis")),
            laboratoryConfirmation: new Date(fromMap("laboratoryConfirmation")),
            appropriateCaseManagement: {
                date: new Date(fromMap("appropriateCaseManagementDate")),
                na: fromMap("appropriateCaseManagementNA") === "true",
            },
            initiatePublicHealthCounterMeasures: {
                date: new Date(fromMap("initiatePublicHealthCounterMeasuresDate")),
                na: fromMap("initiatePublicHealthCounterMeasuresNA") === "true",
            },
            initiateRiskCommunication: {
                date: new Date(fromMap("initiateRiskCommunicationDate")),
                na: fromMap("initiateRiskCommunicationNA") === "true",
            },
            establishCoordination: {
                date: new Date(fromMap("establishCoordinationDate")),
                na: fromMap("establishCoordinationNA") === "true",
            },
            responseNarrative: fromMap("responseNarrative"),
        },
        notes: fromMap("notes"),
        casesDataSource: casesDataSource,
        dataSource: dataSource,
    };

    return diseaseOutbreak;
}

export function mapDiseaseOutbreakEventToTrackedEntityAttributes(
    diseaseOutbreak: DiseaseOutbreakEventBaseAttrs,
    attributesMetadata: D2TrackedEntityAttribute[]
): D2TrackedEntityInstanceToPost {
    const attributeValues: Record<DiseaseOutbreakCode, string> =
        getValueFromDiseaseOutbreak(diseaseOutbreak);

    const attributes: AttributeToPost[] = attributesMetadata.map(attribute => {
        if (!isStringInDiseaseOutbreakCodes(attribute.trackedEntityAttribute.code)) {
            throw new Error("Attribute code not found in DiseaseOutbreakCodes");
        }
        const typedCode: DiseaseOutbreakKeyCode = attribute.trackedEntityAttribute.code;
        const populatedAttribute = {
            attribute: attribute.trackedEntityAttribute.id,
            value: attributeValues[typedCode],
        };
        return populatedAttribute;
    });

    const isExistingTEI = diseaseOutbreak.id !== "";

    if (isExistingTEI) {
        const trackedEntity: D2TrackedEntityInstanceToPost = {
            orgUnit: RTSL_ZEBRA_ORG_UNIT_ID,
            trackedEntityType: RTSL_ZEBRA_TRACKED_ENTITY_TYPE_ID,
            trackedEntity: diseaseOutbreak.id,
            attributes: attributes,
            enrollments: [],
        };

        return trackedEntity;
    } else {
        const enrollment: D2TrackerEnrollmentToPost = {
            orgUnit: RTSL_ZEBRA_ORG_UNIT_ID,
            program: RTSL_ZEBRA_PROGRAM_ID,
            enrollment: "",
            trackedEntity: diseaseOutbreak.id,
            trackedEntityType: RTSL_ZEBRA_TRACKED_ENTITY_TYPE_ID,
            notes: [],
            attributes: attributes,
            events: [],
            enrolledAt: getCurrentTimeString(),
            occurredAt: getCurrentTimeString(),
            createdAt: getCurrentTimeString(),
            createdAtClient: getCurrentTimeString(),
            updatedAt: getCurrentTimeString(),
            updatedAtClient: getCurrentTimeString(),
            status: "ACTIVE",
            orgUnitName: "",
            followUp: false,
            deleted: false,
            storedBy: "",
        };
        const trackedEntity: D2TrackedEntityInstanceToPost = {
            trackedEntity: diseaseOutbreak.id,
            orgUnit: RTSL_ZEBRA_ORG_UNIT_ID,
            trackedEntityType: RTSL_ZEBRA_TRACKED_ENTITY_TYPE_ID,
            attributes: attributes,
            createdAt: getCurrentTimeString(),
            updatedAt: getCurrentTimeString(),
            enrollments: [enrollment],
        };

        return trackedEntity;
    }
}

export function getValueFromMap(
    key: keyof typeof diseaseOutbreakCodes,
    trackedEntity: DiseaseOutbreakTrackedEntity
): string {
    return trackedEntity.attributes?.find(a => a.code === diseaseOutbreakCodes[key])?.value ?? "";
}
