# Easy Finance Frontend Docs

Documentacion del frontend Easy Finance alineada con backend v0.2.0.

## Como Leer Esta Carpeta

1. `api/api-overview.md`: mapa de endpoints usados por el frontend.
2. `api/openapi.json`: contrato OpenAPI local de referencia.
3. `business/business-rules.md`: reglas financieras y de permisos que la UI debe respetar visualmente.
4. `frontend-guidance/implementation-roadmap.md`: estado por fases y pendientes.
5. `frontend-guidance/routing-plan.md`: rutas publicas, privadas y account-scoped.
6. `frontend-guidance/ui-pages-map.md`: paginas, endpoints y comportamiento esperado.
7. `frontend-guidance/state-management-plan.md`: stores, filtros persistentes y selected account.
8. `models/dto-reference.md`: DTOs principales para mantener interfaces TypeScript.
9. `frontend-qa-smoke.md`: smoke real manual contra backend local.
10. `frontend-rc-checklist.md`: criterios de release candidate.

## Backend

- Local base URL: `http://localhost:8080`
- API prefix: `/api/v1`
- Protected endpoints require `Authorization: Bearer <accessToken>`.
- Public endpoints:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`

## Estado Funcional Frontend

Implementado:

- Auth, Accounts, Members y selected account.
- Catalogs con busqueda.
- Expenses con busqueda, orden por fecha, paginacion y tamano de pagina.
- Debts/Payments con gasto asociado opcional.
- Budgets con metricas dinamicas y subpresupuestos simplificados.
- Income con busqueda, orden por fecha y filtros simplificados.
- Dashboard analytics con tabs, filtro de mes especifico y presupuesto vs gasto por categoria.
- Imports Excel con plantilla dinamica, metadata de deuda, preview, confirmacion y cargar otro archivo.

No incluido:

- Exportaciones.
- Imports de income/debts.
- Reportes avanzados.
- Graficas con librerias externas.

No secrets, passwords, real tokens, `dist`, `coverage` or `node_modules` should be committed.
