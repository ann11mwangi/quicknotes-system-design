# QuickNotes Data Model

## Entities

### users
| Column | Type | Key / rules |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL (never store the plain password) |
| created_at | TIMESTAMP | NOT NULL, defaults to now |

### notes
| Column | Type | Key / rules |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users.id`, NOT NULL |
| title | VARCHAR(100) | NOT NULL, 1 to 100 characters |
| body | TEXT | Optional |
| created_at | TIMESTAMP | NOT NULL, defaults to now |
| updated_at | TIMESTAMP | NOT NULL, defaults to now |

### tags
| Column | Type | Key / rules |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | VARCHAR(50) | NOT NULL, UNIQUE |

### note_tags (join table)
| Column | Type | Key / rules |
|--------|------|-------------|
| note_id | INTEGER | Foreign key to `notes.id`; part of the primary key |
| tag_id | INTEGER | Foreign key to `tags.id`; part of the primary key |

The primary key of `note_tags` is the pair `(note_id, tag_id)`, so the same tag cannot be attached to the same note twice.

## Relationships

- **users to notes is one-to-many.** One user can write many notes, but each note belongs to exactly one user. This is why `notes` has a `user_id` foreign key.
- **notes to tags is many-to-many.** One note can have many tags (a note can be both "work" and "study"), and one tag can be used on many notes. A relational column can only hold one value, so we cannot store a list of tags inside a note. The join table `note_tags` solves this by storing one row for each note and tag pair. It turns one many-to-many relationship into two one-to-many relationships.

## CREATE TABLE statements

The SQL below runs in SQLite. (In PostgreSQL, use `BIGSERIAL PRIMARY KEY` for ids and `TIMESTAMPTZ` for the dates.)

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      VARCHAR(100) NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body       TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

## Example queries

**1. The 10 newest notes for one user** (this is what `GET /notes` runs):

```sql
SELECT id, title, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;
```

**2. All of a user's notes with a given tag** (uses a JOIN across the join table):

```sql
SELECT n.id, n.title, t.name AS tag
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t ON t.id = nt.tag_id
WHERE n.user_id = 1 AND t.name = 'study'
ORDER BY n.created_at DESC;
```

**3. How many notes each tag has** (LEFT JOIN keeps tags with zero notes):

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
GROUP BY t.id, t.name
ORDER BY note_count DESC;
```

**4. Search a user's notes by title:**

```sql
SELECT id, title
FROM notes
WHERE user_id = 1 AND title LIKE '%report%';
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);
```

- **`idx_notes_user_created`** is the most important one. Almost every request asks for "this user's newest notes". With this index the database jumps straight to one user's notes already sorted by date, instead of scanning every note in the system, which matters with hundreds of millions of rows.
- **`idx_note_tags_tag`** helps when we start from a tag and look for its notes. The primary key `(note_id, tag_id)` already speeds up searches that start from a note, but not ones that start from a tag.

Indexes make reads faster but slow down writes slightly and use extra storage, so only the indexes that match real queries are added.

## SQL or NoSQL?

I would choose **SQL** (for example PostgreSQL) for QuickNotes. The data is clearly structured and connected: users own notes, and notes and tags link to each other many-to-many. A relational database enforces the rules for us, such as unique emails, a note always pointing to a real user, and no duplicate tags on a note, and it answers questions like "all notes with this tag" easily with joins. It also gives transactions, so creating a note and its tags either fully succeeds or fully fails. NoSQL would be a better fit if our data had no fixed shape or needed to be spread across many servers from day one, but at 1 million users a single SQL primary with a read replica can cope, and we can scale further later.