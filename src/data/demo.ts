// Modo vitrina (29-10-2026, landing): solo en /vitrina, en desarrollo. Mientras está puesto, las
// lecturas devuelven filas de ejemplo (por la clave de cada consulta) en vez de las del servidor,
// para fotografiar las tarjetas reales con datos creíbles. Fuera de la vitrina no hace nada.

type DemoSource = (key: string) => unknown[] | undefined;

let source: DemoSource | null = null;

export function setDemoData(fn: DemoSource | null) {
  source = fn;
}

/** Las filas de ejemplo para una clave, o undefined si no hay vitrina o no las tiene. */
export function demoRows(key: string): unknown[] | undefined {
  return source?.(key);
}
