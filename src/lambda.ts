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
            case "majors":
                transformedData[newKey] = handleMajors(value);
                break;
            case "qualifications":
                handleQualifications(transformedData, value);
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

/**
 * Parses qualifications-related information from an input string based on predefined patterns.
 *
 * The function extracts details such as major, recruit count, grade, credit, required competence,
 * and additional information from the input string. Each detail is matched against specific regular
 * expressions to extract the relevant value. The "major" value is further processed using a helper function.
 *
 * @param {string} input - The input string containing qualifications-related data.
 * @returns {object} - An object containing parsed qualification details with keys like "major", "recruitCount",
 *                     "grade", "credit", "competence", and "etc".
 */
function parseQualifications(input) {
    const result = {};
    const patterns = {
        major: /전공\s*:\s*([\s\S]*?)(?=\*인원|$)/,
        recruitCount: /인원\s*:\s*([\s\S]*?)(?=\*학년|$)/,
        grade: /학년\s*:\s*([\s\S]*?)(?=\*학점\/평점|$)/,
        credit: /학점\/평점\s*:\s*([\s\S]*?)(?=\*요구 역량|$)/,
        competence: /요구\s*역량\s*:\s*([\s\S]*?)(?=\*기타사항|$)/,
        etc: /기타사항\s*:\s*([\s\S]*?)(?=$)/,
    };

    for (const [key, regex] of Object.entries(patterns)) {
        const match = input.match(regex);
        if (match && match[1]) {
            let value = match[1].trim();
            if (key === 'major'){
                value = parseMajors(value);
            }
            result[key] = value;
        }
    }

    return result;
}

/**
 * Processes and retrieves related majors based on the provided input.
 *
 * The function first parses the given value to extract a list of majors, then finds and returns
 * the related majors using a helper function. The resulting list of related majors is returned as an array.
 *
 * @param {string} value - The input string containing majors information to be processed.
 * @returns {string[]} - An array of related majors based on the parsed input.
 */
function handleMajors(value: string): string[] {
    const majors = parseMajors(value);
    const relatedMajors = findRelatedMajor(majors);
    return relatedMajors;
}

/**
 * Processes and updates qualifications information in the transformed data.
 *
 * The function parses qualifications related information from the provided value and adds it to the
 * transformedData object under the "qualifications" key. If no majors are already set in the transformed data,
 * it updates the "majors" key with the qualifications' major values and finds related majors, storing them in
 * the "systemMajors" key.
 *
 * @param {Record<string, any>} transformedData - The object holding the transformed data that will be updated.
 * @param {string} value - The input string containing qualifications-related data to be processed.
 */
function handleQualifications(transformedData: Record<string, any>, value: string): void {
    transformedData["qualifications"] = parseQualifications(value);
    if (
        Array.isArray(transformedData["majors"]) &&
        transformedData["majors"].length === 0
    ) {
        const qualifications = transformedData["qualifications"];
        if (qualifications && Array.isArray(qualifications.major)) {
            transformedData["majors"] = qualifications.major;
            transformedData["systemMajors"] = findRelatedMajor(qualifications.major);
        }
    }
}

/**
 * Parses a selection string to extract a list of majors.
 *
 * The function processes the input string by handling special cases, removing bullet points,
 * and splitting the string based on various separators. It also accounts for specific terms such
 * as "무관" and "모든 계열" to return a predefined value. The resulting majors are cleaned and
 * returned as an array. Special cases like "S/W" are extracted separately and included in the result.
 *
 * @param {string} selection - The input string representing the selected majors to be parsed.
 * @returns {string[]} - An array of parsed and cleaned major values.
 */

