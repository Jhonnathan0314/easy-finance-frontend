# Frontend QA Smoke - Easy Finance

Fecha de preparacion: 2026-05-14

## Precondiciones

- Backend Spring Boot corriendo en `http://localhost:8080`.
- Frontend configurado con:
  - `environment.apiBaseUrl = "http://localhost:8080"`
  - `environment.apiPrefix = "/api/v1"`
- Base de datos local disponible y migraciones aplicadas.
- Navegador con `localStorage` limpio para una corrida desde cero.
- Archivo Excel `.xlsx` para imports con maximo 5MB y hasta 1000 filas.

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
Fecha | Descripcion | Monto | Categoria | MedioPago | EstadoPago
```

Fila valida sugerida:

```text
2026-05-14 | Compra import QA | 30000 | Mercado QA | Efectivo QA | PAID
```

Fila invalida sugerida:

```text
2026-05-14 | Categoria inexistente | 15000 | No Existe QA | Efectivo QA | PAID
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
4. Recargar navegador.

Expected:

- La cuenta aparece en la lista.
- La cuenta queda seleccionada.
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
4. Filtrar por estado `ACTIVE`.

Expected:

- El gasto simple aparece en la lista.
- El gasto en cuotas aparece como `INSTALLMENT`.
- El gasto en cuotas no muestra acciones de editar/cancelar desde Expenses.

### E. Debts

1. Abrir `/app/accounts/:accountId/debts`.
2. Verificar deuda derivada del gasto en cuotas.
3. Registrar pago parcial.
4. Intentar sobrepago mayor al saldo pendiente.
5. Registrar pago final si el saldo lo permite.

Expected:

- La deuda derivada aparece como `INSTALLMENT_EXPENSE`.
- El pago parcial reduce el saldo pendiente.
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
- Solo admin puede escribir.
- Cuenta archivada bloquea writes.

### G. Income

1. Abrir `/app/accounts/:accountId/income`.
2. Crear ingreso `Salario mensual QA`.
3. Editar descripcion o monto.
4. Cancelar ingreso.

Expected:

- El ingreso aparece como `ACTIVE`.
- Owner/admin puede editar/cancelar.
- Tras cancelar queda `CANCELLED` y no muestra acciones de edicion/cancelacion.

### H. Analytics

1. Abrir `/app/accounts/:accountId/dashboard`.
2. Seleccionar el mes usado en gastos/ingresos.
3. Refrescar.

Expected:

- Monthly summary muestra ingresos, gastos, balance, deuda pendiente y presupuesto.
- Gastos por categoria incluye `Mercado QA`.
- Ingresos por categoria incluye `Salario QA` si no fue cancelado para ese periodo.
- Debt summary refleja deudas activas/pagadas.
- Budget summary muestra `Sin presupuesto mensual creado` si no existe budget.

### I. Imports

1. Abrir `/app/accounts/:accountId/imports`.
2. Intentar preview sin archivo.
3. Intentar archivo que no sea `.xlsx`.
4. Subir Excel QA con una fila valida y una invalida.
5. Ejecutar preview.
6. Filtrar por filas validas e invalidas.
7. Confirmar import.
8. Volver a Expenses.

Expected:

- Validaciones frontend bloquean archivo faltante, extension invalida y mayor a 5MB.
- Preview muestra resumen total/validas/invalidas.
- Errores por fila se leen claramente.
- Confirm se deshabilita durante confirmacion y no aparece tras `CONFIRMED`.
- Solo filas validas crean gastos.

## Checklist De Hardening UI

- [ ] Loading visible en listas y acciones largas.
- [ ] Empty state visible en listas sin datos.
- [ ] Error visible con `code` y mensaje amigable.
- [ ] Botones de escritura deshabilitados cuando `isSaving`/`isConfirming`.
- [ ] Cuenta `ARCHIVED` bloquea create/update/cancel/confirm.
- [ ] `ACCOUNT_MEMBER` sin ownership no ve acciones de editar/cancelar en Expenses/Income/Debts.
- [ ] `ACCOUNT_ADMIN` ve acciones permitidas.
- [ ] 401 limpia sesion y redirige a `/login`.
- [ ] 403 por usuario/participante inactivo limpia sesion y redirige a `/login`.
- [ ] 403 por permisos de cuenta muestra mensaje sin cerrar sesion.
- [ ] Imports no setea manualmente `Content-Type` en multipart.

## Bugs Conocidos / Riesgos

- Backend local no disponible durante esta preparacion; smoke real pendiente de ejecutar.
- `docs/api/openapi.json` define algunos request amounts como `Money`, mientras `docs/models/dto-reference.md` y `docs/models/request-examples.md` los documentan como `number`. El frontend mantiene `number`, que coincide con ejemplos y fases funcionales actuales.
- Members page es de lectura basica; endpoints de alta/cambio de rol/remocion estan documentados en backend pero no implementados como UI de esta fase.

## Veredicto Del Checklist

- Build: OK (`npm run build`, 2026-05-14).
- Tests: OK (`npm test -- --watch=false`, 112 success, 2026-05-14).
- Smoke real: pendiente hasta tener backend disponible.
