# PageSpeed MCP Server

A Model Context Protocol (MCP) server for PageSpeed & SEO audits. **Zero configuration required** - just install and use.

## Features

7 powerful SEO audit tools:

| Tool | Description |
|------|-------------|
| `run_pagespeed_test` | PageSpeed Insights summary: scores, Core Web Vitals (lab and field), top opportunities, failing audits |
| `technical_seo_audit` | Meta tags, canonical URLs, hreflang, Open Graph, Twitter Cards, JSON-LD structured data |
| `sitemap_robots_audit` | Validate sitemap.xml and robots.txt |
| `onpage_seo_audit` | Heading structure, word count, internal/external links, images, keyword analysis |
| `security_headers_audit` | HTTPS, HSTS, CSP, X-Frame-Options, and more |
| `performance_audit` | Core Web Vitals summary with optimization opportunities |
| `mobile_audit` | Mobile-friendliness: viewport, tap targets, font sizes, responsive images, PWA readiness |

## Quick Start

Add this to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["-y", "pagespeed-mcp-server"]
    }
  }
}
```

Restart Claude Desktop. That's it!

## Example Prompts

- "Run an SEO audit on https://example.com"
- "Check the Core Web Vitals for my website"
- "Is my site mobile-friendly?"
- "Analyze https://mysite.com/blog for the keyword 'seo tips'"
- "Check if my sitemap and robots.txt are configured correctly"

## Tools

### `run_pagespeed_test`
A compact summary of the PageSpeed Insights result, about 1,500 characters: category scores, lab Core Web Vitals, real-user field data for the page and origin, top opportunities with estimated savings, and failing audits per category. The raw Lighthouse response is about 700,000 characters, more than MCP clients accept in one reply, so it is no longer returned.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to test |
| `strategy` | string | `mobile` | `mobile` or `desktop` |
| `category` | array | `['performance']` | Any of: `performance`, `accessibility`, `best-practices`, `pwa`, `seo` |

### `technical_seo_audit`
Analyzes technical SEO elements.

**Checks:** Title tag, meta description, canonical URL, hreflang tags, Open Graph, Twitter Cards, JSON-LD structured data, viewport, language attribute.

### `sitemap_robots_audit`
Validates sitemap and robots.txt.

**Checks:** robots.txt existence/content, sitemap references, sitemap.xml format, URL count.

### `onpage_seo_audit`
Analyzes on-page SEO factors.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to analyze |
| `targetKeyword` | string | Optional keyword to check optimization |

**Checks:** Heading structure (H1-H6), word count, internal/external links, image alt text, keyword placement/density.

### `security_headers_audit`
Checks security headers.

**Checks:** HTTPS, Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.

### `performance_audit`
Summarized performance report.

**Returns:** Performance/Accessibility/SEO scores, Core Web Vitals (FCP, LCP, TBT, CLS), top optimization opportunities, overall grade (A-F).

### `mobile_audit`
Mobile-friendliness check.

**Checks:** Viewport configuration, tap target sizes, font sizes, content width, responsive images, PWA elements (manifest, theme-color, touch icons).

## Using Your Own API Key (Optional)

The server works out of the box with a built-in key that every user shares. If you hit its quota, the error tells you so. Add your own free key for your own quota.

Claude Code:

```bash
claude mcp add pagespeed -s user -e PAGESPEED_API_KEY=your_key -- npx -y pagespeed-mcp-server
```

Claude Desktop:

```json
{
  "mcpServers": {
    "pagespeed": {
      "command": "npx",
      "args": ["-y", "pagespeed-mcp-server"],
      "env": {
        "PAGESPEED_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Get a free API key from [Google's PageSpeed Insights guide](https://developers.google.com/speed/docs/insights/v5/get-started), or in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with the PageSpeed Insights API enabled.

## License

MIT

## About Me

I'm **Sofian Bettayeb**.

By day, I'm a martech consultant, working with billion-dollar brands like Rolex and Helsana. By night, I build tools like **AI SEO Copilot** (15k+ installs), **AEO Copilot**, and blueprints like **Webflow SEO Checklist** (1k+ downloads) to help my Webflow friends make money with SEO and AEO.

In between, I ride my bikes and play with my kids in Bern, Switzerland.

[GitHub](https://github.com/sofianbettayeb)
