# autofm

Automatic front matter generator for Markdown files.

This tool rewrites your Markdown. Review the config, enable backup if needed, and try it on a copy first.

## Install

```sh
npm install -g autofm
```

## Quick start

In the blog / docs repo you want to watch — not in this package repo:

```sh
autofm init-config --preset hexo
autofm --init
autofm
```

That writes `.autofm/config.json` next to `_posts`, fills missing front matter, then watches for new files.

```text
<your-blog>/
  .autofm/config.json
  _posts/
  _drafts/
```

Do not put `autofm-config.json` at the content root or in this package root. See [docs/config.md](./docs/config.md).

## Common commands

```sh
autofm --help
autofm --dir ./blog
autofm --init              # backfill existing files, then exit
autofm --force             # overwrite existing front matter
autofm --ct                # regenerate categories and tags only
autofm --config ./path/to/config.json
```

## Development

```sh
yarn install
yarn build
node ./dist/index.js --help
```

## Docs

- [Getting started](./docs/getting-started.md)
- [CLI](./docs/cli.md)
- [Config](./docs/config.md)
- [Templates](./docs/templates.md)
- [Architecture](./docs/architecture.md)

## License

GPL-3.0-only
