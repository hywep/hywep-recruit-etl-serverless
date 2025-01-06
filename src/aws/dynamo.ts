import {DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import {marshall} from "@aws-sdk/util-dynamodb";

const dynamoClient = new DynamoDBClient({region: "ap-northeast-2"});

export async function saveToDynamoDB(data: any[]): Promise<void> {
    if (!process.env.RECRUIT_TABLE) {
        throw new Error("Environment variable RECRUIT_TABLE is not set.");
    }

    for (const item of data) {

        if (typeof item.id === "string") {
            if (!isNaN(Number(item.id))) {
                item.id = parseInt(item.id, 10);
            } else {
                console.error(`Invalid id value: ${item.id}`);
                throw new Error(`Invalid id value: ${item.id}`);
            }
        }

        console.log(item);

        const params = {
            TableName: process.env.RECRUIT_TABLE,
            Item: marshall(item),
        };

        try {
            await dynamoClient.send(new PutItemCommand(params));
        } catch (error) {
            console.error("Error saving item to DynamoDB:", error);
            throw error;
        }
    }
    console.log("Data saved to DynamoDB.");
}
