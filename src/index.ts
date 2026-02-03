#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// ============================================
// API KEY CONFIGURATION
// ============================================
// Default API key for PageSpeed Insights - works out of the box
// Users can override with PAGESPEED_API_KEY env var for higher quotas
const DEFAULT_API_KEY = "AIzaSyCy_h1_YPQUKGMvLusmCJDZ_q9uoBbYnuU";

function getApiKey(): string {
    // Priority: 1) Environment variable, 2) Default key
    return process.env.PAGESPEED_API_KEY || DEFAULT_API_KEY;
}

// ============================================
// SCHEMA DEFINITIONS
// ============================================

const UrlSchema = z.object({
    url: z.string().url()
});

const RunPageSpeedTestSchema = z.object({
    url: z.string().url(),
    strategy: z.enum(['mobile', 'desktop']).default('mobile'),
    category: z.array(z.enum([
        'accessibility',
        'best-practices',
        'performance',
        'pwa',
        'seo'
    ])).default(['performance']),
    locale: z.string().default('en'),
    apiKey: z.string().optional()
});

const TechnicalSeoAuditSchema = z.object({
    url: z.string().url()
});

const SitemapRobotsSchema = z.object({
    url: z.string().url()
});

const OnPageSeoSchema = z.object({
    url: z.string().url(),
    targetKeyword: z.string().optional()
});

const SecurityHeadersSchema = z.object({
    url: z.string().url()
});

const PerformanceAuditSchema = z.object({
    url: z.string().url(),
    strategy: z.enum(['mobile', 'desktop']).default('mobile')
});

const MobileAuditSchema = z.object({
    url: z.string().url()
});

// ============================================
// SERVER SETUP
// ============================================

const server = new Server({
    name: "seo-audit-server",
    version: "2.1.0",
}, {
    capabilities: {
        tools: {},
    },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchPage(url: string): Promise<{ html: string; response: any; headers: any }> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)'
        },
        redirect: 'follow'
    });

    const html = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });

    return { html, response, headers };
}

function getBaseUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
}

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================

