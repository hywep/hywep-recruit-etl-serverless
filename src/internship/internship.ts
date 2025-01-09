import {standardizeDates} from "../util/date";

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
export function parseSelectionInfo(selectionInfo: string): number[] {
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
 * Parses an internship period string to extract start and end dates.
 *
 * The function splits the input string by the "~" separator, trims any extra whitespace,
 * and returns an object containing the start and end dates as separate fields.
 *
 * @param {string} period - The input string representing the internship period (e.g., "2023-01-01 ~ 2023-06-30").
 * @returns {Record<string, string>} - An object with "startDate" and "endDate" as string fields.
 */
export function parseInternshipPeriod(period: string): Record<string, string> {
    const [start, end] = period.split("~").map((v) => v.trim());
    return {startDate: start, endDate: end};
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
export function parseInternshipDetails(details: string): Record<string, string> {
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
 * Processes and standardizes interview information before adding it to the transformed data.
 *
 * The function extracts relevant interview details from the provided value and standardizes
 * any date-related information. It then adds the processed interview information to the
 * transformedData object under the key 'interviewInfo'.
 *
 * @param {Record<string, any>} transformedData - The object holding the transformed data where the result will be added.
 * @param {string} value - The input string containing interview-related information to be processed.
 */
export function handleInterviewInfo(transformedData: Record<string, any>, value: string) {
    const extractedValue = extractInterviewDetails(value);
    transformedData['interviewInfo'] = standardizeDates(extractedValue);
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
 * Parses the status and determines if it indicates an open or closed status.
 *
 * The function checks if the input string is equal to "접수마감" (meaning "closed"). If so, it returns false,
 * otherwise, it returns true indicating an open status.
 *
 * @param {string} status - The input string representing the status (e.g., "접수마감", "접수중").
 * @returns {boolean} - True if the status indicates open, false if closed.
 */
export function parseStatus(status: string): boolean {
    return status.trim() !== "접수마감";
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
export function cleanCurrency(value: string): { period: string; amount: number } {
    const match = value.match(/^(월|주)?\s*([\d,]+)\s*원$/);
    if (match) {
        const period = match[1] || "월";
        const amount = parseInt(match[2].replace(/,/g, ""), 10);
        return {period, amount};
    }
    return {period: "월", amount: 0};
}

/**
 * Parses the internship season details from an input string.
 *
 * This function extracts the year, semester, and program type (short-term or long-term)
 * from a given input. It returns an object containing:
 * - `year` (number): The year of the internship.
 * - `semester` (string): The semester (e.g., "1학기").
 * - `programType` (string): The type of internship (short-term or long-term).
 *
 * @param transformedData
 * @param {string} input - The input string with internship details.
 * @returns {Object} - An object with `year`, `semester`, and `programType`.
 */
export function handleInternshipName(transformedData: Record<string, any>, input: string): void {
    const yearMatch = input.match(/(\d{4})년도/);
    const semesterMatch = input.match(/(1학기|여름학기|2학기|겨울학기)/);
    const programTypeMatch = input.match(/(단기|장기)\s*현장실습/);

    if (yearMatch) transformedData['year'] = parseInt(yearMatch[1], 10);
    if (semesterMatch) transformedData['semester'] = semesterMatch[1];
    if (programTypeMatch) transformedData['programType'] = programTypeMatch[1];
}

export function parseOrganizationName(value: string) {
    return value.split('/')[0].trim();
}
