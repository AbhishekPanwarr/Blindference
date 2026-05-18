# Blindference Documentation

This is the official documentation site for Blindference, built with [Mintlify](https://mintlify.com/).

## Development

### Prerequisites

- Node.js 18–20 (LTS required — Mintlify does not support Node 21+)
- npm or yarn

### Install Mintlify CLI

```bash
npm install -g mintlify
```

### Start Dev Server

```bash
cd blindference/docs
mintlify dev
```

The site will be available at `http://localhost:3000`.

> **Note**: Mintlify requires an LTS Node version (18.x or 20.x). If you have Node 21+, use nvm to switch:
> ```bash
> nvm install 20
> nvm use 20
> npm install -g mintlify
> mintlify dev
> ```

## Deployment

Mintlify docs are deployed through the [Mintlify dashboard](https://dashboard.mintlify.com) by connecting your GitHub repository.

### Steps

1. **Push this `docs/` folder to a GitHub repository**

```bash
git add docs/
git commit -m "Add Mintlify documentation"
git push origin main
```

2. **Connect to Mintlify**
   - Go to [dashboard.mintlify.com](https://dashboard.mintlify.com)
   - Sign up / log in
   - Click "Add Project"
   - Select your GitHub repository
   - Set **docs directory** as the root (or `blindference/docs/` if docs are in a subdirectory)
   - Deploy

3. **Configure custom domain** (optional)
   - In Mintlify dashboard → Settings → Domain
   - Add `docs.blindference.xyz`
   - Follow DNS instructions (CNAME to Mintlify)

### Alternative: Self-Hosted

If you prefer not to use Mintlify's hosted platform, you can convert the MDX files to a static site using [Docusaurus](https://docusaurus.io/) or [VitePress](https://vitepress.dev/):

```bash
# Example with VitePress
cd docs
npm install -g vitepress
# Move mint.json content to VitePress config.ts
# Build
vitepress build
# Deploy dist/ to Vercel/Netlify
```

## Structure

```
docs/
├── mint.json                 # Navigation and theme config
├── introduction.mdx          # Landing page
├── what-is-blindference.mdx  # Product overview
├── architecture.mdx          # System architecture
├── compute/                  # Node operator docs
│   ├── introduction.mdx
│   ├── quickstart.mdx
│   ├── installation.mdx
│   ├── configuration.mdx
│   ├── attestation.mdx
│   ├── running.mdx
│   ├── monitoring.mdx
│   ├── troubleshooting.mdx
│   └── rewards.mdx
├── build/                    # Agent developer docs
│   ├── introduction.mdx
│   ├── quickstart.mdx
│   ├── architecture.mdx
│   ├── cofhe-encryption.mdx
│   ├── icl-api.mdx
│   ├── contracts.mdx
│   ├── deployment.mdx
│   └── examples/
│       ├── risk-scoring.mdx
│       └── text-inference.mdx
├── api-reference/            # API documentation
│   └── icl-api.mdx
├── resources/                # Reference materials
│   ├── changelog.mdx
│   ├── contract-addresses.mdx
│   └── troubleshooting.mdx
├── logo/                     # Logo assets
│   ├── logo-dark.svg
│   └── logo-light.svg
└── favicon.svg               # Site favicon
```

## Writing Content

- Use `.mdx` files for Mintlify features (components, code blocks, etc.)
- Use standard Markdown for simple content
- See [Mintlify documentation](https://mintlify.com/docs) for component reference

## Theme

The docs use the Blindference dark theme:

- Primary color: `#ffffff` (white)
- Background: Dark mode by default
- Accent: `#a1a1aa` (zinc-400)

## Contributing

1. Edit files in this directory
2. Test locally with `mintlify dev` (Node 18/20 LTS)
3. Submit a PR to the main repo
4. Mintlify auto-deploys on merge to main

## License

MIT — same as the Blindference project.
