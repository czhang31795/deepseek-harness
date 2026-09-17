import type { RequestContext } from '../../common/types/request-context';
import type { OrderView } from '../../domain/order';

export interface FindOrderQuery {
  orderNo: string;
  ctx: RequestContext;
}

export interface OrderPort {
  readonly systemId: string;
  findByOrderNo(query: FindOrderQuery): Promise<OrderView | null>;
}

export const ORDER_PORTS = Symbol('ORDER_PORTS');
