// ==================== TIPOS BASE ====================

export type UserRole = 'admin' | 'gestor' | 'operador';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions?: string[];
}

// ==================== DOCUMENTOS / FACTURAS ====================

export type DocType = 'RECIBIDA' | 'ABONADA';
export type StatusReview = 'PENDIENTE' | 'REVISADA';
export type StatusAccounting = 'PENDIENTE' | 'CONTABILIZADA';
export type DocumentVisibility = 'EMPRESA' | 'GESTOR' | 'AMBOS';

export interface HistoryEvent {
  id: string;
  date: Date;
  action: string;
  userId: string;
  userName: string;
  details?: string;
}

export interface Document {
  id: string;
  docType: DocType;
  title: string;
  counterparty: string;
  amount: number;
  currency: string;
  invoiceNumber?: string;
  invoiceDate: Date;
  uploadedBy: string;
  uploadedAt: Date;
  statusReview: StatusReview;
  reviewedAt?: Date;
  reviewedBy?: string;
  statusAccounting: StatusAccounting;
  accountedAt?: Date;
  accountedBy?: string;
  tags?: string[];
  notes?: string;
  fileUrl: string;
  accountingPeriod: string;
  visibility: DocumentVisibility;
  historyEvents: HistoryEvent[];
}

// ==================== MÁQUINAS ====================

export type MachineType = 'snack' | 'bebida' | 'cafe' | 'mixta';
export type MachineStatus = 'ACTIVA' | 'ALMACEN' | 'AVERIADA' | 'RETIRADA';

export interface MachineDocument {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  uploadedAt: Date;
}

export interface Machine {
  id: string;
  machineNumber: string;
  type: MachineType;
  brand: string;
  model: string;
  serialNumber: string;
  hasCardReader: boolean;
  hasTelemetry: boolean;
  hasContract: boolean;
  contractFileUrl?: string;
  locationName: string;
  locationAddress: string;
  contactPerson?: string;
  contactPhone?: string;
  installationDate: Date;
  status: MachineStatus;
  commissionPercentage?: number;
  notes?: string;
  documents: MachineDocument[];
  historyEvents: HistoryEvent[];
}

// ==================== RECAUDACIONES ====================

export interface Collection {
  id: string;
  machineId: string;
  date: Date;
  cashAmount: number;
  cardAmount: number;
  totalAmount: number;
  clientCommission?: number;
  commissionPaid: boolean;
  commissionPaidDate?: Date;
  commissionNotes?: string;
  collectedBy: string;
  notes?: string;
}

// ==================== INCIDENCIAS ====================

export type IncidentType = 'electrica' | 'atasco' | 'lector' | 'vandalismo' | 'otro';
export type IncidentStatus = 'ABIERTA' | 'EN_PROCESO' | 'CERRADA';

export interface Incident {
  id: string;
  machineId: string;
  date: Date;
  type: IncidentType;
  description: string;
  status: IncidentStatus;
  assignedTo?: string;
  resolvedAt?: Date;
  images: string[];
  notes?: string;
}

// ==================== EMPLEADOS Y NÓMINAS ====================

export interface Employee {
  id: string;
  name: string;
  dni: string;
  position: string;
  startDate: Date;
  active: boolean;
}

export type PayrollStatus = 'PENDIENTE' | 'REVISADA';

export interface Payroll {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  grossAmount: number;
  netAmount: number;
  companyCost: number;
  uploadedAt: Date;
  status: PayrollStatus;
  fileUrl: string;
  notes?: string;
}

// ==================== FILTROS ====================

export interface DocumentFilters {
  search?: string;
  docType?: DocType;
  statusReview?: StatusReview;
  statusAccounting?: StatusAccounting;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
}

export interface MachineFilters {
  search?: string;
  type?: MachineType;
  status?: MachineStatus;
  hasCardReader?: boolean;
  hasTelemetry?: boolean;
}

export interface IncidentFilters {
  search?: string;
  status?: IncidentStatus;
  type?: IncidentType;
  machineId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ==================== DASHBOARD STATS ====================

export interface DashboardStats {
  activeMachines: number;
  pendingReviewDocuments: number;
  pendingAccountingDocuments: number;
  monthlyRevenue: number;
  monthlyPayrolls: number;
}

// ==================== STOCK ====================

export interface StockProduct {
  name: string;
  category?: string;
  totalCapacity: number;
  availableUnits: number;
  unitsToReplenish: number;
  line?: string;
}

export interface MachineStock {
  machineId: string;
  machineName: string;
  location?: string;
  products: StockProduct[];
  scrapedAt: Date;
}

export interface StockSummary {
  productName: string;
  category?: string;
  totalUnitsToReplenish: number;
  machineCount: number;
  machineNames: string[]; // Nombres de las máquinas donde va este producto
}

export interface ScrapingStatus {
  isRunning: boolean;
  progress: number;
  currentMachine?: string;
  error?: string;
  completedAt?: Date;
}

// ==================== DASHBOARD DATA ====================

export interface ChartDataPoint {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DashboardMetrics {
  ticketMedio: {
    value: number;
    change: number; // Percentage change
    trend: 'up' | 'down';
  };
  mediaVentasEuros: {
    value: number;
    change: number;
    trend: 'up' | 'down';
  };
  mediaVentasUnidades: {
    value: number;
    change: number;
    trend: 'up' | 'down';
  };
}

export type DashboardPeriod = 'Día' | 'Semana' | 'Mes';

export interface DashboardPeriodData {
  metrics: DashboardMetrics;
  totalVentasEuros: ChartDataPoint[];
  totalVentasUnidades: ChartDataPoint[];
  totalRecargas: ChartDataPoint[];
}

export interface DashboardData {
  periods: {
    [key in DashboardPeriod]: DashboardPeriodData;
  };
  scrapedAt: Date;
}

