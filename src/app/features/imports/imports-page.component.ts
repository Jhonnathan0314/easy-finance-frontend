import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { ImportsStore } from '../../core/imports/imports.store';
import { AccountStore } from '../../core/state/account.store';
import { ApiErrorResponse, ExpenseImportRowResponseDto } from '../../shared/models';
import { enumLabel } from '../../shared/ui/enum-labels';

type RowFilter = 'all' | 'valid' | 'invalid';
type ImportMode = 'expenses' | 'incomes' | 'categories' | 'paymentMethods' | 'budgets';

export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const EXPENSE_IMPORT_TEMPLATE_FILENAME = 'easy-finance-expense-import-template.xlsx';
export const INCOME_IMPORT_TEMPLATE_FILENAME = 'easy-finance-income-import-template.xlsx';
export const CATEGORY_IMPORT_TEMPLATE_FILENAME = 'easy-finance-category-import-template.xlsx';
export const PAYMENT_METHOD_IMPORT_TEMPLATE_FILENAME = 'easy-finance-payment-method-import-template.xlsx';
export const ANNUAL_BUDGET_IMPORT_TEMPLATE_FILENAME = 'easy-finance-annual-budget-import-template.xlsx';

@Component({
  selector: 'ef-imports-page',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  styleUrl: './imports-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Importaciones</h1>
          <p class="page-subtitle">Importaciones de la cuenta {{ accountId() }}.</p>
        </div>
      </div>

      <div class="mode-tabs" role="tablist" aria-label="Tipo de importacion">
        <button type="button" [class.active]="activeMode() === 'expenses'" (click)="activeMode.set('expenses')">Gastos</button>
        <button type="button" [class.active]="activeMode() === 'incomes'" (click)="activeMode.set('incomes')">Ingresos</button>
        <button type="button" [class.active]="activeMode() === 'categories'" (click)="activeMode.set('categories')">Categorias</button>
        <button type="button" [class.active]="activeMode() === 'paymentMethods'" (click)="activeMode.set('paymentMethods')">
          Medios de pago
        </button>
        <button type="button" [class.active]="activeMode() === 'budgets'" (click)="activeMode.set('budgets')">Presupuestos</button>
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las importaciones de gasto estan bloqueadas.</div>
      }

      @if (activeMode() === 'expenses') {
      <section class="panel instructions">
        <div>
          <h2>Importar gastos desde Excel</h2>
          <p>Usa un archivo .xlsx con estas cabeceras exactas:</p>
          <div class="headers-list">
            @for (header of requiredHeaders; track header) {
              <span>{{ header }}</span>
            }
          </div>
        </div>
        <div class="template-download">
          <p>La plantilla se genera con las categorías de gasto y medios de pago activos de esta cuenta.</p>
          <button type="button" (click)="downloadTemplate()" [disabled]="importsStore.isDownloadingTemplate()">
            {{ importsStore.isDownloadingTemplate() ? 'Descargando...' : 'Descargar plantilla Excel' }}
          </button>
        </div>
        @if (importsStore.templateDownloadError(); as templateError) {
          <p class="form-error" role="alert">{{ templateError }}</p>
        }
        <ul>
          <li>Solo .xlsx, maximo 5MB y maximo 1000 filas.</li>
          <li>La categoría debe existir, estar activa y ser de gasto.</li>
          <li>MedioPago debe existir y estar activo.</li>
          <li>EstadoPago: PENDING, PARTIAL, PAID.</li>
          <li>Opcionalmente puedes asociar una fila a pago de deuda con AplicaPagoDeuda, Deuda, TipoPagoDeuda y NotasPagoDeuda.</li>
          <li>Filas invalidas se reportan y no se importan.</li>
          <li>Confirmar importa solo filas validas y registra pagos de deuda cuando aplique.</li>
        </ul>
      </section>

      <section class="panel upload-panel">
        <label class="file-field">
          <span>Archivo Excel</span>
          <input #fileInput type="file" accept=".xlsx" (change)="onFileSelected($event)" [disabled]="!canWrite()">
        </label>

        @if (importsStore.selectedFile(); as file) {
          <div class="selected-file">
            <strong>{{ file.name }}</strong>
            <span>{{ fileSizeLabel(file.size) }}</span>
            <button type="button" (click)="clearFile(fileInput)">Quitar</button>
          </div>
        } @else {
          <p class="muted">Selecciona un archivo .xlsx para generar el preview.</p>
        }

        @if (fileError(); as error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }

        <div class="actions">
          <button class="button" type="button" (click)="preview()" [disabled]="!canPreview()">
            {{ importsStore.isPreviewing() ? 'Generando preview...' : 'Preview' }}
          </button>
          @if (hasImportState()) {
            <button type="button" (click)="clearImport(fileInput)">Cargar otro archivo</button>
          }
        </div>
      </section>

      @if (importsStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error) }}</span>
        </div>
      }

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (!importsStore.currentBatch() && !importsStore.isPreviewing()) {
        <div class="panel empty-state">
          <h2>Sin preview cargado</h2>
          <p>El preview valida el archivo y muestra que filas se podran importar antes de crear gastos.</p>
        </div>
      }

      @if (importsStore.isLoading()) {
        <div class="panel">Cargando batch...</div>
      }

      @if (importsStore.currentBatch(); as batch) {
        <section class="panel batch-summary">
          <div class="summary-heading">
            <div>
              <h2>{{ batch.originalFilename }}</h2>
              <p>Batch {{ batch.batchId }} - {{ enumLabel(batch.status) }}</p>
            </div>
            @if (batch.confirmedAt) {
              <span class="badge success">Confirmado {{ batch.confirmedAt }}</span>
            } @else {
              <span class="badge">{{ enumLabel(batch.status) }}</span>
            }
          </div>

          <dl class="summary-grid">
            <div>
              <dt>Total filas</dt>
              <dd>{{ batch.totalRows }}</dd>
            </div>
            <div>
              <dt>Validas</dt>
              <dd>{{ batch.validRows }}</dd>
            </div>
            <div>
              <dt>Invalidas</dt>
              <dd>{{ batch.invalidRows }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ enumLabel(batch.status) }}</dd>
            </div>
          </dl>

          @if (hasCatalogErrors()) {
            <div class="catalog-cta">
              Hay errores frecuentes de categoria o medio de pago.
              <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Revisar catalogos</a>
            </div>
          }

          <div class="confirm-row">
            @if (batch.status === 'PREVIEW') {
              <button class="button" type="button" (click)="confirm(batch.batchId)" [disabled]="!canConfirm()">
                {{ importsStore.isConfirming() ? 'Confirmando...' : 'Confirmar importacion' }}
              </button>
            } @else if (batch.status === 'CONFIRMED') {
              <span class="badge success">Importacion confirmada</span>
            }
          </div>
        </section>

        <section class="panel rows-panel">
          <div class="rows-heading">
            <h2>Filas del preview</h2>
            <div class="tabs" role="tablist" aria-label="Filtro de filas">
              <button type="button" [class.active]="rowFilter() === 'all'" (click)="rowFilter.set('all')">Todas</button>
              <button type="button" [class.active]="rowFilter() === 'valid'" (click)="rowFilter.set('valid')">Validas</button>
              <button type="button" [class.active]="rowFilter() === 'invalid'" (click)="rowFilter.set('invalid')">Invalidas</button>
            </div>
          </div>

          @if (!filteredRows().length) {
            <p class="muted">No hay filas para este filtro.</p>
          } @else {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Fecha</th>
                    <th>Descripcion</th>
                    <th>Monto</th>
                    <th>Categoria</th>
                    <th>Medio pago</th>
                    <th>Estado pago</th>
                    <th>Pago deuda</th>
                    <th>Deuda</th>
                    <th>Tipo pago deuda</th>
                    <th>Notas deuda</th>
                    <th>Resultado</th>
                    <th>Valid</th>
                    <th>Errores</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredRows(); track row.id) {
                    <tr [class.invalid]="!row.valid">
                      <td>{{ row.rowNumber }}</td>
                      <td>{{ row.expenseDate || '-' }}</td>
                      <td>{{ row.description || '-' }}</td>
                      <td>
                        @if (row.amount !== null && row.amount !== undefined) {
                          {{ row.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}
                        } @else {
                          -
                        }
                      </td>
                      <td>{{ row.categoryName || categoryLabel(row.categoryId) }}</td>
                      <td>{{ row.paymentMethodName || paymentMethodLabel(row.paymentMethodId) }}</td>
                      <td>{{ row.paymentState ? enumLabel(row.paymentState) : '-' }}</td>
                      <td>
                        <span class="badge" [class.debt]="row.appliesDebtPayment">
                          {{ row.appliesDebtPayment ? 'SI' : 'NO' }}
                        </span>
                      </td>
                      <td>{{ debtLabel(row) }}</td>
                      <td>{{ row.debtPaymentType ? enumLabel(row.debtPaymentType) : '-' }}</td>
                      <td>{{ row.debtPaymentNotes || '-' }}</td>
                      <td>
                        @if (row.createdDebtPaymentId) {
                          <span class="badge success">Pago deuda #{{ row.createdDebtPaymentId }}</span>
                        } @else if (row.createdExpenseId) {
                          <span class="badge success">Gasto #{{ row.createdExpenseId }}</span>
                        } @else {
                          -
                        }
                      </td>
                      <td>
                        <span class="badge" [class.success]="row.valid" [class.danger]="!row.valid">
                          {{ row.valid ? 'VALID' : 'INVALID' }}
                        </span>
                      </td>
                      <td>
                        @if (row.errors.length) {
                          <ul class="row-errors">
                            @for (error of row.errors; track error.column + error.code + error.message) {
                              <li><strong>{{ error.column }}</strong>: {{ error.message }}</li>
                            }
                          </ul>
                        } @else {
                          -
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
      } @else if (activeMode() === 'incomes') {
      <section class="panel instructions">
        <div>
          <h2>Importar ingresos desde Excel</h2>
          <p>Usa un archivo .xlsx con estas cabeceras exactas:</p>
          <div class="headers-list">
            @for (header of incomeRequiredHeaders; track header) {
              <span>{{ header }}</span>
            }
          </div>
        </div>
        <div class="template-download">
          <p>La plantilla se genera con las categorias de ingreso activas de esta cuenta.</p>
          <button type="button" (click)="downloadIncomeTemplate()" [disabled]="importsStore.isDownloadingTemplate()">
            {{ importsStore.isDownloadingTemplate() ? 'Descargando...' : 'Descargar plantilla de ingresos' }}
          </button>
        </div>
        @if (importsStore.incomeTemplateDownloadError(); as templateError) {
          <p class="form-error" role="alert">{{ templateError }}</p>
        }
        <ul>
          <li>Solo .xlsx, maximo 5MB y maximo 1000 filas.</li>
          <li>Columnas requeridas: Fecha, Descripcion, Categoria, Monto.</li>
          <li>Si alguna fila es invalida, no se crea ningun ingreso.</li>
        </ul>
      </section>

      <section class="panel upload-panel">
        <label class="file-field">
          <span>Archivo Excel</span>
          <input #incomeFileInput type="file" accept=".xlsx" (change)="onIncomeFileSelected($event)" [disabled]="!canWrite()">
        </label>

        @if (importsStore.selectedIncomeFile(); as file) {
          <div class="selected-file">
            <strong>{{ file.name }}</strong>
            <span>{{ fileSizeLabel(file.size) }}</span>
            <button type="button" (click)="clearIncomeFile(incomeFileInput)">Quitar</button>
          </div>
        } @else {
          <p class="muted">Selecciona un archivo .xlsx para importar ingresos.</p>
        }

        @if (incomeFileError(); as error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }

        <div class="actions">
          <button class="button" type="button" (click)="importIncomes()" [disabled]="!canImportIncomes()">
            {{ importsStore.isImportingIncome() ? 'Importando...' : 'Importar ingresos' }}
          </button>
          @if (hasIncomeImportState()) {
            <button type="button" (click)="clearIncomeImport(incomeFileInput)">Cargar otro archivo</button>
          }
        </div>
      </section>

      @if (importsStore.incomeError(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyIncomeError(error) }}</span>
        </div>
      }

      @if (incomeSuccessMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (importsStore.currentIncomeImportResult(); as result) {
        <section class="panel batch-summary">
          <div class="summary-heading">
            <div>
              <h2>{{ result.originalFilename }}</h2>
              <p>Importacion directa de ingresos</p>
            </div>
          </div>
          <dl class="summary-grid">
            <div>
              <dt>Total filas</dt>
              <dd>{{ result.totalRows }}</dd>
            </div>
            <div>
              <dt>Creados</dt>
              <dd>{{ result.createdCount }}</dd>
            </div>
            <div>
              <dt>Invalidos</dt>
              <dd>{{ result.invalidRows }}</dd>
            </div>
          </dl>

          @if (result.invalidRows > 0) {
            <div class="panel warning-panel">
              No se creo ningun ingreso. Corrige el archivo y vuelve a cargarlo.
            </div>
          }
        </section>

        <section class="panel rows-panel">
          <h2>Filas procesadas</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Fecha</th>
                  <th>Descripcion</th>
                  <th>Monto</th>
                  <th>Categoria</th>
                  <th>Resultado</th>
                  <th>Valid</th>
                  <th>Errores</th>
                </tr>
              </thead>
              <tbody>
                @for (row of result.rows; track row.rowNumber) {
                  <tr [class.invalid]="!row.valid">
                    <td>{{ row.rowNumber }}</td>
                    <td>{{ row.incomeDate || '-' }}</td>
                    <td>{{ row.description || '-' }}</td>
                    <td>
                      @if (row.amount !== null && row.amount !== undefined) {
                        {{ row.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}
                      } @else {
                        -
                      }
                    </td>
                    <td>{{ row.categoryName || categoryLabel(row.categoryId) }}</td>
                    <td>
                      @if (row.createdIncomeId) {
                        <span class="badge success">Ingreso #{{ row.createdIncomeId }}</span>
                      } @else {
                        -
                      }
                    </td>
                    <td>
                      <span class="badge" [class.success]="row.valid" [class.danger]="!row.valid">
                        {{ row.valid ? 'VALID' : 'INVALID' }}
                      </span>
                    </td>
                    <td>
                      @if (row.errors.length) {
                        <ul class="row-errors">
                          @for (error of row.errors; track error.column + error.code + error.message) {
                            <li><strong>{{ error.column }}</strong>: {{ error.message }}</li>
                          }
                        </ul>
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (!importsStore.isImportingIncome()) {
        <div class="panel empty-state">
          <h2>Sin importacion de ingresos</h2>
          <p>Sube un Excel y el sistema intentara crear todos los ingresos en un solo paso.</p>
        </div>
      }
      } @else if (activeMode() === 'categories') {
      <section class="panel instructions">
        <div>
          <h2>Importar categorias desde Excel</h2>
          <p>Usa un archivo .xlsx con estas cabeceras exactas:</p>
          <div class="headers-list">
            @for (header of categoryRequiredHeaders; track header) {
              <span>{{ header }}</span>
            }
          </div>
        </div>
        <div class="template-download">
          <p>La plantilla se genera para importar categorias de gasto e ingreso.</p>
          <button type="button" (click)="downloadCategoryTemplate()" [disabled]="importsStore.isDownloadingTemplate()">
            {{ importsStore.isDownloadingTemplate() ? 'Descargando...' : 'Descargar plantilla de categorias' }}
          </button>
        </div>
        @if (importsStore.categoryTemplateDownloadError(); as templateError) {
          <p class="form-error" role="alert">{{ templateError }}</p>
        }
        <ul>
          <li>Solo .xlsx, maximo 5MB y maximo 1000 filas.</li>
          <li>Columnas requeridas: Nombre y Tipo.</li>
          <li>Tipo acepta: Gasto, Ingreso, EXPENSE o INCOME.</li>
          <li>Si alguna fila es invalida, no se crea ninguna categoria.</li>
        </ul>
      </section>

      <section class="panel upload-panel">
        <label class="file-field">
          <span>Archivo Excel</span>
          <input
            #categoryFileInput
            type="file"
            accept=".xlsx"
            (change)="onCategoryFileSelected($event)"
            [disabled]="!canWrite()"
          >
        </label>

        @if (importsStore.selectedCategoryFile(); as file) {
          <div class="selected-file">
            <strong>{{ file.name }}</strong>
            <span>{{ fileSizeLabel(file.size) }}</span>
            <button type="button" (click)="clearCategoryFile(categoryFileInput)">Quitar</button>
          </div>
        } @else {
          <p class="muted">Selecciona un archivo .xlsx para importar categorias.</p>
        }

        @if (categoryFileError(); as error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }

        <div class="actions">
          <button class="button" type="button" (click)="importCategories()" [disabled]="!canImportCategories()">
            {{ importsStore.isImportingCategory() ? 'Importando...' : 'Importar categorias' }}
          </button>
          @if (hasCategoryImportState()) {
            <button type="button" (click)="clearCategoryImport(categoryFileInput)">Cargar otro archivo</button>
          }
        </div>
      </section>

      @if (importsStore.categoryError(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyCategoryError(error) }}</span>
        </div>
      }

      @if (categorySuccessMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (importsStore.currentCategoryImportResult(); as result) {
        <section class="panel batch-summary">
          <div class="summary-heading">
            <div>
              <h2>{{ result.originalFilename }}</h2>
              <p>Importacion directa de categorias</p>
            </div>
          </div>
          <dl class="summary-grid">
            <div>
              <dt>Total filas</dt>
              <dd>{{ result.totalRows }}</dd>
            </div>
            <div>
              <dt>Creadas</dt>
              <dd>{{ result.createdCount }}</dd>
            </div>
            <div>
              <dt>Invalidas</dt>
              <dd>{{ result.invalidRows }}</dd>
            </div>
          </dl>

          @if (result.invalidRows > 0) {
            <div class="panel warning-panel">
              No se creo ninguna categoria. Corrige el archivo y vuelve a cargarlo.
            </div>
          }
        </section>

        <section class="panel rows-panel">
          <h2>Filas procesadas</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Resultado</th>
                  <th>Valid</th>
                  <th>Errores</th>
                </tr>
              </thead>
              <tbody>
                @for (row of result.rows; track row.rowNumber) {
                  <tr [class.invalid]="!row.valid">
                    <td>{{ row.rowNumber }}</td>
                    <td>{{ row.name || '-' }}</td>
                    <td>{{ row.type ? enumLabel(row.type) : '-' }}</td>
                    <td>
                      @if (row.createdCategoryId) {
                        <span class="badge success">Categoria #{{ row.createdCategoryId }}</span>
                      } @else {
                        -
                      }
                    </td>
                    <td>
                      <span class="badge" [class.success]="row.valid" [class.danger]="!row.valid">
                        {{ row.valid ? 'VALID' : 'INVALID' }}
                      </span>
                    </td>
                    <td>
                      @if (row.errors.length) {
                        <ul class="row-errors">
                          @for (error of row.errors; track error.column + error.code + error.message) {
                            <li><strong>{{ error.column }}</strong>: {{ error.message }}</li>
                          }
                        </ul>
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (!importsStore.isImportingCategory()) {
        <div class="panel empty-state">
          <h2>Sin importacion de categorias</h2>
          <p>Sube un Excel y el sistema intentara crear todas las categorias en un solo paso.</p>
        </div>
      }
      } @else if (activeMode() === 'paymentMethods') {
      <section class="panel instructions">
        <div>
          <h2>Importar medios de pago desde Excel</h2>
          <p>Usa un archivo .xlsx con estas cabeceras exactas:</p>
          <div class="headers-list">
            @for (header of paymentMethodRequiredHeaders; track header) {
              <span>{{ header }}</span>
            }
          </div>
        </div>
        <div class="template-download">
          <p>La plantilla se genera para importar medios de pago de la cuenta.</p>
          <button type="button" (click)="downloadPaymentMethodTemplate()" [disabled]="importsStore.isDownloadingTemplate()">
            {{ importsStore.isDownloadingTemplate() ? 'Descargando...' : 'Descargar plantilla de medios de pago' }}
          </button>
        </div>
        @if (importsStore.paymentMethodTemplateDownloadError(); as templateError) {
          <p class="form-error" role="alert">{{ templateError }}</p>
        }
        <ul>
          <li>Solo .xlsx, maximo 5MB y maximo 1000 filas.</li>
          <li>Columnas requeridas: Nombre y Tipo.</li>
          <li>Si alguna fila tiene error, no se crea ningun medio de pago.</li>
        </ul>
      </section>

      <section class="panel upload-panel">
        <label class="file-field">
          <span>Archivo Excel</span>
          <input
            #paymentMethodFileInput
            type="file"
            accept=".xlsx"
            (change)="onPaymentMethodFileSelected($event)"
            [disabled]="!canWrite()"
          >
        </label>

        @if (importsStore.selectedPaymentMethodFile(); as file) {
          <div class="selected-file">
            <strong>{{ file.name }}</strong>
            <span>{{ fileSizeLabel(file.size) }}</span>
            <button type="button" (click)="clearPaymentMethodFile(paymentMethodFileInput)">Quitar</button>
          </div>
        } @else {
          <p class="muted">Selecciona un archivo .xlsx para importar medios de pago.</p>
        }

        @if (paymentMethodFileError(); as error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }

        <div class="actions">
          <button class="button" type="button" (click)="importPaymentMethods()" [disabled]="!canImportPaymentMethods()">
            {{ importsStore.isImportingPaymentMethod() ? 'Importando...' : 'Importar medios de pago' }}
          </button>
          @if (hasPaymentMethodImportState()) {
            <button type="button" (click)="clearPaymentMethodImport(paymentMethodFileInput)">Cargar otro archivo</button>
          }
        </div>
      </section>

      @if (importsStore.paymentMethodError(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyPaymentMethodError(error) }}</span>
        </div>
      }

      @if (paymentMethodSuccessMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (importsStore.currentPaymentMethodImportResult(); as result) {
        <section class="panel batch-summary">
          <div class="summary-heading">
            <div>
              <h2>{{ result.originalFilename }}</h2>
              <p>Importacion directa de medios de pago</p>
            </div>
          </div>
          <dl class="summary-grid">
            <div>
              <dt>Total filas</dt>
              <dd>{{ result.totalRows }}</dd>
            </div>
            <div>
              <dt>Creados</dt>
              <dd>{{ result.createdCount }}</dd>
            </div>
            <div>
              <dt>Invalidos</dt>
              <dd>{{ result.invalidRows }}</dd>
            </div>
          </dl>

          @if (result.invalidRows > 0) {
            <div class="panel warning-panel">
              No se creo ningun medio de pago. Corrige el archivo y vuelve a cargarlo.
            </div>
          }
        </section>

        <section class="panel rows-panel">
          <h2>Filas procesadas</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Resultado</th>
                  <th>Valid</th>
                  <th>Errores</th>
                </tr>
              </thead>
              <tbody>
                @for (row of result.rows; track row.rowNumber) {
                  <tr [class.invalid]="!row.valid">
                    <td>{{ row.rowNumber }}</td>
                    <td>{{ row.name || '-' }}</td>
                    <td>{{ row.type ? enumLabel(row.type) : '-' }}</td>
                    <td>
                      @if (row.createdPaymentMethodId) {
                        <span class="badge success">Medio #{{ row.createdPaymentMethodId }}</span>
                      } @else {
                        -
                      }
                    </td>
                    <td>
                      <span class="badge" [class.success]="row.valid" [class.danger]="!row.valid">
                        {{ row.valid ? 'VALID' : 'INVALID' }}
                      </span>
                    </td>
                    <td>
                      @if (row.errors.length) {
                        <ul class="row-errors">
                          @for (error of row.errors; track error.column + error.code + error.message) {
                            <li><strong>{{ error.column }}</strong>: {{ error.message }}</li>
                          }
                        </ul>
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (!importsStore.isImportingPaymentMethod()) {
        <div class="panel empty-state">
          <h2>Sin importacion de medios de pago</h2>
          <p>Sube un Excel y el sistema intentara crear todos los medios de pago en un solo paso.</p>
        </div>
      }
      } @else if (activeMode() === 'budgets') {
      <section class="panel instructions">
        <div>
          <h2>Importar presupuesto anual desde Excel</h2>
          <p>Usa un archivo .xlsx con estas cabeceras exactas:</p>
          <div class="headers-list">
            @for (header of annualBudgetRequiredHeaders; track header) {
              <span>{{ header }}</span>
            }
          </div>
        </div>
        <div class="template-download">
          <p>Usa Mes = Todos para aplicar a todo el año. Usa un mes especifico para reemplazar ese valor solo en ese mes.</p>
          <button type="button" (click)="downloadAnnualBudgetTemplate()" [disabled]="importsStore.isDownloadingTemplate()">
            {{ importsStore.isDownloadingTemplate() ? 'Descargando...' : 'Descargar plantilla de presupuestos' }}
          </button>
        </div>
        @if (importsStore.annualBudgetTemplateDownloadError(); as templateError) {
          <p class="form-error" role="alert">{{ templateError }}</p>
        }
        <ul>
          <li>Columnas: Año, Mes, NombrePresupuesto, Categoria, NombreSubpresupuesto, Valor.</li>
          <li>Si alguna fila tiene error, no se crea ningun presupuesto.</li>
        </ul>
      </section>

      <section class="panel upload-panel">
        <label class="file-field">
          <span>Archivo Excel</span>
          <input
            #annualBudgetFileInput
            type="file"
            accept=".xlsx"
            (change)="onAnnualBudgetFileSelected($event)"
            [disabled]="!canWrite()"
          >
        </label>

        @if (importsStore.selectedAnnualBudgetFile(); as file) {
          <div class="selected-file">
            <strong>{{ file.name }}</strong>
            <span>{{ fileSizeLabel(file.size) }}</span>
            <button type="button" (click)="clearAnnualBudgetFile(annualBudgetFileInput)">Quitar</button>
          </div>
        } @else {
          <p class="muted">Selecciona un archivo .xlsx para importar presupuestos.</p>
        }

        @if (annualBudgetFileError(); as error) {
          <p class="form-error" role="alert">{{ error }}</p>
        }

        <div class="actions">
          <button class="button" type="button" (click)="importAnnualBudget()" [disabled]="!canImportAnnualBudget()">
            {{ importsStore.isImportingAnnualBudget() ? 'Importando...' : 'Importar presupuesto anual' }}
          </button>
          @if (hasAnnualBudgetImportState()) {
            <button type="button" (click)="clearAnnualBudgetImport(annualBudgetFileInput)">Cargar otro archivo</button>
          }
        </div>
      </section>

      @if (importsStore.annualBudgetError(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyAnnualBudgetError(error) }}</span>
        </div>
      }

      @if (annualBudgetSuccessMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (importsStore.currentAnnualBudgetImportResult(); as result) {
        <section class="panel batch-summary">
          <div class="summary-heading">
            <div>
              <h2>{{ result.originalFilename }}</h2>
              <p>Importacion directa de presupuesto anual</p>
            </div>
          </div>
          <dl class="summary-grid">
            <div>
              <dt>Total filas</dt>
              <dd>{{ result.totalRows }}</dd>
            </div>
            <div>
              <dt>Presupuestos creados</dt>
              <dd>{{ result.createdBudgetsCount }}</dd>
            </div>
            <div>
              <dt>Subpresupuestos creados</dt>
              <dd>{{ result.createdSubBudgetsCount }}</dd>
            </div>
            <div>
              <dt>Invalidos</dt>
              <dd>{{ result.invalidRows }}</dd>
            </div>
          </dl>

          @if (result.invalidRows > 0) {
            <div class="panel warning-panel">
              No se creo ningun presupuesto. Corrige el archivo y vuelve a cargarlo.
            </div>
          }
        </section>

        <section class="panel rows-panel">
          <h2>Filas procesadas</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Año</th>
                  <th>Mes</th>
                  <th>Presupuesto</th>
                  <th>Categoria</th>
                  <th>Subpresupuesto</th>
                  <th>Valor</th>
                  <th>Valid</th>
                  <th>Errores</th>
                </tr>
              </thead>
              <tbody>
                @for (row of result.rows; track row.rowNumber) {
                  <tr [class.invalid]="!row.valid">
                    <td>{{ row.rowNumber }}</td>
                    <td>{{ row.year ?? '-' }}</td>
                    <td>{{ row.month || '-' }}</td>
                    <td>{{ row.budgetName || '-' }}</td>
                    <td>{{ row.categoryName || categoryLabel(row.categoryId) }}</td>
                    <td>{{ row.subBudgetName || '-' }}</td>
                    <td>
                      @if (row.plannedAmount !== null && row.plannedAmount !== undefined) {
                        {{ row.plannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}
                      } @else {
                        -
                      }
                    </td>
                    <td>
                      <span class="badge" [class.success]="row.valid" [class.danger]="!row.valid">
                        {{ row.valid ? 'VALID' : 'INVALID' }}
                      </span>
                    </td>
                    <td>
                      @if (row.errors.length) {
                        <ul class="row-errors">
                          @for (error of row.errors; track error.column + error.code + error.message) {
                            <li><strong>{{ error.column }}</strong>: {{ error.message }}</li>
                          }
                        </ul>
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (!importsStore.isImportingAnnualBudget()) {
        <div class="panel empty-state">
          <h2>Sin importacion de presupuestos</h2>
          <p>Sube un Excel y el sistema intentara crear el presupuesto anual en un solo paso.</p>
        </div>
      }
      }
    </section>
  `
})
export class ImportsPageComponent {
  protected readonly importsStore = inject(ImportsStore);
  protected readonly accountStore = inject(AccountStore);
  protected readonly enumLabel = enumLabel;

  readonly rowFilter = signal<RowFilter>('all');
  readonly activeMode = signal<ImportMode>('expenses');
  readonly fileError = signal<string | null>(null);
  readonly incomeFileError = signal<string | null>(null);
  readonly categoryFileError = signal<string | null>(null);
  readonly paymentMethodFileError = signal<string | null>(null);
  readonly annualBudgetFileError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly incomeSuccessMessage = signal<string | null>(null);
  readonly categorySuccessMessage = signal<string | null>(null);
  readonly paymentMethodSuccessMessage = signal<string | null>(null);
  readonly annualBudgetSuccessMessage = signal<string | null>(null);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly canWrite = computed(() => this.accountStore.selectedAccount()?.status === 'ACTIVE');
  readonly hasImportState = computed(
    () =>
      Boolean(this.importsStore.selectedFile()) ||
      Boolean(this.importsStore.currentBatch()) ||
      Boolean(this.importsStore.error()) ||
      Boolean(this.importsStore.templateDownloadError()) ||
      Boolean(this.fileError()) ||
      Boolean(this.successMessage())
  );
  readonly hasIncomeImportState = computed(
    () =>
      Boolean(this.importsStore.selectedIncomeFile()) ||
      Boolean(this.importsStore.currentIncomeImportResult()) ||
      Boolean(this.importsStore.incomeError()) ||
      Boolean(this.importsStore.incomeTemplateDownloadError()) ||
      Boolean(this.incomeFileError()) ||
      Boolean(this.incomeSuccessMessage())
  );
  readonly hasCategoryImportState = computed(
    () =>
      Boolean(this.importsStore.selectedCategoryFile()) ||
      Boolean(this.importsStore.currentCategoryImportResult()) ||
      Boolean(this.importsStore.categoryError()) ||
      Boolean(this.importsStore.categoryTemplateDownloadError()) ||
      Boolean(this.categoryFileError()) ||
      Boolean(this.categorySuccessMessage())
  );
  readonly hasPaymentMethodImportState = computed(
    () =>
      Boolean(this.importsStore.selectedPaymentMethodFile()) ||
      Boolean(this.importsStore.currentPaymentMethodImportResult()) ||
      Boolean(this.importsStore.paymentMethodError()) ||
      Boolean(this.importsStore.paymentMethodTemplateDownloadError()) ||
      Boolean(this.paymentMethodFileError()) ||
      Boolean(this.paymentMethodSuccessMessage())
  );
  readonly hasAnnualBudgetImportState = computed(
    () =>
      Boolean(this.importsStore.selectedAnnualBudgetFile()) ||
      Boolean(this.importsStore.currentAnnualBudgetImportResult()) ||
      Boolean(this.importsStore.annualBudgetError()) ||
      Boolean(this.importsStore.annualBudgetTemplateDownloadError()) ||
      Boolean(this.annualBudgetFileError()) ||
      Boolean(this.annualBudgetSuccessMessage())
  );
  readonly filteredRows = computed(() => {
    const rows = this.importsStore.currentBatch()?.rows ?? [];

    if (this.rowFilter() === 'valid') {
      return rows.filter((row) => row.valid);
    }

    if (this.rowFilter() === 'invalid') {
      return rows.filter((row) => !row.valid);
    }

    return rows;
  });
  readonly requiredHeaders = ['Fecha', 'Descripcion', 'Monto', 'Categoria', 'MedioPago', 'EstadoPago'];
  readonly incomeRequiredHeaders = ['Fecha', 'Descripcion', 'Categoria', 'Monto'];
  readonly categoryRequiredHeaders = ['Nombre', 'Tipo'];
  readonly paymentMethodRequiredHeaders = ['Nombre', 'Tipo'];
  readonly annualBudgetRequiredHeaders = ['Año', 'Mes', 'NombrePresupuesto', 'Categoria', 'NombreSubpresupuesto', 'Valor'];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.fileError.set(null);
    this.successMessage.set(null);

    if (!file) {
      this.importsStore.clearFile();
      this.fileError.set('Selecciona un archivo .xlsx.');
      return;
    }

    const validationError = validateImportFile(file);

    if (validationError) {
      this.importsStore.clearFile();
      this.fileError.set(validationError);
      input.value = '';
      return;
    }

    this.importsStore.selectFile(file);
  }

  onIncomeFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.incomeFileError.set(null);
    this.incomeSuccessMessage.set(null);

    if (!file) {
      this.importsStore.clearIncomeFile();
      this.incomeFileError.set('Selecciona un archivo .xlsx.');
      return;
    }

    const validationError = validateImportFile(file);

    if (validationError) {
      this.importsStore.clearIncomeFile();
      this.incomeFileError.set(validationError);
      input.value = '';
      return;
    }

    this.importsStore.selectIncomeFile(file);
  }

  onCategoryFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.categoryFileError.set(null);
    this.categorySuccessMessage.set(null);

    if (!file) {
      this.importsStore.clearCategoryFile();
      this.categoryFileError.set('Selecciona un archivo .xlsx.');
      return;
    }

    const validationError = validateImportFile(file);

    if (validationError) {
      this.importsStore.clearCategoryFile();
      this.categoryFileError.set(validationError);
      input.value = '';
      return;
    }

    this.importsStore.selectCategoryFile(file);
  }

  onPaymentMethodFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.paymentMethodFileError.set(null);
    this.paymentMethodSuccessMessage.set(null);

    if (!file) {
      this.importsStore.clearPaymentMethodFile();
      this.paymentMethodFileError.set('Selecciona un archivo .xlsx.');
      return;
    }

    const validationError = validateImportFile(file);

    if (validationError) {
      this.importsStore.clearPaymentMethodFile();
      this.paymentMethodFileError.set(validationError);
      input.value = '';
      return;
    }

    this.importsStore.selectPaymentMethodFile(file);
  }

  onAnnualBudgetFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.annualBudgetFileError.set(null);
    this.annualBudgetSuccessMessage.set(null);

    if (!file) {
      this.importsStore.clearAnnualBudgetFile();
      this.annualBudgetFileError.set('Selecciona un archivo .xlsx.');
      return;
    }

    const validationError = validateImportFile(file);

    if (validationError) {
      this.importsStore.clearAnnualBudgetFile();
      this.annualBudgetFileError.set(validationError);
      input.value = '';
      return;
    }

    this.importsStore.selectAnnualBudgetFile(file);
  }

  clearFile(fileInput?: HTMLInputElement): void {
    this.importsStore.clearFile();
    this.fileError.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearImport(fileInput?: HTMLInputElement): void {
    this.importsStore.clear();
    this.fileError.set(null);
    this.successMessage.set(null);
    this.rowFilter.set('all');

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearIncomeFile(fileInput?: HTMLInputElement): void {
    this.importsStore.clearIncomeFile();
    this.incomeFileError.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearIncomeImport(fileInput?: HTMLInputElement): void {
    this.importsStore.clearIncomeImportState();
    this.incomeFileError.set(null);
    this.incomeSuccessMessage.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearCategoryFile(fileInput?: HTMLInputElement): void {
    this.importsStore.clearCategoryFile();
    this.categoryFileError.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearCategoryImport(fileInput?: HTMLInputElement): void {
    this.importsStore.clearCategoryImportState();
    this.categoryFileError.set(null);
    this.categorySuccessMessage.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearPaymentMethodFile(fileInput?: HTMLInputElement): void {
    this.importsStore.clearPaymentMethodFile();
    this.paymentMethodFileError.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearPaymentMethodImport(fileInput?: HTMLInputElement): void {
    this.importsStore.clearPaymentMethodImportState();
    this.paymentMethodFileError.set(null);
    this.paymentMethodSuccessMessage.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearAnnualBudgetFile(fileInput?: HTMLInputElement): void {
    this.importsStore.clearAnnualBudgetFile();
    this.annualBudgetFileError.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  clearAnnualBudgetImport(fileInput?: HTMLInputElement): void {
    this.importsStore.clearAnnualBudgetImportState();
    this.annualBudgetFileError.set(null);
    this.annualBudgetSuccessMessage.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }

  preview(): void {
    this.successMessage.set(null);
    this.fileError.set(null);

    if (!this.canWrite()) {
      this.fileError.set('La cuenta archivada no permite preview.');
      return;
    }

    const file = this.importsStore.selectedFile();
    const validationError = file ? validateImportFile(file) : 'Selecciona un archivo .xlsx.';

    if (validationError) {
      this.fileError.set(validationError);
      return;
    }

    this.importsStore.preview(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  confirm(batchId: number): void {
    if (!this.canConfirm()) {
      return;
    }

    this.successMessage.set(null);
    this.importsStore.confirm(this.accountId(), batchId).pipe(take(1)).subscribe({
      next: () => this.successMessage.set('Importacion confirmada. Los gastos validos fueron creados.'),
      error: () => undefined
    });
  }

  downloadTemplate(): void {
    this.importsStore.downloadTemplate(this.accountId()).pipe(take(1)).subscribe({
      next: (blob) => this.saveTemplateBlob(blob),
      error: () => undefined
    });
  }

  downloadIncomeTemplate(): void {
    this.importsStore.downloadIncomeTemplate(this.accountId()).pipe(take(1)).subscribe({
      next: (blob) => this.saveTemplateBlob(blob, INCOME_IMPORT_TEMPLATE_FILENAME),
      error: () => undefined
    });
  }

  downloadCategoryTemplate(): void {
    this.importsStore.downloadCategoryTemplate(this.accountId()).pipe(take(1)).subscribe({
      next: (blob) => this.saveTemplateBlob(blob, CATEGORY_IMPORT_TEMPLATE_FILENAME),
      error: () => undefined
    });
  }

  downloadPaymentMethodTemplate(): void {
    this.importsStore.downloadPaymentMethodTemplate(this.accountId()).pipe(take(1)).subscribe({
      next: (blob) => this.saveTemplateBlob(blob, PAYMENT_METHOD_IMPORT_TEMPLATE_FILENAME),
      error: () => undefined
    });
  }

  downloadAnnualBudgetTemplate(): void {
    this.importsStore.downloadAnnualBudgetTemplate(this.accountId()).pipe(take(1)).subscribe({
      next: (blob) => this.saveTemplateBlob(blob, ANNUAL_BUDGET_IMPORT_TEMPLATE_FILENAME),
      error: () => undefined
    });
  }

  importIncomes(): void {
    this.incomeSuccessMessage.set(null);
    this.incomeFileError.set(null);

    if (!this.canWrite()) {
      this.incomeFileError.set('La cuenta archivada no permite importar ingresos.');
      return;
    }

    const file = this.importsStore.selectedIncomeFile();
    const validationError = file ? validateImportFile(file) : 'Selecciona un archivo .xlsx.';

    if (validationError) {
      this.incomeFileError.set(validationError);
      return;
    }

    this.importsStore.importIncomeFile(this.accountId()).pipe(take(1)).subscribe({
      next: (result) => {
        if (result.invalidRows > 0) {
          this.incomeSuccessMessage.set('No se creo ningun ingreso. Corrige el archivo y vuelve a cargarlo.');
          return;
        }

        this.incomeSuccessMessage.set(`Se importaron ${result.createdCount} ingresos.`);
      },
      error: () => undefined
    });
  }

  importCategories(): void {
    this.categorySuccessMessage.set(null);
    this.categoryFileError.set(null);

    if (!this.canWrite()) {
      this.categoryFileError.set('La cuenta archivada no permite importar categorias.');
      return;
    }

    const file = this.importsStore.selectedCategoryFile();
    const validationError = file ? validateImportFile(file) : 'Selecciona un archivo .xlsx.';

    if (validationError) {
      this.categoryFileError.set(validationError);
      return;
    }

    this.importsStore.importCategoryFile(this.accountId()).pipe(take(1)).subscribe({
      next: (result) => {
        if (result.invalidRows > 0) {
          this.categorySuccessMessage.set('No se creo ninguna categoria. Corrige el archivo y vuelve a cargarlo.');
          return;
        }

        this.categorySuccessMessage.set(`Se importaron ${result.createdCount} categorias.`);
      },
      error: () => undefined
    });
  }

  importPaymentMethods(): void {
    this.paymentMethodSuccessMessage.set(null);
    this.paymentMethodFileError.set(null);

    if (!this.canWrite()) {
      this.paymentMethodFileError.set('La cuenta archivada no permite importar medios de pago.');
      return;
    }

    const file = this.importsStore.selectedPaymentMethodFile();
    const validationError = file ? validateImportFile(file) : 'Selecciona un archivo .xlsx.';

    if (validationError) {
      this.paymentMethodFileError.set(validationError);
      return;
    }

    this.importsStore.importPaymentMethodFile(this.accountId()).pipe(take(1)).subscribe({
      next: (result) => {
        if (result.invalidRows > 0) {
          this.paymentMethodSuccessMessage.set('No se creo ningun medio de pago. Corrige el archivo y vuelve a cargarlo.');
          return;
        }

        this.paymentMethodSuccessMessage.set(`Se importaron ${result.createdCount} medios de pago.`);
      },
      error: () => undefined
    });
  }

  importAnnualBudget(): void {
    this.annualBudgetSuccessMessage.set(null);
    this.annualBudgetFileError.set(null);

    if (!this.canWrite()) {
      this.annualBudgetFileError.set('La cuenta archivada no permite importar presupuestos.');
      return;
    }

    const file = this.importsStore.selectedAnnualBudgetFile();
    const validationError = file ? validateImportFile(file) : 'Selecciona un archivo .xlsx.';

    if (validationError) {
      this.annualBudgetFileError.set(validationError);
      return;
    }

    this.importsStore.importAnnualBudgetFile(this.accountId()).pipe(take(1)).subscribe({
      next: (result) => {
        if (result.invalidRows > 0) {
          this.annualBudgetSuccessMessage.set('No se creo ningun presupuesto. Corrige el archivo y vuelve a cargarlo.');
          return;
        }

        this.annualBudgetSuccessMessage.set(
          result.createdBudgetsCount === 12
            ? 'Se crearon 12 presupuestos.'
            : `Se crearon ${result.createdBudgetsCount} presupuestos.`
        );
      },
      error: () => undefined
    });
  }

  canPreview(): boolean {
    return this.canWrite() && Boolean(this.importsStore.selectedFile()) && !this.importsStore.isPreviewing();
  }

  canConfirm(): boolean {
    const batch = this.importsStore.currentBatch();

    return (
      this.canWrite() &&
      Boolean(batch) &&
      batch?.status === 'PREVIEW' &&
      (batch?.validRows ?? 0) > 0 &&
      !this.importsStore.isConfirming()
    );
  }

  canImportIncomes(): boolean {
    return this.canWrite() && Boolean(this.importsStore.selectedIncomeFile()) && !this.importsStore.isImportingIncome();
  }

  canImportCategories(): boolean {
    return this.canWrite() && Boolean(this.importsStore.selectedCategoryFile()) && !this.importsStore.isImportingCategory();
  }

  canImportPaymentMethods(): boolean {
    return (
      this.canWrite() &&
      Boolean(this.importsStore.selectedPaymentMethodFile()) &&
      !this.importsStore.isImportingPaymentMethod()
    );
  }

  canImportAnnualBudget(): boolean {
    return this.canWrite() && Boolean(this.importsStore.selectedAnnualBudgetFile()) && !this.importsStore.isImportingAnnualBudget();
  }

  hasCatalogErrors(): boolean {
    const rows = this.importsStore.currentBatch()?.rows ?? [];

    return rows.some((row) =>
      row.errors.some((error) => {
        const normalized = `${error.column} ${error.code}`.toUpperCase();
        return normalized.includes('CATEGORY') || normalized.includes('CATEGORIA') || normalized.includes('PAYMENT');
      })
    );
  }

  fileSizeLabel(size: number): string {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  categoryLabel(categoryId?: number | null): string {
    return categoryId ? `Categoria ${categoryId}` : '-';
  }

  paymentMethodLabel(paymentMethodId?: number | null): string {
    return paymentMethodId ? `Medio ${paymentMethodId}` : '-';
  }

  debtLabel(row: ExpenseImportRowResponseDto): string {
    if (!row.appliesDebtPayment) {
      return '-';
    }

    return row.debtLabel || (row.debtId ? `Deuda ${row.debtId}` : '-');
  }

  friendlyError(error: ApiErrorResponse): string {
    const messages: Record<string, string> = {
      IMPORT_FILE_REQUIRED: 'Selecciona un archivo para importar.',
      IMPORT_FILE_INVALID_TYPE: 'El archivo debe ser .xlsx.',
      IMPORT_FILE_TOO_LARGE: 'El archivo supera el tamano maximo permitido.',
      IMPORT_TEMPLATE_INVALID: 'La plantilla no tiene las cabeceras esperadas.',
      IMPORT_ROW_LIMIT_EXCEEDED: 'El archivo supera el limite de filas.',
      IMPORT_BATCH_NOT_FOUND: 'No se encontro el batch de importacion.',
      IMPORT_ALREADY_CONFIRMED: 'Este batch ya fue confirmado.',
      IMPORT_NOT_CONFIRMABLE: 'Este batch no se puede confirmar.',
      IMPORT_CONFIRMATION_FAILED: 'No fue posible confirmar la importacion.',
      IMPORT_NO_VALID_ROWS: 'No hay filas validas para importar.'
    };

    return messages[error.code] ?? error.message;
  }

  friendlyIncomeError(error: ApiErrorResponse): string {
    const messages: Record<string, string> = {
      IMPORT_FILE_REQUIRED: 'Selecciona un archivo para importar.',
      IMPORT_FILE_INVALID_TYPE: 'El archivo debe ser .xlsx.',
      IMPORT_FILE_TOO_LARGE: 'El archivo supera el tamano maximo permitido.',
      IMPORT_TEMPLATE_INVALID: 'La plantilla no tiene las cabeceras esperadas.',
      IMPORT_ROW_LIMIT_EXCEEDED: 'El archivo supera el limite de filas.'
    };

    return messages[error.code] ?? error.message;
  }

  friendlyCategoryError(error: ApiErrorResponse): string {
    const messages: Record<string, string> = {
      IMPORT_FILE_REQUIRED: 'Selecciona un archivo para importar.',
      IMPORT_FILE_INVALID_TYPE: 'El archivo debe ser .xlsx.',
      IMPORT_FILE_TOO_LARGE: 'El archivo supera el tamano maximo permitido.',
      IMPORT_TEMPLATE_INVALID: 'La plantilla no tiene las cabeceras esperadas.',
      IMPORT_ROW_LIMIT_EXCEEDED: 'El archivo supera el limite de filas.',
      CATEGORY_ALREADY_EXISTS: 'Ya existe una categoria con ese nombre.',
      CATEGORY_TYPE_INVALID: 'El tipo de categoria no es valido.'
    };

    return messages[error.code] ?? error.message;
  }

  friendlyPaymentMethodError(error: ApiErrorResponse): string {
    const messages: Record<string, string> = {
      IMPORT_FILE_REQUIRED: 'Selecciona un archivo para importar.',
      IMPORT_FILE_INVALID_TYPE: 'El archivo debe ser .xlsx.',
      IMPORT_FILE_TOO_LARGE: 'El archivo supera el tamano maximo permitido.',
      IMPORT_TEMPLATE_INVALID: 'La plantilla no tiene las cabeceras esperadas.',
      IMPORT_ROW_LIMIT_EXCEEDED: 'El archivo supera el limite de filas.',
      PAYMENT_METHOD_ALREADY_EXISTS: 'Ya existe un medio de pago con ese nombre.',
      PAYMENT_METHOD_TYPE_INVALID: 'El tipo de medio de pago no es valido.'
    };

    return messages[error.code] ?? error.message;
  }

  friendlyAnnualBudgetError(error: ApiErrorResponse): string {
    const messages: Record<string, string> = {
      IMPORT_FILE_REQUIRED: 'Selecciona un archivo para importar.',
      IMPORT_FILE_INVALID_TYPE: 'El archivo debe ser .xlsx.',
      IMPORT_FILE_TOO_LARGE: 'El archivo supera el tamano maximo permitido.',
      IMPORT_TEMPLATE_INVALID: 'La plantilla no tiene las cabeceras esperadas.',
      IMPORT_ROW_LIMIT_EXCEEDED: 'El archivo supera el limite de filas.',
      ANNUAL_BUDGET_MONTH_ALREADY_EXISTS: 'Ya existe al menos un presupuesto para ese año.'
    };

    return messages[error.code] ?? error.message;
  }

  private saveTemplateBlob(blob: Blob, fileName: string = EXPENSE_IMPORT_TEMPLATE_FILENAME): void {
    const url = globalThis.URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    globalThis.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    globalThis.URL.revokeObjectURL(url);
  }
}

export function validateImportFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'El archivo debe tener extension .xlsx.';
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return 'El archivo no puede superar 5MB.';
  }

  return null;
}
