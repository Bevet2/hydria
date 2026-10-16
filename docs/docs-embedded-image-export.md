# Hydria Docs — embedded image export

The `POST /api/docs/export-docx` and `POST /api/docs/export-pdf`
endpoints can now embed actual **PNG and JPEG images** when source HTML
contains a `data:image/png;base64,...` or `data:image/jpeg;base64,...`
`<img>` element. The export retains its aspect ratio and honors valid
pixel `width` / `height` attributes or inline CSS sizes when possible.
Both block images and images in ordinary paragraphs are supported.

Example:

```html
<p>Example report</p>
<p><img src="data:image/png;base64,..." width="320" alt="Chart"></p>
```

### Security and limits

- The backend **never requests external image URLs**. External images,
  SVG and unsupported image types still export as text alternatives.
- At most 8 embedded images, 1 MB per image, 3 MB combined and
  4096 × 4096 native pixels.
- The image's magic bytes and dimensions are validated. Malformed images
  fail with HTTP 400; oversized images fail with HTTP 413.
- Large images are fitted to a safe DOCX/PDF page size; no user-provided
  file paths or URLs are processed.
- Images inside HTML table cells and precise floating/wrapping layouts
  are not yet covered by this change.

Validation runs in `backend/scripts/osExportSmoke.mjs` through CI:
the DOCX ZIP package must contain image media and DrawingML image refs,
the exported PDF must contain an image XObject, and an oversized image
must be rejected.

This is an **incremental fidelity improvement** rather than complete
round-trip import/export compatibility with Microsoft Word.