// 1. PageSpeed Test (existing, with env var fix)
async function runPageSpeedTest(params: z.infer<typeof RunPageSpeedTestSchema>) {
    const { url, strategy, category, locale, apiKey: passedApiKey } = params;
    const apiKey = passedApiKey || getApiKey();

    const categoriesParam = category.join('&category=');
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=${categoriesParam}&locale=${locale}${apiKey ? `&key=${apiKey}` : ''}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`PageSpeed API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
}

// 2. Technical SEO Audit
async function runTechnicalSeoAudit(params: z.infer<typeof TechnicalSeoAuditSchema>) {
    const { url } = params;
    const { html, headers } = await fetchPage(url);
    const $ = cheerio.load(html);

    // Meta tags analysis
    const metaTags = {
        title: $('title').text() || null,
        titleLength: $('title').text()?.length || 0,
        metaDescription: $('meta[name="description"]').attr('content') || null,
        metaDescriptionLength: $('meta[name="description"]').attr('content')?.length || 0,
        metaKeywords: $('meta[name="keywords"]').attr('content') || null,
        metaRobots: $('meta[name="robots"]').attr('content') || null,
        metaViewport: $('meta[name="viewport"]').attr('content') || null,
        ogTitle: $('meta[property="og:title"]').attr('content') || null,
        ogDescription: $('meta[property="og:description"]').attr('content') || null,
        ogImage: $('meta[property="og:image"]').attr('content') || null,
        ogUrl: $('meta[property="og:url"]').attr('content') || null,
        ogType: $('meta[property="og:type"]').attr('content') || null,
        twitterCard: $('meta[name="twitter:card"]').attr('content') || null,
        twitterTitle: $('meta[name="twitter:title"]').attr('content') || null,
        twitterDescription: $('meta[name="twitter:description"]').attr('content') || null,
        twitterImage: $('meta[name="twitter:image"]').attr('content') || null,
    };

    // Canonical URL
    const canonical = $('link[rel="canonical"]').attr('href') || null;

    // Hreflang tags
    const hreflangTags: Array<{ lang: string; href: string }> = [];
    $('link[rel="alternate"][hreflang]').each((_, el) => {
        hreflangTags.push({
            lang: $(el).attr('hreflang') || '',
            href: $(el).attr('href') || ''
        });
    });

    // Structured data (JSON-LD)
    const structuredData: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const json = JSON.parse($(el).html() || '');
            structuredData.push(json);
        } catch (e) {
            structuredData.push({ error: 'Invalid JSON-LD', raw: $(el).html()?.substring(0, 200) });
        }
    });

    // Language
    const htmlLang = $('html').attr('lang') || null;

    // Charset
    const charset = $('meta[charset]').attr('charset') ||
                   $('meta[http-equiv="Content-Type"]').attr('content') || null;

    // Issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Title checks
    if (!metaTags.title) {
        issues.push('Missing title tag');
    } else if (metaTags.titleLength < 30) {
        recommendations.push(`Title is too short (${metaTags.titleLength} chars). Aim for 50-60 characters.`);
    } else if (metaTags.titleLength > 60) {
        recommendations.push(`Title is too long (${metaTags.titleLength} chars). Keep under 60 characters.`);
    }

    // Meta description checks
    if (!metaTags.metaDescription) {
        issues.push('Missing meta description');
    } else if (metaTags.metaDescriptionLength < 120) {
        recommendations.push(`Meta description is short (${metaTags.metaDescriptionLength} chars). Aim for 150-160 characters.`);
    } else if (metaTags.metaDescriptionLength > 160) {
        recommendations.push(`Meta description is too long (${metaTags.metaDescriptionLength} chars). Keep under 160 characters.`);
    }

    // Canonical check
    if (!canonical) {
        recommendations.push('Consider adding a canonical URL to prevent duplicate content issues.');
    }

    // Viewport check
    if (!metaTags.metaViewport) {
        issues.push('Missing viewport meta tag - site may not be mobile-friendly');
    }

    // Open Graph checks
    if (!metaTags.ogTitle || !metaTags.ogDescription || !metaTags.ogImage) {
        recommendations.push('Missing Open Graph tags - social sharing may not display properly.');
    }

    // Language check
    if (!htmlLang) {
        recommendations.push('Missing lang attribute on <html> tag. Important for accessibility and SEO.');
    }

    // Structured data check
    if (structuredData.length === 0) {
        recommendations.push('No structured data found. Consider adding JSON-LD schema markup.');
    }

    return {
        url,
        metaTags,
        canonical,
        hreflangTags,
        structuredData,
        htmlLang,
        charset,
        issues,
        recommendations,
        score: {
            total: 100 - (issues.length * 15) - (recommendations.length * 5),
            issuesCount: issues.length,
            recommendationsCount: recommendations.length
        }
    };
}

// 3. Sitemap & Robots.txt Validation
async function runSitemapRobotsAudit(params: z.infer<typeof SitemapRobotsSchema>) {
    const { url } = params;
    const baseUrl = getBaseUrl(url);

    const results: any = {
        url,
        robotsTxt: {
            exists: false,
            content: null,
            issues: [],
            sitemapReferences: []
        },
        sitemap: {
            exists: false,
            url: null,
            urlCount: 0,
            issues: [],
            sampleUrls: []
        }
    };

    // Check robots.txt
    try {
        const robotsUrl = `${baseUrl}/robots.txt`;
        const robotsResponse = await fetch(robotsUrl);

        if (robotsResponse.ok) {
            results.robotsTxt.exists = true;
            results.robotsTxt.content = await robotsResponse.text();

            // Parse robots.txt
            const lines = results.robotsTxt.content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim().toLowerCase();
                if (trimmed.startsWith('sitemap:')) {
                    results.robotsTxt.sitemapReferences.push(line.split(':').slice(1).join(':').trim());
                }
                if (trimmed === 'disallow: /') {
                    results.robotsTxt.issues.push('WARNING: Entire site is blocked from crawling (Disallow: /)');
                }
            }
        } else {
            results.robotsTxt.issues.push('robots.txt not found or not accessible');
        }
    } catch (error) {
        results.robotsTxt.issues.push(`Error fetching robots.txt: ${error}`);
    }

    // Check sitemap
    const sitemapUrls = [
        ...results.robotsTxt.sitemapReferences,
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap/sitemap.xml`
    ];

    for (const sitemapUrl of [...new Set(sitemapUrls)]) {
        try {
            const sitemapResponse = await fetch(sitemapUrl);

            if (sitemapResponse.ok) {
                results.sitemap.exists = true;
                results.sitemap.url = sitemapUrl;
                const sitemapContent = await sitemapResponse.text();

                // Parse sitemap
                const $ = cheerio.load(sitemapContent, { xmlMode: true });

                // Check if it's a sitemap index
                const sitemapIndex = $('sitemapindex sitemap loc');
                if (sitemapIndex.length > 0) {
                    results.sitemap.type = 'sitemap_index';
                    results.sitemap.childSitemaps = [];
                    sitemapIndex.each((_, el) => {
                        results.sitemap.childSitemaps.push($(el).text());
                    });
                    results.sitemap.urlCount = sitemapIndex.length;
                } else {
                    // Regular sitemap
                    results.sitemap.type = 'sitemap';
                    const urls = $('urlset url loc');
                    results.sitemap.urlCount = urls.length;
                    urls.slice(0, 5).each((_, el) => {
                        results.sitemap.sampleUrls.push($(el).text());
                    });
                }

                // Validation
                if (results.sitemap.urlCount === 0) {
                    results.sitemap.issues.push('Sitemap appears to be empty');
                }
                if (results.sitemap.urlCount > 50000) {
                    results.sitemap.issues.push('Sitemap exceeds 50,000 URL limit');
                }

                break; // Found a valid sitemap
            }
        } catch (error) {
            // Continue to next sitemap URL
        }
    }

    if (!results.sitemap.exists) {
        results.sitemap.issues.push('No sitemap found. Consider creating one for better indexing.');
    }

    return results;
}

