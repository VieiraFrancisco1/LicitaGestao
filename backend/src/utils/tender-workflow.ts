type WorkflowEvent = 'SUSPENDED' | 'RESUMED' | 'CONVOCATED' | 'RESOURCE';

export function resolveTenderWorkflowStatus(sessionDate: Date, latestEvent: WorkflowEvent | null, today: string) {
  if (latestEvent === 'SUSPENDED') return 'SUSPENSA' as const;
  if (latestEvent === 'CONVOCATED') return 'CONVOCADA' as const;
  if (latestEvent === 'RESOURCE') return 'RECURSO' as const;
  if (latestEvent === 'RESUMED' || sessionDate.toISOString().slice(0, 10) <= today) return 'INICIADA' as const;
  // A associação já registra a participação; anexação não é uma etapa da lista.
  return 'PENDENTE' as const;
}
