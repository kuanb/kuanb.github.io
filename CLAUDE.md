# CLAUDE.md

## Project Overview

Personal technical blog for Kuan Butts, hosted on GitHub Pages at kuanbutts.com.

## Tech Stack

- **Static site generator**: Jekyll (v3+)
- **Markdown processor**: Kramdown
- **Styling**: SCSS/Sass (Pixyll-inspired theme with Basscss)
- **Hosting**: GitHub Pages (auto-builds on push to `master`)
- **Domain**: kuanbutts.com (configured via CNAME)

## Key Directories

- `_posts/` - Blog posts in `YYYY-MM-DD-slug.md` format
- `_layouts/` - Templates: `default.html`, `post.html`, `page.html`
- `_includes/` - Partials (header, footer, navigation, etc.)
- `_sass/` - Sass source files
- `images/` - Post images and assets
- `_site/` - Generated output (gitignored)

## Blog Post Frontmatter

```yaml
---
layout: post
title: "Post Title"
date: YYYY-MM-DD HH:MM:SS
summary: "Brief summary"
published: true
comments: true
categories: [category1, category2]
---
```

## Common Tasks

- **Local preview**: `jekyll serve` (builds and serves at localhost:4000)
- **Build only**: `jekyll build`
- **Deploy**: Push to `master` branch; GitHub Pages builds automatically

## Conventions

- Permalink style: `pretty` (e.g., `/2025/12/25/post-title/`)
- Pagination: 8 posts per page at `/blog/`
- Images referenced from `/images/` directory
- No CI/CD workflows; relies on GitHub Pages native Jekyll build
- Apps panel (`_includes/apps_panel.html`): entries must be kept in alphabetical order by app name
