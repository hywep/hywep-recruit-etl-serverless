import {colleges, relatedColleges, special} from "../constants";
import * as levenshtein from 'fastest-levenshtein';

/**
 * Processes and retrieves related majors based on the provided input.
 *
 * The function first parses the given value to extract a list of majors, then finds and returns
 * the related majors using a helper function. The resulting list of related majors is returned as an array.
 *
 * @param {string} value - The input string containing majors information to be processed.
 * @returns {string[]} - An array of related majors based on the parsed input.
 */
export function handleMajors(value: string): string[] {
    const majors = parseMajors(value);
    return findRelatedMajor(majors);
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
    selection = selection.replace(bulletPointRegex, " ");

    const separators = /,|\/| 및 |\u2219|\n|\s+/;

    const cleanedMajors = selection
        .split(separators)
        .map((item) => {
            return item
                .split(/등|관련/)[0]
                .replace(/\(|\)/g, "")
                .trim()
        })
        .filter((item) => (item.length > 0 && !['계열', '학과, 학부, 과'].includes(item) && item !== '+ 창업'));

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
export function findRelatedMajor(inputs: string[]): string[] {
    const relatedData: Set<string> = new Set();

    const flatInputs = inputs
        .flatMap((input) => input.split(/[,\s]+/))
        .map((str) => str.replace(/학과|학부|전공|학/g, "").trim())
        .filter((str) => str.length > 0);

    const allMajors = new Set<string>();
    Object.values(colleges).forEach((majors) => majors.forEach((major) => allMajors.add(major)));
    Object.values(special).forEach((majors) => majors.forEach((major) => allMajors.add(major)));

    function correctMajor(input: string): string {
        let bestMatch = "";
        let bestDistance = Infinity;

        for (const major of allMajors) {
            const normalizedMajor = major.replace(/학과|학부|전공/g, "");
            const distance = levenshtein.distance(input, normalizedMajor);

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
export function handleQualifications(transformedData: Record<string, any>, value: string): void {
    transformedData["qualifications"] = parseQualifications(value);
    if (
        Array.isArray(transformedData["majors"]) &&
        transformedData["majors"].length === 0
    ) {
        const qualifications = transformedData["qualifications"];
        if (qualifications && Array.isArray(qualifications.major)) {
            transformedData["majors"] = findRelatedMajor(qualifications.major);
        }
    }
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
export function parseQualifications(input) {
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
            if (key === 'major') {
                value = parseMajors(value);
            }
            result[key] = value;
        }
    }

    return result;
}
