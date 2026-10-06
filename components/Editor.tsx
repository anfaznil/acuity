"use client";

import { uid, updateSet, useStore } from "@/lib/store";
import { go } from "./App";
import SetForm from "./SetForm";

export default function Editor({ id }: { id: string }) {
  const s = useStore((st) => st.sets.find((x) => x.id === id));
  if (!s) return <div className="empty mt-32">Set not found.</div>;
  return (
    <div className="mt-32">
      <SetForm
        initial={{ title: s.title, description: s.description, emoji: s.emoji, color: s.color, cards: s.cards.map((c) => ({ id: c.id, term: c.term, definition: c.definition })) }}
        saveLabel="Save changes"
        onCancel={() => go(`/set/${id}`)}
        banner={<h1>Edit set</h1>}
        onSave={(d) => {
          const byId = new Map(s.cards.map((c) => [c.id, c]));
          updateSet(id, {
            title: d.title,
            description: d.description,
            emoji: d.emoji,
            color: d.color ?? s.color,
            cards: d.cards.map((c) => {
              const prev = c.id ? byId.get(c.id) : undefined;
              if (prev) {
                const changed = prev.term !== c.term || prev.definition !== c.definition;
                return { ...prev, term: c.term, definition: c.definition, mastery: changed ? 0 : prev.mastery };
              }
              return { id: uid(), term: c.term, definition: c.definition, mastery: 0, correct: 0, wrong: 0 };
            }),
          });
          go(`/set/${id}`);
        }}
      />
    </div>
  );
}
