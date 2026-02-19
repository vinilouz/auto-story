# Pipeline Pattern Guide

## Core Pattern: Function Composition with Pipe

This project uses **Pipeline Pattern** with **Function Composition** following these principles:

### Implementation Standard
```javascript
// Atomic functions - single responsibility
const validateInput = (data) => {
  if (!data.text || !data.segmentLength)
    throw new Error('Missing required fields');
  return data;
};

const processSegments = (data) => {
  const segments = splitText(data.text, data.segmentLength);
  return { ...data, segments };
};

// Pipe function - handles sync/async mix
const pipe = (...fns) => (initialValue) =>
  fns.reduce(async (accPromise, fn) => {
    const acc = await accPromise;
    return fn(acc);
  }, initialValue);

// Pipeline composition
const processScript = pipe(
  validateInput,
  processSegments,
  formatResponse
);
```

### Rules
1. **Pure functions only** - no side effects
2. **Single data flow** - each function receives and returns data
3. **No manual next()** - pipe manages composition
4. **Atomic functions** - one responsibility per function
5. **Sync/async mix supported** - pipe handles both

### Usage in API Routes
```javascript
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const result = await processScript(data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Benefits
- Zero boilerplate - native JavaScript
- Type-safe data flow
- Easy debugging with logging steps
- Composable and reusable functions
- Clear separation of concerns