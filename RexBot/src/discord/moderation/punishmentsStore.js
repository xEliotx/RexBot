import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "punishments.json");

export async function loadPunishments() {
    try {
        const raw = await readFile(FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export async function savePunishments(data) {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}