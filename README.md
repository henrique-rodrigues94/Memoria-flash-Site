# FlashMind Study Web

Site web de estudos do FlashMind, pensado para funcionar no computador e também em telas menores.

## Stack

- React 19
- Vite
- TypeScript/JSX
- Firebase SDK (preparado para Auth + Firestore)
- Firebase Hosting

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Próxima integração

A interface já está organizada para conectar:

- Firebase Authentication
- Firestore
- decks do usuário
- cardBuckets globais
- progresso SRS
- feedback dos cards
- Content Agent

O conteúdo atual é demonstrativo para permitir testar a UX antes da conexão com o banco real.
