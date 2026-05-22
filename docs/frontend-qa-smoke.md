# Frontend QA Smoke - Easy Finance

Fecha de preparacion: 2026-05-21

## Precondiciones

- Backend Spring Boot corriendo en `http://localhost:8080`.
- Frontend configurado con:
  - `environment.apiBaseUrl = "http://localhost:8080"`
  - `environment.apiPrefix = "/api/v1"`
- Base de datos local disponible y migraciones aplicadas.
- Navegador con `localStorage` limpio para una corrida desde cero.
- Archivo Excel `.xlsx` para imports con maximo 5MB y hasta 1000 filas.
- Para imports con pago de deuda, debe existir una deuda activa en la cuenta.

Nota de esta revision: desde esta sesion no fue posible conectar con `http://localhost:8080`; el smoke real queda documentado para ejecucion manual cuando el backend este arriba.

## Comandos

```bash
npm install
npm start
npm run build
npm test -- --watch=false
```

URL frontend esperada: `http://localhost:4200`.

## Rutas A Verificar

- `/login`
- `/register`
- `/app/accounts`
- `/app/accounts/:accountId/dashboard`
- `/app/accounts/:accountId/analytics` debe redirigir a `/app/accounts/:accountId/dashboard`
- `/app/accounts/:accountId/catalogs`
- `/app/accounts/:accountId/expenses`
- `/app/accounts/:accountId/debts`
- `/app/accounts/:accountId/budgets`
- `/app/accounts/:accountId/income`
- `/app/accounts/:accountId/imports`
- `/app/accounts/:accountId/settings/members`

Expected:

- Rutas `/app/**` redirigen a `/login` sin sesion.
- `/login` y `/register` redirigen a `/app/accounts` con sesion activa.
- Rutas con `:accountId` redirigen a `/app/accounts` si la cuenta no pertenece al usuario.
- La cuenta seleccionada persiste tras refresh si sigue perteneciendo al usuario.
- Cambiar cuenta desde el topbar preserva la seccion actual cuando la ruta es account-scoped.

## Datos De Prueba

Usuario:

- Email: `qa.easy.finance+<timestamp>@example.com`
- Password: `Password123!`
- Nombre: `QA Easy Finance`

Cuenta:

- Nombre: `QA Personal`
- Descripcion: `Cuenta smoke frontend`

Catalogos:

- Categoria EXPENSE: `Mercado QA`
- Categoria INCOME: `Salario QA`
- Medio de pago: `Efectivo QA`, tipo `CASH`

Gastos:

- Gasto simple: `Almuerzo QA`, monto `45000`, fecha actual, estado `PAID`
- Gasto en cuotas: `Laptop QA`, total `1200000`, `12` cuotas de `100000`, primera cuota en el mes siguiente

Deudas:

- Deuda manual opcional: `Prestamo QA`, total `300000`, inicio actual
- Pago parcial: `50000`
- Pago final: usar saldo pendiente exacto si aplica

Budget:

- Mes: mes de la primera cuota del gasto en cuotas
- Nombre: `Budget QA`
- SubBudget manual: `Comida QA`, monto `800000`

Income:

- `Salario mensual QA`, monto `5000000`, fecha actual

Excel imports:

Cabeceras requeridas:

```text
Fecha | Descripcion | Monto | Categoria | MedioPago | EstadoPago | AplicaPagoDeuda | Deuda | TipoPagoDeuda | NotasPagoDeuda
```

Fila valida sugerida:

```text
2026-05-14 | Compra import QA | 30000 | Mercado QA | Efectivo QA | PAID | NO |  |  |
```

Fila invalida sugerida:

```text
2026-05-14 | Categoria inexistente | 15000 | No Existe QA | Efectivo QA | PAID | NO |  |  |
```

## Smoke Flow

### A. Auth

1. Abrir `/register`.
2. Registrar el usuario QA.
3. Verificar redireccion o sesion activa.
4. Cerrar sesion si aplica.
5. Abrir `/login` e iniciar sesion.
6. Recargar navegador.

Expected:

- El token se guarda localmente.
- `GET /auth/me` rehidrata la sesion tras refresh.
- Con sesion activa, `/login` y `/register` redirigen a `/app/accounts`.

### B. Accounts

1. Abrir `/app/accounts`.
2. Crear cuenta `QA Personal`.
3. Seleccionarla.
4. Cambiar a otra cuenta desde el topbar si existe.
5. Recargar navegador.

Expected:

- La cuenta aparece en la lista.
- La cuenta queda seleccionada.
- En rutas como `/expenses`, el topbar cambia solo el `accountId` y conserva la seccion.
- Tras refresh, la cuenta seleccionada se restaura.

### C. Catalogs

1. Abrir `/app/accounts/:accountId/catalogs`.
2. Crear categoria EXPENSE `Mercado QA`.
3. Crear categoria INCOME `Salario QA`.
4. Crear medio de pago `Efectivo QA`.

Expected:

- Los catalogos aparecen como `ACTIVE`.
- Formularios de Expenses e Income dejan de mostrar CTA obligatorio a Catalogs.

### D. Expenses

1. Abrir `/app/accounts/:accountId/expenses`.
2. Crear gasto simple `Almuerzo QA`.
3. Crear gasto en cuotas `Laptop QA`.
4. Buscar por descripcion.
5. Cambiar orden por fecha.
6. Cambiar tamano de pagina.
7. Filtrar por estado `ACTIVE`.

Expected:

- El gasto simple aparece en la lista.
- El gasto en cuotas aparece como `INSTALLMENT`.
- El gasto en cuotas no muestra acciones de editar/cancelar desde Expenses.
- La paginacion superior e inferior queda sincronizada.
- La busqueda por descripcion mantiene filtros y orden.

