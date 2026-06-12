const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const branch = "main";

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function cleanFileName(name) {
  const fallback = `file-${Date.now()}`;

  return (name || fallback)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function cleanFolderName(text) {
  return text
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

function getBase64FromDataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.includes(",")) return "";
  return dataUrl.split(",")[1];
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "GitHub API request failed.");
  }

  return data;
}

async function createBlob(content, encoding = "base64") {
  return githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        encoding
      })
    }
  );
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, {
        message: "Method not allowed."
      });
    }

    if (!owner || !repo || !token) {
      return jsonResponse(500, {
        message: "Missing GitHub environment variables."
      });
    }

    const payload = JSON.parse(event.body || "{}");
    const draftSongs = payload.songs || [];

    if (!Array.isArray(draftSongs)) {
      return jsonResponse(400, {
        message: "Invalid songs payload."
      });
    }

    const refData = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`
    );

    const latestCommitSha = refData.object.sha;

    const latestCommit = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`
    );

    const baseTreeSha = latestCommit.tree.sha;

    const treeItems = [];
    const publishedSongs = [];

    for (const song of draftSongs) {
      const songId =
        song.id || cleanFolderName(song.title || "untitled-song");

      const folderName =
        `${songId}-${cleanFolderName(song.title || "song")}`;

      const publishedFiles = [];

      for (const file of song.files || []) {


       if (file.size && file.size > 5 * 1024 * 1024) {
       throw new Error(
       `${file.name} is too large. Maximum file size is 5MB.`
         );
         }


        if (file.url && !file.dataUrl) {
          publishedFiles.push(file);
          continue;
        }

        const safeFileName = cleanFileName(file.name || "file");
        const filePath =
          `assets/uploads/${folderName}/${safeFileName}`;

        const base64Content = getBase64FromDataUrl(file.dataUrl);

        if (!base64Content) continue;

        const blob = await createBlob(base64Content, "base64");

        treeItems.push({
          path: filePath,
          mode: "100644",
          type: "blob",
          sha: blob.sha
        });

          publishedFiles.push({
          id: file.id,
          name: safeFileName,
          type: file.type,
          size: file.size,
          url: `/${filePath}`
         });
      }

      publishedSongs.push({
        id: song.id || songId,
        title: song.title || "",
        category: song.category || "Others",
        lyrics: song.lyrics || "",
        files: publishedFiles,
        images: publishedFiles
          .filter(file => file.type && file.type.startsWith("image/"))
          .map(file => file.name),
        documents: publishedFiles
          .filter(file => !(file.type && file.type.startsWith("image/")))
          .map(file => file.name)
      });
    }

    const songsJson = JSON.stringify(publishedSongs, null, 2);

    const songsBlob = await createBlob(
      Buffer.from(songsJson).toString("base64"),
      "base64"
    );

    treeItems.push({
      path: "data/songs.json",
      mode: "100644",
      type: "blob",
      sha: songsBlob.sha
    });

    const newTree = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeItems
        })
      }
    );

    const newCommit = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Publish choir song library updates",
          tree: newTree.sha,
          parents: [latestCommitSha]
        })
      }
    );

    await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sha: newCommit.sha,
          force: false
        })
      }
    );

    return jsonResponse(200, {
      message: "Publish completed.",
      songsCount: publishedSongs.length,
      commit: newCommit.sha
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      message: error.message || "Publish failed."
    });
  }
};