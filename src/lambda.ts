import { SQSHandler } from "aws-lambda";
import * as stream from "stream";
import {colleges, EXCLUDE_KEYS, INVALID_VALUES, KEY_MAPPING, relatedColleges, special} from "./constants";
import * as levenshtein from "fast-levenshtein";
import {saveToElasticsearch} from "./elasticsearch";
import {saveToDynamoDB} from "./dynamo";
import {getS3File, saveToS3} from "./s3";


export const handler: SQSHandler = async (event) => {
    try {
        for (const record of event.Records) {
            const messageBody = JSON.parse(record.body);
            const { bucketName, key } = messageBody;

            console.log(`Processing file from S3: Bucket=${bucketName}, Key=${key}`);

            const jsonData = await getS3File(bucketName, key);
            const crawledData = JSON.parse(jsonData);

            console.log("Crawled Data:", crawledData);

            const transformedData = crawledData.map(transformData);

            const processedKey = key.replace("raw-data", "processed-data");
            await saveToS3(bucketName, processedKey, transformedData);

            await saveToDynamoDB(transformedData);
            await saveToElasticsearch(transformedData);
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

    for (const [key, value] of Object.entries(data)) {
        const newKey = KEY_MAPPING[key] || key;

        if (EXCLUDE_KEYS.includes(newKey) || INVALID_VALUES.includes(value)) {
            continue;
        }

        switch (newKey) {
            case "deadlineTime":
                break;
            case "majors":
                break;
            case "internshipPeriod":
                break;
            case "organizationSupportAmount":
                break;
            case "status":
                break;
            case "qualifications":
                break;
            case "interviewInfo":
                break;
            case "internshipDetails":
                break;
            case "workingHours":
                continue;
            case "workingDays":
                break;
            case "progress":
                break;
            case "selectionInfo":
                break;
            default:
                break;
        }
    }

    return transformedData;
}
