import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  requestId: string;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export const getRequestContext = () => {
  return requestContext.getStore() || {};
};
