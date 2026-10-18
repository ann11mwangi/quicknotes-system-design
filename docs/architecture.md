# QuickNotes Architecture

## 1. Requirements

### Functional requirements
- Users can register and log in.
- Users can create, view, edit and delete their own notes (title up to 100 characters, optional body).
- Users can tag notes and filter their notes by tag.
- Users can list their notes, newest first, with paging.
- Users can search their notes by title.
- Background jobs can run without slowing down requests (for example search indexing and reminder emails).

### Non-functional requirements
- **Scalability:** support 1 million users, and grow beyond that by adding servers.
- **Availability:** target 99.9% uptime, with no single point of failure.
- **Performance:** listing notes should take under 200 ms for 95% of requests.
- **Durability:** a saved note must never be lost (backups and replication).
- **Security:** HTTPS everywhere, passwords stored as hashes, and users can only access their own notes.
- **Maintainability:** logging and monitoring so problems are found quickly.

## 2. Load estimate for 1 million users

### Assumptions
- 1,000,000 registered users, of whom **30% are active each day: 300,000 daily active users**.
- Each active user makes **20 read requests a day** (opening the list, viewing and searching notes).
- Each active user makes **5 write requests a day** (creating, editing or deleting notes).
- To keep it simple and cautious, every write is counted as a new note.
- An average note takes about **1 KB**, and indexes and overhead roughly double that.
- One day has 86,400 seconds, and peak traffic is **5×** the average.

### Results

| Measure | Working | Result |
|---|---|---|
| Reads per day | 300,000 × 20 | 6,000,000 |
| **Reads per second** | 6,000,000 / 86,400 | **about 69 average, about 347 at peak** |
| Writes per day | 300,000 × 5 | 1,500,000 |
| **Writes per second** | 1,500,000 / 86,400 | **about 17 average, about 87 at peak** |
| New notes per year | 1,500,000 × 365 | about 547.5 million |
| **Storage per year** | 547.5 million × 1 KB | **about 548 GB raw, about 1.1 TB with indexes and overhead** |

The system is **read-heavy**, with about 4 reads for every write. That is why the design uses a cache and a read replica. These numbers are small enough for a single primary database to handle all writes.

## 3. Architecture diagram

```
                 +-------------------+
                 |  Client (browser) |
                 +---------+---------+
                           |
                           v
                    +-------------+
                    |     DNS     |  (turns quicknotes.example into server addresses)
                    +------+------+
                           |
              +------------+------------+
              |                         |
 static files |                         | API calls
              v                         v
        +-----------+          +-----------------+
        |    CDN    |          |  Load Balancer  |
        +-----------+          +--------+--------+
                                        |
                           +------------+------------+
                           |            |            |
                           v            v            v
                      +---------+  +---------+  +---------+
                      |   App   |  |   App   |  |   App   |
                      | Server 1|  | Server 2|  | Server 3|
                      +----+----+  +----+----+  +----+----+
                           |            |            |
                           +------------+------------+
                                        |
                           +------------+------------+
                           |            |            |
                           v            v            v
                      +---------+  +---------+  +---------+
                      |  Cache  |  | Primary |  |  Queue  |
                      | (Redis) |  |   DB    |  +----+----+
                      +---------+  +----+----+       |
                                        |            v
                                        v      +-----------+
                                   +---------+ |  Worker   |
                                   |  Read   | +-----------+
                                   | Replica |
                                   +---------+
```

How to read the diagram:
- The CDN serves the static files (HTML, CSS and JavaScript). API calls go through the load balancer to the app servers.
- The app servers send **writes** to the primary database, and check the cache first for **reads**, then the read replica.
- The primary database copies every change to the read replica ("replication").
- The app servers put background jobs on the queue, and the worker takes them off.

## 4. What each component does

