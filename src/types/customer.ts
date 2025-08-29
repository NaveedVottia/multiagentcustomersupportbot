export interface Customer {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustomerSearchParams {
  customerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CustomerCreateParams {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface CustomerUpdateParams {
  customerId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}
