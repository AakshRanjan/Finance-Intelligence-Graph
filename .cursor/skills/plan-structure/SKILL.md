---
name: plan-structure
description: Instructs the agent to structure every generated plan with five sections (Introduction, Requirement, HLD, LLD, Tasks) and include diagrams in HLD and LLD. Use when creating or updating a plan, calling CreatePlan, or when the user asks for a plan, HLD, LLD, or implementation design.
---

# Plan Structure

Whenever a plan is generated, it should have 5 sections. Introduction, Requirement, HLD, LLD, and Tasks. The HLD/LLD should have diagrams to help explain the algorithm/structure.

## Sections

### Introduction

Problem, context, and what the plan will accomplish.

### Requirement

Constraints, inputs/outputs, and success criteria.

### HLD

Component and structure overview. Include a mermaid diagram of architecture or data flow.

### LLD

File, function, and algorithm detail. Include a mermaid diagram of sequence, class, or algorithm flow.

### Tasks

Ordered, actionable implementation steps.

## Diagrams

Use mermaid in HLD and LLD. Follow Cursor plan rendering rules:

- No spaces in node IDs (`UserService`, `user_service`)
- Quote edge labels that contain special characters: `A -->|"O(1) lookup"| B`
- Quote node labels that contain parentheses, commas, or colons: `A["Process (main)"]`
- Avoid reserved keywords as node IDs (`end`, `subgraph`, `graph`, `flowchart`)
- Subgraphs: `subgraph auth [Authentication Flow]`
- Do not use colors, classDef, or click events
