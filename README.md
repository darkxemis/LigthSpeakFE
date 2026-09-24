# LightSpeak FE

Cliente web **Angular 22** (zoneless, OnPush, Signal Forms, signals-first) para el backend LightSpeak.

## Requisitos

- Node.js 22+
- Backend LightSpeak corriendo en `http://localhost:5133` (perfil `http`)
- SQL Server disponible para el backend

## Desarrollo

```bash
npm install
npm start          # http://localhost:8095
```

Backend:

```bash
cd ../LigthSpeakBE/LightSpeak/LightSpeak.Backend
dotnet run --launch-profile http   # http://localhost:5133
```

CORS ya incluye `http://localhost:8095` y `http://localhost:4200`.

## Credenciales demo

- Email: `admin@lightspeak.dev`
- Password: `Admin123!`

## Scripts

| Comando        | Descripción                |
| -------------- | -------------------------- |
| `npm start`    | Dev server en el puerto 8095 |
| `npm run build`| Build de producción        |
| `npm test`     | Unit tests (Vitest)        |
| `npx ng lint`  | ESLint (Angular)           |

## Arquitectura

```
src/app/
├── core/          # auth, api, i18n (ES/EN), SignalR hubs, toasts
├── shared/        # modelos DTO, UI (avatar, modal, icon), pipes
└── features/
    ├── auth/      # login / register (Signal Forms)
    ├── shell/     # layout: rail servidores, canales, user bar, home
    ├── servers/   # CRUD, miembros, ajustes, invitaciones
    ├── chat/      # mensajes + ChatHub (typing, edición)
    ├── voice/     # WebRTC mesh + VoiceHub
    └── profile/   # avatar, idioma, cuenta
```

## Stack Angular 22

- Zoneless + OnPush por defecto
- Signal Forms (`@angular/forms/signals`)
- `@Service()`, signals / `computed`
- `@angular/aria` (tabs de ajustes)
- Control flow `@if` / `@for`
- Tailwind CSS 4 (design tokens Aurora)
- Vitest + angular-eslint
- HTTP interceptor con refresh single-flight de JWT
- Idioma runtime ES/EN (pipe `| t`)

## Identidad visual

Tema **Aurora oscura**: base grafito/índigo, acentos degradado cian→lima (“haz de luz”), glassmorphism sutil. No es una copia de Discord: iconografía y layout propios.