// 4. On-Page SEO Analysis
async function runOnPageSeoAudit(params: z.infer<typeof OnPageSeoSchema>) {
    const { url, targetKeyword } = params;
    const { html } = await fetchPage(url);
    const $ = cheerio.load(html);

    // Remove script and style tags for content analysis
    $('script, style, noscript').remove();

    // Heading structure
    const headings: Record<string, string[]> = {
        h1: [],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: []
    };

    for (let i = 1; i <= 6; i++) {
        $(`h${i}`).each((_, el) => {
            const text = $(el).text().trim();
            if (text) headings[`h${i}`].push(text);
        });
    }

    // Content analysis
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

    // Links analysis
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const baseHost = new URL(url).host;

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        try {
            const linkUrl = new URL(href, url);
            if (linkUrl.host === baseHost) {
                internalLinks.push(href);
            } else if (linkUrl.protocol.startsWith('http')) {
                externalLinks.push(href);
            }
        } catch {
            // Invalid URL, skip
        }
    });

    // Images analysis
    const images: Array<{ src: string; alt: string | null; hasAlt: boolean }> = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        const alt = $(el).attr('alt');
        images.push({
            src: src.substring(0, 100),
            alt: alt || null,
            hasAlt: alt !== undefined && alt !== ''
        });
    });

    const imagesWithoutAlt = images.filter(img => !img.hasAlt).length;

    // Keyword analysis (if provided)
    let keywordAnalysis = null;
    if (targetKeyword) {
        const keyword = targetKeyword.toLowerCase();
        const titleText = $('title').text().toLowerCase();
        const metaDesc = ($('meta[name="description"]').attr('content') || '').toLowerCase();
        const h1Text = headings.h1.join(' ').toLowerCase();
        const bodyLower = bodyText.toLowerCase();

        // Count keyword occurrences
        const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const keywordCount = (bodyText.match(keywordRegex) || []).length;
        const keywordDensity = wordCount > 0 ? ((keywordCount / wordCount) * 100).toFixed(2) : '0';

        keywordAnalysis = {
            keyword: targetKeyword,
            inTitle: titleText.includes(keyword),
            inMetaDescription: metaDesc.includes(keyword),
            inH1: h1Text.includes(keyword),
            inFirst100Words: bodyLower.substring(0, bodyLower.split(/\s+/).slice(0, 100).join(' ').length).includes(keyword),
            totalOccurrences: keywordCount,
            density: `${keywordDensity}%`
        };
    }

    // Issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];

    // H1 checks
    if (headings.h1.length === 0) {
        issues.push('Missing H1 tag');
    } else if (headings.h1.length > 1) {
        recommendations.push(`Multiple H1 tags found (${headings.h1.length}). Consider using only one H1.`);
    }

    // Content length
    if (wordCount < 300) {
        recommendations.push(`Content is thin (${wordCount} words). Aim for at least 300 words for better SEO.`);
    }

    // Images
    if (imagesWithoutAlt > 0) {
        issues.push(`${imagesWithoutAlt} image(s) missing alt text`);
    }

    // Internal linking
    if (internalLinks.length < 3) {
        recommendations.push('Few internal links. Add more internal links for better site structure.');
    }

    // Keyword optimization
    if (keywordAnalysis) {
        if (!keywordAnalysis.inTitle) {
            recommendations.push(`Target keyword "${targetKeyword}" not found in title`);
        }
        if (!keywordAnalysis.inH1) {
            recommendations.push(`Target keyword "${targetKeyword}" not found in H1`);
        }
        if (!keywordAnalysis.inMetaDescription) {
            recommendations.push(`Target keyword "${targetKeyword}" not found in meta description`);
        }
    }

    return {
        url,
        headings: {
            h1: headings.h1,
            h2: headings.h2,
            h3: headings.h3.slice(0, 10),
            structure: `H1: ${headings.h1.length}, H2: ${headings.h2.length}, H3: ${headings.h3.length}, H4: ${headings.h4.length}`
        },
        content: {
            wordCount,
            readingTime: `${Math.ceil(wordCount / 200)} min`
        },
        links: {
            internal: internalLinks.length,
            external: externalLinks.length,
            sampleInternal: internalLinks.slice(0, 5),
            sampleExternal: externalLinks.slice(0, 5)
        },
        images: {
            total: images.length,
            withoutAlt: imagesWithoutAlt,
            altCoverage: images.length > 0 ? `${((1 - imagesWithoutAlt / images.length) * 100).toFixed(0)}%` : 'N/A'
        },
        keywordAnalysis,
        issues,
        recommendations
    };
}

