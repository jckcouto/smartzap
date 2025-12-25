# Sentinel Journal

Este arquivo é **intencionalmente enxuto**: só registre aprendizados **críticos** (padrões de vulnerabilidade específicos do projeto, efeitos colaterais inesperados, restrições importantes, gaps arquiteturais surpreendentes).

Formato:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** ...`
`**Learning:** ...`
`**Prevention:** ...`

## 2025-12-25 - Setup endpoints precisam de gate por secret do servidor
**Vulnerability:** Rotas de setup podem executar operações sensíveis (ex.: migração via service role) e, se expostas sem autenticação, viram um gatilho público de ações privilegiadas.
**Learning:** Fluxos de “wizard/setup” tendem a nascer como utilitários e depois acabam sendo deployados junto do app; sem um guardrail padrão, é fácil esquecer o gate.
**Prevention:** Padronizar um helper de auth para `/api/setup/*` exigindo `SMARTZAP_ADMIN_KEY` (ou equivalente) e evitar retornar detalhes de erro em produção.

