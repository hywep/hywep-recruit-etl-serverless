/**
 * Trims the input value to remove leading and trailing whitespace.
 *
 * The function simply trims the input string and returns the cleaned value.
 *
 * @param {string} value - The input string to be cleaned.
 * @returns {string} - The cleaned string with whitespace removed.
 */
export function cleanGenericValue(value: string): string {
    return value.trim();
}
