import { DataValue } from "@eyeseetea/d2-api/api/trackerEvents";
import { Maybe } from "../../../utils/ts-utils";
import { Id } from "../../../domain/entities/Ref";

/**
 * A data value as read back from the tracker API when only `dataElement` and `value` are
 * selected. Tracker queries return just the fields they ask for, so this is the shape the
 * mappers actually receive.
 */
export type EventDataValue = Pick<DataValue, "dataElement" | "value">;

/**
 * A data value as sent to the tracker import endpoint: only `dataElement` and `value` are
 * required, the audit fields are set by the server.
 */
export type DataValueToPost = EventDataValue & Partial<Omit<DataValue, "dataElement" | "value">>;

export function getValueById(dataValues: EventDataValue[], dataElement: string): Maybe<string> {
    return dataValues.find(dataValue => dataValue.dataElement === dataElement)?.value;
}

export function getDataValueById(
    dataValues: EventDataValue[],
    dataElement: string
): Maybe<EventDataValue> {
    return dataValues.find(dataValue => dataValue.dataElement === dataElement);
}

export function getPopulatedDataElement(dataElement: Id, value: Maybe<string>): DataValueToPost {
    const populatedDataElement: DataValueToPost = {
        dataElement: dataElement,
        value: value ?? "",
        updatedAt: new Date().toISOString(),
        storedBy: "",
        createdAt: new Date().toISOString(),
        providedElsewhere: false,
    };
    return populatedDataElement;
}
