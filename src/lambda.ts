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
            case "internshipPeriod":
                Object.assign(transformedData, parseInternshipPeriod(value));
                break;
            case "internshipDetails":
                transformedData[newKey] = parseInternshipDetails(value);
                break;
            case "interviewInfo":
                handleInterviewInfo(transformedData,value);
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
            default:
                transformedData[newKey] = cleanGenericValue(value);
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
 * Processes and standardizes interview information before adding it to the transformed data.
 *
 * The function extracts relevant interview details from the provided value and standardizes
 * any date-related information. It then adds the processed interview information to the
 * transformedData object under the key 'interviewInfo'.
 *
 * @param {Record<string, any>} transformedData - The object holding the transformed data where the result will be added.
 * @param {string} value - The input string containing interview-related information to be processed.
 */
function handleInterviewInfo(transformedData: Record<string, any>, value: string) {
    const extractedValue = extractInterviewDetails(value);
    transformedData['interviewInfo'] = standardizeDates(extractedValue);
}

/**
 * Processes and adds work start and end hours to the provided data object.
 *
 * The function splits the input string by the "~" separator to extract the start and end times,
 * trims any extra whitespace, and then converts the times to ISO 8601 format using a helper function.
 * The converted times are stored in the "data" object under the keys "workStartHour" and "workEndHour".
 *
 * @param {string} value - The input string representing the working hours in the format "HH:mm ~ HH:mm".
 * @param {Record<string, any>} data - The object where the processed working hours will be stored.
 */
