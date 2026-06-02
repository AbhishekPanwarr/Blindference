import { Server, ExternalLink, BookOpen, Terminal } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BecomeNodeBanner() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 md:p-12 text-center">
        <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-6">
          <Server className="w-8 h-8 text-zinc-400" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Become a Blindference Compute Node
        </h1>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto mb-8 leading-relaxed">
          Run confidential inference and earn BLIND rewards. Join the quorum network
          that powers private AI for the decentralized web.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/nodes"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            <Terminal className="w-4 h-4" />
            Node Setup Guide
          </Link>
          <a
            href="https://pypi.org/project/blindference-node/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            PyPI Package
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            { title: '1. Install', desc: 'pip install blindference-node' },
            { title: '2. Configure', desc: 'Set wallet key and ICL endpoint' },
            { title: '3. Earn', desc: 'Run inference, verify, get paid' },
          ].map((step) => (
            <div key={step.title} className="rounded-lg border border-zinc-800 bg-[#0a0a0b] p-4">
              <div className="text-xs font-medium text-zinc-500 mb-1">{step.title}</div>
              <div className="text-sm text-zinc-300 font-mono">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
