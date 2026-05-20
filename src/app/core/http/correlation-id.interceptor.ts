import { HttpInterceptorFn } from '@angular/common/http';

export const correlationIdInterceptor: HttpInterceptorFn = (request, next) => {
  const correlationId = createCorrelationId();

  return next(
    request.clone({
      setHeaders: {
        'X-Correlation-Id': correlationId
      }
    })
  );
};

function createCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ef-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
