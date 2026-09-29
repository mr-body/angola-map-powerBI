export interface ProvinceInfo {
    id: string;
    name: string;
    capital: string;
    aliases: string[];
}

export const ANGOLA_PROVINCES: Record<string, ProvinceInfo> = {
    "AO-BGO": { id: "AO-BGO", name: "Bengo", capital: "Caxito", aliases: ["bengo", "aobgo", "ao bgo", "bgo"] },
    "AO-BGU": { id: "AO-BGU", name: "Benguela", capital: "Benguela", aliases: ["benguela", "aobgu", "ao bgu", "bgu"] },
    "AO-BIE": { id: "AO-BIE", name: "Bié", capital: "Cuíto", aliases: ["bie", "aobie", "ao bie"] },
    "AO-CAB": { id: "AO-CAB", name: "Cabinda", capital: "Cabinda", aliases: ["cabinda", "aocab", "ao cab", "cab"] },
    "AO-CCU": { id: "AO-CCU", name: "Cuando Cubango", capital: "Menongue", aliases: ["cuando cubango", "kuando kubango", "aoccu", "ao ccu", "ccu"] },
    "AO-CNO": { id: "AO-CNO", name: "Cuanza Norte", capital: "N'dalatando", aliases: ["cuanza norte", "kwanza norte", "aocno", "ao cno", "cno"] },
    "AO-CUS": { id: "AO-CUS", name: "Cuanza Sul", capital: "Sumbe", aliases: ["cuanza sul", "kwanza sul", "aocus", "ao cus", "cus"] },
    "AO-CNN": { id: "AO-CNN", name: "Cunene", capital: "Ondjiva", aliases: ["cunene", "aocnn", "ao cnn", "cnn"] },
    "AO-HUA": { id: "AO-HUA", name: "Huambo", capital: "Huambo", aliases: ["huambo", "aohua", "ao hua", "hua"] },
    "AO-HUI": { id: "AO-HUI", name: "Huíla", capital: "Lubango", aliases: ["huila", "aohui", "ao hui", "hui"] },
    "AO-LUA": { id: "AO-LUA", name: "Luanda", capital: "Luanda", aliases: ["luanda", "aolua", "ao lua", "lua"] },
    "AO-LNO": { id: "AO-LNO", name: "Lunda Norte", capital: "Dundo", aliases: ["lunda norte", "aolno", "ao lno", "lno"] },
    "AO-LSU": { id: "AO-LSU", name: "Lunda Sul", capital: "Saurimo", aliases: ["lunda sul", "aolsu", "ao lsu", "lsu"] },
    "AO-MAL": { id: "AO-MAL", name: "Malanje", capital: "Malanje", aliases: ["malanje", "malange", "aomal", "ao mal", "mal"] },
    "AO-MOX": { id: "AO-MOX", name: "Moxico", capital: "Luena", aliases: ["moxico", "aomox", "ao mox", "mox"] },
    "AO-NAM": { id: "AO-NAM", name: "Namibe", capital: "Moçâmedes", aliases: ["namibe", "aonam", "ao nam", "nam"] },
    "AO-UIG": { id: "AO-UIG", name: "Uíge", capital: "Uíge", aliases: ["uige", "aouig", "ao uig", "uig"] },
    "AO-ZAI": { id: "AO-ZAI", name: "Zaire", capital: "M'banza Kongo", aliases: ["zaire", "aozai", "ao zai", "zai"] }
};

export function normalizeKey(str: string): string {
    if (!str) return "";
    return str
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const lookupMap: Map<string, string> = new Map();

for (const [id, info] of Object.entries(ANGOLA_PROVINCES)) {
    lookupMap.set(normalizeKey(id), id);
    lookupMap.set(normalizeKey(info.name), id);
    for (const alias of info.aliases) {
        lookupMap.set(normalizeKey(alias), id);
    }
}

export function findProvinceId(input: string | number | null | undefined): string | null {
    if (input === null || input === undefined) return null;
    const normalized = normalizeKey(String(input));
    if (lookupMap.has(normalized)) {
        return lookupMap.get(normalized)!;
    }
    // Also try without spaces
    const compact = normalized.replace(/\s+/g, "");
    for (const [key, id] of lookupMap.entries()) {
        if (key.replace(/\s+/g, "") === compact) {
            return id;
        }
    }
    return null;
}
