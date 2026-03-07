---
description: Design UI screens directly in Figma using the figma-pilot MCP. Creates frames, components, and design tokens from a prompt before React implementation begins.
tools: ['figma-pilot/*', 'read', 'edit']
handoffs:
  - label: Implement in React (Frontend)
    agent: frontend-dev
    prompt: The Figma designs above are approved. Implement them in React following all frontend conventions. Match the layout, spacing, and colour tokens exactly.
    send: false
  - label: Plan Implementation
    agent: planner
    prompt: The Figma designs above are complete. Produce a full implementation plan for the screens shown.
    send: false
---

## When to use

**ALWAYS read this skill BEFORE calling figma_execute!** This skill contains the correct API syntax, parameter formats, and examples that you MUST follow. Failure to read this will result in syntax errors.

Use this skill whenever you are working with figma-pilot MCP tools to create or modify Figma designs.

## Code Execution Mode

figma-pilot uses a **code execution mode** for maximum efficiency. Instead of 15+ individual tools, you use `figma_execute` to run JavaScript code with access to all Figma APIs.

### Available Tools

| Tool | Description |
|------|-------------|
| `figma_status` | Check connection to Figma plugin (call first) |
| `figma_execute` | Execute JavaScript with all Figma APIs |
| `figma_get_api_docs` | Get detailed API documentation |

### Quick Example

```javascript
// figma_execute
// Create a card and modify selection
await figma.create({
  type: 'card',
  name: 'Welcome Card',
  children: [
    { type: 'text', content: 'Hello!', fontSize: 24 }
  ]
});

const { nodes } = await figma.query({ target: 'selection' });
for (const node of nodes) {
  await figma.modify({ target: node.id, fill: '#0066FF' });
}
console.log(`Modified ${nodes.length} elements`);
```

### Benefits

- **90%+ fewer tokens** - 3 tools instead of 15+
- **Batch operations** - Modify many elements in one call
- **Data filtering** - Filter results before returning to context
- **Complex workflows** - Loops, conditionals, error handling

## API Reference

Read individual rule files for detailed API documentation:

### Getting Started
- [figma-pilot-rules/quick-start.md](figma-pilot-rules/quick-start.md) - Quick start guide and setup requirements
- [figma-pilot-rules/workflow.md](figma-pilot-rules/workflow.md) - Recommended agent workflow and operator rules

### Core APIs
- [figma-pilot-rules/status.md](figma-pilot-rules/status.md) - `figma.status()` - Check connection
- [figma-pilot-rules/query.md](figma-pilot-rules/query.md) - `figma.query()` - Query elements by ID, name, or selection

### Creating Elements
- [figma-pilot-rules/create.md](figma-pilot-rules/create.md) - `figma.create()` - Create elements (frames, text, shapes, semantic types)
- [figma-pilot-rules/layout.md](figma-pilot-rules/layout.md) - Auto-layout configuration and patterns

### Modifying Elements
- [figma-pilot-rules/modify.md](figma-pilot-rules/modify.md) - `figma.modify()`, `figma.delete()`, `figma.append()`

### Styling
- [figma-pilot-rules/effects.md](figma-pilot-rules/effects.md) - Shadows, blur, and visual effects
- [figma-pilot-rules/gradients.md](figma-pilot-rules/gradients.md) - Gradient fills (linear, radial, angular)
- [figma-pilot-rules/corner-radius.md](figma-pilot-rules/corner-radius.md) - Independent corner radius
- [figma-pilot-rules/strokes.md](figma-pilot-rules/strokes.md) - Stroke styling (dash patterns, caps, alignment)
- [figma-pilot-rules/transforms.md](figma-pilot-rules/transforms.md) - Rotation and blend modes
- [figma-pilot-rules/constraints.md](figma-pilot-rules/constraints.md) - Responsive constraints and min/max sizes

### Text
- [figma-pilot-rules/text.md](figma-pilot-rules/text.md) - Text elements, wrapping, and sizing
- [figma-pilot-rules/fonts.md](figma-pilot-rules/fonts.md) - Loading and using custom fonts

### Components
- [figma-pilot-rules/components.md](figma-pilot-rules/components.md) - `figma.listComponents()`, `figma.instantiate()`, `figma.toComponent()`, `figma.createVariants()`

### Accessibility
- [figma-pilot-rules/accessibility.md](figma-pilot-rules/accessibility.md) - `figma.accessibility()` - WCAG compliance checking and auto-fixing

### Design Tokens
- [figma-pilot-rules/tokens.md](figma-pilot-rules/tokens.md) - `figma.createToken()`, `figma.bindToken()`, `figma.syncTokens()`

### Export
- [figma-pilot-rules/export.md](figma-pilot-rules/export.md) - `figma.export()` - Export as PNG, SVG, PDF, JPG

### Common Patterns
- [figma-pilot-rules/patterns.md](figma-pilot-rules/patterns.md) - Cards, navigation bars, page layouts

### Reference
- [figma-pilot-rules/target-specifiers.md](figma-pilot-rules/target-specifiers.md) - How to target elements (ID, selection, name)

---