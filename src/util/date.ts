/**
 * Normalizes a deadline time string into a standardized format (HH:mm).
 *
 * The function supports various time formats such as "12시까지", "12시 30분까지", or "12:30까지".
 * If the input does not match any of the supported patterns or is empty, it returns "24:00".
 *
 * @param {string} time - The input time string to be normalized.
 * @returns {string} - The normalized time in HH:mm format.
 */
export function normalizeDeadlineTime(time: string): string {
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
 * Standardizes date formats in the provided object.
 *
 * The function processes all string values in the given object and checks for date-like patterns.
 * It normalizes dates to a standardized format (YYYY-MM-DD) and resolves partial dates by using the last known year.
 * It handles three date formats: full dates (e.g., "2023.01.01"), partial dates (e.g., "01.01"), and dates with a tilde (~) prefix (e.g., "~2023.01.01").
 *
 * @param {Record<string, any>} parsedObject - The object containing the parsed data, where date values will be standardized.
 * @returns {Record<string, any>} - The object with standardized date formats.
 */
export function standardizeDates(parsedObject: Record<string, any>): Record<string, any> {
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
 * Converts a time string into ISO 8601 format (HH:mm).
 *
 * The function matches the input string (e.g., "12시 30분") to extract the hour and minute, and converts them into
 * a formatted time string in the ISO 8601 format (HH:mm). If the input format is invalid, an error is thrown.
 *
 * @param {string} time - The input string representing the time (e.g., "12시 30분").
 * @returns {string} - The time in ISO 8601 format (HH:mm).
 * @throws {Error} - Throws an error if the input time format is invalid.
 */
export function convertToISO8601(time: string): string {
    const match = time.match(/(\d{1,2})시\s*(\d{1,2})분/);
    if (!match) {
        throw new Error(`Invalid time format: ${time}`);
    }
    const hour = String(match[1]).padStart(2, '0');
    const minute = String(match[2]).padStart(2, '0');
    return `${hour}:${minute}`;
}
