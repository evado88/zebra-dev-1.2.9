import { Future } from "../domain/entities/generic/Future";
import { CancelableResponse } from "../types/d2-api";

export type FutureData<D> = Future<Error, D>;

export function apiToFuture<Data>(res: CancelableResponse<Data>): FutureData<Data> {
    return Future.fromComputation((resolve, reject) => {
        res.getData()
            .then(resolve)
            .catch((err: unknown) => {
                if (err instanceof Error) {
                    reject(withResponseMessage(err));
                } else {
                    console.error("apiToFuture:uncatched", err);
                    reject(new Error("Unknown error"));
                }
            });
        return res.cancel;
    });
}

/**
 * d2-api (fetch backend) builds HTTP errors from the response's statusText, which is empty over
 * HTTP/2. Since DHIS2 2.41, a failed tracker import also responds 409 with the import report as
 * the body, so the validation errors only live in the response data. Surface them in the message.
 */
function withResponseMessage(err: Error): Error {
    const response = (err as { response?: { status?: number; data?: unknown } }).response;
    if (!response) return err;

    const message = getMessageFromResponseData(response.data);
    if (!message) {
        return err.message ? err : new Error(`Request failed with status ${response.status}`);
    }

    const error = new Error(message);
    Object.assign(error, { request: (err as { request?: unknown }).request, response });
    console.error("apiToFuture:http-error", response.data);
    return error;
}

type D2ErrorReport = { message?: string };

type D2ResponseData = {
    message?: string;
    validationReport?: { errorReports?: D2ErrorReport[] };
    response?: { errorReports?: D2ErrorReport[] };
};

function getMessageFromResponseData(data: unknown): string | undefined {
    if (!data || typeof data !== "object") return undefined;
    const d2Data = data as D2ResponseData;

    const errorReports =
        d2Data.validationReport?.errorReports ?? d2Data.response?.errorReports ?? [];
    const reportMessages = errorReports.flatMap(report => (report.message ? [report.message] : []));

    if (reportMessages.length > 0) return reportMessages.join(", ");
    return d2Data.message || undefined;
}