### E. Debts

1. Abrir `/app/accounts/:accountId/debts`.
2. Verificar deuda derivada del gasto en cuotas.
3. Registrar pago parcial.
4. Registrar un pago con checkbox `Crear gasto asociado`, categoria EXPENSE activa, medio activo y descripcion.
5. Intentar sobrepago mayor al saldo pendiente.
6. Registrar pago final si el saldo lo permite.

Expected:

- La deuda derivada aparece como `INSTALLMENT_EXPENSE`.
- El pago parcial reduce el saldo pendiente.
- Si se marca gasto asociado, la respuesta muestra gasto creado y el gasto aparece como conceptual sin duplicar cashflow.
- El sobrepago se bloquea en UI o backend con mensaje amigable.
- Al pagar todo, la deuda queda `PAID`.

### F. Budgets

1. Abrir `/app/accounts/:accountId/budgets`.
2. Seleccionar el mes de la primera cuota.
3. Cargar detalle mensual.
4. Crear o actualizar presupuesto mensual.
5. Crear subBudget manual.

Expected:

- El detalle muestra impacts derivados de deuda si existen.
- Totales expected/paid/pending son visibles.
- Las metricas superiores usan `analytics/budget-summary`.
- Los subpresupuestos muestran nombre, categoria, valor presupuestado, estado/source y acciones; no muestran progreso individual.
- Solo admin puede escribir.
- Cuenta archivada bloquea writes.

### G. Income

1. Abrir `/app/accounts/:accountId/income`.
2. Crear ingreso `Salario mensual QA`.
3. Editar descripcion o monto.
4. Cancelar ingreso.
5. Verificar busqueda por descripcion, orden por fecha, paginacion superior/inferior y selector de tamano de pagina.

Expected:

- El ingreso aparece como `ACTIVE`.
- Owner/admin puede editar/cancelar.
- Tras cancelar queda `CANCELLED` y no muestra acciones de edicion/cancelacion.

### H. Analytics

1. Abrir `/app/accounts/:accountId/dashboard`.
2. Verificar tabs `Resumen`, `Cashflow`, `Gastos`, `Presupuesto`.
3. Seleccionar un mes especifico por year/month usado en gastos/ingresos.
4. Refrescar.
5. Probar preset `Ultimos 30 dias` y volver a mes exacto.

Expected:

- `Resumen` muestra cashflow real y gastos conceptuales.
- `Cashflow` muestra timeline.
- `Gastos` muestra gastos por categoria, gastos por medio de pago e ingresos por categoria.
- `Presupuesto` muestra comparacion presupuesto vs gasto por categoria solo para mes calendario exacto.
- Si el rango no es mensual, muestra mensaje claro de no disponibilidad de comparacion presupuestal.
- Debt summary refleja deudas activas/pagadas.
- Budget summary muestra `Sin presupuesto mensual creado` si no existe budget.

### I. Imports

1. Abrir `/app/accounts/:accountId/imports`.
2. Descargar plantilla dinamica y verificar columnas de deuda.
3. Intentar preview sin archivo.
4. Intentar archivo que no sea `.xlsx`.
5. Subir Excel QA con una fila valida y una invalida.
6. Ejecutar preview.
7. Filtrar por filas validas e invalidas.
8. Si hay deuda activa, agregar una fila con `AplicaPagoDeuda = SI` y verificar metadata de deuda en preview.
9. Confirmar import.
10. Usar `Cargar otro archivo` o `Limpiar`.
11. Volver a Expenses y Debts.

Expected:

- Validaciones frontend bloquean archivo faltante, extension invalida y mayor a 5MB.
- Preview muestra resumen total/validas/invalidas.
- Errores por fila se leen claramente.
- Las columnas de deuda muestran deuda, tipo y notas cuando aplican.
- Confirm se deshabilita durante confirmacion y no aparece tras `CONFIRMED`.
- Solo filas validas crean gastos.
- Filas con deuda valida tambien registran `createdDebtPaymentId`.
- Limpiar borra archivo, batch, preview, mensajes y permite cargar otro archivo sin recargar pagina.

## Checklist De Hardening UI

- [ ] Loading visible en listas y acciones largas.
- [ ] Empty state visible en listas sin datos.
- [ ] Error visible con `code` y mensaje amigable.
- [ ] Botones de escritura deshabilitados cuando `isSaving`/`isConfirming`.
- [ ] Cuenta `ARCHIVED` bloquea create/update/cancel/confirm.
- [ ] `ACCOUNT_MEMBER` sin ownership no ve acciones de editar/cancelar/duplicar en Expenses/Income/Debts.
- [ ] `ACCOUNT_ADMIN` ve acciones permitidas.
- [ ] 401 limpia sesion y redirige a `/login`.
- [ ] 403 por usuario/participante inactivo limpia sesion y redirige a `/login`.
- [ ] 403 por permisos de cuenta muestra mensaje sin cerrar sesion.
- [ ] Imports no setea manualmente `Content-Type` en multipart.

## Bugs Conocidos / Riesgos

- Smoke manual visual completo sigue pendiente de ejecutarse en navegador real para todos los breakpoints.
- `docs/api/openapi.json` define algunos request amounts como `Money`, mientras `docs/models/dto-reference.md` y `docs/models/request-examples.md` los documentan como `number`. El frontend mantiene `number`, que coincide con ejemplos y fases funcionales actuales.

## Veredicto Del Checklist

- Build: ejecutar antes de RC.
- Tests: ejecutar antes de RC.
- Smoke real: seguir este checklist contra backend v0.2.0.
