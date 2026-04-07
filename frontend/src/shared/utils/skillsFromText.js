/** Split user-entered skills (comma / semicolon / Arabic comma) into a trimmed list. */
export function skillsFromCommaText(text) {
  return String(text ?? "")
    .split(/[,،;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
