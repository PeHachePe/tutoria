import { Component } from '@angular/core';

/**
 * A block with the shape of content that is still loading (4.8): its size and roundness come from the
 * classes of whoever uses it (`<app-skeleton class="h-6 w-48" />`). Hidden from assistive technology;
 * `LoadingSkeleton` says «Cargando…» instead. The pulse stops with `prefers-reduced-motion`.
 */
@Component({
  selector: 'app-skeleton',
  template: '',
  host: {
    'aria-hidden': 'true',
    class: 'block rounded-md bg-surface-container-highest animate-pulse motion-reduce:animate-none',
  },
})
export class Skeleton {}
