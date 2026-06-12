const ADMIN_USERS = [
  {
    username: "admin1",
    password: "choir123"
  },
  {
    username: "admin2",
    password: "choir123"
  },
  {
    username: "admin3",
    password: "choir123"
  }
];

const loginSection =
  document.getElementById("loginSection");

const adminSection =
  document.getElementById("adminSection");

const loginError =
  document.getElementById("loginError");

const adminSongList =
  document.getElementById("adminSongList");

function login() {
  const username =
    document.getElementById("username").value.trim();

  const password =
    document.getElementById("password").value.trim();

  const validUser = ADMIN_USERS.find(
    user =>
      user.username === username &&
      user.password === password
  );

  if (!validUser) {
    loginError.textContent =
      "Invalid username or password.";
    return;
  }

  localStorage.setItem(
    "choirAdminLoggedIn",
    "true"
  );

  showAdmin();
}

function logout() {
  localStorage.removeItem(
    "choirAdminLoggedIn"
  );

  location.reload();
}

function showAdmin() {
  loginSection.classList.add("hidden");
  adminSection.classList.remove("hidden");

  loadAdminSongs();
}

function loadAdminSongs() {
  const songs =
    JSON.parse(
      localStorage.getItem("choirSongs")
    ) || [];

  if (!songs.length) {
    adminSongList.innerHTML =
      "<p>No draft songs found.</p>";
    return;
  }

  adminSongList.innerHTML = songs
    .map(
      (song, index) => `
      <div class="admin-song-card">

        <h3>${song.title}</h3>

        <p>${song.category}</p>

        <p>
          Files:
          ${(song.files || []).length}
        </p>

        <div class="card-actions">
          <button
            class="edit-btn"
            onclick="editSong(${index})">
            Edit
          </button>

          <button
            class="delete-btn"
            onclick="deleteSong(${index})">
            Delete
          </button>
        </div>

      </div>
    `
    )
    .join("");
}

async function saveSong() {
  const title =
    document.getElementById("songTitle").value.trim();

  const category =
    document.getElementById("songCategory").value;

  const lyrics =
    document.getElementById("songLyrics").value.trim();

  const filesInput =
    document.getElementById("songFiles");

  const files =
    Array.from(filesInput.files);

  const uploadedFiles = await Promise.all(
    files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();

        reader.onload = () => {
          resolve({
            id:
              crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()) + "-" + file.name,
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: reader.result
          });
        };

        reader.readAsDataURL(file);
      });
    })
  );

  const editIndex =
    document.getElementById("editIndex").value;

  if (!title) {
    alert("Song title is required.");
    return;
  }

  let songs =
    JSON.parse(
      localStorage.getItem("choirSongs")
    ) || [];

  let existingSong = null;
  let existingFiles = [];

  if (editIndex !== "") {
    existingSong = songs[editIndex];
    existingFiles = existingSong.files || [];
  }

  const allFiles = [
    ...existingFiles,
    ...uploadedFiles
  ];

  const song = {
    id:
      existingSong?.id ||
      (
        crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now())
      ),
    title,
    category,
    lyrics,
    files: allFiles,
    images: allFiles
      .filter(file =>
        file.type &&
        file.type.startsWith("image/")
      )
      .map(file => file.name),
    documents: allFiles
      .filter(file =>
        !(
          file.type &&
          file.type.startsWith("image/")
        )
      )
      .map(file => file.name)
  };

  if (editIndex !== "") {
    songs[editIndex] = song;
  } else {
    songs.push(song);
  }

  localStorage.setItem(
    "choirSongs",
    JSON.stringify(songs)
  );

  clearForm();
  loadAdminSongs();

  alert("Song saved as draft.");
}

function editSong(index) {
  const songs =
    JSON.parse(
      localStorage.getItem("choirSongs")
    ) || [];

  const song = songs[index];

  document.getElementById("editIndex").value =
    index;

  document.getElementById("songTitle").value =
    song.title || "";

  document.getElementById("songCategory").value =
    song.category || "Entrance";

  document.getElementById("songLyrics").value =
    song.lyrics || "";

  const existingFilesDiv =
    document.getElementById("existingFiles");

  existingFilesDiv.innerHTML = (song.files || [])
    .map(file => `
      <div>
        📎 ${file.name}
      </div>
    `)
    .join("");

  document.getElementById("formTitle").textContent =
    "Edit Song";
}

function deleteSong(index) {
  const confirmDelete = confirm(
    "Delete this draft song?"
  );

  if (!confirmDelete) return;

  let songs =
    JSON.parse(
      localStorage.getItem("choirSongs")
    ) || [];

  songs.splice(index, 1);

  localStorage.setItem(
    "choirSongs",
    JSON.stringify(songs)
  );

  clearForm();
  loadAdminSongs();
}

function clearForm() {
  document.getElementById("editIndex").value = "";

  document.getElementById("songTitle").value = "";

  document.getElementById("songCategory").value =
    "Entrance";

  document.getElementById("songLyrics").value = "";

  document.getElementById("songFiles").value = "";

  document.getElementById("existingFiles").innerHTML = "";

  document.getElementById("formTitle").textContent =
    "Add New Song";
}

async function publishSongs() {
  const songs =
    JSON.parse(
      localStorage.getItem("choirSongs")
    ) || [];

  if (!songs.length) {
    alert("No draft songs to publish.");
    return;
  }

  const confirmed = confirm(
    "Are you sure you want to publish all draft changes to the live website?"
  );

  if (!confirmed) return;

  alert("Publishing website. Please wait...");

  const response = await fetch(
    "/.netlify/functions/publishSongs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        songs
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    alert(
      result.message ||
      "Publish failed. Please try again."
    );
    return;
  }

  alert(
    "Website publish started successfully. Please wait a few minutes for Netlify to update."
  );
}

window.onload = () => {
  const isLoggedIn =
    localStorage.getItem(
      "choirAdminLoggedIn"
    );

  if (isLoggedIn === "true") {
    showAdmin();
  }
};