// 5. Security & Headers Check
async function runSecurityHeadersAudit(params: z.infer<typeof SecurityHeadersSchema>) {
    const { url } = params;
    const { headers, response } = await fetchPage(url);

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';

    // Security headers to check
    const securityHeaders = {
        'strict-transport-security': {
            present: false,
            value: null as string | null,
            description: 'HSTS - Forces HTTPS connections'
        },
        'content-security-policy': {
            present: false,
            value: null as string | null,
            description: 'CSP - Prevents XSS attacks'
        },
        'x-content-type-options': {
            present: false,
            value: null as string | null,
            description: 'Prevents MIME type sniffing'
        },
        'x-frame-options': {
            present: false,
            value: null as string | null,
            description: 'Prevents clickjacking'
        },
        'x-xss-protection': {
            present: false,
            value: null as string | null,
            description: 'XSS filter (legacy)'
        },
        'referrer-policy': {
            present: false,
            value: null as string | null,
            description: 'Controls referrer information'
        },
        'permissions-policy': {
            present: false,
            value: null as string | null,
            description: 'Controls browser features'
        }
    };

    // Check each security header
    for (const [header, info] of Object.entries(securityHeaders)) {
        const value = headers[header];
        if (value) {
            info.present = true;
            info.value = value;
        }
    }

    // Issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!isHttps) {
        issues.push('Site is not using HTTPS - this is critical for security and SEO');
    }

    if (!securityHeaders['strict-transport-security'].present && isHttps) {
        recommendations.push('Add Strict-Transport-Security header to enforce HTTPS');
    }

    if (!securityHeaders['content-security-policy'].present) {
        recommendations.push('Add Content-Security-Policy header to prevent XSS attacks');
    }

    if (!securityHeaders['x-content-type-options'].present) {
        recommendations.push('Add X-Content-Type-Options: nosniff header');
    }

    if (!securityHeaders['x-frame-options'].present) {
        recommendations.push('Add X-Frame-Options header to prevent clickjacking');
    }

    // Calculate security score
    const headersPresent = Object.values(securityHeaders).filter(h => h.present).length;
    const totalHeaders = Object.keys(securityHeaders).length;
    const httpsScore = isHttps ? 30 : 0;
    const headersScore = (headersPresent / totalHeaders) * 70;

    return {
        url,
        https: {
            enabled: isHttps,
            protocol: parsedUrl.protocol
        },
        securityHeaders,
        allHeaders: headers,
        issues,
        recommendations,
        score: {
            total: Math.round(httpsScore + headersScore),
            httpsEnabled: isHttps,
            headersPresent,
            headersTotal: totalHeaders
        }
    };
}

