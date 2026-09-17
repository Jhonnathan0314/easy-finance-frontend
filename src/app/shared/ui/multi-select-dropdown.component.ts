import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

export interface MultiSelectOption {
  id: number;
  label: string;
}

@Component({
  selector: 'ef-multi-select-dropdown',
  standalone: true,
  styleUrl: './multi-select-dropdown.component.scss',
  template: `
    <div class="multi-select">
      <button type="button" class="multi-select-trigger" [class.active]="open()" (click)="toggle()">
        <span>{{ summaryLabel() }}</span>
        <span class="multi-select-caret" aria-hidden="true">&#9662;</span>
      </button>
      @if (open()) {
        <div class="multi-select-panel" role="listbox">
          @if (options().length) {
            @for (option of options(); track option.id) {
              <label class="multi-select-option">
                <input type="checkbox" [checked]="isSelected(option.id)" (change)="toggleOption(option.id)">
                <span>{{ option.label }}</span>
              </label>
            }
          } @else {
            <p class="multi-select-empty">Sin opciones.</p>
          }
          @if (selectedIds().length) {
            <button type="button" class="multi-select-clear" (click)="clear()">Limpiar seleccion</button>
          }
        </div>
      }
    </div>
  `
})
export class MultiSelectDropdownComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly options = input<MultiSelectOption[]>([]);
  readonly selectedIds = input<number[]>([]);
  readonly placeholder = input('Todos');
  readonly selectedIdsChange = output<number[]>();

  readonly open = signal(false);
  readonly summaryLabel = computed(() => {
    const selected = this.selectedIds();

    if (!selected.length) {
      return this.placeholder();
    }

    if (selected.length === 1) {
      return this.options().find((option) => option.id === selected[0])?.label ?? this.placeholder();
    }

    return `${selected.length} seleccionadas`;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  toggle(): void {
    this.open.update((value) => !value);
  }

  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  toggleOption(id: number): void {
    const current = this.selectedIds();
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    this.selectedIdsChange.emit(next);
  }

  clear(): void {
    this.selectedIdsChange.emit([]);
  }
}
