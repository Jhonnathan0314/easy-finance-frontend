# Frontend RC Checklist - Easy Finance

Fecha de preparacion: 2026-05-21

## Estado Del Alcance

Incluido en este release candidate:

- Auth real con register, login, rehidratacion por `/auth/me` y logout.
- Accounts con selected account persistido.
- Catalogs: categorias y medios de pago.
- Expenses simples, quick expense, duplicacion simple, busqueda, orden y paginacion.
- Debts y payments, incluyendo gasto asociado opcional en pagos.
- Budgets, subBudgets e impacts.
- Income con busqueda, orden y paginacion.
- Analytics dashboard con tabs, mes especifico y comparacion presupuesto vs gasto por categoria.
- Imports Excel de gastos con plantilla dinamica, preview, confirmacion, deuda asociada y cargar otro archivo.
- Members management.
- QA smoke API real ejecutado contra backend local.

Fuera de alcance RC:

- Exportaciones.
- Reportes avanzados.
- Imports adicionales.
- Graficas avanzadas con librerias externas.

## Comandos

```bash
npm install
npm start
npm run build
npm test -- --watch=false
```

Notas:

- `npm start` levanta Angular dev server en `http://localhost:4200`.
- `npm run build` usa la configuracion production por defecto de Angular.
- No hay script `lint` configurado en `package.json`.

## Versiones Requeridas

El proyecto declara en `package.json`:

```json
{
  "node": "^20.19.0 || ^22.12.0 || >=24.0.0",
  "npm": ">=8.0.0"
}
```

Recomendacion RC:

- Usar Node 22 LTS o una version compatible con Angular 21.
- Verificar `node -v` antes de build/test en CI.

## Variables De Entorno

Archivos:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Desarrollo local:

```ts
apiBaseUrl: 'http://localhost:8080'
apiPrefix: '/api/v1'
production: false
```

Produccion actual:

```ts
apiBaseUrl: 'https://api.example.com'
apiPrefix: '/api/v1'
production: true
```

Go/no-go:

- Antes de publicar RC en un ambiente real, reemplazar `https://api.example.com` por la URL real del backend.
- No se encontraron URLs absolutas de backend en codigo de runtime fuera de environments. Las URLs absolutas restantes estan en docs y specs.

## Pasos Para Correr Local

1. Levantar backend en `http://localhost:8080`.
2. Verificar health basico con `GET http://localhost:8080/api/v1/auth/me`; sin token debe responder 401.
3. Instalar dependencias con `npm install`.
4. Levantar frontend con `npm start`.
5. Abrir `http://localhost:4200`.
6. Ejecutar smoke manual usando `docs/frontend-qa-smoke.md`.

## Smoke Test Resumido

Smoke API real ya ejecutado contra backend local:

- Auth: register, login, me.
- Accounts: crear cuenta y obtener rol `ACCOUNT_ADMIN`.
- Catalogs: crear categoria EXPENSE, categoria INCOME y payment method.
- Expenses: crear gasto simple, quick expense, duplicar simple, buscar, ordenar, paginar y crear gasto en cuotas.
- Debts: verificar deuda derivada, registrar pago parcial, registrar pago con gasto asociado y bloquear sobrepago.
- Budgets: crear budget mensual, verificar impact, crear subBudget manual, duplicar budget y validar metricas `budget-summary`.
- Income: crear, actualizar, duplicar, buscar, ordenar, paginar y cancelar.
- Analytics: tabs, mes especifico, cashflow, breakdowns, debt summary, budget summary y presupuesto vs gasto por categoria.
- Imports: descargar plantilla, preview Excel con filas validas/invalidas, metadata de deuda, confirmacion y creacion solo de filas validas.
- Members: agregar miembro, cambiar rol y remover miembro respetando ultimo admin.
- CORS: preflight OK para `http://localhost:4200`.

Resultado:

- Smoke API: OK.
- Bug encontrado y corregido: endpoints de cancelacion 204 estaban tipados como DTO en algunos services/stores.

## QA Visual Pendiente

Antes de marcar RC como listo para usuarios finales, ejecutar revision manual en navegador real:

- Consola del navegador sin errores no controlados.
- Network tab sin requests mal formados.
- Responsive mobile y tablet.
- Accesibilidad basica: foco visible, labels de formularios, contraste suficiente, navegacion por teclado principal.
- Estados reales: loading, empty, saving, success, error 400/401/403/409/422.
- Validacion visual de cuenta archivada.
- Validacion visual de permisos `ACCOUNT_ADMIN` y `ACCOUNT_MEMBER`.
- Import Excel desde input real del navegador.
- Cambio de cuenta desde topbar preservando seccion actual.
- Ruta legacy `/app/accounts/:accountId/analytics` redirige a Dashboard y no aparece en menu.

## Seguridad Frontend

Checklist revisado:

- Token se persiste solo en `AuthStorageService`; no se loguea en consola.
- `Authorization: Bearer` se agrega solo por `authInterceptor`.
- Logout limpia sesion auth y selected account.
- `authGuard` protege rutas privadas.
- `publicGuard` redirige login/register si ya hay sesion.
- `accountRouteGuard` bloquea `accountId` que no pertenece al usuario.
- 401 limpia sesion, limpia cuenta y redirige a `/login`.
- 403 con `USER_BLOCKED`, `USER_NOT_ACTIVE` o `PARTICIPANT_NOT_ACTIVE` limpia sesion y redirige.
- 403 de permisos de negocio queda como error visible sin cerrar sesion.
- No hay secretos ni credenciales hardcodeadas en runtime.

Riesgo aceptado para MVP:

- El JWT se almacena en `localStorage`. Mantener CSP estricta y evitar scripts de terceros no confiables.

## Consistencia API 204

Metodos revisados como `void`:

- `cancelExpense`
- `cancelDebt`
- `cancelIncome`
- `deactivateCategory`
- `deactivatePaymentMethod`
- `deactivateSubBudget`
- `removeMember`

La UI de members usa delete 204 como `void`.

## Criterios Go

- `npm run build` exitoso.
- `npm test -- --watch=false` exitoso.
- Smoke API real exitoso.
- `environment.prod.ts` configurado con backend real del ambiente RC.
- QA visual manual completado sin errores bloqueantes.
- No hay errores de consola no controlados en flujos principales.
- CORS configurado para el origen real del frontend.

## Criterios No-Go

- Build o tests fallan.
- Login/register no funciona contra backend real.
- Selected account no persiste o apunta a una cuenta no autorizada.
- Requests usan URL incorrecta o prefijo distinto de `/api/v1`.
- 401 no limpia sesion.
- Cancelaciones o deletes 204 rompen la UI.
- Imports confirma mas de una vez o crea filas invalidas.
- Topbar no actualiza URL al cambiar cuenta A -> B.
- Dashboard muestra empty state incorrecto para presupuesto vs gasto cuando backend devuelve `items`.
- `environment.prod.ts` queda con `https://api.example.com` para un despliegue real.

## Pendientes Post-RC

- QA visual completa en navegador real y dispositivos/responsive.
- Automatizar smoke e2e con Playwright o Cypress.
- Mejorar accesibilidad con auditoria WCAG basica.
- Externalizar runtime config si se requiere un mismo build para multiples ambientes.
- Definir estrategia de almacenamiento de token mas robusta si el threat model exige endurecimiento adicional.
