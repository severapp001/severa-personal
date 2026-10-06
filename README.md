# Severa Personal — app

App móvil (Android + iOS) de Severa. Expo SDK 57 · React Native · TypeScript · Expo Router · Supabase.
La documentación del producto vive en `../docs` (bóveda de Obsidian); este repositorio es solo la app.

## Requisitos
- Node 24 y npm
- Docker Desktop (para Supabase local)
- Supabase CLI
- Expo Go en el teléfono, o un development build

## Primera vez
```bash
npm install
cp .env.example .env.local   # y pegar la llave publicable que muestra supabase start
npm run db:start             # Supabase local: API 54321 · panel 54323 · correos de prueba 54324
npm start                    # escanear el QR con Expo Go (mismo Wi-Fi que el computador)
```
Con Supabase local, la app usa sola la IP del computador para que el teléfono llegue al servidor.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo (Expo Go o development build) |
| `npm run web` | La app en el navegador (para revisar pantallas) |
| `npm run typecheck` · `npm run lint` · `npm test` | Tipos, lint y pruebas del dominio (`src/core`) |
| `npm run db:reset` | Rehace la base local desde las migraciones |
| `npm run db:test` | Pruebas de permisos (RLS) de `supabase/tests` |

## Estructura
```
src/app/        rutas (Expo Router): entrar, crear-cuenta, verificar · (personal)/
src/core/       dominio puro, sin dependencias del teléfono (se prueba con Jest)
src/data/       Supabase, sesión, y luego PowerSync
src/features/   una carpeta por neurona (módulo)
src/ui/         componentes del sistema de diseño
src/theme/      los 5 temas y sus pares de Trabajo
supabase/       config, migraciones (siempre por CLI), plantillas de correo y pruebas
```

## Reglas
- Las migraciones se crean con la CLI y nunca se pegan a mano en el panel.
- Este proyecto usa su **propio** Supabase. Nunca el de SEVERA Talleres.
- En `.env.local` solo van llaves públicas (`publishable`). La `secret` o `service_role` nunca van en la app.
- Expo Go sirve para ver pantallas; lo que se entrega a otras personas sale del development build.
