import * as path from "node:path";
import { transformData } from "../lambda";
import { readJsonFile, writeJsonFile } from "./utils";

const process = async () => {
    const localKey = "local-raw-data.json";

    const crawledData = readJsonFile(path.join(__dirname, "/data/local-raw-data.json"));
    const transformedData = crawledData.map((data: any) => transformData(data));

    const processedKey = localKey.replace("raw-data", "processed-data");
    const processedFilePath = path.join(__dirname, `/data/${processedKey}`);
    writeJsonFile(processedFilePath, transformedData);

    transformedData.forEach((item) => {
        console.log("Simulating DynamoDB save:", item);
        console.log("Simulating Elasticsearch save:", item);
    });

    console.log("Local test completed successfully.");
};

describe("process Function", () => {
    test("should complete successfully", async () => {
        await expect(process()).resolves.not.toThrow();
    });
    test("should ensure systemMajors field is populated", async () => {
        const localKey = "/data/local-raw-data.json";
        const crawledData = readJsonFile(path.join(__dirname, localKey));
        const transformedData = crawledData.map((data: any) => transformData(data));

        transformedData.forEach((item, index) => {
            try {
                expect(item).toHaveProperty("majors");
                expect(item.majors).not.toBeUndefined();
                expect(Array.isArray(item.majors)).toBe(true);
                expect(item.majors.length).toBeGreaterThan(0);
            } catch (error) {
                console.error(`Failed data at index ${index}:`, item);
                throw error;
            }
        });
    });
});
