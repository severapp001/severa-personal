// Qué entiende los mensajes del asistente (decisión del usuario, 25-10-2026: «solo sin IA»).
// - 'local': el intérprete sin IA de src/core/intent.ts, en el teléfono, gratis y sin enviar nada.
// - 'claude': la función `asistente` de Supabase con Claude Opus 5.5. Necesita el secreto
//   ANTHROPIC_API_KEY en Supabase (tiene costo). Está lista; basta cambiar esta línea.
export const BRAIN: 'local' | 'claude' = 'local';
