"""Render complete French neural narration to individual MP3 scenes."""
import asyncio, json, pathlib
from mutagen.mp3 import MP3
import edge_tts
SCENES=json.loads(pathlib.Path("tools/video/hydria_complete_scenes.json").read_text(encoding="utf8"))
OUT=pathlib.Path("dist/hydria-full-voice")
OUT.mkdir(parents=True,exist_ok=True)
async def main():
 voices={v["ShortName"] for v in await edge_tts.list_voices()}
 choice=next((x for x in ["fr-FR-RemyMultilingualNeural","fr-FR-HenriNeural","fr-FR-DeniseNeural"] if x in voices),None)
 if not choice:raise RuntimeError("French neural voice unavailable")
 manifest={"voice":choice,"scenes":[]}
 for idx,item in enumerate(SCENES):
  file=OUT/f"{idx:02d}_{item['id']}.mp3"
  for attempt in range(3):
   try:
    await edge_tts.Communicate(item["voice"],choice,rate="-3%",volume="+0%",pitch="-1Hz").save(str(file))
    duration=float(MP3(file).info.length)
    if not (2<duration<45):raise RuntimeError(f"Invalid duration {duration}")
    manifest["scenes"].append({"index":idx,"id":item["id"],"file":file.name,"seconds":duration,"text":item["voice"]})
    print(f"VOICE {idx+1}/{len(SCENES)}: {item['id']} {duration:.1f}s",flush=True)
    break
   except Exception as e:
    print("RETRY",idx,attempt,str(e),flush=True)
    if attempt==2:raise
    await asyncio.sleep(2*(attempt+1))
 (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf8")
 print("COMPLETE",len(manifest["scenes"]),flush=True)
asyncio.run(main())
