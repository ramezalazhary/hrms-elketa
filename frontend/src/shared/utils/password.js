/**
 * Builds a random password that satisfies backend rules (≥8 chars, upper, lower, digit).
 * @returns {string}
 */
export function generateCompliantTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const num = "23456789";
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let core = "";
  for (let i = 0; i < 6; i++) core += pick(lower + upper + num);
  return `Tmp${core}A1`;
}
