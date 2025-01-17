import {S3Handler} from "aws-lambda";
import {EXCLUDE_KEYS, INVALID_VALUES, KEY_MAPPING} from "./constants";
import {saveToDynamoDB} from "./aws/dynamo";
import {getS3File} from "./aws/s3";
import {handleMajors, handleQualifications} from "./major/major";
import {normalizeDeadlineTime} from "./util/date";
import {handleWorkingHours, parseWorkingDays} from "./work/work";
import {cleanGenericValue} from "./util/util";
import {
    cleanCurrency,
    handleInternshipName,
    handleInterviewInfo,
    parseInternshipDetails,
    parseInternshipPeriod,
    parseOrganizationName,
    parseSelectionInfo,
    parseStatus
} from "./internship/internship";

export const handler: S3Handler = async (event) => {
    try {
        for (const record of event.Records) {
            const bucketName = record.s3.bucket.name;
            const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

            console.log(`Processing file from S3: Bucket=${bucketName}, Key=${key}`);

            const jsonData = await getS3File(bucketName, key);

            const transformedData = jsonData.map(transformData);

            await saveToDynamoDB(transformedData);
        }
    } catch (error) {
        console.error("Error processing SQS event:", error);
        throw error;
    }
};

/**
 * Transforms the input data by mapping keys, excluding specific fields,
 * and normalizing or cleaning values based on predefined rules.
 *
 * @param {Record<string, any>} data - The input data to be transformed.
 * @returns {Record<string, any>} - The transformed data after applying necessary changes.
 */
export function transformData(data: Record<string, any>): Record<string, any> {
    const transformedData: Record<string, any> = {};

    for (let [key, value] of Object.entries(data)) {
        const newKey = KEY_MAPPING[key] || key;

        if (EXCLUDE_KEYS.includes(newKey) || INVALID_VALUES.includes(value)) {
            continue;
        }

        switch (newKey) {
            case "deadlineTime":
                transformedData[newKey] = normalizeDeadlineTime(value);
                break;
            case "majors":
                if (transformedData['organizationName'].includes('삼성전자')) {
                    value = '이공계열';
                }
                transformedData['announcedMajors'] = value;
                transformedData[newKey] = handleMajors(value);
                break;
            case "qualifications":
                handleQualifications(transformedData, value);
                break;
            case "internshipPeriod":
                Object.assign(transformedData, parseInternshipPeriod(value));
                break;
            case "internshipDetails":
                transformedData[newKey] = parseInternshipDetails(value);
                break;
            case "internshipName":
                handleInternshipName(transformedData, value);
                break
            case "interviewInfo":
                handleInterviewInfo(transformedData, value);
                break;
            case "organizationSupportAmount":
                transformedData[newKey] = cleanCurrency(value);
                break;
            case "status":
                transformedData[newKey] = parseStatus(value);
                break;
            case "workingHours":
                handleWorkingHours(value, transformedData);
                continue;
            case "workingDays":
                transformedData[newKey] = parseWorkingDays(value);
                break;
            case "selectionInfo":
                transformedData[newKey] = parseSelectionInfo(value);
                break;
            case "id":
                transformedData[newKey] = parseInt(value);
                break;
            case "organizationName":
                transformedData[newKey] = parseOrganizationName(value);
                break;
            default:
                transformedData[newKey] = cleanGenericValue(value);
                break;
        }
    }

    return transformedData;
}
