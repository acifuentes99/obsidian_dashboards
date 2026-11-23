# Glossary

Domain terms used across dashboards and shared `datacore`/`quickadd` code.
Created lazily, per `docs/agents/domain.md` — add a term here when naming a
deepened module or sharpening a fuzzy concept during a review.

## Resource tree

The nesting structure shown in the Resources dashboard's "List of resources,
and their subresources" section: a resource that links out to another
resource makes the target a **sub-resource**, nested underneath it. Built by
`datacore/utils/resourceTree.js`'s `buildResourceTree`.

## Root resource

A resource no other resource in the vault links to. Root resources are the
top-level entries in the resource tree; everything else is a sub-resource
nested under exactly one root (or under another sub-resource's parent).

## Category group

The grouping of root resources by their `category` frontmatter value, used
to section the resource tree (e.g. "Books", "Otros" for resources with no
category set). Only root resources are grouped — sub-resources are rendered
nested under their parent, not listed separately in a category group.

## Project status bucket

The single status an Area dashboard's "Projects" section
(`datacore/areaProjects.jsx`) sorts a project into — `active`, `coldtask`,
`backlog`, `archived`, or `done` — computed by
`datacore/utils/areaProjects.js`'s `categorizeProject`. Priority-ordered and
mutually exclusive (`done` beats `archived` beats `coldtask` beats
`backlog`), so a project with inconsistent frontmatter (e.g. an `#archive`
tag while `status: coldtask`) still lands in exactly one bucket. Distinct
from — and not yet shared with — Projects.md's own inline categorization,
which doesn't guarantee that exclusivity; see
`docs/dashboards/area-projects.md`.
