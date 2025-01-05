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
                transformedData[newKey] = normalizeDeadlineTime(value);
                break;
        }
    }

    return transformedData;
}

/**
 * Normalizes a deadline time string into a standardized format (HH:mm).
 *
 * The function supports various time formats such as "12시까지", "12시 30분까지", or "12:30까지".
 * If the input does not match any of the supported patterns or is empty, it returns "24:00".
 *
 * @param {string} time - The input time string to be normalized.
 * @returns {string} - The normalized time in HH:mm format.
 */
function normalizeDeadlineTime(time: string): string {
    if (!time) return "24:00";

    const patterns = [
        { regex: /(\d{1,2})시까지/, format: (h: string) => `${String(h).padStart(2, "0")}:00` },
        {
            regex: /(\d{1,2})시\s*(\d{1,2})분까지/,
            format: (h: string, m: string) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        },
        {
            regex: /(\d{1,2}):(\d{1,2})까지/,
            format: (h: string, m: string) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        },
    ];

    for (const { regex, format } of patterns) {
        const match = time.match(regex);
        if (match) {
            // @ts-ignore
            return format(...match.slice(1));
        }
    }
    return "24:00";
}
