// QuickNotes API client (talks to the JSONPlaceholder practice API)

const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");
const notesList = document.querySelector("#notes-list");

const MAX_TITLE_LENGTH = 100;

// The notes currently shown on the page
let notes = [];
let localCounter = 0;

// ---------- Helpers ----------

// Shows a message in #status. type is "loading", "success" or "error".
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type ? `status-${type}` : "";
}

// Reusable request function: calls fetch, checks response.ok, throws on errors
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  // DELETE responses can have an empty body, so read it as text first
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { status: response.status, data };
}

// Draws the notes array on the page (user text is added with textContent only)
function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-message";
    empty.textContent = 'No notes to show yet. Click "Load notes" or add one above.';
    notesList.append(empty);
    return;
  }

  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "note-card";

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body || "(no body)";

    const footer = document.createElement("div");
    footer.className = "note-footer";

    const idLabel = document.createElement("small");
    idLabel.textContent = `id: ${note.id}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteNote(note, deleteBtn);
    });

    footer.append(idLabel, deleteBtn);
    li.append(title, body, footer);
    notesList.append(li);
  }
}

// ---------- GET: load 10 notes ----------

async function loadNotes() {
  loadBtn.disabled = true;
  setStatus("Loading notes...", "loading");

  try {
    const { data } = await request(`${API_URL}?_limit=10`);

    // Loading replaces whatever is on the page with what the server holds
    notes = data.map(item => ({
      key: `server-${item.id}`,
      id: item.id,
      title: item.title,
      body: item.body,
      isLocal: false,
    }));

    renderNotes();
    setStatus(`Loaded ${notes.length} notes from the server.`, "success");
  } catch (error) {
    setStatus(
      `Sorry, we could not load your notes. Please try again. (${error.message})`,
      "error"
    );
  } finally {
    loadBtn.disabled = false;
  }
}

// ---------- POST: create a note ----------

async function createNote(title, body) {
  submitBtn.disabled = true;
  setStatus("Saving note...", "loading");

  try {
    const { status, data } = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, body: body, userId: 1 }),
    });

    // JSONPlaceholder returns id 101 for every new note, so we also give each
    // note its own key to tell notes apart on the page.
    localCounter += 1;
    notes.unshift({
      key: `local-${localCounter}`,
      id: data.id,
      title: data.title,
      body: data.body,
      isLocal: true,
    });

    renderNotes();
    form.reset();
    setStatus(`Note created (status ${status}, id ${data.id}).`, "success");
  } catch (error) {
    setStatus(
      `Sorry, we could not save your note. Please try again. (${error.message})`,
      "error"
    );
  } finally {
    submitBtn.disabled = false;
  }
}

// ---------- DELETE: remove a note ----------

/*
  How deleting works with JSONPlaceholder:
  JSONPlaceholder is a practice API. It pretends to accept POST requests and
  returns a fake id (101), but it never stores the new note. So a note created
  on this page does not exist on the server, and sending DELETE /posts/101
  would not be meaningful. My approach:
  - Notes loaded from the server (isLocal false) are removed with a real
    DELETE /posts/{id} request. The server replies with success, but the note
    comes back when "Load notes" is clicked again, because nothing is really
    deleted there.
  - Notes created on this page (isLocal true) were never stored, so they are
    removed from the page only, with no request.
*/
async function deleteNote(note, button) {
  button.disabled = true;
  setStatus("Deleting note...", "loading");

  try {
    if (note.isLocal) {
      notes = notes.filter(item => item.key !== note.key);
      renderNotes();
      setStatus("Note removed. It was only on this page, so no server request was needed.", "success");
      return;
    }

    const { status } = await request(`${API_URL}/${note.id}`, {
      method: "DELETE",
    });

    notes = notes.filter(item => item.key !== note.key);
    renderNotes();
    setStatus(`Note deleted (status ${status}).`, "success");
  } catch (error) {
    button.disabled = false;
    setStatus(
      `Sorry, we could not delete the note. Please try again. (${error.message})`,
      "error"
    );
  }
}

// ---------- Form validation and events ----------

form.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("Please enter a title for your note.", "error");
    return;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    setStatus(`The title must be ${MAX_TITLE_LENGTH} characters or fewer.`, "error");
    return;
  }

  createNote(title, body);
});

loadBtn.addEventListener("click", loadNotes);

// Show the empty state when the page first opens
renderNotes();