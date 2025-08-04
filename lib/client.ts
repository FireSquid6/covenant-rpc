import type { RouteDeclaration } from ".";

export function httpClient<T extends Record<string, RouteDeclaration<any, any>>>(url: string, schema: T) {

}
