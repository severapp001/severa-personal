// Reglas de edad (docs/02 Producto/Flujos/F01 Primera vez.md y docs/02 Producto/Investigación - edad y datos de menores.md).
// El servidor aplica las mismas reglas; aquí sirven para avisar antes de enviar.

export const MIN_AGE = 14;

export function ageOn(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type AgeRules = {
  canCreateAccount: boolean;
  health: boolean; // Salud y la parte de ciclo
  intimate: boolean; // sección Íntimo
  adultHabitTemplates: boolean; // alcohol, tabaco, drogas y salidas nocturnas
};

export function ageRules(age: number): AgeRules {
  return {
    canCreateAccount: age >= MIN_AGE,
    health: age >= 16,
    intimate: age >= 18,
    adultHabitTemplates: age >= 18,
  };
}

// «dd-mm-aaaa» (como se escribe en Chile) → Date, o null si no es una fecha real.
export function parseChileanDate(text: string): Date | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

export function toIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}
