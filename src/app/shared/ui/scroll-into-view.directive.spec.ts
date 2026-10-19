import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ScrollIntoViewDirective } from './scroll-into-view.directive';

@Component({
  standalone: true,
  imports: [ScrollIntoViewDirective],
  template: `<form [efScrollIntoView]="target()"><input type="text"></form>`
})
class HostComponent {
  readonly target = signal<number | null>(null);
}

describe('ScrollIntoViewDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let scrollSpy: jasmine.Spy;

  beforeEach(() => {
    scrollSpy = spyOn(HTMLElement.prototype, 'scrollIntoView');
    fixture = TestBed.createComponent(HostComponent);
  });

  it('scrolls when rendered and when the bound value changes', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    fixture.componentInstance.target.set(5);
    fixture.detectChanges();
    tick();
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  }));
});
