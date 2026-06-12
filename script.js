let songs = [];
let selectedCategory = "All";

const songList = document.getElementById("songList");
const songDetails = document.getElementById("songDetails");
const searchInput = document.getElementById("searchInput");
const categoryFilters = document.getElementById("categoryFilters");
const songCount = document.getElementById("songCount");

async function loadSongs() {
  try {
    const savedSongs = localStorage.getItem("choirSongs");

    if (savedSongs) {
      songs = JSON.parse(savedSongs);
    } else {
      const response = await fetch("data/songs.json");
      songs = await response.json();

      localStorage.setItem(
        "choirSongs",
        JSON.stringify(songs)
      );
    }

    renderCategories();
    renderSongs();
  } catch (error) {
    console.error(error);

    songList.innerHTML = `
      <div class="song-card">
        <h3>Error loading songs</h3>
      </div>
    `;
  }
}

function renderCategories() {
  const categories = [
    "All",
    ...new Set(songs.map(song => song.category))
  ];

  categoryFilters.innerHTML = categories
    .map(category => `
      <button
        class="category-btn ${
          category === selectedCategory ? "active" : ""
        }"
        onclick="selectCategory('${category}')"
      >
        ${category}
      </button>
    `)
    .join("");
}

function selectCategory(category) {
  selectedCategory = category;

  renderCategories();
  renderSongs();
}

function renderSongs() {
  const keyword = searchInput.value.toLowerCase();

  const filteredSongs = songs.filter(song => {
    const matchesCategory =
      selectedCategory === "All" ||
      song.category === selectedCategory;

    const matchesSearch =
      song.title.toLowerCase().includes(keyword) ||
      song.category.toLowerCase().includes(keyword) ||
      (song.lyrics || "").toLowerCase().includes(keyword);

    return matchesCategory && matchesSearch;
  });

  songCount.textContent = filteredSongs.length;

  if (!filteredSongs.length) {
    songList.innerHTML = `
      <div class="song-card">
        <h3>No songs found</h3>
      </div>
    `;
    return;
  }

  songList.innerHTML = filteredSongs
    .map(song => `
      <div class="song-card"
           onclick="showSong('${escapeQuotes(song.title)}')">

        <h3>${song.title}</h3>

        <div class="song-category">
          ${song.category}
        </div>

      </div>
    `)
    .join("");
}

function showSong(title) {
  const song = songs.find(
    x => x.title === title
  );

  if (!song) return;

  const imageFiles = (song.files || [])
  .filter(file =>
    file.type &&
    file.type.startsWith("image/")
  );

const documentFiles = (song.files || [])
  .filter(file =>
    !(
      file.type &&
      file.type.startsWith("image/")
    )
  );

  songDetails.innerHTML = `
    <h1 class="song-title">
      ${song.title}
    </h1>

    <div class="song-badge">
      ${song.category}
    </div>

    <div class="song-images">
  ${imageFiles.map(file => `
    <img
      src="${file.dataUrl}"
      alt="${file.name}"
      class="song-image"
    />
  `).join("")}
</div>

<div class="song-documents">
  ${documentFiles.map(file => `
    <a
      href="${file.dataUrl}"
      target="_blank"
      class="file-link"
    >
      📄 ${file.name}
    </a>
  `).join("")}
</div>

    <div class="song-lyrics">
      ${song.lyrics || ""}
    </div>
  `;
}

function escapeQuotes(text) {
  return text.replace(/'/g, "\\'");
}

searchInput.addEventListener(
  "input",
  renderSongs
);

loadSongs();