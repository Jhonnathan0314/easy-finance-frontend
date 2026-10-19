import { Directive, ElementRef, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';

/**
 * Scrolls the host into view when it is rendered and focuses its first field, so forms that open
 * above or below the current viewport (for example when editing a row far down a list) are noticed.
 * Bind a value to re-trigger it when the form stays open but its subject changes.
 */
@Directive({
  selector: '[efScrollIntoView]',
  standalone: true
})
export class ScrollIntoViewDirective implements OnInit, OnChanges {
  @Input() efScrollIntoView: unknown;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    this.host.nativeElement.style.scrollMarginTop = '1rem';
    this.scheduleScroll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['efScrollIntoView'];

    if (change && !change.firstChange) {
      this.scheduleScroll();
    }
  }

  private scheduleScroll(): void {
    setTimeout(() => {
      const element = this.host.nativeElement;
      const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

      element.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      element.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?.focus({ preventScroll: true });
    });
  }
}
