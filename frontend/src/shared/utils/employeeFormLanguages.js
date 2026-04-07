/** Matches Employee schema: languages[].proficiency enum */

const PROF_LEVELS = new Set(["BASIC", "INTERMEDIATE", "ADVANCED", "NATIVE"]);

export function languagesFromText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/[,،;]/)
    .map((part) => {
      const p = part.trim();
      if (!p) return null;
      const m = p.match(/^(.+?)\s*\(\s*([A-Za-z_]+)\s*\)\s*$/);
      if (m) {
        const language = m[1].trim();
        let proficiency = m[2].trim().toUpperCase();
        if (!PROF_LEVELS.has(proficiency)) proficiency = "INTERMEDIATE";
        if (!language) return null;
        return { language, proficiency };
      }
      return { language: p, proficiency: "INTERMEDIATE" };
    })
    .filter(Boolean);
}

export function languagesToFormString(languages) {
  if (!Array.isArray(languages) || languages.length === 0) return "";
  return languages
    .map((l) => {
      const language = (l.language || "").trim();
      if (!language) return "";
      const prof = PROF_LEVELS.has(l.proficiency) ? l.proficiency : "INTERMEDIATE";
      return prof === "INTERMEDIATE" ? language : `${language} (${prof})`;
    })
    .filter(Boolean)
    .join(", ");
}
