# Easy Finance Frontend

Frontend Angular standalone para Easy Finance, alineado con backend v0.2.0.

## Stack

- Angular 21 con standalone components.
- TypeScript strict.
- Angular Router con rutas lazy por feature.
- HttpClient con interceptores de JWT y errores.
- Signals para estado local/stores.
- Reactive Forms.
- API REST backend en `http://localhost:8080/api/v1`.

## Alcance Implementado

- Auth real: register, login, `/auth/me`, logout y guards.
- Accounts con selected account persistida y topbar que preserva la seccion al cambiar cuenta.
- Members: listado, alta por email, cambio de rol y remocion.
- Catalogs: categorias y medios de pago con filtros y busqueda.
- Expenses: gastos simples, gastos en cuotas, duplicacion simple, busqueda por descripcion, orden por fecha, paginacion superior/inferior y selector de tamano de pagina.
- Debts/Payments: deudas manuales/derivadas, pagos, y pago con gasto asociado opcional.
- Budgets: presupuesto mensual, duplicacion, subpresupuestos manuales, impacts de deuda, metricas con `budget-summary` y subpresupuestos simplificados.
- Income: ingresos, duplicacion, busqueda por descripcion, filtros simplificados, orden por fecha y paginacion superior/inferior.
- Dashboard analytics: tabs locales `Resumen`, `Cashflow`, `Gastos`, `Presupuesto`, filtro de mes especifico, cashflow, gastos conceptuales, breakdowns y comparacion presupuesto vs gasto por categoria.
- Imports Excel: descarga de plantilla dinamica, preview, confirmacion, columnas opcionales de pago de deuda y accion para cargar otro archivo.

## Comandos

```bash
npm install
npm start
npm run build
npm test -- --watch=false
```

`npm start` levanta el frontend en `http://localhost:4200`.

## Environment

Archivos:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Valores esperados en local:

```ts
apiBaseUrl: 'http://localhost:8080'
apiPrefix: '/api/v1'
production: false
```

## Documentacion

La documentacion funcional y tecnica esta en `docs/`:

- `docs/api/`: contratos REST, OpenAPI y Postman.
- `docs/business/`: reglas de negocio, permisos y ciclos de vida.
- `docs/frontend-guidance/`: arquitectura Angular, rutas, roadmap, estado y formularios.
- `docs/models/`: DTOs, enums y ejemplos.
- `docs/frontend-qa-smoke.md`: smoke manual frontend/backend.
- `docs/frontend-rc-checklist.md`: checklist de release candidate.

## Notas De Seguridad

- El JWT se agrega por interceptor.
- No se deben hardcodear tokens, secretos ni URLs absolutas fuera de environments.
- El backend sigue siendo autoridad para permisos, ownership, cuentas archivadas y validaciones de negocio.
