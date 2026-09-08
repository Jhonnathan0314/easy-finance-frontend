import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs';
import { ExportsApiService } from '../../core/exports/exports-api.service';
import { AccountStore } from '../../core/state/account.store';

@Component({
 selector: 'ef-exports-page',
 standalone: true,
 imports: [FormsModule],
 styleUrl: './exports-page.component.scss',
 template: `
<section class="page-shell">
  <div class="page-header">
    <div>
      <h1 class="page-title">Exportaciones</h1>
      <p class="page-subtitle">Descarga respaldos compatibles con las plantillas de importación.</p>
    </div>
  </div>

  <section class="panel export-filters">
    <div>
      <h2>Filtros de exportación</h2>
      <p>Selecciona el período para ingresos, gastos y presupuestos. Deudas y catálogos se descargan completos.</p>
    </div>
    <div class="filters-row">
      <label class="field">
        <span>Año</span>
        <input type="number" [(ngModel)]="year" min="2000" max="2100" aria-label="Año de exportación">
      </label>
      <label class="field">
        <span>Mes</span>
        <select [(ngModel)]="month" aria-label="Mes de exportación">
          <option [ngValue]="undefined">Todo el año</option>
          @for (m of months; track m) { <option [ngValue]="m">{{ m }}</option> }
        </select>
      </label>
    </div>
  </section>

  @if (error()) { <div class="panel error-panel" role="alert">{{ error() }}</div> }

  <section class="export-grid" aria-label="Módulos exportables">
    @for (item of modules; track item.key) {
      <article class="panel export-card">
        <div>
          <h2>{{ item.label }}</h2>
          <p>{{ item.description }}</p>
        </div>
        <button class="button" type="button" (click)="download(item.key)" [disabled]="loading()">
          {{ loading() ? 'Descargando...' : 'Descargar Excel' }}
        </button>
      </article>
    }
  </section>
</section>`
})
export class ExportsPageComponent {
 private readonly api=inject(ExportsApiService); readonly accountStore=inject(AccountStore); readonly loading=signal(false); readonly error=signal(''); year?:number=new Date().getFullYear(); month?:number; readonly months=Array.from({length:12},(_,i)=>i+1); readonly modules=[{key:'incomes',label:'Ingresos',description:'Ingresos del año o mes seleccionado.'},{key:'expenses',label:'Gastos',description:'Gastos del año o mes seleccionado.'},{key:'debts',label:'Deudas',description:'Todas las deudas de la cuenta.'},{key:'categories',label:'Categorías',description:'Categorías activas e inactivas.'},{key:'payment-methods',label:'Medios de pago',description:'Medios de pago activos e inactivos.'},{key:'budgets',label:'Presupuestos',description:'Presupuestos del año o mes seleccionado.'}];
 download(module:string){const id=this.accountStore.selectedAccountId(); if(!id)return; const hasPeriod=module==='incomes'||module==='expenses'||module==='budgets'; this.loading.set(true); this.error.set(''); this.api.download(id,module,hasPeriod?this.year:undefined,hasPeriod?this.month:undefined).pipe(take(1)).subscribe({next:b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=this.filename(module,hasPeriod?this.year:undefined,hasPeriod?this.month:undefined);a.click();URL.revokeObjectURL(a.href);this.loading.set(false)},error:()=>{this.error.set('No fue posible generar la exportación. Verifica que seas administrador.');this.loading.set(false)}})}
 private filename(module:string,year?:number,month?:number):string { let name=`easy-finance-${module}-export`; if(year){name+=`-${year}`; if(month)name+=`-${String(month).padStart(2,'0')}`;} return `${name}.xlsx`; }
}
