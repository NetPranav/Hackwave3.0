import { SERVICES_STATUS_DATA, type EndpointStatus } from "@/lib/mock/status";

export interface EndpointRef {
  serviceSlug: string;
  serviceName: string;
  endpoint: EndpointStatus;
}

/** Every monitored endpoint, grouped by service in the same order as the Status page. */
export const ENDPOINTS: EndpointRef[] = SERVICES_STATUS_DATA.flatMap((svc) =>
  svc.endpoints.map((endpoint) => ({ serviceSlug: svc.slug, serviceName: svc.name, endpoint }))
);

export function findEndpoint(id: string | undefined): EndpointRef {
  return ENDPOINTS.find((e) => e.endpoint.id === id) ?? ENDPOINTS[0];
}
