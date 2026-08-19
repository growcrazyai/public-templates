"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/api";

export function NoteForm() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { error } = await browserClient().POST("/api/notes", {
      body: { body },
      headers: { "x-requested-by": "web" },
    });
    if (error !== undefined) {
      setRefusal(error.title);
      return;
    }
    setBody("");
    setRefusal(undefined);
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Note body"
        required
      />
      <button type="submit">Add note</button>
      {refusal !== undefined ? <p role="alert">{refusal}</p> : null}
    </form>
  );
}
