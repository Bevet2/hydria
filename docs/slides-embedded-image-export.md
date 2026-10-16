# Hydria Slides — images intégrées dans les exports PowerPoint

Le point de sortie `POST /api/work-objects/:workObjectId/presentation-export`
peut maintenant incorporer de vrais médias **PNG/JPEG** aux fichiers PPTX,
à partir du champ `src` d'un élément `type: "image"` décrit dans
`<!-- hydria-slide: {...} -->`.

Exemple d'élément :

```json
{
  "type": "image",
  "text": "Capture du graphique",
  "src": "data:image/png;base64,...",
  "x": 12, "y": 24, "w": 60, "h": 45
}
```

L'export utilise une mise à l'échelle de type `contain`, afin de conserver
les proportions dans la boîte de l'éditeur. Les notes existantes restent
exportées par PptxGenJS.

## Limites et sécurité

- Uniquement les images PNG/JPEG embarquées en base64 : pas de lecture de
  fichier local ou d'URL distante depuis le backend. Les URL restent des
  espaces réservés comme précédemment.
- Maximum 8 images par présentation, 1 Mo par image et 3 Mo cumulés.
- Signature PNG/JPEG validée avant l'intégration.
- Les textes, formes et positionnements existants restent inchangés.
- L'export PPTX complet (animations, transitions complexes, vidéos intégrées,
  modèles PowerPoint multi-layouts) reste un chantier distinct.

Validation : `node backend/scripts/pptxImageExportGate.mjs`, exécuté après
démarrage du backend dans la CI Hydria OS.
