import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'ef-analytics-page',
  standalone: true,
  template: `
    <section class="page-shell">
      <div>
        <h1 class="page-title">Analitica</h1>
        <p class="page-subtitle">Metricas readonly de la cuenta {{ accountId() }}.</p>
      </div>
      <div class="panel">Placeholder de Fase 2.</div>
    </section>
  `
})
export class AnalyticsPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly accountId = computed(() => this.route.snapshot.paramMap.get('accountId'));
}
