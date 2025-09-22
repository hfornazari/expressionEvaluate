# Interpretador de Expressões (Infix ➜ Postfix ➜ Resultado)

Este projeto demonstra um fluxo completo de interpretação de expressões matemáticas:

1. **Tokenização léxica** – quebra a expressão em tokens (números, operadores e parênteses).
2. **Análise sintática estilo *Shunting Yard*** – converte a forma infixa para pós-fixa (RPN) usando pilhas e filas.
3. **Avaliação da RPN** – executa a expressão pós-fixa, exibindo cada passo de manipulação da pilha.

A interface React permite que o usuário forneça uma linha de código (a expressão matemática) e visualize cada estágio do processo de interpretação.

## Estrutura

```
backend/   → servidor Node.js sem dependências externas
frontend/  → interface React independente, carregada via CDN
```

## Executando o backend

```bash
cd backend
node server.js
```

O servidor ficará disponível em `http://localhost:3001` com o endpoint `POST /evaluate`.

### Exemplo de requisição

```bash
curl -X POST http://localhost:3001/evaluate \
  -H "Content-Type: application/json" \
  -d '{"expression": "3 + 4 * 2 / (1 - 5) ^ 2 ^ 3"}'
```

## Executando o frontend

Como o frontend é um arquivo estático, você pode servi-lo com qualquer servidor HTTP simples. Exemplos:

```bash
cd frontend
python -m http.server 8080
# em seguida abra http://localhost:8080 no navegador
```

A interface se comunicará com o backend em `http://localhost:3001/evaluate` e exibirá:

- Tokens identificados na expressão
- Passos detalhados do algoritmo Shunting Yard (fila de saída e pilha de operadores)
- Sequência de avaliação pós-fixa com o estado da pilha após cada ação
- Resultado final da expressão

## Observações

- Suporta operadores `+`, `-`, `*`, `/`, `^`, parênteses e negativo unário.
- Em caso de erros (símbolos desconhecidos, parênteses desbalanceados, etc.), o backend retorna mensagens descritivas.
- O projeto foi pensado para demonstrar o raciocínio *compiler-like* de forma didática e transparente.
