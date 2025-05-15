import React, { useState, useEffect } from "react";
import "./App.css";
import "@aws-amplify/ui-react/styles.css";
import { generateClient } from "aws-amplify/api";
import { uploadData, getUrl, remove } from "@aws-amplify/storage";
import {
  Button,
  Flex,
  Heading,
  Text,
  TextField,
  View,
  withAuthenticator,
  Image,
} from "@aws-amplify/ui-react";

import { listNotes } from "./graphql/queries";
import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from "./graphql/mutations";

const client = generateClient();

const App = ({ signOut }) => {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    const apiData = await client.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;

    await Promise.all(
      notesFromAPI.map(async (note) => {
        if (note.image) {
          const { url } = await getUrl({ key: note.image });
          note.image = url.href;
        }
        return note;
      })
    );

    setNotes(notesFromAPI);
  }

async function createNote(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const image = form.get("image");

  const data = {
    name: form.get("name"),
    description: form.get("description"),
  };

  if (image && image.name) {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;
    if (!validTypes.includes(image.type) || image.size > maxSize) {
      alert("無効な画像ファイルです。");
      return;
    }

    const key = `public/${Date.now()}_${image.name}`;
    await uploadData({ key, data: image });
    data.image = key;
  }

  await client.graphql({
    query: createNoteMutation,
    variables: { input: data },
  });

  fetchNotes();
  event.target.reset();
}

async function deleteNote({ id, image }) {
  const newNotes = notes.filter((note) => note.id !== id);
  setNotes(newNotes);

  // 正しいキーを URL から復元
  const s3Key = image?.includes("amazonaws.com/")
    ? decodeURIComponent(image.split(".amazonaws.com/")[1].split("?")[0])
    : null;

  if (s3Key && s3Key.length < 1024) {
    try {
      await remove({ key: s3Key });
    } catch (err) {
      console.warn("S3からの削除失敗:", err);
    }
  }

  await client.graphql({
    query: deleteNoteMutation,
    variables: { input: { id } },
  });
}


  return (
    <View className="App">
      <Heading level={1}>My Notes App</Heading>
<View as="form" margin="3rem 0" onSubmit={createNote} style={{ position: "relative" }}>
  {/* Sign Outボタンはフォーム内の絶対位置 */}
  <Button
    onClick={signOut}
    variation="link"
    style={{
      position: "absolute",
      top: 0,
      right: 0,
      padding: "0.5rem 1rem",
      zIndex: 10,
    }}
  >
    Sign Out
  </Button>

  <Flex direction="row" justifyContent="center" gap="1rem" alignItems="center">
    <TextField
      name="name"
      placeholder="Note Name"
      label="Note Name"
      labelHidden
      variation="quiet"
      required
    />
    <TextField
      name="description"
      placeholder="Note Description"
      label="Note Description"
      labelHidden
      variation="quiet"
      required
    />
    <Button type="submit" variation="primary">
      Create Note
    </Button>
  </Flex>

  {/* 画像アップロードは中央に */}
  <Flex
    direction="row"
    justifyContent="center"
    alignItems="center"
    marginTop="1rem"
  >
    <View as="input" name="image" type="file" />
  </Flex>
</View>
      <Heading level={2}>Current Notes</Heading>
      <View margin="3rem 0">
        {notes.map((note) => (
          <Flex
            key={note.id}
            direction="row"
            justifyContent="center"
            alignItems="center"
          >
            <Text as="strong" fontWeight={700}>
              {note.name}
            </Text>
            <Text as="span">{note.description}</Text>
            {note.image && (
              <Image
                src={note.image}
                alt={`visual aid for ${note.name}`}
                style={{ width: 400 }}
              />
            )}
            <Button variation="link" onClick={() => deleteNote(note)}>
              Delete note
            </Button>
          </Flex>
        ))}
      </View>
    </View>
  );
};

export default withAuthenticator(App);

