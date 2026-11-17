import { TestBed } from '@angular/core/testing';

import { type BarSegment, LiveBar } from './live-bar';

describe('LiveBar', () => {
  function setup(segments: BarSegment[]) {
    const fixture = TestBed.createComponent(LiveBar);
    fixture.componentRef.setInput('segments', segments);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return { host, spans: [...host.querySelectorAll<HTMLElement>('span')] };
  }

  it('draws a segment per status with students, in the order of the work, with its width', () => {
    const { spans } = setup([
      { status: 'submitted', count: 1, names: 'Entregado: Lía' },
      { status: 'tests_failed', count: 3, names: 'Con fallos: Aya, Hugo y Max' },
    ]);

    expect(spans.map((span) => span.style.width)).toEqual(['75%', '25%']);
    expect(spans[0].classList).toContain('bg-chart-fail');
    expect(spans[1].classList).toContain('bg-chart-done');
  });

  it('draws nothing for a status without students, and leaves who has not started as the track', () => {
    const { spans } = setup([
      { status: 'not_started', count: 2, names: 'Sin empezar: Lía y Max' },
      { status: 'tests_failed', count: 0, names: '' },
      { status: 'in_progress', count: 2, names: 'En curso: Aya y Hugo' },
    ]);

    expect(spans).toHaveLength(1);
    expect(spans[0].style.width).toBe('50%');
  });

  it('is a drawing for screen readers, with its widths moving smoothly unless asked not to', () => {
    const { host, spans } = setup([{ status: 'passed', count: 1, names: 'Superado: Aya' }]);

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(spans[0].className).toContain('motion-reduce:transition-none');
  });
});
