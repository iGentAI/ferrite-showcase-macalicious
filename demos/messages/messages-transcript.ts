import type { MessagesConversation } from "./messages-data";

/** A conversation as lines of text, for Save Transcript and Print: who said what, in order. */
export function transcriptLines(conversation: MessagesConversation): readonly string[] {
  const title = conversation.name.trim() || "New Message";
  return [
    title,
    ...conversation.messages.flatMap((message) => {
      const who = message.from === "me" ? "Me" : (message.sender ?? title);
      return ["", `${who}:`, ...message.text.split("\n")];
    }),
  ];
}

/** The transcript as a text file the browser downloads, named after the conversation. */
export function saveTranscript(conversation: MessagesConversation): void {
  const name = conversation.name.trim().replace(/[/\\:]/g, "-") || "Messages";
  const url = URL.createObjectURL(
    new Blob([transcriptLines(conversation).join("\n")], { type: "text/plain" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
