import { Suspense } from "react";
import { NoteForm } from "@/components/note-form";
import { serverClient } from "@/lib/api-server";

async function NoteList() {
  const client = await serverClient();
  const { data, error } = await client.GET("/api/notes");
  if (error !== undefined) {
    return <p>The note store is not reachable.</p>;
  }
  return (
    <ul>
      {data.map((note) => (
        <li key={note.id}>{note.body}</li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main>
      <h1>Notes</h1>
      <NoteForm />
      <Suspense fallback={<p>Loading notes…</p>}>
        <NoteList />
      </Suspense>
    </main>
  );
}
