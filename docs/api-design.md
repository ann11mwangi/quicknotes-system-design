# QuickNotes API Design

This is the API the backend team should build for the real QuickNotes service (not JSONPlaceholder).

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** all requests and responses are JSON
- **Authentication:** a token sent in the header `Authorization: Bearer <token>` on every endpoint except register and login. Each user can only see and change their own notes.

## Endpoints

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/auth/register` | Create a new user account | 201 Created |
| POST | `/auth/login` | Log in and receive a token | 200 OK |
| GET | `/notes` | List the signed-in user's notes (supports `page`, `limit`, `tag` and `q` query parameters) | 200 OK |
| GET | `/notes/{id}` | Get one note | 200 OK |
| POST | `/notes` | Create a note | 201 Created |
| PUT | `/notes/{id}` | Update a note (title, body and tags) | 200 OK |
| DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| GET | `/tags` | List all available tags | 200 OK |

## Example: create a note

`POST /notes`

Request body:

```json
{
  "title": "Buy milk",
  "body": "And bread",
  "tags": ["personal"]
}
```

Response: `201 Created`, with the header `Location: /v1/notes/42`

```json
{
  "id": 42,
  "userId": 7,
  "title": "Buy milk",
  "body": "And bread",
  "tags": ["personal"],
  "createdAt": "2026-10-18T09:30:00Z",
  "updatedAt": "2026-10-18T09:30:00Z"
}
```

## Example: list notes

`GET /notes?page=1&limit=2`

Response: `200 OK`

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy milk",
      "body": "And bread",
      "tags": ["personal"],
      "createdAt": "2026-10-18T09:30:00Z"
    },
    {
      "id": 41,
      "title": "Finish report",
      "body": "Due Friday",
      "tags": ["work", "study"],
      "createdAt": "2026-10-17T14:05:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 2,
    "total": 57
  }
}
```

Notes are returned newest first.

## Error codes

| Status | Meaning | Example of when it happens |
|--------|---------|----------------------------|
| 400 Bad Request | The request is invalid | `POST /notes` with no `title`, or a title longer than 100 characters |
| 401 Unauthorized | The user is not logged in | The `Authorization` header is missing, or the token has expired |
| 403 Forbidden | The user is logged in but not allowed | User 7 tries to `DELETE /notes/50`, which belongs to user 9 |
| 404 Not Found | The resource does not exist | `GET /notes/9999` when no note has that id |
| 500 Internal Server Error | An unexpected failure on the server | The database is unreachable while saving a note |

### Example error body

Every error uses the same shape, so the client can handle them in one place.

`POST /notes` with an empty title returns `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer.",
    "details": [
      { "field": "title", "problem": "required" }
    ]
  }
}
```

Other examples:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Your session has expired. Please log in again." } }
```

```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have permission to change this note." } }
```

```json
{ "error": { "code": "NOT_FOUND", "message": "Note 9999 was not found." } }
```

```json
{ "error": { "code": "SERVER_ERROR", "message": "Something went wrong on our side. Please try again later." } }
```