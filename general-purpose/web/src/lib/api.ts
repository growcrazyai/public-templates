import createClient from "openapi-fetch";
import type { paths } from "@/generated/api";

export function browserClient() {
  return createClient<paths>({ baseUrl: "/" });
}
