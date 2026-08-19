import "server-only";
import createClient from "openapi-fetch";
import { cookies } from "next/headers";
import type { paths } from "@/generated/api";
import { serverEnv } from "@/env/server";

export async function serverClient() {
  const jar = await cookies();
  return createClient<paths>({
    baseUrl: serverEnv.BACKEND_ORIGIN,
    headers: { cookie: jar.toString() },
  });
}
