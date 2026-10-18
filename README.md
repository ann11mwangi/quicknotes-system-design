# QuickNotes System Design

This project has two parts. The first is a small web client that talks to the JSONPlaceholder practice API to load, create and delete notes. The second is a set of design documents for the real QuickNotes backend, which is planned to serve 1 million users: the REST API, the database model and the system architecture.

## Features

- Load 10 notes from the API with a GET request
- Create a note with a POST request, with validation (a title is required, 100 characters maximum)
- Delete a note with a DELETE request
- Loading, success, error and empty states shown on the page
- Buttons disabled while a request is running
- User text added to the page with `textContent` only

## How to run the API client

1. Clone the repository: `git clone https://github.com/YOUR-USERNAME/quicknotes-system-design.git`
2. Open the `quicknotes-system-design` folder.
3. Open `index.html` in your browser (or use the Live Server extension in VS Code). You need an internet connection because the client calls the JSONPlaceholder API.
4. Click **Load notes**, add a note with the form and use the **Delete** buttons.

JSONPlaceholder is a practice API, so notes you create or delete are not really saved on the server.

## Design documents

- [API design](docs/api-design.md): endpoints, request and response examples and error codes
- [Data model](docs/data-model.md): tables, relationships, SQL, indexes and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, load estimates, diagram, request flows and trade-offs

## What I learned

- How to write one reusable `request()` function that checks `response.ok` and throws errors, so GET, POST and DELETE all handle problems the same way.
- How to show loading, success, error and empty states, and disable buttons during requests, so users always know what is happening.
- How to design a REST API with the right methods, status codes and error bodies.
- How a join table solves a many-to-many relationship, and why an index on `(user_id, created_at)` speeds up the most common query.
- How a CDN, load balancer, cache, read replica and queue work together, and how to remove single points of failure.