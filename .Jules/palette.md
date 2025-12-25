# Palette's Journal 🎨

## 2025-12-25 - Comprehensive Accessibility Audit

**Learning:** SmartZap tinha muitos botões icon-only sem ARIA labels, o que tornava a navegação por teclado e leitores de tela extremamente difícil. Componentes de lista (campanhas, contatos, templates) eram especialmente problemáticos.

**Action:** 
- Sempre adicionar `aria-label` em botões icon-only com descrição contextual (ex: "Excluir campanha X" ao invés de apenas "Excluir")
- Adicionar `aria-hidden="true"` em ícones decorativos para evitar poluição em leitores de tela
- Implementar `focus-visible:outline` consistente em todos os elementos interativos
- Usar `aria-live="polite"` em contadores e informações dinâmicas
- Implementar `aria-current="page"` em navegação ativa
- Usar `aria-pressed` em botões de toggle/filtro
- Adicionar `role="status"` em spinners de loading

**Pattern Discovered:** Componentes de lista precisam de atenção especial:
1. Paginação: `aria-label` em botões, `aria-current` na página ativa, `nav` wrapper
2. Filtros: `role="group"` com `aria-label`, `aria-pressed` para estado ativo
3. Busca: `aria-label` descritivo, `aria-hidden` no ícone de lupa
4. Ações em linha: `aria-label` contextual com nome do item (ex: "Clonar campanha Marketing 2024")
5. Empty states: Mensagens contextuais baseadas em filtros ativos

**Impact:** 
- Usuários de teclado agora podem navegar toda a aplicação sem mouse
- Leitores de tela (NVDA, JAWS, VoiceOver) agora anunciam corretamente todos os elementos
- Focus indicators visuais claros para navegação por teclado
- Feedback sonoro apropriado para ações assíncronas

## 2025-12-25 - Focus Management Best Practices

**Learning:** Focus-visible é diferente de focus. Focus-visible só aparece quando o usuário navega por teclado, não quando clica com o mouse. Isso evita o "anel azul" indesejado em cliques de mouse.

**Action:**
- Usar `focus-visible:outline` ao invés de `focus:outline`
- Cores de outline devem combinar com a ação: primary para ações normais, red para destrutivas, emerald para positivas
- Sempre incluir `outline-offset-2` para melhor visibilidade
- Outline deve ter 2px de espessura (`outline-2`)

**Pattern:**
```tsx
className="... focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
```

## 2025-12-25 - Empty State UX Pattern

**Learning:** Empty states genéricos ("Nenhum item encontrado") não ajudam o usuário a entender o que fazer. Estados vazios devem ser contextuais e orientar a próxima ação.

**Action:**
- Detectar se o estado vazio é devido a filtros ativos ou ausência real de dados
- Mostrar mensagens diferentes para cada caso
- Incluir ícone visual (não apenas texto)
- Sugerir ação clara quando apropriado

**Pattern:**
```tsx
{items.length === 0 && (
  <div className="flex flex-col items-center gap-3 py-16">
    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
      <Icon size={24} className="text-gray-500" aria-hidden="true" />
    </div>
    <div>
      <p className="text-gray-400 font-medium">Título contextual</p>
      <p className="text-gray-600 text-sm mt-1">
        {hasFilters 
          ? 'Tente ajustar os filtros'
          : 'Crie seu primeiro item para começar'}
      </p>
    </div>
  </div>
)}
```

## 2025-12-25 - Tooltips vs Title Attribute

**Learning:** O atributo HTML `title` é inconsistente entre browsers e não é acessível. Tooltips customizados com Radix UI oferecem controle total sobre timing, estilo e acessibilidade.

**Action:**
- Sempre usar componente Tooltip ao invés de `title` attribute
- Manter `aria-label` para acessibilidade (tooltips são visuais)
- Usar `asChild` para evitar wrapper extra
- Delay padrão de 300ms para evitar tooltips acidentais

**Pattern:**
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <button aria-label="Descrição completa">
      <Icon aria-hidden="true" />
    </button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Texto curto e claro</p>
  </TooltipContent>
</Tooltip>
```

## 2025-12-25 - Loading Skeleton Timing

**Learning:** Loading skeletons com animação uniforme (todos pulsando juntos) parecem artificiais. Animações escalonadas (staggered) com delays diferentes criam efeito de "onda" mais natural e menos cansativo.

**Action:**
- Usar `animationDelay` em CSS inline para cada elemento
- Delays típicos: 0ms, 150ms, 300ms, 450ms
- Aplicar `animate-pulse` individualmente, não no container
- Efeito funciona melhor em listas verticais

**Pattern:**
```tsx
<div className="w-20 h-9 bg-zinc-700/50 rounded animate-pulse" />
<div className="w-28 h-4 bg-zinc-700/50 rounded animate-pulse" 
     style={{ animationDelay: '150ms' }} />
```

## 2025-12-25 - Hover Effects: Subtlety is Key

**Learning:** Hover effects muito dramáticos distraem. Glow sutil com shadow inset/outset + transição de 200ms é o equilíbrio perfeito entre feedback visual e discrição.

**Action:**
- Usar `shadow-[0_0_20px_rgba(16,185,129,0.1)]` para glow externo
- Usar `shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]` para glow interno (linhas de tabela)
- Sempre combinar com `transition-all duration-200`
- Cor do glow deve ser primary color do design system

**Pattern:**
```tsx
// Cards
className="hover:bg-white/5 transition-all duration-200 
           hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"

// Table rows
className="hover:bg-white/5 transition-all duration-200 
           hover:shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"
```

## 2025-12-25 - Focus Ring vs Outline

**Learning:** `outline` com `outline-offset` cria contornos muito grossos e mal posicionados, especialmente em fundos escuros. `ring` do Tailwind é muito mais elegante e permite controle fino com `ring-offset`.

**Action:**
- Usar `focus-visible:ring-2` ao invés de `focus-visible:outline`
- Sempre adicionar `ring-offset-2` para espaçamento
- Usar `ring-offset-{color}` para combinar com o fundo (ex: `ring-offset-zinc-950`)
- Usar opacidade no ring para sutileza: `ring-primary-500/50`

**Pattern:**
```tsx
// RUIM - Outline grosso e mal posicionado
className="focus-visible:outline focus-visible:outline-2 
           focus-visible:outline-primary-500 
           focus-visible:outline-offset-2"

// BOM - Ring sutil e bem posicionado
className="focus-visible:ring-2 
           focus-visible:ring-primary-500/50 
           focus-visible:ring-offset-2 
           focus-visible:ring-offset-zinc-950"
```

**Resultado Visual:**
- Ring: Contorno fino e elegante, bem posicionado
- Outline: Contorno grosso, pode ficar fora do elemento
- Ring com opacity: Mais sutil e profissional

**IMPORTANTE - Ring sendo cortado:**
Se o ring estiver sendo cortado nas bordas:
1. Adicionar `ring-inset` para que fique DENTRO do elemento
2. Adicionar padding no container pai (ex: `px-2`)
3. Remover `ring-offset` que causa o corte

```tsx
// Se ring está sendo cortado
<div className="space-y-1 px-2"> {/* padding no container */}
  <Link className="focus-visible:ring-2 
                   focus-visible:ring-inset 
                   focus-visible:ring-primary-500" />
</div>
```