// 6. Performance Audit Summary (simplified PageSpeed results)
async function runPerformanceAudit(params: z.infer<typeof PerformanceAuditSchema>) {
    const { url, strategy } = params;
    const apiKey = getApiKey();

    const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
    const categoriesParam = categories.join('&category=');
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=${categoriesParam}${apiKey ? `&key=${apiKey}` : ''}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`PageSpeed API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    const lighthouse = data.lighthouseResult;

    // Extract key metrics
    const metrics = {
        firstContentfulPaint: lighthouse?.audits?.['first-contentful-paint']?.displayValue || 'N/A',
        largestContentfulPaint: lighthouse?.audits?.['largest-contentful-paint']?.displayValue || 'N/A',
        totalBlockingTime: lighthouse?.audits?.['total-blocking-time']?.displayValue || 'N/A',
        cumulativeLayoutShift: lighthouse?.audits?.['cumulative-layout-shift']?.displayValue || 'N/A',
        speedIndex: lighthouse?.audits?.['speed-index']?.displayValue || 'N/A',
        timeToInteractive: lighthouse?.audits?.['interactive']?.displayValue || 'N/A'
    };

    // Extract scores
    const scores = {
        performance: Math.round((lighthouse?.categories?.performance?.score || 0) * 100),
        accessibility: Math.round((lighthouse?.categories?.accessibility?.score || 0) * 100),
        bestPractices: Math.round((lighthouse?.categories?.['best-practices']?.score || 0) * 100),
        seo: Math.round((lighthouse?.categories?.seo?.score || 0) * 100)
    };

    // Extract top opportunities
    const opportunities: Array<{ title: string; savings: string }> = [];
    const audits = lighthouse?.audits || {};

    for (const [key, audit] of Object.entries(audits) as [string, any][]) {
        if (audit?.details?.overallSavingsMs > 0) {
            opportunities.push({
                title: audit.title,
                savings: `${(audit.details.overallSavingsMs / 1000).toFixed(1)}s`
            });
        }
    }

    opportunities.sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings));

    // Issues based on scores
    const issues: string[] = [];
    if (scores.performance < 50) issues.push('Critical: Performance score is poor');
    if (scores.accessibility < 90) issues.push('Accessibility needs improvement');
    if (scores.seo < 90) issues.push('SEO score needs improvement');

    return {
        url,
        strategy,
        scores,
        coreWebVitals: metrics,
        topOpportunities: opportunities.slice(0, 5),
        issues,
        overallGrade: scores.performance >= 90 ? 'A' :
                      scores.performance >= 70 ? 'B' :
                      scores.performance >= 50 ? 'C' :
                      scores.performance >= 30 ? 'D' : 'F'
    };
}

// 7. Mobile-Friendliness Audit
async function runMobileAudit(params: z.infer<typeof MobileAuditSchema>) {
    const { url } = params;
    const apiKey = getApiKey();

    // Fetch page HTML for static checks
    const { html } = await fetchPage(url);
    const $ = cheerio.load(html);

    // Static mobile checks
    const viewport = $('meta[name="viewport"]').attr('content') || null;
    const hasViewport = !!viewport;
    const viewportHasWidthDevice = viewport?.includes('width=device-width') || false;
    const viewportHasInitialScale = viewport?.includes('initial-scale=1') || false;

    // Check for mobile-specific meta tags
    const appleMobileWebAppCapable = $('meta[name="apple-mobile-web-app-capable"]').attr('content') || null;
    const themeColor = $('meta[name="theme-color"]').attr('content') || null;
    const mobileOptimized = $('meta[name="MobileOptimized"]').attr('content') || null;
    const handheldFriendly = $('meta[name="HandheldFriendly"]').attr('content') || null;

    // Check for touch icons
    const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr('href') || null;
    const manifest = $('link[rel="manifest"]').attr('href') || null;

    // Check for responsive images
    const images = $('img');
    let responsiveImages = 0;
    let totalImages = images.length;
    images.each((_, el) => {
        const srcset = $(el).attr('srcset');
        const sizes = $(el).attr('sizes');
        const style = $(el).attr('style') || '';
        const hasMaxWidth = style.includes('max-width') || $(el).attr('class')?.includes('responsive');
        if (srcset || sizes || hasMaxWidth) {
            responsiveImages++;
        }
    });

    // Check for horizontal scroll issues (fixed width elements)
    const potentialOverflowElements: string[] = [];
    $('[style*="width"]').each((_, el) => {
        const style = $(el).attr('style') || '';
        const widthMatch = style.match(/width:\s*(\d+)px/);
        if (widthMatch && parseInt(widthMatch[1]) > 400) {
            potentialOverflowElements.push($(el).prop('tagName') || 'unknown');
        }
    });

    // Get mobile PageSpeed data for tap targets, font sizes, etc.
    let mobilePageSpeed: any = null;
    let tapTargets: any = null;
    let fontSizes: any = null;
    let contentWidth: any = null;

    try {
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=accessibility&category=seo${apiKey ? `&key=${apiKey}` : ''}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
            mobilePageSpeed = await response.json();
            const audits = mobilePageSpeed?.lighthouseResult?.audits || {};

            // Tap targets
            tapTargets = {
                score: audits['tap-targets']?.score,
                displayValue: audits['tap-targets']?.displayValue || 'N/A',
                description: audits['tap-targets']?.description || '',
                failures: audits['tap-targets']?.details?.items?.slice(0, 5).map((item: any) => ({
                    target: item.tapTarget?.snippet?.substring(0, 100),
                    size: item.size,
                    overlappingTarget: item.overlappingTarget?.snippet?.substring(0, 50)
                })) || []
            };

            // Font sizes
            fontSizes = {
                score: audits['font-size']?.score,
                displayValue: audits['font-size']?.displayValue || 'N/A',
                description: audits['font-size']?.description || ''
            };

            // Content width
            contentWidth = {
                score: audits['content-width']?.score,
                description: audits['content-width']?.description || ''
            };
        }
    } catch (error) {
        // PageSpeed API failed, continue with static checks only
    }

    // Build issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Viewport issues
    if (!hasViewport) {
        issues.push('CRITICAL: Missing viewport meta tag - page will not render correctly on mobile');
    } else {
        if (!viewportHasWidthDevice) {
            issues.push('Viewport missing width=device-width');
        }
        if (!viewportHasInitialScale) {
            recommendations.push('Consider adding initial-scale=1 to viewport meta tag');
        }
    }

    // Tap targets
    if (tapTargets?.score !== null && tapTargets.score < 1) {
        issues.push(`Tap targets too small: ${tapTargets.displayValue}`);
    }

    // Font sizes
    if (fontSizes?.score !== null && fontSizes.score < 1) {
        issues.push(`Font sizes too small for mobile: ${fontSizes.displayValue}`);
    }

    // Content width
    if (contentWidth?.score !== null && contentWidth.score < 1) {
        issues.push('Content wider than screen - causes horizontal scrolling');
    }

    // Responsive images
    if (totalImages > 0 && responsiveImages / totalImages < 0.5) {
        recommendations.push(`Only ${Math.round((responsiveImages / totalImages) * 100)}% of images use responsive techniques (srcset/sizes)`);
    }

    // PWA recommendations
    if (!manifest) {
        recommendations.push('No web app manifest found - consider adding for PWA support');
    }
    if (!themeColor) {
        recommendations.push('No theme-color meta tag - browser UI won\'t match your brand on mobile');
    }
    if (!appleTouchIcon) {
        recommendations.push('No Apple touch icon - iOS home screen icon will be a screenshot');
    }

    // Calculate score
    let score = 100;
    score -= issues.length * 20;
    score -= recommendations.length * 5;
    score = Math.max(0, score);

    return {
        url,
        viewport: {
            present: hasViewport,
            content: viewport,
            hasWidthDevice: viewportHasWidthDevice,
            hasInitialScale: viewportHasInitialScale
        },
        mobileMeta: {
            appleMobileWebAppCapable,
            themeColor,
            mobileOptimized,
            handheldFriendly,
            appleTouchIcon,
            manifest
        },
        responsiveImages: {
            total: totalImages,
            responsive: responsiveImages,
            percentage: totalImages > 0 ? `${Math.round((responsiveImages / totalImages) * 100)}%` : 'N/A'
        },
        tapTargets,
        fontSizes,
        contentWidth,
        potentialOverflowElements: potentialOverflowElements.slice(0, 5),
        issues,
        recommendations,
        score: {
            total: score,
            grade: score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : score >= 30 ? 'D' : 'F'
        }
    };
}

// ============================================
// TOOL HANDLERS
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "run_pagespeed_test",
                description: "Run a full PageSpeed Insights test on a URL. Returns detailed performance, accessibility, SEO, and best practices data.",
                inputSchema: zodToJsonSchema(RunPageSpeedTestSchema),
            },
            {
                name: "technical_seo_audit",
                description: "Audit technical SEO elements: meta tags, canonical URLs, hreflang, Open Graph, Twitter Cards, structured data (JSON-LD), and more.",
                inputSchema: zodToJsonSchema(TechnicalSeoAuditSchema),
            },
            {
                name: "sitemap_robots_audit",
                description: "Validate sitemap.xml and robots.txt files. Checks existence, format, URL count, and common issues.",
                inputSchema: zodToJsonSchema(SitemapRobotsSchema),
            },
            {
                name: "onpage_seo_audit",
                description: "Analyze on-page SEO factors: heading structure, content length, internal/external links, images alt text, and optional keyword optimization analysis.",
                inputSchema: zodToJsonSchema(OnPageSeoSchema),
            },
            {
                name: "security_headers_audit",
                description: "Check HTTPS status and security headers (HSTS, CSP, X-Frame-Options, etc.). Important for both security and SEO.",
                inputSchema: zodToJsonSchema(SecurityHeadersSchema),
            },
            {
                name: "performance_audit",
                description: "Get a summarized performance audit with Core Web Vitals, scores for performance/accessibility/SEO, and top optimization opportunities.",
                inputSchema: zodToJsonSchema(PerformanceAuditSchema),
            },
            {
                name: "mobile_audit",
                description: "Comprehensive mobile-friendliness audit: viewport configuration, tap target sizes, font sizes, content width, responsive images, PWA readiness, and mobile-specific meta tags.",
                inputSchema: zodToJsonSchema(MobileAuditSchema),
            }
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        let result: any;

        switch (name) {
            case "run_pagespeed_test": {
                const parsed = RunPageSpeedTestSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runPageSpeedTest(parsed.data);
                break;
            }
            case "technical_seo_audit": {
                const parsed = TechnicalSeoAuditSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runTechnicalSeoAudit(parsed.data);
                break;
            }
            case "sitemap_robots_audit": {
                const parsed = SitemapRobotsSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runSitemapRobotsAudit(parsed.data);
                break;
            }
            case "onpage_seo_audit": {
                const parsed = OnPageSeoSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runOnPageSeoAudit(parsed.data);
                break;
            }
            case "security_headers_audit": {
                const parsed = SecurityHeadersSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runSecurityHeadersAudit(parsed.data);
                break;
            }
            case "performance_audit": {
                const parsed = PerformanceAuditSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runPerformanceAudit(parsed.data);
                break;
            }
            case "mobile_audit": {
                const parsed = MobileAuditSchema.safeParse(args);
                if (!parsed.success) throw new Error(`Invalid arguments: ${parsed.error}`);
                result = await runMobileAudit(parsed.data);
                break;
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result, null, 2)
            }],
            isError: false,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
    }
});

// ============================================
// START SERVER
// ============================================

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SEO Audit Server v2.0 running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
