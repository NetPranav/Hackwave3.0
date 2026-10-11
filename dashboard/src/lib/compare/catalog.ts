import type { EndpointStatus, ServiceStatusItem } from "@/lib/mock/status";

export interface EndpointRef {
  serviceSlug: string;
  serviceName: string;
  endpoint: EndpointStatus;
}

/** Every monitored endpoint, grouped by service in the same order as the Status page. */
export function endpointsOf(services: ServiceStatusItem[]): EndpointRef[] {
  return services.flatMap((svc) => svc.endpoints.map((endpoint) => ({ serviceSlug: svc.slug, serviceName: svc.name, endpoint })));
}

/** The endpoint with this id, else the first one; undefined only when nothing is monitored yet. */
export function findEndpoint(list: EndpointRef[], id: string | undefined): EndpointRef | undefined {
  return list.find((e) => e.endpoint.id === id) ?? list[0];
}
