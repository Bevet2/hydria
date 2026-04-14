# Knowledge Layer V2

Hydria conserve l'ingestion existante des pieces jointes mais ajoute une couche plus proche d'un index local exploitable.

## Fichiers

- `backend/src/knowledge/knowledge.chunker.js`
- `backend/src/knowledge/knowledge.index.js`
- `backend/src/knowledge/knowledge.search.js`
- `backend/src/knowledge/JsonKnowledgeStore.js`

## Capacites

- chunking par type de contenu
- markdown headings
- json fields
- code blocks / fonctions / classes
- overlap entre chunks
- index local avec termes clefs, termes normalises, bigrams et char-trigrams
- recherche semantique locale par expansion de tokens, rarete, phrases, metadonnees et fraicheur
- ingestion des pieces jointes, resultats web et patterns GitHub

## Objectif

La couche knowledge sert a:

- relire des documents
- indexer localement ce qui a ete vu
- re-injecter des evidences utiles dans les tours suivants
- preparer un retrieval plus riche sans dependance payante
