export const futureCapabilities = ["text_to_image", "text_to_music", "text_to_video"];

export function getMultimodalPlaceholder() {
  return {
    enabled: false,
    status: "placeholder",
    message:
      "Hydria V1 does not include image, music, or video providers yet. The adapter slot is reserved for V2."
  };
}

