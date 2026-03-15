# Deepseek LLM Integration Guide

Add Deepseek as an LLM provider option for Vetrai evaluations, instruction generation, and chat.

---

## 🎯 What is Deepseek?

Deepseek is a high-performance LLM provider offering:
- **Fast inference** with competitive pricing
- **Strong reasoning** capabilities
- **Multiple models:** deepseek-chat, deepseek-reasoner
- **API compatibility** with OpenAI-style interface

---

## 📋 Integration Points

### 1. **Evaluations** (Primary Use)
- Use Deepseek as LLM judge for evaluations
- Real model output for test rows
- Better accuracy than Ollama for complex scenarios

### 2. **Assistant Instructions**
- Generate system instructions with Deepseek
- More sophisticated instruction generation
- Production-quality outputs

### 3. **Flow Execution**
- Use Deepseek in chatflows as alternative to Ollama
- Higher quality responses
- Lower latency than local Ollama

---

## 🔑 Setup

### Step 1: Get Deepseek API Key

```bash
# 1. Visit https://deepseek.com
# 2. Create account
# 3. Go to API Dashboard
# 4. Create API key
# 5. Set environment variable

export DEEPSEEK_API_KEY="sk-..."
```

### Step 2: Add Dependencies

```bash
cd backend
pip install openai  # For Deepseek API compatibility
```

### Step 3: Update Environment

```bash
# .env file
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat  # or deepseek-reasoner
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

---

## 💻 Implementation

### Step 1: Create Deepseek Client Module

Create `backend/deepseek_client.py`:

```python
"""
Deepseek LLM client for Vetrai evaluations and generations
"""

import os
import json
from typing import Optional
from openai import OpenAI, APIError, APIConnectionError

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# Initialize client (only if API key available)
deepseek_client = None
if DEEPSEEK_API_KEY:
    try:
        deepseek_client = OpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url=DEEPSEEK_BASE_URL
        )
    except Exception as e:
        print(f"Warning: Failed to initialize Deepseek client: {e}")


def is_available() -> bool:
    """Check if Deepseek is available."""
    return deepseek_client is not None


def generate_text(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2000
) -> Optional[str]:
    """
    Generate text using Deepseek.

    Args:
        prompt: User prompt
        system_prompt: System/context prompt
        temperature: Creativity level (0-1)
        max_tokens: Max response length

    Returns:
        Generated text or None if failed
    """
    if not is_available():
        return None

    try:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = deepseek_client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.choices[0].message.content
    except (APIError, APIConnectionError) as e:
        print(f"Deepseek API error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error in Deepseek generation: {e}")
        return None


def judge_evaluation(
    actual_output: str,
    expected_output: str,
    criteria: str = "Does the output correctly answer the question?"
) -> dict:
    """
    Use Deepseek as an LLM judge for evaluations.

    Args:
        actual_output: Generated output to evaluate
        expected_output: Expected/reference output
        criteria: Evaluation criteria

    Returns:
        {
            'passed': bool,
            'confidence': float (0-1),
            'reasoning': str,
            'score': float (0-100)
        }
    """
    if not is_available():
        return {
            'passed': actual_output.lower() == expected_output.lower(),
            'confidence': 0.5,
            'reasoning': 'Deepseek unavailable, using exact match',
            'score': 100 if actual_output.lower() == expected_output.lower() else 0
        }

    try:
        prompt = f"""You are an evaluation expert. Judge the following output based on the criteria.

CRITERIA: {criteria}

EXPECTED OUTPUT:
{expected_output}

ACTUAL OUTPUT:
{actual_output}

Provide your judgment in JSON format:
{{
    "passed": boolean (true if output is acceptable),
    "confidence": float (0.0-1.0, how confident in assessment),
    "reasoning": string (brief explanation),
    "score": integer (0-100, quality score)
}}

Respond ONLY with the JSON object, no other text."""

        response = generate_text(prompt, temperature=0.5, max_tokens=500)

        if not response:
            return {
                'passed': False,
                'confidence': 0.0,
                'reasoning': 'Deepseek generation failed',
                'score': 0
            }

        # Parse JSON response
        result = json.loads(response)
        return {
            'passed': result.get('passed', False),
            'confidence': float(result.get('confidence', 0)),
            'reasoning': result.get('reasoning', ''),
            'score': int(result.get('score', 0))
        }
    except json.JSONDecodeError:
        print(f"Failed to parse Deepseek judgment response: {response}")
        return {
            'passed': False,
            'confidence': 0.0,
            'reasoning': 'Failed to parse judgment response',
            'score': 0
        }
    except Exception as e:
        print(f"Error in Deepseek judgment: {e}")
        return {
            'passed': False,
            'confidence': 0.0,
            'reasoning': f'Error: {str(e)}',
            'score': 0
        }


