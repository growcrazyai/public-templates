import "server-only";
import { z } from "zod";

const schema = z.object({
  BACKEND_ORIGIN: z.string().url().default("http://127.0.0.1:8080"),
});

export const serverEnv = schema.parse({
  BACKEND_ORIGIN: process.env.BACKEND_ORIGIN,
});
