import { D2Api } from "@eyeseetea/d2-api/2.36";
import { SelectedPick } from "@eyeseetea/d2-api/api";
import { D2TrackerTrackedEntitySchema } from "@eyeseetea/d2-api/api/trackerTrackedEntities";
import { Id } from "../../../domain/entities/Ref";
import { Maybe } from "../../../utils/ts-utils";

export const programStatusOptions = {
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
} as const;

export type ProgramStatus = (typeof programStatusOptions)[keyof typeof programStatusOptions];

const fields = {
    attributes: true,
    orgUnit: true,
    trackedEntity: true,
    trackedEntityType: true,
    inactive: true,
    createdAt: true,
    enrollments: {
        occurredAt: true,
        status: true,
        enrollment: true,
        program: true,
        orgUnit: true,
        enrolledAt: true,
        events: {
            orgUnit: true,
            status: true,
            createdAt: true,
            occurredAt: true,
            dataValues: {
                dataElement: true,
                value: true,
            },
            event: true,
        },
    },
} as const;

/**
 * Tracked entity as returned by {@link getAllTrackedEntitiesAsync}: only the fields
 * requested above are present, so it is narrower than `D2TrackerTrackedEntity`.
 */
export type TrackedEntityWithEnrollments = SelectedPick<
    D2TrackerTrackedEntitySchema,
    typeof fields
>;

export async function getAllTrackedEntitiesAsync(
    api: D2Api,
    options: {
        programId: Id;
        orgUnitId: Id;
        ouMode?: "SELECTED" | "DESCENDANTS";
        filter?: { id: string; value: Maybe<string> };
        programStatus?: ProgramStatus;
        ids?: Id[];
    }
): Promise<TrackedEntityWithEnrollments[]> {
    const { programId, orgUnitId, ouMode, filter, programStatus, ids } = options;
    const d2TrackerTrackedEntities: TrackedEntityWithEnrollments[] = [];

    const pageSize = 250;
    let page = 1;
    let totalPages = 1;

    try {
        do {
            const result = await api.tracker.trackedEntities
                .get({
                    program: programId,
                    orgUnit: orgUnitId,
                    ouMode: ouMode ?? "SELECTED",
                    totalPages: true,
                    page: page,
                    pageSize: pageSize,
                    fields: fields,
                    filter: filter ? `${filter.id}:eq:${filter.value}` : undefined,
                    trackedEntity: ids ? ids.join(";") : undefined,
                    ...(programStatus ? { programStatus } : {}),
                })
                .getData();

            d2TrackerTrackedEntities.push(...result.instances);

            totalPages = getTotalPages(result, pageSize);
            page++;
        } while (page <= totalPages);
        return d2TrackerTrackedEntities;
    } catch (error) {
        console.error(`Error fetching tracked entities for program ${programId}`, error);
        throw error;
    }
}

/**
 * From 2.41 the tracker endpoints nest the paging info under `pager` instead of
 * returning it at the top level, so both shapes are read here.
 */
export function getTotalPages(
    response: {
        pageCount?: number;
        total?: number;
        pager?: { pageCount?: number; total?: number };
    },
    pageSize: number
): number {
    const pager = response.pager ?? response;
    if (pager.pageCount !== undefined) return pager.pageCount;
    if (pager.total !== undefined) return Math.ceil(pager.total / pageSize);
    return 1;
}
