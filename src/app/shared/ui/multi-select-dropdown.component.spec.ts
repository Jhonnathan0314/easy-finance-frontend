import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiSelectDropdownComponent, MultiSelectOption } from './multi-select-dropdown.component';

describe('MultiSelectDropdownComponent', () => {
  const options: MultiSelectOption[] = [
    { id: 1, label: 'Mercado' },
    { id: 2, label: 'Transporte' },
    { id: 3, label: 'Salud' }
  ];

  let fixture: ComponentFixture<MultiSelectDropdownComponent>;
  let component: MultiSelectDropdownComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MultiSelectDropdownComponent] });
    fixture = TestBed.createComponent(MultiSelectDropdownComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('placeholder', 'Todas');
    fixture.detectChanges();
  });

  function triggerText(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('.multi-select-trigger')?.textContent?.trim() ?? '';
  }

  it('shows the placeholder when nothing is selected', () => {
    expect(triggerText()).toContain('Todas');
  });

  it('shows the option label when exactly one is selected', () => {
    fixture.componentRef.setInput('selectedIds', [2]);
    fixture.detectChanges();

    expect(triggerText()).toContain('Transporte');
  });

  it('shows a count summary when multiple are selected', () => {
    fixture.componentRef.setInput('selectedIds', [1, 3]);
    fixture.detectChanges();

    expect(triggerText()).toContain('2 seleccionadas');
  });

  it('opens the panel when the trigger is clicked', () => {
    expect(component.open()).toBeFalse();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.multi-select-trigger')?.click();
    fixture.detectChanges();

    expect(component.open()).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('.multi-select-panel')).toBeTruthy();
  });

  it('emits the updated selection when a checkbox is checked', () => {
    fixture.componentRef.setInput('selectedIds', [1]);
    const emitted: number[][] = [];
    component.selectedIdsChange.subscribe((value) => emitted.push(value));

    component.toggleOption(2);

    expect(emitted).toEqual([[1, 2]]);
  });

  it('emits the updated selection when a checked option is unchecked', () => {
    fixture.componentRef.setInput('selectedIds', [1, 2]);
    const emitted: number[][] = [];
    component.selectedIdsChange.subscribe((value) => emitted.push(value));

    component.toggleOption(1);

    expect(emitted).toEqual([[2]]);
  });

  it('emits an empty selection when cleared', () => {
    fixture.componentRef.setInput('selectedIds', [1, 2]);
    const emitted: number[][] = [];
    component.selectedIdsChange.subscribe((value) => emitted.push(value));

    component.clear();

    expect(emitted).toEqual([[]]);
  });

  it('closes the panel when clicking outside the component', () => {
    component.open.set(true);
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect(component.open()).toBeFalse();
  });
});