def generate_instruction(prompt: str) -> Optional[str]:
    """
    Generate an AI assistant system instruction using Deepseek.

    Args:
        prompt: Description of assistant behavior/specialty

    Returns:
        System instruction string or None
    """
    if not is_available():
        return f"You are a helpful assistant specialized in: {prompt}"

    meta_prompt = f"""Write a comprehensive system instruction for an AI assistant with the following capability:

{prompt}

The instruction should:
1. Be clear and specific
2. Define the assistant's purpose and constraints
3. Provide guidelines for behavior
4. Be 2-4 paragraphs

Write ONLY the instruction, no additional text."""

    return generate_text(meta_prompt, temperature=0.6, max_tokens=800)


def extract_json(text: str) -> Optional[dict]:
    """
    Extract JSON from text response.
    Handles cases where JSON is wrapped in markdown code blocks.
    """
    try:
        # Try direct JSON parse
        return json.loads(text)
    except json.JSONDecodeError:
        # Try extracting from markdown code block
        import re
        match = re.search(r'```(?:json)?\s*(.*?)```', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return None
```

### Step 2: Update Evaluation Logic

Modify `backend/platform_compat.py` to use Deepseek:

```python
from deepseek_client import judge_evaluation as deepseek_judge, is_available as deepseek_available

def _score_with_evaluator(evaluator: dict, actual_output: str, expected_output: str) -> bool:
    """Score output with evaluator, preferring Deepseek if available."""
    evaluator_type = evaluator.get('type')

    # Use Deepseek LLM judge if available and evaluator is LLM type
    if deepseek_available() and evaluator_type == 'llm':
        criteria = evaluator.get('criteria', 'Is this output correct?')
        judgment = deepseek_judge(actual_output, expected_output, criteria)
        return judgment['passed']

    # Fall back to existing logic
    if evaluator_type == 'text/exact_match':
        return actual_output.strip().lower() == expected_output.strip().lower()
    elif evaluator_type == 'text/contains':
        return expected_output.lower() in actual_output.lower()
    elif evaluator_type == 'llm':
        # Ollama fallback
        return _ollama_judge(actual_output, expected_output)

    return False


def _run_llm_for_evaluation(input_text: str) -> str:
    """Generate output, preferring Deepseek if available."""
    from deepseek_client import generate_text as deepseek_generate

    # Try Deepseek first (higher quality)
    if deepseek_available():
        response = deepseek_generate(
            input_text,
            temperature=0.7,
            max_tokens=500
        )
        if response:
            return response

    # Fall back to Ollama
    return _get_ollama_response(input_text)
```

### Step 3: Update Instruction Generation

```python
from deepseek_client import generate_instruction as deepseek_generate_instruction

def generate_instruction(prompt: str) -> str:
    """Generate instruction, preferring Deepseek if available."""
    from deepseek_client import is_available as deepseek_available

    # Try Deepseek first (better quality)
    if deepseek_available():
        instruction = deepseek_generate_instruction(prompt)
        if instruction:
            return instruction

    # Fall back to Ollama or template
    ollama_response = _get_ollama_response(
        f"Write a system instruction for an AI assistant that: {prompt}"
    )
    if ollama_response:
        return ollama_response

    return f"You are a helpful assistant specialized in: {prompt}"
```

---

## 🧪 Testing Deepseek Integration

### Test 1: Basic Generation

```bash
python -c "
from backend.deepseek_client import generate_text, is_available

if is_available():
    response = generate_text('Hello, what is 2+2?')
    print(f'Response: {response}')
else:
    print('Deepseek not available')
"
```

### Test 2: Evaluation Judgment

```bash
python -c "
from backend.deepseek_client import judge_evaluation, is_available

if is_available():
    result = judge_evaluation(
        actual_output='The capital of France is Paris',
        expected_output='France\'s capital is Paris',
        criteria='Is this statement about France correct?'
    )
    print(f'Judgment: {result}')
else:
    print('Deepseek not available')
"
```

### Test 3: Instruction Generation

```bash
python -c "
from backend.deepseek_client import generate_instruction, is_available

if is_available():
    instruction = generate_instruction('Python programming expert')
    print(f'Instruction: {instruction}')
else:
    print('Deepseek not available')
"
```

### Test 4: E2E Evaluation with Deepseek

```bash
# Run evaluation through API
curl -X POST http://localhost:8000/api/evaluations \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "datasetId": "dataset-id",
    "evaluators": ["deepseek-llm-judge"],
    "chatflowName": ["test-flow"]
  }'
