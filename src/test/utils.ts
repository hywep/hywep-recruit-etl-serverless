import * as fs from "node:fs";

/**
 * Reads and parses a JSON file.
 * @param filePath - Path to the JSON file.
 * @returns Parsed JSON data.
 */
export const readJsonFile = (filePath: string) => {
    try {
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading or parsing file: ${filePath}`, error);
        throw error;
    }
};

/**
 * Writes JSON data to a file.
 * @param filePath - Path to the JSON file.
 * @param data - Data to write.
 */
export const writeJsonFile = (filePath: string, data: any) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: "utf-8" });
        console.log(`Data saved to: ${filePath}`);
    } catch (error) {
        console.error(`Error writing to file: ${filePath}`, error);
        throw error;
    }
};
