export function shortAddress(value?: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function formatAusdc(
  value: string | number | bigint | null | undefined
) {
  const amount = BigInt(value || 0);
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .slice(0, 2);
  return `${whole.toLocaleString("id-ID")}.${fraction} aUSDC`;
}

export function formatDate(value: string | number | Date) {
  const date =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? new Date(Number(value) * 1000)
      : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