export function parseMajors(selection: string): string[] {
    if (
        selection.includes("무관") ||
        selection.includes("모든 계열") ||
        selection.includes("모든 학과") ||
        selection.includes("모든과")
    ) {
        return ["무관"];
    }

    const specialCases = ["S/W"];
    const specialRegex = new RegExp(`\\b(${specialCases.join("|")})\\b`, "gi");
    const extractedSpecials: string[] = [];

    selection = selection.replace(specialRegex, (match) => {
        extractedSpecials.push(match.trim());
        return "";
    });

    const bulletPointRegex = /[-•*]\s*/g;
    selection = selection.replace(bulletPointRegex, "");

    const separators = /,|\/| 및 |\u2219|\n/;

    const cleanedMajors = selection
        .split(separators)
        .map((item) => {
            return item
                .split(/등|관련/)[0]
                .replace(/\(|\)/g, "")
                .trim();

        })
        .filter((item) => item.length > 0 && !['학과, 학부, 과'].includes(item) && item!=='+ 창업');

    return [...extractedSpecials, ...cleanedMajors];
}

/**
 * Finds and returns related majors based on input strings.
 *
 * The function takes an array of input strings (e.g., majors or related terms) and tries to find exact or near matches
 * with known majors in colleges, special categories, and related fields. It checks for matches in multiple levels: special
 * categories, fields of study, colleges, and individual majors. It uses the Levenshtein distance algorithm to find
 * the best match when no exact match is found. If the input is "무관", it returns that as the result.
 *
 * @param {string[]} inputs - An array of strings representing majors or related terms to be matched.
 * @returns {string[]} - An array of related majors found based on the input.
 */
function findRelatedMajor(inputs: string[]): string[] {
    const relatedData: Set<string> = new Set();

    const flatInputs = inputs
        .flatMap((input) => input.split(/[,\s]+/))
        .map((str) => str.replace(/학과|학부|전공|학/g, "").trim().toLowerCase())
        .filter((str) => str.length > 0);

    const allMajors = new Set<string>();
    Object.values(colleges).forEach((majors) => majors.forEach((major) => allMajors.add(major)));
    Object.values(special).forEach((majors) => majors.forEach((major) => allMajors.add(major)));

    function correctMajor(input: string): string {
        let bestMatch = "";
        let bestDistance = Infinity;

        for (const major of allMajors) {
            const normalizedMajor = major.replace(/학과|학부|전공/g, "").toLowerCase();
            const distance = levenshtein.get(input, normalizedMajor);

            if (distance < bestDistance && distance <= 1) {
                bestMatch = major;
                bestDistance = distance;
            }
        }

        return bestMatch || input;
    }

    for (const input of flatInputs) {
        if (input === "무관") {
            return [input];
        }

        let foundExactMatch = false;

        // Check special inputs first
        for (const [specialKey, majors] of Object.entries(special)) {
            if (specialKey.includes(input) || input.includes(specialKey)) {
                majors.forEach((major) => relatedData.add(major));
                foundExactMatch = true;
            }
        }

        // Search fields
        for (const [group, collegesList] of Object.entries(relatedColleges)) {
            if (group.includes(input) || input.includes(group.replace("계열", ""))) {
                collegesList.forEach((college) =>
                    colleges[college]?.forEach((major) => relatedData.add(major))
                );
                foundExactMatch = true;
            }
        }

        // Search college
        for (const [collegeName, majors] of Object.entries(colleges)) {
            if (input.includes(collegeName.replace("대학", ""))) {
                majors.forEach((major) => relatedData.add(major));
                foundExactMatch = true;
            }
        }

        // Search major
        for (const [collegeName, majors] of Object.entries(colleges)) {
            for (const major of majors) {
                const normalizedMajor = major.replace(/학과|학부|전공/g, "").toLowerCase();
                const normalizedInput = input.replace(/학과|학부|전공/g, "").toLowerCase();

                if (
                    normalizedMajor.startsWith(normalizedInput) ||
                    normalizedInput.startsWith(normalizedMajor)
                ) {
                    relatedData.add(major);
                    foundExactMatch = true;
                }
            }
        }

        if (!foundExactMatch) {
            const correctedInput = correctMajor(input);
            if (correctedInput !== input) {
                relatedData.add(correctedInput);
            }
        }
    }
    return Array.from(relatedData);
}
