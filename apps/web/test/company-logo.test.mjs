import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareCompanyLogo } from "../lib/company-logo.ts";

test("company logo rejects unsupported and oversized files before decoding", async () => {
  await assert.rejects(
    prepareCompanyLogo({ type: "image/svg+xml", size: 100 }),
    /PNG, JPEG or WebP/,
  );
  await assert.rejects(
    prepareCompanyLogo({ type: "image/png", size: 6 * 1024 * 1024 }),
    /smaller than 5 MB/,
  );
});

test("company logo resizes proportionally, bounds output, and releases decoded images", async () => {
  const originalBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  let closed = 0,
    drawn = 0;
  const image = {
    width: 1000,
    height: 500,
    close() {
      closed++;
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage(value) {
        assert.equal(value, image);
        drawn++;
      },
    }),
    toDataURL: () => "data:image/webp;base64,YWJj",
  };
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => image,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(tag) {
        assert.equal(tag, "canvas");
        return canvas;
      },
    },
  });
  try {
    assert.equal(
      await prepareCompanyLogo({ type: "image/png", size: 1024 }),
      "data:image/webp;base64,YWJj",
    );
    assert.equal(canvas.width, 256);
    assert.equal(canvas.height, 128);
    assert.equal(drawn, 1);
    assert.equal(closed, 1);
    canvas.toDataURL = () => `data:image/png;base64,${"A".repeat(90000)}`;
    await assert.rejects(
      prepareCompanyLogo({ type: "image/png", size: 1024 }),
      /too detailed/,
    );
    assert.equal(closed, 2);
  } finally {
    if (originalBitmap)
      Object.defineProperty(globalThis, "createImageBitmap", originalBitmap);
    else delete globalThis.createImageBitmap;
    if (originalDocument)
      Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
  }
});
