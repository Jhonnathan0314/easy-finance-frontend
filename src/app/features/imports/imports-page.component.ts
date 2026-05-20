import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { ImportsStore } from '../../core/imports/imports.store';
import { AccountStore } from '../../core/state/account.store';
import { ApiErrorResponse, ExpenseImportRowResponseDto } from '../../shared/models';

type RowFilter = 'all' | 'valid' | 'invalid';

export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const EXPENSE_IMPORT_TEMPLATE_FILENAME = 'easy-finance-expense-import-template.xlsx';

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
          <p class="page-subtitle">Preview y confirmacion de importaciones de la cuenta {{ accountId() }}.</p>
        </div>
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Preview y confirmacion estan bloqueados.</div>
      }

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
          <li>Categoria debe existir, estar activa y ser EXPENSE.</li>
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
              <p>Batch {{ batch.batchId }} - {{ batch.status }}</p>
            </div>
            @if (batch.confirmedAt) {
              <span class="badge success">Confirmado {{ batch.confirmedAt }}</span>
            } @else {
              <span class="badge">{{ batch.status }}</span>
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
              <dd>{{ batch.status }}</dd>
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
                      <td>{{ row.paymentState || '-' }}</td>
                      <td>
                        <span class="badge" [class.debt]="row.appliesDebtPayment">
                          {{ row.appliesDebtPayment ? 'SI' : 'NO' }}
                        </span>
                      </td>
                      <td>{{ debtLabel(row) }}</td>
                      <td>{{ row.debtPaymentType || '-' }}</td>
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
    </section>
  `
})
export class ImportsPageComponent {
  protected readonly importsStore = inject(ImportsStore);
  protected readonly accountStore = inject(AccountStore);

  readonly rowFilter = signal<RowFilter>('all');
  readonly fileError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
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

  private saveTemplateBlob(blob: Blob): void {
    const url = globalThis.URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement('a');

    anchor.href = url;
    anchor.download = EXPENSE_IMPORT_TEMPLATE_FILENAME;
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
