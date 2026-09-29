export interface ProvinceInfo {
    id: string;
    name: string;
    capital: string;
    aliases: string[];
}
export declare const ANGOLA_PROVINCES: Record<string, ProvinceInfo>;
export declare function normalizeKey(str: string): string;
export declare function findProvinceId(input: string | number | null | undefined): string | null;