function handleWorkingHours(value: string, data: Record<string, any>) {
    const [start, end] = value.split("~").map((time) => time.trim());
    data["workStartHour"] = convertToISO8601(start);
    data["workEndHour"] = convertToISO8601(end);
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

/**
 * Parses an internship period string to extract start and end dates.
 *
 * The function splits the input string by the "~" separator, trims any extra whitespace,
 * and returns an object containing the start and end dates as separate fields.
 *
 * @param {string} period - The input string representing the internship period (e.g., "2023-01-01 ~ 2023-06-30").
 * @returns {Record<string, string>} - An object with "startDate" and "endDate" as string fields.
 */
function parseInternshipPeriod(period: string): Record<string, string> {
    const [start, end] = period.split("~").map((v) => v.trim());
    return { startDate: start, endDate: end };
}

/**
 * Parses internship details from a given input string and extracts relevant information.
 *
 * The function matches various sections of the internship details using predefined regular
 * expressions and stores the extracted values in an object. It looks for specific sections
 * such as "직무명", "교육목표", "직무 개요", "운영/ 지도 계획", and "목표 성과물". Each extracted
 * value is trimmed and added to the result object under appropriate keys.
 *
 * @param {string} details - The input string containing internship details to be parsed.
 * @returns {Record<string, string>} - An object containing the parsed internship details such as job title, goals,
 *                                      job overview, operation guidance, and target outcomes.
 */
function parseInternshipDetails(details: string): Record<string, string> {
    const result: Record<string, string> = {};
    const patterns = {
        jobTitle: /[*]직무명\s*:\s*([\s\S]*?)(?=\n[*]교육목표|$)/,
        goals: /[*]교육목표\s*:\s*([\s\S]*?)(?=\n[*]직무 개요|$)/,
        jobOverview: /[*]직무\s*개요\s*:\s*([\s\S]*?)(?=\n[*]운영\/ 지도 계획|$)/,
        operationGuidance: /[*]운영\/ 지도 계획\s*:\s*([\s\S]*?)(?=\n[*]목표 성과물|$)/,
        targetOutcomes: /[*]목표\s*성과물\s*:\s*([\s\S]*?)(?=$)/,
    };

    for (const [key, regex] of Object.entries(patterns)) {
        const match = details.match(regex);
        if (match && match[1]) {
            result[key] = match[1].trim();
        }
    }

    return result;
}

/**
 * Extracts interview-related details from an input string.
 *
 * The function processes the input string to extract various interview details such as interview type,
 * application submission period, application results announcement, and final results announcement using
 * predefined regular expressions. It removes any asterisks from the input before applying the patterns
 * and stores the extracted values in an object.
 *
 * @param {string} input - The input string containing interview details to be extracted.
 * @returns {Record<string, string>} - An object containing the extracted interview details such as
 *                                      "interviewType", "applicationSubmissionPeriod",
 *                                      "applicationResultsAnnouncement", and "finalResultsAnnouncement".
 */
function extractInterviewDetails(input: string): Record<string, string> {
    const result: Record<string, string> = {};
    const patterns = {
        interviewType: /면접유형\s*:\s*([^\n]+)/,
        applicationSubmissionPeriod: /서류\s*접수\s*기간\s*:\s*([^서류합격발표]+)/,
        applicationResultsAnnouncement: /서류\s*합격\s*발표\s*:\s*([^면접일]+)/,
        finalResultsAnnouncement: /최종\s*합격발표\s*:\s*([^\n]+)/,
    };

    const cleanedInput = input.replace(/\*/g, '');

    for (const [key, regex] of Object.entries(patterns)) {
        const match = cleanedInput.match(regex);
        if (match && match[1]) {
            result[key] = match[1].trim();
        }
    }

    return result;
}

/**
 * Standardizes date formats in the provided object.
 *
 * The function processes all string values in the given object and checks for date-like patterns.
 * It normalizes dates to a standardized format (YYYY-MM-DD) and resolves partial dates by using the last known year.
 * It handles three date formats: full dates (e.g., "2023.01.01"), partial dates (e.g., "01.01"), and dates with a tilde (~) prefix (e.g., "~2023.01.01").
 *
 * @param {Record<string, any>} parsedObject - The object containing the parsed data, where date values will be standardized.
 * @returns {Record<string, any>} - The object with standardized date formats.
 */
function standardizeDates(parsedObject: Record<string, any>): Record<string, any> {
    const fullDatePattern = /^\d{2,4}\s*\.\s*\d{2}\s*\.\s*\d{2}$/;
    const partialDatePattern = /^\d{2}\s*\.\s*\d{2}$/;
    const tildeDatePattern = /^~\d{2,4}\s*\.\s*\d{2}\s*\.\s*\d{2}$/;
    const dateLikePattern = /(~?\d{2,4}\s*\.\s*\d{2}\s*\.\s*\d{2})|(~?\d{2}\s*\.\s*\d{2})/g;

    let lastKnownYear = null;

    for (const key in parsedObject) {
        const value = parsedObject[key];
        if (typeof value === "string") {
            parsedObject[key] = value.replace(/\s*\.\s*/g, ".").trim();
        }
    }

    for (const key in parsedObject) {
        const value = parsedObject[key];
        if (typeof value !== "string") continue;

        const matches = value.match(dateLikePattern);
        if (!matches) continue;

        let transformedValue = value;
        matches.forEach((match) => {
            const normalizedMatch = match.replace(/\s*\.\s*/g, ".").trim();

            let transformedDate = normalizedMatch;

            if (tildeDatePattern.test(normalizedMatch)) {
                const dateWithoutTilde = normalizedMatch.slice(1);
                const components = dateWithoutTilde.split(".");
                const year = components[0].length === 2 ? `20${components[0]}` : components[0];
                transformedDate = `~${year}-${components[1]}-${components[2]}`;
                lastKnownYear = year;
            } else if (fullDatePattern.test(normalizedMatch)) {
                const components = normalizedMatch.split(".");
                const year = components[0].length === 2 ? `20${components[0]}` : components[0];
                transformedDate = `${year}-${components[1]}-${components[2]}`;
                lastKnownYear = year;
            } else if (partialDatePattern.test(normalizedMatch) && lastKnownYear) {
                const components = normalizedMatch.split(".");
                transformedDate = `${lastKnownYear}-${components[0]}-${components[1]}`;
            }

            transformedValue = transformedValue.replace(match, transformedDate);
        });

        parsedObject[key] = transformedValue;
    }

    return parsedObject;
}

/**
 * Cleans and extracts currency information from a given string.
 *
 * The function matches the input string against a regular expression to extract the period (e.g., "월", "주")
 * and the amount in Korean Won. It returns the extracted information in an object with the period and amount as properties.
 * If the input format is invalid, it returns a default period of "월" and an amount of 0.
 *
 * @param {string} value - The input string representing the currency value (e.g., "월 500,000 원").
 * @returns {{ period: string, amount: number }} - An object containing the period and the amount.
 */

function cleanCurrency(value: string): { period: string; amount: number } {
    const match = value.match(/^(월|주)?\s*([\d,]+)\s*원$/);
    if (match) {
        const period = match[1] || "월";
        const amount = parseInt(match[2].replace(/,/g, ""), 10);
        return { period, amount };
    }
    return { period: "월", amount: 0 };
}

/**
 * Parses a string representing working days into an array of individual days.
 *
 * The function splits the input string by spaces and returns an array of working days.
 *
 * @param {string} value - The input string representing working days (e.g., "월 화 수").
 * @returns {string[]} - An array of working days.
 */
function parseWorkingDays(value: string): string[] {
    return value.split(" ");
}

/**
 * Parses the status and determines if it indicates an open or closed status.
 *
 * The function checks if the input string is equal to "접수마감" (meaning "closed"). If so, it returns false,
 * otherwise, it returns true indicating an open status.
 *
 * @param {string} status - The input string representing the status (e.g., "접수마감", "접수중").
 * @returns {boolean} - True if the status indicates open, false if closed.
 */
function parseStatus(status: string): boolean {
    return status.trim() !== "접수마감";
}

/**
 * Parses selection information to extract applicable grade levels.
 *
 * The function checks if the input string includes the term "무관", in which case it returns all grade levels
 * (1, 2, 3, 4). If the string contains specific grade information (e.g., "1학년, 2학년"), it extracts and
 * returns the corresponding numeric values. If no grade information is found, it returns an empty array.
 *
 * @param {string} selectionInfo - The input string containing the selection information to be parsed.
 * @returns {number[]} - An array of applicable grade levels as numbers, or an empty array if no grades are found.
 */
function parseSelectionInfo(selectionInfo: string): number[] {
    if (selectionInfo.includes("무관")) {
        return [1, 2, 3, 4];
    }

    const gradeMatch = selectionInfo.match(/(\d+(?:,\d+)*학년)/);

    if (!gradeMatch) {
        return [];
    }

    return gradeMatch[1].replace(/학년/g, '').split(',').map(Number);
}

/**
 * Trims the input value to remove leading and trailing whitespace.
 *
 * The function simply trims the input string and returns the cleaned value.
 *
 * @param {string} value - The input string to be cleaned.
 * @returns {string} - The cleaned string with whitespace removed.
 */
function cleanGenericValue(value: string): string {
    return value.trim();
}

/**
 * Converts a time string into ISO 8601 format (HH:mm).
 *
 * The function matches the input string (e.g., "12시 30분") to extract the hour and minute, and converts them into
 * a formatted time string in the ISO 8601 format (HH:mm). If the input format is invalid, an error is thrown.
 *
 * @param {string} time - The input string representing the time (e.g., "12시 30분").
 * @returns {string} - The time in ISO 8601 format (HH:mm).
 * @throws {Error} - Throws an error if the input time format is invalid.
 */
function convertToISO8601(time: string): string {
    const match = time.match(/(\d{1,2})시\s*(\d{1,2})분/);
    if (!match) {
        throw new Error(`Invalid time format: ${time}`);
    }
    const hour = String(match[1]).padStart(2, '0');
    const minute = String(match[2]).padStart(2, '0');
    return `${hour}:${minute}`;
}
