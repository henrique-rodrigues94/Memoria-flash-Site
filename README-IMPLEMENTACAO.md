# MemoriaFlash — próxima implementação

Branch: `web/firebase-data-layer`

## O que este pacote melhora

- Divide Firebase/Auth/ícones em chunks do Vite.
- Remove o import dinâmico duplicado do Firebase Auth.
- Centraliza autenticação em `src/services/auth.js`.
- Centraliza conteúdo em `src/services/content.js`.
- Suporta a hierarquia:
  - matéria
  - tópico
  - subtópico
  - card
- Centraliza progresso.
- Centraliza feedback.

## Aplicação

Copie os arquivos para a raiz do projeto, substituindo os equivalentes.

Depois:

```powershell
npm install
npm run build
```

## Importante

O `src/services/content.js` tenta suportar os nomes de campos já discutidos, mas o schema definitivo do Firebase deve ser confirmado antes de remover definitivamente os dados de demonstração.

Não faça `git stash pop`.

Depois do build:

```powershell
git status
```

Revise as mudanças antes do commit.
