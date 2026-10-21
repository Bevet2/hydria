/**
 * Apply a minimal, pinned Hydria-only adapter to FigCraft v0.8.0 source.
 *
 * Upstream WebServices intentionally returns None for native Save dialogs;
 * a pathless document opened through the browser cannot trigger its native
 * download serializer from File > Save. Furthermore synthetic DragEvent drops
 * are not reliably accepted by egui for complex .figcraft files.
 *
 * The shim is opt-in and compiled only in the private Hydria pilot. It uses
 * FigCraft's own original figcraft_format serializer (no JSON conversion).
 * Apache-2.0 / MIT upstream credits and trademarks must be observed.
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPSTREAM_COMMIT = "594dc8c6cf50a03b6d88abce877794f286f759b9";
const one = (source, needle, replacement) => {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw Error("Pinned FigCraft source changed ("+count+"): " + needle.slice(0,70));
  return source.replace(needle, replacement);
};
export function patchFigCraftUi(source) {
  const saveAs = "    pub fn save_as_dialog(&mut self) {\n";
  source = one(source, saveAs, saveAs +
    "        if self.services.downloads() { self.save(); return; }\n");
  const save = "    pub fn save(&mut self) {\n";
  source = one(source, save, save + [
    "        // Hydria browser build: a pathless document can still be saved in",
    "        // FigCraft's full-fidelity native format as a downloaded ZIP.",
    "        if self.services.downloads() {",
    "            let Ok(doc) = self.session.doc() else { return };",
    "            let name = format!(\"{}.figcraft\", doc.name.trim_end_matches(\".figcraft\"));",
    "            let binary = self.session.ds().and_then(figcraft_engine::cmd::file::file_bytes);",
    "            match binary {",
    "                Ok(bytes) => {",
    "                    if self.services.download(&name, &bytes) {",
    "                        self.toast(\"Save requested. Check Hydria Drive confirmation.\".to_string());",
    "                    } else {",
    "                        self.show_error(i18n::tr(\"Could not download document\").to_string());",
    "                    }",
    "                }",
    "                Err(error) => self.show_error(error.to_string()),",
    "            }",
    "            return;",
    "        }",
    ""
  ].join("\n"));
  return source;
}
export function patchFigCraftWeb(source) {
  const anchor = [
    "    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {",
    "        self.fig.ui(ui);",
    "    }"
  ].join("\n");
  const replacement = [
    "    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {",
    "        // Hydria host provides a transferred ArrayBuffer after authenticating",
    "        // the same-origin iframe. Invoke FigCraft's own file.open engine command,",
    "        // instead of an untrusted synthetic HTML DragEvent.",
    "        if let Some(window) = web_sys::window() {",
    "            let key = wasm_bindgen::JsValue::from_str(\"__hydriaFigOpenQueue\");",
    "            if let Ok(queue) = js_sys::Reflect::get(window.as_ref(), &key) {",
    "                if js_sys::Array::is_array(&queue) {",
    "                    let received = js_sys::Array::from(&queue);",
    "                    let _ = js_sys::Reflect::set(window.as_ref(), &key, &js_sys::Array::new());",
    "                    for entry in received.iter() {",
    "                        let name = js_sys::Reflect::get(&entry, &wasm_bindgen::JsValue::from_str(\"name\"))",
    "                            .ok().and_then(|value| value.as_string());",
    "                        let raw = js_sys::Reflect::get(&entry, &wasm_bindgen::JsValue::from_str(\"bytes\")).ok();",
    "                        let (Some(name), Some(raw)) = (name, raw) else { continue };",
    "                        if name.len() > 180 || !name.to_ascii_lowercase().ends_with(\".figcraft\") { continue; }",
    "                        let bytes = js_sys::Uint8Array::new(&raw).to_vec();",
    "                        if bytes.is_empty() || bytes.len() > 30 * 1024 * 1024 { continue; }",
    "                        use base64::Engine as _;",
    "                        let data = base64::engine::general_purpose::STANDARD.encode(bytes);",
    "                        if self.fig.run_user(\"file.open\", serde_json::json!({\"name\":name,\"data\":data})).is_some() {",
    "                            self.fig.ui.home = false;",
    "                            log::info!(\"Hydria opened native FigCraft project: {name}\");",
    "                        } else {",
    "                            log::error!(\"Hydria could not open native FigCraft project: {name}\");",
    "                        }",
    "                    }",
    "                }",
    "            }",
    "        }",
    "        self.fig.ui(ui);",
    "    }"
  ].join("\n");
  return one(source, anchor, replacement);
}
export function patchFigCraftManifest(source) {
  return one(source, "[dependencies]\n", "[dependencies]\nbase64 = { workspace = true }\nserde_json = { workspace = true }\n");
}
export async function patchHydriaFigCraft(root, {verifyGit = true} = {}) {
  if (verifyGit) {
    const actual = execFileSync("git", ["rev-parse","HEAD"], {cwd:root,encoding:"utf8"}).trim();
    if (actual !== UPSTREAM_COMMIT) throw Error("FigCraft source commit mismatch: " + actual);
  }
  for (const [file,patch] of [
    ["crates/ui-egui/src/lib.rs",patchFigCraftUi],
    ["apps/figcraft-web/src/web.rs",patchFigCraftWeb],
    ["apps/figcraft-web/Cargo.toml",patchFigCraftManifest]
  ]) {
    const filename = path.join(root,file);
    await writeFile(filename,patch(await readFile(filename,"utf8")),"utf8");
  }
}
if (process.argv[1] && /patchHydriaFigCraft\.mjs$/.test(process.argv[1])) {
  const root = process.argv[2];
  if (!root) throw Error("Usage: node patchHydriaFigCraft.mjs <checked-out FigCraft v0.8.0 path>");
  await patchHydriaFigCraft(path.resolve(root));
  console.log("Hydria FigCraft native open/save patch applied to pinned " + UPSTREAM_COMMIT);
}
