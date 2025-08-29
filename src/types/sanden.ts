export interface Customer {
  customerId: string;
  companyName: string;
  email: string;
  phone: string;
  location: string;
}

export interface Product {
  productId: string;
  customerId: string;
  category: string;
  model: string;
  serialNumber: string;
  warrantyStatus: string;
}

export interface Repair {
  repairId: string;
  date: string;
  productId: string;
  customerId: string;
  problem: string;
  status: string;
  visitRequired: string;
  priority: string;
  assignedTo: string;
}

export interface Log {
  customerId: string;
  companyName: string;
  email: string;
  phone: string;
  location: string;
  productId?: string;
  productCategory?: string;
  model?: string;
  serialNumber?: string;
  warrantyStatus?: string;
  repairId?: string;
  date: string;
  problem?: string;
  status?: string;
  visitRequired?: string;
  priority?: string;
  assignedTo?: string;
  notes?: string;
  contactName?: string;
  preferredDate?: string;
  machine?: string;
}
