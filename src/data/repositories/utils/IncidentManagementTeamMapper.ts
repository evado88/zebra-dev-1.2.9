import {
    D2TrackerEventSchema,
    D2TrackerEventToPost,
} from "@eyeseetea/d2-api/api/trackerEvents";

import { IncidentManagementTeam } from "../../../domain/entities/incident-management-team/IncidentManagementTeam";
import { DataValueToPost, EventDataValue, getPopulatedDataElement, getValueById } from "./helpers";
import {
    RTSL_ZEBRA_INCIDENT_MANAGEMENT_TEAM_BUILDER_PROGRAM_STAGE_ID,
    RTSL_ZEBRA_ORG_UNIT_ID,
    RTSL_ZEBRA_PROGRAM_ID,
} from "../consts/DiseaseOutbreakConstants";
import { TeamMember, TeamRole } from "../../../domain/entities/incident-management-team/TeamMember";
import { Maybe } from "../../../utils/ts-utils";
import _c from "../../../domain/entities/generic/Collection";
import { Id } from "../../../domain/entities/Ref";
import { SelectedPick } from "@eyeseetea/d2-api/api";
import { D2DataElementSchema } from "@eyeseetea/d2-api/2.36";
import { RTSL_ZEBRA_INCIDENT_MANAGEMENT_TEAM_BUILDER_IDS_WITHOUT_ROLES } from "../consts/IncidentManagementTeamBuilderConstants";
import { Role } from "../../../domain/entities/incident-management-team/Role";
import { getISODateAsLocaleDateString } from "./DateTimeHelper";

export const incidentManagementTeamEventFields = {
    dataValues: {
        dataElement: true,
        value: true,
    },
    trackedEntity: true,
    event: true,
    updatedAt: true,
} as const;

/** Team builder event as returned by the tracker API: only the fields above are present. */
export type IncidentManagementTeamEvent = SelectedPick<
    D2TrackerEventSchema,
    typeof incidentManagementTeamEventFields
>;

export function mapD2EventsToIncidentManagementTeam(
    d2Events: IncidentManagementTeamEvent[],
    roles: Role[],
    teamMembers: TeamMember[]
): Maybe<IncidentManagementTeam> {
    const teamHierarchy: TeamMember[] = teamMembers.reduce(
        (acc: TeamMember[], teamMember: TeamMember) => {
            const memberRoleEvents = d2Events.filter(event => {
                const teamMemberAssignedUsername = getValueById(
                    event.dataValues,
                    RTSL_ZEBRA_INCIDENT_MANAGEMENT_TEAM_BUILDER_IDS_WITHOUT_ROLES.teamMemberAssigned
                );
                return teamMemberAssignedUsername === teamMember.username;
            });

            if (memberRoleEvents.length === 0) {
                return acc;
            } else {
                const teamRoles = getTeamMemberIncidentManagementTeamRoles(
                    teamMember,
                    memberRoleEvents,
                    roles
                );

                return teamRoles.length === 0
                    ? acc
                    : [...acc, new TeamMember({ ...teamMember, teamRoles: teamRoles })];
            }
        },
        []
    );

    const sortedByUpdatedDates = d2Events.sort(function (a, b) {
        if (!a.updatedAt) return -1;
        if (!b.updatedAt) return 1;
        return a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0;
    });

    return new IncidentManagementTeam({
        teamHierarchy: teamHierarchy,
        lastUpdated: sortedByUpdatedDates[0]?.updatedAt
            ? getISODateAsLocaleDateString(sortedByUpdatedDates[0]?.updatedAt)
            : undefined,
    });
}

export function getTeamMemberIncidentManagementTeamRoles(
    teamMemberAssigned: TeamMember,
    events: IncidentManagementTeamEvent[],
    roles: Role[]
): TeamRole[] {
    return events.reduce((acc: TeamRole[], event: IncidentManagementTeamEvent) => {
        if (
            teamMemberAssigned.username ===
            getValueById(
                event.dataValues,
                RTSL_ZEBRA_INCIDENT_MANAGEMENT_TEAM_BUILDER_IDS_WITHOUT_ROLES.teamMemberAssigned
            )
        ) {
            const teamRole = getTeamRole(event.event, event.dataValues, roles);

            return teamRole ? [...acc, teamRole] : acc;
        }
        return acc;
    }, []);
}

function getTeamRole(eventId: Id, dataValues: EventDataValue[], roles: Role[]): Maybe<TeamRole> {
    const selectedRoleId = roles.find(({ id }) => {
        const role = getValueById(dataValues, id);
        return role === "true";
    })?.id;

    const roleSelected = roles.find(role => role.id === selectedRoleId);

    const reportsToUsername = getValueById(
        dataValues,
        RTSL_ZEBRA_INCIDENT_MANAGEMENT_TEAM_BUILDER_IDS_WITHOUT_ROLES.reportsToUsername
    );

    if (selectedRoleId && roleSelected) {
        return {
            id: eventId,
            roleId: selectedRoleId,
            name: roleSelected?.name,
            reportsToUsername: reportsToUsername,
        };
    }
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

export function mapIncidentManagementTeamMemberToD2Event(
    teamMemberRole: TeamRole,
    incidentManagementTeamMember: TeamMember,
    teiId: Id,
    enrollmentId: Id,
    programStageDataElementsMetadata: D2ProgramStageDataElementsMetadata[],
    roles: Role[]
): D2TrackerEventToPost {
    const dataElementValues = getValueFromIncidentManagementTeamMember(
        incidentManagementTeamMember.username,
        teamMemberRole,
        roles
    );

    const dataValues: DataValueToPost[] = programStageDataElementsMetadata.map(programStage => {
        const typedCode = programStage.dataElement.code;
        return getPopulatedDataElement(programStage.dataElement.id, dataElementValues[typedCode]);
    });

    const d2IncidentManagementTeam: D2TrackerEventToPost = {
        event: teamMemberRole.id ?? "",
        status: "ACTIVE",
        program: RTSL_ZEBRA_PROGRAM_ID,
        programStage: RTSL_ZEBRA_INCIDENT_MANAGEMENT_TEAM_BUILDER_PROGRAM_STAGE_ID,
        enrollment: enrollmentId,
        orgUnit: RTSL_ZEBRA_ORG_UNIT_ID,
        occurredAt: new Date().toISOString(),
        dataValues: dataValues,
        trackedEntity: teiId,
    };

    return d2IncidentManagementTeam;
}

export function getValueFromIncidentManagementTeamMember(
    incidentManagementTeamMemberUsername: string,
    teamRoleAssigned: TeamRole,
    roles: Role[]
): Record<string, string> {
    const checkRoleSelected = (roleId: string): boolean =>
        (teamRoleAssigned?.roleId || "") === roleId;

    const rolesObjByCode = roles.reduce((acc, role) => {
        return {
            ...acc,
            [role.code]: checkRoleSelected(role.id) ? "true" : "",
        };
    }, {});

    return {
        RTSL_ZEB_DET_IMB_TMA: incidentManagementTeamMemberUsername,
        RTSL_ZEB_DET_IMB_REPORTS: teamRoleAssigned?.reportsToUsername ?? "",
        ...rolesObjByCode,
    };
}
