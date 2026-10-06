# Severa Personal — app

App móvil (Android + iOS) de Severa. Expo SDK 57 · React Native · TypeScript · Expo Router · Supabase.
La documentación del producto vive en `../docs` (bóveda de Obsidian); este repositorio es solo la app.

## Requisitos
- Node 24 y npm
- Expo Go en el teléfono, o un development build
- Supabase CLI (solo para la configuración de autenticación: `supabase config push`)
- Docker es opcional: en el computador de desarrollo no se usa porque consume demasiada memoria.

## Primera vez
```bash
npm install
cp .env.example .env.local   # URL y llave publicable del proyecto severa-personal
npm start                    # escanear el QR con Expo Go
```
La app usa el proyecto en la nube **severa-personal** (`hcwmbeokrcagrqbhvkoa`, São Paulo).
Mientras no haya SMTP propio, el correo de verificación trae un enlace (llega solo a los miembros
de la organización de Supabase): se abre en el mismo teléfono y la app entra sola.

## Base de datos
- Las migraciones viven en `supabase/migrations` y se aplican con el conector de Supabase o con la CLI.
  El archivo local lleva **la misma versión** que queda registrada en el proyecto.
- Los permisos se prueban en la nube con `supabase/tests/remote/core_check.sql`: un bloque que
  termina con un error a propósito para deshacer todo; los resultados vienen en el mensaje.
- Con Docker disponible: `npm run db:start` y `npm run db:test` corren lo mismo en local (pgTAP).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo (Expo Go o development build) |
| `npm run web` | La app en el navegador (para revisar pantallas) |
| `npm run typecheck` · `npm run lint` · `npm test` | Tipos, lint y pruebas del dominio (`src/core`) |
| `npm run db:start` · `db:test` | Solo con Docker: base local y pruebas pgTAP |

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