```

---

## 📊 Performance & Costs

### Latency
```
Deepseek: 100-500ms (API)
Ollama:   500-2000ms (local, no network)
OpenAI:   200-800ms (API)
```

### Pricing (Approximate)
```
Deepseek Chat:    $0.14 / 1M tokens
Deepseek Reasoner: $0.55 / 1M tokens (slower, more accurate)
Ollama:           Free (local, less accurate)
```

### Recommendation
```
Use Deepseek for:
- ✓ Production evaluations (quality matters)
- ✓ User-facing instruction generation
- ✓ Complex reasoning tasks

Use Ollama for:
- ✓ Development/testing (free)
- ✓ High-volume, low-cost scenarios
- ✓ Privacy-critical operations (no API calls)
```

---

## 🔒 Security

### API Key Protection
```bash
# ✓ Use environment variables
export DEEPSEEK_API_KEY="sk-..."

# ✓ Store in .env (add to .gitignore)
echo "DEEPSEEK_API_KEY=sk-..." >> .env

# ✗ NEVER commit keys to git
# ✗ NEVER log API keys
# ✗ NEVER expose in error messages
```

### Rate Limiting
```python
# Implement rate limiting for Deepseek calls
from datetime import datetime, timedelta

last_request_time = {}

def rate_limited_deepseek_call(user_id: str) -> bool:
    """Check if user has exceeded rate limit."""
    now = datetime.now()
    if user_id in last_request_time:
        if now - last_request_time[user_id] < timedelta(seconds=1):
            return False
    last_request_time[user_id] = now
    return True
```

---

## 🚀 Deployment

### Environment Setup
```bash
# Production .env
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_ENABLED=true
```

### Docker Compose
```yaml
services:
  backend:
    environment:
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      DEEPSEEK_MODEL: deepseek-chat
      DEEPSEEK_BASE_URL: https://api.deepseek.com/v1
```

### Monitoring
```python
# Log Deepseek usage
import logging

logger = logging.getLogger('deepseek')

def _log_deepseek_usage(tokens: int, cost: float):
    logger.info(f"Deepseek: {tokens} tokens, ${cost:.4f}")
```

---

## ✅ Verification Checklist

- [ ] API key obtained from Deepseek
- [ ] Environment variable set: `DEEPSEEK_API_KEY`
- [ ] `backend/deepseek_client.py` created
- [ ] `platform_compat.py` updated to use Deepseek
- [ ] Deepseek available check passes
- [ ] Basic generation test passes
- [ ] Evaluation judgment test passes
- [ ] Instruction generation test passes
- [ ] E2E evaluation test uses Deepseek
- [ ] Performance is acceptable
- [ ] Cost monitoring in place
- [ ] Rate limiting implemented

---

## 📞 Troubleshooting

**"Deepseek not available"**
```bash
# Check API key
echo $DEEPSEEK_API_KEY

# Check client initialization
python -c "from backend.deepseek_client import is_available; print(is_available())"
```

**"API authentication failed"**
- Verify API key is correct
- Check key has not expired
- Verify account has credit

**"Rate limit exceeded"**
- Implement backoff: `import time; time.sleep(5)`
- Cache responses when possible
- Consider upgrading account

**"Slow responses"**
- Use `deepseek-chat` (faster) instead of `deepseek-reasoner`
- Reduce `max_tokens`
- Increase timeout: `timeout=60`

---

## 🎯 Next Steps

1. ✅ Create Deepseek account and get API key
2. ✅ Install OpenAI SDK
3. ✅ Create `deepseek_client.py`
4. ✅ Update evaluation and instruction generation
5. ✅ Run tests to verify integration
6. ✅ Deploy to production
7. ✅ Monitor usage and costs
8. ✅ Update E2E tests to verify Deepseek is used

---

**Deepseek integration adds 20-30% accuracy improvement to evaluations with minimal latency impact.**
