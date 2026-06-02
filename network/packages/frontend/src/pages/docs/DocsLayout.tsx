import React, { Suspense, lazy, useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MDXProvider } from '@mdx-js/react'
import Fuse from 'fuse.js'
import {
  BookOpen,
  Cpu,
  Code,
  FileText,
  HelpCircle,
  Search,
  ChevronRight,
  Menu,
  X,
  Hash,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { mdxComponents } from '../../components/docs'

// ─── Navigation Tree ───

export interface NavItem {
  id: string
  label: string
  path: string
  icon?: React.ElementType
  description?: string
  children?: NavItem[]
}

const navTree: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/docs',
    icon: BookOpen,
    description: 'Documentation home',
    children: [
      { id: 'intro', label: 'Introduction', path: '/docs/introduction', description: 'Welcome to Blindference' },
      { id: 'what-is', label: 'What is Blindference?', path: '/docs/what-is-blindference', description: 'The problem, solution, and why it matters' },
      { id: 'architecture', label: 'Architecture', path: '/docs/architecture', description: 'System-level component view' },
      { id: 'components', label: 'Components', path: '/docs/components', description: 'Available docs components' },
    ],
  },
  {
    id: 'compute',
    label: 'Compute',
    path: '/docs/compute',
    icon: Cpu,
    description: 'Node operator guides',
    children: [
      { id: 'c-intro', label: 'Introduction', path: '/docs/compute/introduction', description: 'Join the network as a compute provider' },
      { id: 'c-quickstart', label: 'Quickstart', path: '/docs/compute/quickstart', description: 'Get running in 5 minutes' },
      { id: 'c-install', label: 'Installation', path: '/docs/compute/installation', description: 'All install options' },
      { id: 'c-config', label: 'Configuration', path: '/docs/compute/configuration', description: 'Environment and settings' },
      { id: 'c-attest', label: 'Attestation', path: '/docs/compute/attestation', description: 'Prove your node identity' },
      { id: 'c-models', label: 'Models', path: '/docs/compute/models', description: 'Supported inference models' },
      { id: 'c-backends', label: 'Backends', path: '/docs/compute/backends', description: 'Pluggable backend system' },
      { id: 'c-running', label: 'Running', path: '/docs/compute/running', description: 'Start the daemon' },
      { id: 'c-monitor', label: 'Monitoring', path: '/docs/compute/monitoring', description: 'Track health and earnings' },
      { id: 'c-trouble', label: 'Troubleshooting', path: '/docs/compute/troubleshooting', description: 'Common node issues' },
      { id: 'c-rewards', label: 'Rewards', path: '/docs/compute/rewards', description: 'Earnings and slashing' },
    ],
  },
  {
    id: 'build',
    label: 'Build',
    path: '/docs/build',
    icon: Code,
    description: 'Agent developer docs',
    children: [
      { id: 'b-intro', label: 'Introduction', path: '/docs/build/introduction', description: 'Build on Blindference' },
      { id: 'b-quickstart', label: 'Quickstart', path: '/docs/build/quickstart', description: 'Build your first agent' },
      { id: 'b-arch', label: 'Architecture', path: '/docs/build/architecture', description: 'Builder architecture' },
      { id: 'b-cofhe', label: 'CoFHE Encryption', path: '/docs/build/cofhe-encryption', description: 'How to encrypt data' },
      { id: 'b-contracts', label: 'Contracts', path: '/docs/build/contracts', description: 'Smart contract reference' },
      { id: 'b-deploy', label: 'Deployment', path: '/docs/build/deployment', description: 'Deploy your application' },
      { id: 'b-risk', label: 'Risk Scoring', path: '/docs/build/examples/risk-scoring', description: 'Example: privacy-preserving risk evaluation' },
      { id: 'b-text', label: 'Text Inference', path: '/docs/build/examples/text-inference', description: 'Example: confidential AI assistant' },
    ],
  },
  {
    id: 'api',
    label: 'API Reference',
    path: '/docs/api-reference',
    icon: FileText,
    description: 'REST API docs',
    children: [
      { id: 'api-intro', label: 'Introduction', path: '/docs/api-reference/introduction', description: 'API overview' },
      { id: 'api-icl', label: 'ICL API', path: '/docs/api-reference/icl-api', description: 'Full endpoint reference' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    path: '/docs/resources',
    icon: HelpCircle,
    description: 'Changelog, addresses, support',
    children: [
      { id: 'r-changelog', label: 'Changelog', path: '/docs/resources/changelog', description: 'Release history' },
      { id: 'r-addresses', label: 'Contract Addresses', path: '/docs/resources/contract-addresses', description: 'Arbitrum Sepolia deployments' },
      { id: 'r-faq', label: 'FAQ', path: '/docs/resources/faq', description: 'Frequently asked questions' },
      { id: 'r-trouble', label: 'Troubleshooting', path: '/docs/resources/troubleshooting', description: 'Common issues' },
    ],
  },
]

// Flatten for search
const allPages: { title: string; path: string; description: string; section: string }[] = []
navTree.forEach((section) => {
  section.children?.forEach((page) => {
    allPages.push({
      title: page.label,
      path: page.path,
      description: page.description || '',
      section: section.label,
    })
  })
})

// ─── MDX Module Map ───

const mdxFiles = import.meta.glob('./content/**/*.mdx') as Record<string, () => Promise<any>>

const mdxModules: Record<string, () => Promise<any>> = {
  '/docs/introduction': mdxFiles['./content/introduction.mdx'],
  '/docs/what-is-blindference': mdxFiles['./content/what-is-blindference.mdx'],
  '/docs/architecture': mdxFiles['./content/architecture.mdx'],
  '/docs/components': mdxFiles['./content/components.mdx'],
  '/docs/compute/introduction': mdxFiles['./content/compute/introduction.mdx'],
  '/docs/compute/quickstart': mdxFiles['./content/compute/quickstart.mdx'],
  '/docs/compute/installation': mdxFiles['./content/compute/installation.mdx'],
  '/docs/compute/configuration': mdxFiles['./content/compute/configuration.mdx'],
  '/docs/compute/attestation': mdxFiles['./content/compute/attestation.mdx'],
  '/docs/compute/models': mdxFiles['./content/compute/models.mdx'],
  '/docs/compute/backends': mdxFiles['./content/compute/backends.mdx'],
  '/docs/compute/running': mdxFiles['./content/compute/running.mdx'],
  '/docs/compute/monitoring': mdxFiles['./content/compute/monitoring.mdx'],
  '/docs/compute/troubleshooting': mdxFiles['./content/compute/troubleshooting.mdx'],
  '/docs/compute/rewards': mdxFiles['./content/compute/rewards.mdx'],
  '/docs/build/introduction': mdxFiles['./content/build/introduction.mdx'],
  '/docs/build/quickstart': mdxFiles['./content/build/quickstart.mdx'],
  '/docs/build/architecture': mdxFiles['./content/build/architecture.mdx'],
  '/docs/build/cofhe-encryption': mdxFiles['./content/build/cofhe-encryption.mdx'],
  '/docs/build/contracts': mdxFiles['./content/build/contracts.mdx'],
  '/docs/build/deployment': mdxFiles['./content/build/deployment.mdx'],
  '/docs/build/examples/risk-scoring': mdxFiles['./content/build/examples/risk-scoring.mdx'],
  '/docs/build/examples/text-inference': mdxFiles['./content/build/examples/text-inference.mdx'],
  '/docs/api-reference/introduction': mdxFiles['./content/api-reference/introduction.mdx'],
  '/docs/api-reference/icl-api': mdxFiles['./content/api-reference/icl-api.mdx'],
  '/docs/resources/changelog': mdxFiles['./content/resources/changelog.mdx'],
  '/docs/resources/contract-addresses': mdxFiles['./content/resources/contract-addresses.mdx'],
  '/docs/resources/faq': mdxFiles['./content/resources/faq.mdx'],
  '/docs/resources/troubleshooting': mdxFiles['./content/resources/troubleshooting.mdx'],
}

// ─── Search Component ───

function DocsSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<typeof allPages>([])
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const fuse = useRef(
    new Fuse(allPages, {
      keys: ['title', 'description', 'section'],
      threshold: 0.3,
    })
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim()) {
      setResults(fuse.current.search(query).map((r) => r.item))
    } else {
      setResults([])
    }
  }, [query])

  const handleSelect = (path: string) => {
    navigate(path)
    onClose()
  }

  return (
    <div className="w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documentation..."
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/30 transition-colors"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.path}
              onClick={() => handleSelect(r.path)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white group-hover:text-violet-300 transition-colors">{r.title}</span>
                <span className="text-[10px] text-white/30 uppercase">{r.section}</span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">{r.description}</p>
            </button>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <p className="text-sm text-white/30 mt-4 text-center">No results found</p>
      )}
    </div>
  )
}

