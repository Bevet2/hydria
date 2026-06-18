export type Role = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string;
  emailVerifiedAt?: string | null;
  mfaEnabled?: boolean;
  teamId?: string | null;
  team?: { id: string; name: string } | null;
  permissionPolicy?: Record<string, unknown> | null;
  organization?: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    brandColor?: string;
    defaultCurrency?: string;
    locale?: string;
    timezone?: string;
  };
};

export type Company = {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  _count?: { contacts: number; deals: number; tasks: number };
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  status: string;
  source?: string | null;
  company?: Pick<Company, "id" | "name"> | null;
};

export type Stage = {
  id: string;
  name: string;
  position: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
};

export type Deal = {
  id: string;
  name: string;
  value: number | string;
  currency: string;
  probability: number;
  stageId: string;
  forecastCategory: "PIPELINE" | "BEST_CASE" | "COMMIT" | "CLOSED" | "OMITTED";
  description?: string | null;
  score: number;
  campaign?: { id: string; name: string } | null;
  territory?: { id: string; name: string } | null;
  nextStep?: string | null;
  expectedCloseAt?: string | null;
  company?: Pick<Company, "id" | "name"> | null;
  primaryContact?: Pick<Contact, "id" | "firstName" | "lastName"> | null;
  owner?: Pick<User, "id" | "firstName" | "lastName"> | null;
  stage?: Stage;
  lostReason?: string | null;
  competitor?: string | null;
};

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  source?: string | null;
  status: "NEW" | "WORKING" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED";
  rating: "HOT" | "WARM" | "COLD";
  annualRevenue?: number | string | null;
  employeeCount?: number | null;
  description?: string | null;
  convertedAt?: string | null;
  score: number;
  campaign?: { id: string; name: string } | null;
  territory?: { id: string; name: string } | null;
  owner?: Pick<User, "id" | "firstName" | "lastName"> | null;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  unitPrice: number | string;
  currency: string;
  active: boolean;
  _count?: { dealLineItems: number; quoteLineItems: number };
};

export type DealLineItem = {
  id: string;
  quantity: number | string;
  unitPrice: number | string;
  discountPercent: number | string;
  lineTotal: number | string;
  product: Product;
};

export type Quote = {
  id: string;
  number: string;
  name: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  validUntil?: string | null;
  subtotal: number | string;
  discountPercent: number | string;
  taxPercent: number | string;
  total: number | string;
  deal?: Pick<Deal, "id" | "name">;
  company?: Pick<Company, "id" | "name"> | null;
  contact?: Pick<Contact, "id" | "firstName" | "lastName" | "email"> | null;
  lineItems?: QuoteLineItem[];
  _count?: { lineItems: number };
};

export type QuoteLineItem = {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  discountPercent: number | string;
  lineTotal?: number | string;
  product?: Product | null;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt?: string | null;
  reminderAt?: string | null;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurrenceInterval: number;
  recurrenceEndsAt?: string | null;
  recurrenceSeriesId?: string | null;
  assignedTo?: Pick<User, "id" | "firstName" | "lastName"> | null;
  company?: Pick<Company, "id" | "name"> | null;
  contact?: Pick<Contact, "id" | "firstName" | "lastName"> | null;
  deal?: Pick<Deal, "id" | "name"> | null;
  lead?: Pick<Lead, "id" | "firstName" | "lastName"> | null;
};

export type Ticket = {
  id: string;
  number: string;
  subject: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  source: string;
  dueAt?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstRespondedAt?: string | null;
  slaBreachedAt?: string | null;
  escalatedAt?: string | null;
  customerEmail?: string | null;
  portalToken?: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: Pick<User, "id" | "firstName" | "lastName"> | null;
  createdBy?: Pick<User, "id" | "firstName" | "lastName"> | null;
  company?: Pick<Company, "id" | "name"> | null;
  contact?: Pick<Contact, "id" | "firstName" | "lastName"> | null;
  queue?: SupportQueue | null;
  messages?: TicketMessage[];
  events?: TicketEvent[];
  _count?: { messages: number };
};

export type SupportQueue = {
  id: string;
  name: string;
  description?: string | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationAfterMinutes: number;
  routingStrategy: "ROUND_ROBIN" | "LEAST_OPEN";
  businessHours?: {
    timezone?: string;
    weekdays?: Record<string, Array<[string, string]>>;
  } | null;
  holidays?: string[] | null;
  pauseStatuses?: Array<"OPEN" | "IN_PROGRESS" | "WAITING"> | null;
  escalationPolicy?: Array<{
    afterMinutes: number;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status?: "OPEN" | "IN_PROGRESS" | "WAITING";
  }> | null;
  active: boolean;
  _count?: { tickets: number };
};

export type TicketMessage = {
  id: string;
  body: string;
  public: boolean;
  inbound: boolean;
  authorName?: string | null;
  authorEmail?: string | null;
  createdAt: string;
  author?: Pick<User, "id" | "firstName" | "lastName"> | null;
};

export type TicketEvent = {
  id: string;
  type: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: Pick<User, "id" | "firstName" | "lastName"> | null;
};

export type SavedView = {
  id: string;
  resource: "CONTACTS" | "COMPANIES" | "LEADS" | "DEALS" | "TASKS" | "PRODUCTS" | "QUOTES" | "INVOICES" | "TICKETS";
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
};

export type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: Pick<User, "id" | "firstName" | "lastName">;
};

export type AuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
  actor?: Pick<User, "id" | "firstName" | "lastName" | "email"> | null;
};

export type Notification = {
  id: string;
  taskId?: string | null;
  type: "TASK_ASSIGNED" | "TASK_REMINDER" | "TASK_OVERDUE" | "TASK_COMPLETED";
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
  task?: Pick<Task, "id" | "title" | "status" | "dueAt"> | null;
};
