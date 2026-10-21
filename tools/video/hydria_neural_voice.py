"""One-off, no-paid-API French neural narration for the Hydria product film.
Source text matches the 15 existing film segments. Audio is a build artifact.
"""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import edge_tts

SENTENCES = ["Hydria OS. Une même ambition : réunir nos outils de travail dans un seul environnement.","Une plateforme pour écrire, analyser des données, automatiser des traitements et créer, sans changer d'écosystème.","L'interface partage une navigation commune, une bibliothèque de projets, la recherche et les thèmes clair et sombre.","Avec Docs, on crée et on modifie de vrais documents. La sauvegarde et la réouverture sont testées.","Sheets rassemble tableaux, cellules et formules. Les grands classeurs et les opérations complexes restent à renforcer.","Slides propose la composition des présentations. Les animations et la fidélité des exports restent à perfectionner.","Dashboard permet de construire des vues. Les filtres, les connexions et la mise en page doivent encore gagner en maturité.","Flow Manager relie des sources, des transformations et des résultats : un éditeur de flux visuel inspiré des outils E T L.","Whiteboard offre une surface libre pour organiser des idées, déplacer des éléments et créer des liens.","L'atelier P D F progresse : ouvrir, modifier, sauvegarder, puis rouvrir un fichier fait partie des scénarios validés.","L'interface s'adapte aussi aux petits écrans. Il reste du travail sur l'ergonomie tactile et la robustesse mobile.","Ces images viennent de captures réelles du navigateur pendant les tests automatiques d'Hydria. Ce ne sont pas des maquettes.","Il reste quatre chantiers majeurs : enrichir les éditeurs, fiabiliser les fichiers, terminer la suite créative et sécuriser la livraison.","La suite est claire : stabiliser les fonctionnalités, harmoniser chaque workspace, tester sur de vrais usages, puis déployer.","Hydria OS. Le socle existe déjà. Le prochain défi, c'est d'en faire un produit véritablement abouti."]
DURATIONS = [7, 8, 9, 8, 9, 8, 9, 10, 7, 10, 10, 9, 12, 10, 8]
assert len(SENTENCES) == len(DURATIONS)
OUT = Path("dist/hydria-voice")
OUT.mkdir(parents=True, exist_ok=True)

async def choose_voice():
    preferred = ["fr-FR-RemyMultilingualNeural", "fr-FR-HenriNeural", "fr-FR-DeniseNeural"]
    available = {v["ShortName"] for v in await edge_tts.list_voices()}
    voice = next((v for v in preferred if v in available), None)
    if not voice:
        raise RuntimeError("Aucune voix neuronale francaise trouvee : " + str(sorted(v for v in available if v.startswith("fr-FR-"))))
    return voice

async def make_scene(i, text, voice):
    dest = OUT / f"scene_{i:02d}.mp3"
    for attempt in range(1, 4):
        try:
            await edge_tts.Communicate(text=text, voice=voice, rate="+0%", pitch="-1Hz", volume="+0%").save(str(dest))
            if not dest.exists() or dest.stat().st_size < 1000:
                raise RuntimeError("MP3 missing or too small")
            probe = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(dest)], text=True).strip()
            duration = float(probe)
            if not 0.5 < duration < 120:
                raise RuntimeError(f"Invalid duration: {duration}")
            print(f"SCENE {i:02d}: {duration:.2f}s ({dest.stat().st_size} bytes)", flush=True)
            return {"index": i, "file": dest.name, "text": text, "slot_seconds": DURATIONS[i], "audio_seconds": duration}
        except Exception as exc:
            print(f"SCENE {i:02d} attempt {attempt} error: {exc}", flush=True)
            if attempt == 3:
                raise
            await asyncio.sleep(3*attempt)

async def main():
    voice = await choose_voice()
    print("Neural voice:", voice, flush=True)
    results = []
    for i, text in enumerate(SENTENCES):
        results.append(await make_scene(i, text, voice))
    (OUT / "manifest.json").write_text(json.dumps({"voice":voice,"scenes":results}, ensure_ascii=False,indent=2), encoding="utf-8")
    assert len(list(OUT.glob("scene_*.mp3"))) == 15
    print("All neural scene tracks rendered",flush=True)

if __name__ == "__main__":
    asyncio.run(main())
