const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3001;

function tokenize(expression) {
  const tokens = [];
  const regex = /\s*([0-9]*\.?[0-9]+|[()+\-*/^])/g;
  let match;
  let index = 0;
  while ((match = regex.exec(expression)) !== null) {
    const [lexeme, value] = match;
    const start = match.index + (lexeme.length - value.length);
    if (start > index) {
      const skipped = expression.slice(index, start);
      if (!/^\s*$/.test(skipped)) {
        throw new Error(`Símbolo desconhecido próximo a '${skipped}'.`);
      }
    }
    index = match.index + lexeme.length;

    if (/^\d/.test(value)) {
      tokens.push({ type: 'number', value: parseFloat(value), raw: value });
    } else if (value === '(') {
      tokens.push({ type: 'lparen', value });
    } else if (value === ')') {
      tokens.push({ type: 'rparen', value });
    } else {
      tokens.push({ type: 'operator', value });
    }
  }

  if (index < expression.length) {
    const remaining = expression.slice(index);
    if (!/^\s*$/.test(remaining)) {
      throw new Error(`Símbolo desconhecido próximo a '${remaining}'.`);
    }
  }

  return tokens;
}

const PRECEDENCE = {
  '+': { precedence: 2, associativity: 'left', arity: 2 },
  '-': { precedence: 2, associativity: 'left', arity: 2 },
  '*': { precedence: 3, associativity: 'left', arity: 2 },
  '/': { precedence: 3, associativity: 'left', arity: 2 },
  '^': { precedence: 4, associativity: 'right', arity: 2 },
  'u-': { precedence: 5, associativity: 'right', arity: 1 }
};

function isUnaryMinus(tokens, index) {
  const token = tokens[index];
  if (token.type !== 'operator' || token.value !== '-') return false;
  if (index === 0) return true;
  const prev = tokens[index - 1];
  return prev.type === 'operator' || prev.type === 'lparen';
}

function toPostfix(tokens) {
  const output = [];
  const operatorStack = [];
  const steps = [];

  tokens.forEach((token, index) => {
    let processedToken = token;
    if (isUnaryMinus(tokens, index)) {
      processedToken = { ...token, value: 'u-' };
    }

    if (processedToken.type === 'number') {
      output.push(processedToken);
    } else if (processedToken.type === 'operator') {
      const currentInfo = PRECEDENCE[processedToken.value];
      if (!currentInfo) {
        throw new Error(`Operador desconhecido '${processedToken.value}'.`);
      }
      while (operatorStack.length > 0) {
        const top = operatorStack[operatorStack.length - 1];
        if (top.type !== 'operator') break;
        const topInfo = PRECEDENCE[top.value];
        const shouldPop = (currentInfo.associativity === 'left' && currentInfo.precedence <= topInfo.precedence) ||
          (currentInfo.associativity === 'right' && currentInfo.precedence < topInfo.precedence);
        if (!shouldPop) break;
        output.push(operatorStack.pop());
      }
      operatorStack.push(processedToken);
    } else if (processedToken.type === 'lparen') {
      operatorStack.push(processedToken);
    } else if (processedToken.type === 'rparen') {
      let found = false;
      while (operatorStack.length > 0) {
        const op = operatorStack.pop();
        if (op.type === 'lparen') {
          found = true;
          break;
        }
        output.push(op);
      }
      if (!found) {
        throw new Error('Parênteses desbalanceados.');
      }
    }

    steps.push({
      token: processedToken,
      output: output.map(mapTokenForStep),
      operatorStack: operatorStack.map(mapTokenForStep)
    });
  });

  while (operatorStack.length > 0) {
    const op = operatorStack.pop();
    if (op.type === 'lparen' || op.type === 'rparen') {
      throw new Error('Parênteses desbalanceados.');
    }
    output.push(op);
    steps.push({
      token: { type: 'operator', value: '(desempilhar)' },
      output: output.map(mapTokenForStep),
      operatorStack: operatorStack.map(mapTokenForStep)
    });
  }

  return { postfix: output, steps };
}

function mapTokenForStep(token) {
  if (!token) return token;
  if (token.type === 'number') return token.raw ?? token.value.toString();
  return token.value;
}

function evaluatePostfix(postfix) {
  const stack = [];
  const steps = [];

  postfix.forEach((token) => {
    if (token.type === 'number') {
      stack.push(token.value);
      steps.push({ action: `Empilha número ${token.value}`, stack: [...stack] });
    } else if (token.type === 'operator') {
      const info = PRECEDENCE[token.value];
      if (!info) {
        throw new Error(`Operador desconhecido '${token.value}'.`);
      }
      if (info.arity === 1) {
        if (stack.length < 1) {
          throw new Error('Expressão inválida: operandos insuficientes.');
        }
        const a = stack.pop();
        const result = -a;
        stack.push(result);
        steps.push({
          action: `Aplica negativo unário em ${a}`,
          stack: [...stack]
        });
      } else {
        if (stack.length < 2) {
          throw new Error('Expressão inválida: operandos insuficientes.');
        }
        const b = stack.pop();
        const a = stack.pop();
        let result;
        switch (token.value) {
          case '+':
            result = a + b;
            break;
          case '-':
            result = a - b;
            break;
          case '*':
            result = a * b;
            break;
          case '/':
            result = a / b;
            break;
          case '^':
            result = Math.pow(a, b);
            break;
          default:
            throw new Error(`Operador desconhecido '${token.value}'.`);
        }
        stack.push(result);
        steps.push({
          action: `Aplica ${token.value} em ${a} e ${b}`,
          stack: [...stack]
        });
      }
    }
  });

  if (stack.length !== 1) {
    throw new Error('Expressão inválida: sobrou mais de um valor na pilha.');
  }

  return { result: stack[0], steps };
}

function handleEvaluate(req, res, body) {
  try {
    const data = JSON.parse(body || '{}');
    const expression = data.expression;
    if (typeof expression !== 'string' || expression.trim() === '') {
      throw new Error('Informe uma expressão válida.');
    }

    const tokens = tokenize(expression);
    const { postfix, steps: parseSteps } = toPostfix(tokens);
    const evaluation = evaluatePostfix(postfix);

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      expression,
      tokens,
      postfix: postfix.map(mapTokenForStep),
      parseSteps,
      evaluationSteps: evaluation.steps,
      result: evaluation.result
    }));
  } catch (error) {
    res.writeHead(400, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ message: error.message }));
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/evaluate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => handleEvaluate(req, res, body));
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ message: 'Rota não encontrada' }));
});

server.listen(PORT, () => {
  console.log(`Servidor de avaliação ouvindo na porta ${PORT}`);
});
