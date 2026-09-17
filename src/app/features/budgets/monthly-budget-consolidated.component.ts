import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { BudgetsApiService } from '../../core/budgets/budgets-api.service';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { AccountStore } from '../../core/state/account.store';
import { AccountMemberResponseDto, CategoryResponseDto, SubBudgetResponseDto } from '../../shared/models';

interface BudgetCategorySummary {
  categoryId: number | null;
  totalPlannedAmount: number;
  subBudgetCount: number;
}

interface BudgetParticipantConsolidated {
  participantId: number | null;
  participantLabel: string;
  rows: BudgetCategorySummary[];
  totalPlannedAmount: number;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

@Component({
  selector: 'ef-monthly-budget-consolidated',
  standalone: true,
  imports: [CurrencyPipe],
  styleUrl: './monthly-budget-consolidated.component.scss',
  template: `
    <section class="panel monthly-consolidated-panel" aria-label="Consolidado mensual">
      <div class="section-heading">
        <h2>Consolidado {{ monthLabel() }} {{ year }}</h2>
        <button type="button" (click)="close.emit()">Cerrar</button>
      </div>

      @if (isLoading()) {
        <p class="muted">Cargando consolidado...</p>
      } @else if (loadError()) {
        <p class="muted">No hay presupuesto para este mes.</p>
      } @else {
        <h3>Por participante</h3>
        @if (!monthlyConsolidatedByParticipant().length) {
          <p class="muted">No hay subpresupuestos activos para este mes.</p>
        } @else {
          @for (participantGroup of monthlyConsolidatedByParticipant(); track participantGroup.participantId) {
            <h4>{{ participantGroup.participantLabel }}</h4>
            <table class="consolidated-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Subpresupuestos</th>
                  <th>Presupuestado</th>
                </tr>
              </thead>
              <tbody>
                @for (row of participantGroup.rows; track row.categoryId) {
                  <tr>
                    <td>{{ categoryName(row.categoryId) }}</td>
                    <td>{{ row.subBudgetCount }}</td>
                    <td>{{ row.totalPlannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
                  </tr>
                }
                <tr class="consolidated-total-row">
                  <td>Total {{ participantGroup.participantLabel }}</td>
                  <td></td>
                  <td>{{ participantGroup.totalPlannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
                </tr>
              </tbody>
            </table>
          }
        }

        <h3>Total por categoria</h3>
        @if (!monthlyConsolidatedByCategory().length) {
          <p class="muted">No hay subpresupuestos activos para este mes.</p>
        } @else {
          <table class="consolidated-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Subpresupuestos</th>
                <th>Presupuestado</th>
              </tr>
            </thead>
            <tbody>
              @for (row of monthlyConsolidatedByCategory(); track row.categoryId) {
                <tr>
                  <td>{{ categoryName(row.categoryId) }}</td>
                  <td>{{ row.subBudgetCount }}</td>
                  <td>{{ row.totalPlannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
                </tr>
              }
              <tr class="consolidated-total-row">
                <td>Total general</td>
                <td></td>
                <td>{{ monthlyConsolidatedGrandTotal() | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
              </tr>
            </tbody>
          </table>
        }
      }
    </section>
  `
})
export class MonthlyBudgetConsolidatedComponent implements OnChanges {
  @Input({ required: true }) year!: number;
  @Input({ required: true }) month!: number;
  @Output() readonly close = new EventEmitter<void>();

