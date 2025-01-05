import * as path from "node:path";
import {readJsonFile, writeJsonFile} from "./utils";

/**
 * Validates date strings in an object.
 * @param interviewInfo - Object containing key-value pairs for validation.
 * @returns Object with validation results.
 */
function validateInterviewDates(interviewInfo: Record<string, string>): Record<string, boolean> {
    const dateFields = ["서류 접수 기간", "서류 합격발표", "최종 합격발표"];
    const datePattern = /^~?\d{4}-\d{2}-\d{2}/;

    return Object.fromEntries(
        Object.entries(interviewInfo).map(([key, value]) => {
            if (!value || value.trim() === "") {
                return [key, true];
            }

            if (dateFields.includes(key)) {
                const match = value.match(datePattern);
                return [key, !!match];
            }
            return [key, true];
        })
    );
}

/**
 * Tests the validateInterviewDates function against provided test data.
 */
describe("validateInterviewDates Function", () => {
    const expectedResults: Record<string, boolean>[] = [
        {
            "면접유형": true,
        },
        {
            "면접유형": true,
            "서류 접수 기간": true,
        },
        {
            "면접유형": true,
            "서류 접수 기간": true,
            "서류 합격발표": true,
        },
        {
            "면접유형": true,
            "서류 접수 기간": true,
            "서류 합격발표": true,
            "최종 합격발표": true,
        },
    ];

    const testData = readJsonFile(path.join(__dirname, "/data/local-processed-data.json"));

    testData.forEach((data, index) => {
        test(`Validation test for case ${index + 1}`, () => {
            const { interviewInfo } = data;
            const result = validateInterviewDates(interviewInfo);

            const isValid = expectedResults.some(expected => JSON.stringify(result) === JSON.stringify(expected));

            if (!isValid) {
                console.error(`Test case ${index + 1} failed.`);
                console.error("Result:", result);
                console.error("Expected one of:", expectedResults);
                console.error("Interview Info:", interviewInfo);
            }

            expect(isValid).toBe(true);
        });
    });
});

