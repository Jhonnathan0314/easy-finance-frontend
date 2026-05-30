const ENUM_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  CANCELLED: 'Cancelado',
  ARCHIVED: 'Archivada',
  CLOSED: 'Cerrado',
  PAID: 'Pagado',
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  SIMPLE: 'Simple',
  INSTALLMENT: 'En cuotas',
  ACCOUNT_ADMIN: 'Administrador',
  ACCOUNT_MEMBER: 'Miembro',
  MANUAL: 'Manual',
  IMPORT: 'Importado',
  DEBT_PAYMENT: 'Pago de deuda',
  DEBT_DERIVED: 'Derivado de deuda',
  INSTALLMENT_EXPENSE: 'Gasto en cuotas',
  DEBT_INSTALLMENT: 'Cuota de deuda',
  CAPITAL_PAYMENT: 'Abono a capital',
  EXPENSE: 'Gasto',
  INCOME: 'Ingreso',
  PREVIEW: 'Previsualizacion',
  CONFIRMED: 'Confirmado',
  USER: 'Usuario',
  SUPER_ADMIN: 'Super administrador',
  CASH: 'Efectivo',
  BANK_ACCOUNT: 'Cuenta bancaria',
  CREDIT_CARD: 'Tarjeta de credito',
  DEBIT_CARD: 'Tarjeta debito',
  DIGITAL_WALLET: 'Billetera digital',
  OTHER: 'Otro'
};

export function enumLabel(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return ENUM_LABELS[value] ?? value;
}
