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
  organization?: { name: string; slug: string };
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
  nextStep?: string | null;
  expectedCloseAt?: string | null;
  company?: Pick<Company, "id" | "name"> | null;
  primaryContact?: Pick<Contact, "id" | "firstName" | "lastName"> | null;
  owner?: Pick<User, "id" | "firstName" | "lastName"> | null;
  stage?: Stage;
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

export type SavedView = {
  id: string;
  resource: "CONTACTS" | "COMPANIES" | "LEADS" | "DEALS" | "TASKS" | "PRODUCTS" | "QUOTES" | "INVOICES";
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
