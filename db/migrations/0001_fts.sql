-- Full-text search over title / story / tags (PLAN.md §3, §5).
-- Drizzle cannot model virtual tables, so this migration is hand-written.
--
-- Verified before adopting: FTS5's default unicode61 tokenizer handles Hebrew
-- correctly — word, prefix (ציי*) and phrase ("רובע האמנים") matches all work.
--
-- The table is kept in sync by triggers rather than by application code, so a
-- write path that forgets to reindex cannot silently break search. Rows are
-- indexed regardless of status; the query joins back to paintings and filters
-- to 'published' there, so admin search can see drafts.

CREATE VIRTUAL TABLE paintings_fts USING fts5(
  title,
  story,
  tags_text
);
--> statement-breakpoint

-- Denormalised tag string for a painting, e.g. "נוף שמן שנות ה־90".
CREATE TRIGGER paintings_fts_ai AFTER INSERT ON paintings BEGIN
  INSERT INTO paintings_fts(rowid, title, story, tags_text)
  VALUES (
    new.id,
    new.title,
    COALESCE(new.story, ''),
    COALESCE((SELECT group_concat(t.name, ' ')
              FROM painting_tags pt JOIN tags t ON t.id = pt.tag_id
              WHERE pt.painting_id = new.id), '')
  );
END;
--> statement-breakpoint

CREATE TRIGGER paintings_fts_ad AFTER DELETE ON paintings BEGIN
  DELETE FROM paintings_fts WHERE rowid = old.id;
END;
--> statement-breakpoint

CREATE TRIGGER paintings_fts_au AFTER UPDATE OF title, story ON paintings BEGIN
  UPDATE paintings_fts
  SET title = new.title, story = COALESCE(new.story, '')
  WHERE rowid = new.id;
END;
--> statement-breakpoint

-- Tag membership changes must refresh the denormalised tags_text.
CREATE TRIGGER painting_tags_fts_ai AFTER INSERT ON painting_tags BEGIN
  UPDATE paintings_fts
  SET tags_text = COALESCE((SELECT group_concat(t.name, ' ')
                            FROM painting_tags pt JOIN tags t ON t.id = pt.tag_id
                            WHERE pt.painting_id = new.painting_id), '')
  WHERE rowid = new.painting_id;
END;
--> statement-breakpoint

CREATE TRIGGER painting_tags_fts_ad AFTER DELETE ON painting_tags BEGIN
  UPDATE paintings_fts
  SET tags_text = COALESCE((SELECT group_concat(t.name, ' ')
                            FROM painting_tags pt JOIN tags t ON t.id = pt.tag_id
                            WHERE pt.painting_id = old.painting_id), '')
  WHERE rowid = old.painting_id;
END;
--> statement-breakpoint

-- Renaming a tag must propagate to every painting carrying it.
CREATE TRIGGER tags_fts_au AFTER UPDATE OF name ON tags BEGIN
  UPDATE paintings_fts
  SET tags_text = COALESCE((SELECT group_concat(t.name, ' ')
                            FROM painting_tags pt JOIN tags t ON t.id = pt.tag_id
                            WHERE pt.painting_id = paintings_fts.rowid), '')
  WHERE rowid IN (SELECT painting_id FROM painting_tags WHERE tag_id = new.id);
END;
