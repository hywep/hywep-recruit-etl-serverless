import { SQSHandler } from "aws-lambda";
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

            const transformedData = crawledData.map('');

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
