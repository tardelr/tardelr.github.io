# Portfolio

Personal portfolio + blog built with [Jekyll 4](https://jekyllrb.com) and deployed to GitHub Pages via GitHub Actions.

## Where to edit things

| What | File |
| --- | --- |
| Name, description, URL, email (SEO / feed) | `_config.yml` |
| Home page content (about, experience, toolkit, contact) | `index.html` |
| Projects in "Selected work" | `PROJECTS` array at the top of `assets/js/site.js` |
| Styles / colors | `assets/css/main.css` |
| Post page layout | `_layouts/post.html` |

## Writing a post

Create `_posts/YYYY-MM-DD-some-slug.md`:

```md
---
title: My post title
description: One-line summary shown under the title and in link previews.
tags: [Design, Engineering]
---

Write Markdown here.
```

It shows up on the home page (latest 5), in `/writing/`, in the sidebar (latest 4) and in `/feed.xml`.
Optional front matter: `icon: "🌱"` (page icon), `last_modified_at: 2026-10-10`.

The post lists show `description` as a one-line summary under the title; without it, they use the first ~160 characters of the excerpt (the text above `<!--more-->`).

Writing helpers for long posts:

- **Math** (KaTeX, loaded only on posts that contain math): `$$…$$` on its own lines for display math, `$$…$$` inside a sentence for inline math. Don't write `\(…\)` in Markdown; kramdown strips the backslash.
- **Notes:** a `> blockquote` renders as a callout box.
- **Image captions:** put an emphasized line right under the image:
  ```md
  ![Alt text](/assets/img/figure.png)
  *Figure 1. Caption text.*
  ```
- **Citations:** `[[1]](#ref-1)` in the text, `<a id="ref-1"></a>[1] …` in the References list. A literal `|` in a reference must be escaped as `\|`, or GFM turns the line into a table.

If a code block contains `{{` or `{%`, wrap it in `{% raw %}` … `{% endraw %}` so Liquid leaves it alone.

## Running locally

macOS system Ruby (2.6) is too old for Jekyll 4. Install a current Ruby first:

```sh
brew install ruby
echo 'export PATH="/opt/homebrew/opt/ruby/bin:$PATH"' >> ~/.zshrc && exec zsh
```

Then:

```sh
bundle install
bundle exec jekyll serve --livereload
# open http://localhost:4000
```

## Deploying

1. Create a repo named `<your-username>.github.io` and push this folder to its `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Set `url` in `_config.yml` to `https://<your-username>.github.io`.

Every push to `main` builds and deploys via `.github/workflows/pages.yml`.