  private readonly accountStore = inject(AccountStore);
  private readonly budgetsApi = inject(BudgetsApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly accountsApi = inject(AccountsApiService);

  readonly isLoading = signal(false);
  readonly loadError = signal(false);
  private readonly subBudgets = signal<SubBudgetResponseDto[]>([]);
  private readonly categories = signal<CategoryResponseDto[]>([]);
  private readonly members = signal<AccountMemberResponseDto[]>([]);

  readonly monthlyConsolidatedByParticipant = computed<BudgetParticipantConsolidated[]>(() => {
    const grouped = new Map<string, { participantId: number | null; categories: Map<number | null, BudgetCategorySummary> }>();

    for (const subBudget of this.subBudgets()) {
      if (subBudget.status !== 'ACTIVE') {
        continue;
      }

      const participantId = subBudget.participantId ?? null;
      const key = participantId == null ? 'GLOBAL' : String(participantId);
      const entry = grouped.get(key) ?? { participantId, categories: new Map<number | null, BudgetCategorySummary>() };
      const categoryId = subBudget.categoryId ?? null;
      const current = entry.categories.get(categoryId) ?? { categoryId, totalPlannedAmount: 0, subBudgetCount: 0 };

      entry.categories.set(categoryId, {
        categoryId,
        totalPlannedAmount: current.totalPlannedAmount + subBudget.plannedAmount,
        subBudgetCount: current.subBudgetCount + 1
      });
      grouped.set(key, entry);
    }

    return Array.from(grouped.values())
      .map((entry) => {
        const rows = Array.from(entry.categories.values()).sort((a, b) =>
          this.categoryName(a.categoryId).localeCompare(this.categoryName(b.categoryId))
        );

        return {
          participantId: entry.participantId,
          participantLabel: this.participantLabel(entry.participantId),
          rows,
          totalPlannedAmount: rows.reduce((total, row) => total + row.totalPlannedAmount, 0)
        };
      })
      .sort((a, b) => a.participantLabel.localeCompare(b.participantLabel));
  });

  readonly monthlyConsolidatedByCategory = computed<BudgetCategorySummary[]>(() => {
    const grouped = new Map<number | null, BudgetCategorySummary>();

    for (const subBudget of this.subBudgets()) {
      if (subBudget.status !== 'ACTIVE') {
        continue;
      }

      const categoryId = subBudget.categoryId ?? null;
      const current = grouped.get(categoryId) ?? { categoryId, totalPlannedAmount: 0, subBudgetCount: 0 };

      grouped.set(categoryId, {
        categoryId,
        totalPlannedAmount: current.totalPlannedAmount + subBudget.plannedAmount,
        subBudgetCount: current.subBudgetCount + 1
      });
    }

    return Array.from(grouped.values()).sort((a, b) => this.categoryName(a.categoryId).localeCompare(this.categoryName(b.categoryId)));
  });

  readonly monthlyConsolidatedGrandTotal = computed(() =>
    this.monthlyConsolidatedByCategory().reduce((total, row) => total + row.totalPlannedAmount, 0)
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['year'] || changes['month']) {
      this.load();
    }
  }

  monthLabel(): string {
    return MONTH_NAMES[this.month - 1] ?? `Mes ${this.month}`;
  }

  categoryName(categoryId: number | null): string {
    if (!categoryId) {
      return 'Sin categoria';
    }

    return this.categories().find((category) => category.id === categoryId)?.name ?? `Categoria ${categoryId}`;
  }

  private participantLabel(participantId: number | null): string {
    if (!participantId) {
      return 'Global';
    }

    const member = this.members().find((item) => item.participantId === participantId);

    if (!member) {
      return `Participante ${participantId}`;
    }

    return member.displayName ? `${member.displayName} (${member.email})` : member.email;
  }

  private load(): void {
    const accountId = this.accountStore.selectedAccountId() ?? 0;
    this.isLoading.set(true);
    this.loadError.set(false);

    this.budgetsApi
      .getBudgetDetail(accountId, this.year, this.month)
      .pipe(take(1))
      .subscribe({
        next: (detail) => {
          this.subBudgets.set(detail.subBudgets);
          this.isLoading.set(false);
        },
        error: () => {
          this.subBudgets.set([]);
          this.loadError.set(true);
          this.isLoading.set(false);
        }
      });

    this.catalogsApi
      .listCategories(accountId, { type: 'EXPENSE', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.categories.set(page.content),
        error: () => this.categories.set([])
      });

    this.accountsApi
      .listMembers(accountId)
      .pipe(take(1))
      .subscribe({
        next: (members) => this.members.set(members),
        error: () => this.members.set([])
      });
  }
}