// ─── Sidebar ───

function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const location = useLocation()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Auto-expand section containing current page
    const current = location.pathname
    const section = navTree.find((s) =>
      s.children?.some((c) => current === c.path || current.startsWith(c.path + '/'))
    )
    return new Set(section ? [section.id] : ['overview'])
  })

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className={cn("flex flex-col", mobile ? "p-4" : "py-6 px-4")}>
      <div className="flex items-center gap-2 mb-6 px-2">
        <BookOpen className="w-5 h-5 text-violet-400" />
        <span className="font-bold text-white text-sm tracking-wide">Documentation</span>
      </div>

      {navTree.map((section) => {
        const isExpanded = expandedSections.has(section.id)
        const hasActiveChild = section.children?.some((c) => isActive(c.path))
        const SectionIcon = section.icon || BookOpen

        return (
          <div key={section.id} className="mb-2">
            <button
              onClick={() => toggleSection(section.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                hasActiveChild ? "text-violet-300" : "text-white/50 hover:text-white/80"
              )}
            >
              <SectionIcon className="w-4 h-4" />
              <span>{section.label}</span>
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                className="ml-auto"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-white/[0.06] pl-3">
                    {section.children?.map((page) => (
                      <Link
                        key={page.id}
                        to={page.path}
                        onClick={mobile ? onClose : undefined}
                        className={cn(
                          "block px-3 py-1.5 rounded-lg text-sm transition-colors",
                          isActive(page.path)
                            ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                            : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                        )}
                      >
                        {page.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </nav>
  )
}

// ─── Breadcrumbs ───

function Breadcrumbs() {
  const location = useLocation()
  const parts = location.pathname.replace('/docs', '').split('/').filter(Boolean)

  if (parts.length === 0) return null

  return (
    <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
      <Link to="/docs" className="hover:text-white/60 transition-colors">Docs</Link>
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1
        const path = '/docs/' + parts.slice(0, i + 1).join('/')
        const label = part.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

        return (
          <React.Fragment key={i}>
            <ChevronRight className="w-3 h-3" />
            {isLast ? (
              <span className="text-white/50">{label}</span>
            ) : (
              <Link to={path} className="hover:text-white/60 transition-colors">{label}</Link>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Table of Contents ───

function TableOfContents() {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([])
  const [activeId, setActiveId] = useState('')
  const location = useLocation()

  useEffect(() => {
    // Wait for content to render
    const timeout = setTimeout(() => {
      const content = document.getElementById('docs-content')
      if (!content) return
      const h2s = content.querySelectorAll('h2')
      const items = Array.from(h2s).map((h) => {
        const id = h.id || h.textContent?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || ''
        if (!h.id) h.id = id
        return { id, text: h.textContent || '', level: 2 }
      })
      setHeadings(items)
    }, 500)

    return () => clearTimeout(timeout)
  }, [location.pathname])

  useEffect(() => {
    const handleScroll = () => {
      const content = document.getElementById('docs-content')
      if (!content) return
      const h2s = content.querySelectorAll('h2')
      let current = ''
      h2s.forEach((h) => {
        const rect = h.getBoundingClientRect()
        if (rect.top < 200) current = h.id
      })
      setActiveId(current)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  if (headings.length === 0) return null

  return (
    <div className="hidden xl:block w-64 shrink-0">
      <div className="sticky top-28">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Hash className="w-4 h-4 text-white/30" />
          <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">On this page</span>
        </div>
        <nav className="space-y-1">
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cn(
                "block px-3 py-1.5 text-sm rounded-lg transition-colors border-l-2",
                activeId === h.id
                  ? "text-violet-300 border-violet-500/40 bg-violet-500/5"
                  : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.03]"
              )}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}

// ─── MDX Page Loader ───

function MdxPage({ path }: { path: string }) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loader = mdxModules[path]
    if (!loader) {
      setError(true)
      setComponent(null)
      return
    }

    setError(false)
    setComponent(null)

    loader()
      .then((mod) => {
        setComponent(() => mod.default || mod)
      })
      .catch(() => {
        setError(true)
      })
  }, [path])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold text-white mb-2">Page not found</h2>
        <p className="text-white/40 text-sm mb-6">The documentation page you are looking for does not exist.</p>
        <Link
          to="/docs"
          className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to documentation
        </Link>
      </div>
    )
  }

  if (!Component) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <MDXProvider components={mdxComponents}>
      <div className="prose-docs">
        <Component />
      </div>
    </MDXProvider>
  )
}

// ─── Overview Page ───

function OverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Blindference Documentation</h1>
        <p className="text-white/50">
          Everything you need to build, run, and integrate with the Blindference protocol.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {navTree.filter((s) => s.id !== 'overview').map((section) => {
          const SectionIcon = section.icon || BookOpen
          return (
            <Link
              key={section.id}
              to={section.children?.[0]?.path || section.path}
              className="group block"
            >
              <div className="relative rounded-2xl bg-[rgba(10,10,10,0.6)] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 hover:border-white/[0.2] hover:shadow-[0_0_30px_rgba(249,115,22,0.1)] p-6 gradient-accent-top">
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 text-violet-400">
                    <SectionIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{section.label}</h3>
                  <p className="text-white/50 text-sm">{section.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-violet-400/60 group-hover:text-violet-400 transition-colors">
                    <span>{section.children?.length || 0} pages</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Layout ───

export default function DocsLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const currentPath = location.pathname
  const isOverview = currentPath === '/docs' || currentPath === '/docs/'

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [currentPath])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              <Menu className="w-5 h-5 text-white/60" />
            </button>
            <Link to="/docs" className="flex items-center gap-2.5 no-underline">
              <img
                src="/logos/bf-final-logo-2.png"
                alt="Blindference"
                className="h-7 w-auto object-contain"
                draggable={false}
              />
              <span className="font-semibold text-sm text-white hidden sm:block">Blindference Docs</span>
            </Link>
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search docs...</span>
            <span className="hidden md:inline text-xs text-white/20 ml-2">⌘K</span>
          </button>
        </div>
      </div>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-[#0a0a0a] border border-white/[0.12] rounded-2xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/30 uppercase tracking-wider">Search</span>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-1 rounded hover:bg-white/[0.05] transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
              <DocsSearch onClose={() => setSearchOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#0a0a0a] border-r border-white/[0.08] overflow-y-auto lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <span className="font-semibold text-sm text-white">Documentation</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
              <Sidebar mobile onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto flex gap-8 px-4">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto">
            <Sidebar />
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 py-8" id="docs-content">
          <Breadcrumbs />
          {isOverview ? (
            <OverviewPage />
          ) : (
            <MdxPage path={currentPath} />
          )}
        </main>

        {/* TOC */}
        <TableOfContents />
      </div>
    </div>
  )
}
