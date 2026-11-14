# Connector routing and arranging: owner decisions

Design: `design-docs/specs/design-connector-routing-arranging.md`. Questions are open
unless marked otherwise. The design implements each default. A different answer changes
only the section named.

## Q1. Self-loop side order (R5) - open, default kept

- Default: `top`, `right`, `bottom`, `left`, as listed in the request. This replaces the
  earlier `right`, `top`, `bottom`, `left`, so a self-loop on an element with no other
  ends moves from the right side to the top.
- Alternative: keep the earlier order. It is also a documented order, and it avoids
  changing self-loops on otherwise unused elements.

## Q2. Routing stored under `visual` (R2) - open, default kept

- Default: the resolver reads `routing` and `routingAvoidObstacles` from `semantic`, then
  `visual`, then `visual.extensions`, so existing documents draw as authored. The unknown
  visual key warning stays.
- Alternative: migrate those keys to `semantic` when a document loads. This removes the
  fallback but rewrites existing documents on save.

## Q3. Default routing of `connect` with no default and no convention (R1) - open, default kept

- Default: it stays straight, because existing defaults do not change. An architecture
  connect crosses a box between its ends unless routing is given by a field, a page default
  or a convention.
- Alternative: make connect orthogonal and obstacle-avoiding on architecture pages by
  default. This changes output for existing batches.

## Q4. Crossings above the input (R3) - open, default kept

- Default: `layered` keeps the lowest-crossing candidate of three orderings, even if it is
  still above the input on some page. The acceptance test measures the fixture.
- Alternative: refuse the layout, or keep the input order, when every candidate is worse.
  The columns would then not follow the layered ordering.
