const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_BYTES = 64 * 1024;

export async function prepareCompanyLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG or WebP image.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("Choose an image smaller than 5 MB.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Choose another image.");
  }
  try {
    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image preparation is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const logo = canvas.toDataURL("image/webp", 0.85);
    const encoded = logo.split(",")[1] ?? "";
    if (!encoded || atob(encoded).length > MAX_LOGO_BYTES)
      throw new Error("This image is too detailed. Choose a simpler image.");
    return logo;
  } finally {
    image.close();
  }
}
