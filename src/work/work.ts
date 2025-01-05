import {convertToISO8601} from "../util/date";

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
export function handleWorkingHours(value: string, data: Record<string, any>) {
    const [start, end] = value.split("~").map((time) => time.trim());
    data["workStartHour"] = convertToISO8601(start);
    data["workEndHour"] = convertToISO8601(end);
}

/**
 * Parses a string representing working days into an array of individual days.
 *
 * The function splits the input string by spaces and returns an array of working days.
 *
 * @param {string} value - The input string representing working days (e.g., "월 화 수").
 * @returns {string[]} - An array of working days.
 */
export function parseWorkingDays(value: string): string[] {
    return value.split(" ");
}