- **Client:** it gives users the app in their browser or phone and sends their requests to the API.
- **DNS:** it solves the problem of users needing a server's number address by turning the name quicknotes.example into the right IP address.
- **CDN:** it solves slow loading of static files for faraway users by serving copies from servers close to them, which also takes load off our own servers.
- **Load balancer:** it solves the problem of one server being overwhelmed or failing by spreading requests across several app servers and skipping any that are down.
- **App servers (2 or more):** they run the API logic (login, validation, notes), and because they store no user data we can simply add more of them as traffic grows.
- **Cache:** it solves repeated slow database reads by keeping recently used results, such as a user's first page of notes, in fast memory.
- **Primary database:** it solves the need for one reliable source of truth by storing all users, notes and tags, and it handles every write.
- **Read replica:** it solves read overload on the primary database by serving a copy of the data to read queries.
- **Queue:** it solves slow responses by letting the app server hand off slow work and reply to the user immediately.
- **Worker:** it solves the problem of slow background jobs by processing queued tasks, such as search indexing and reminder emails, separately from user requests.

## 5. Request flows

### GET /notes
1. The client sends `GET /v1/notes?limit=10` with its token to `api.quicknotes.example`.
2. **DNS** turns that name into the load balancer's address.
3. The **load balancer** sends the request to a healthy app server.
4. The app server checks the token. If it is missing or expired, it returns **401**.
5. It looks in the **cache** for this user's first page of notes.
6. **Cache hit:** the app server returns the cached notes (go to step 9).
7. **Cache miss:** the app server asks the **read replica** for the user's 10 newest notes.
8. The app server saves the result in the cache with a short expiry (for example 60 seconds).
9. The app server returns **200 OK** with the notes as JSON.

### POST /notes
1. The client sends `POST /v1/notes` with its token and the note as JSON.
2. **DNS** and the **load balancer** route the request to an app server, as above.
3. The app server checks the token (**401** if invalid).
4. It validates the data: a title is required and must be 100 characters or fewer (**400** if not).
5. It saves the note, and its tags, in the **primary database** in one transaction.
6. It clears this user's cached note lists so the next read shows the new note.
7. It puts a background job on the **queue** (for example "index this note for search").
8. It returns **201 Created** with the new note as JSON.
9. Later, a **worker** takes the job from the queue and completes it. If it fails, the job is retried.

## 6. Trade-offs

1. **Cache: speed vs fresh data.** The cache makes reads fast and protects the database, but data in it can be slightly out of date. We clear the user's cached lists after each write and use a short expiry, so the delay is small, and we accept it because a note list that is a few seconds old is not a problem.
2. **Read replica: scale vs consistency.** The replica lets us handle many more reads, but it can lag behind the primary by a moment, so a user might save a note and not see it straight away. We can reduce this by reading a user's own latest notes from the primary right after they write.
3. **Queue and worker: fast responses vs eventual results.** Users get a quick reply, but background results like search indexing appear a little later. It also adds more parts to run and monitor.
4. **Single primary database: simplicity vs write scaling.** With one primary, data stays consistent and the design stays simple, but all writes go to one machine. At about 87 writes per second at peak that is fine, and if it ever becomes a limit we can use a bigger machine or split users across several databases (sharding).

## 7. Avoiding single points of failure

- **DNS:** use a provider with several name servers in different places.
- **CDN:** a managed CDN already runs from many locations worldwide.
- **Load balancer:** use a managed load balancer across several zones, or a pair where one takes over if the other fails.
- **App servers:** run at least 3 in different zones. They store no data, so if one fails the load balancer stops sending it traffic and the others carry on.
- **Cache:** use a replicated cache with automatic failover. If the cache is down, the app servers read from the database instead (slower, but working).
- **Primary database:** keep a standby copy that takes over automatically if the primary fails, take regular backups, and the read replica can be promoted to primary if needed.
- **Queue:** use a replicated queue that stores messages safely, so no jobs are lost if one machine fails.
- **Worker:** run several workers and make jobs safe to repeat, so a failed job can simply be retried by another worker.
- **Zones:** spread everything across at least two availability zones, so one data centre problem does not stop the service.