import {DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient();

export async function saveToDynamoDB(data: any[]): Promise<void> {
    for (const item of data) {
        const params = {
            TableName: process.env.RECRUIT_TABLE!,
            Item: Object.entries(item).reduce((acc, [key, value]) => {
                acc[key] = { S: String(value) };
                return acc;
            }, {}),
        };
        await dynamoClient.send(new PutItemCommand(params));
    }
    console.log("Data saved to DynamoDB.");
}
